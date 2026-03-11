package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/labbed/platform/internal/auth"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: restrict in production
	},
}

// Message types for the WebSocket protocol.
type MessageType string

const (
	MsgSubscribe   MessageType = "subscribe"
	MsgUnsubscribe MessageType = "unsubscribe"
	MsgLabState    MessageType = "lab:state"
	MsgLabLog      MessageType = "lab:log"
	MsgShellData   MessageType = "shell:data"
	MsgShellClose  MessageType = "shell:close"
	MsgStatus      MessageType = "status"
	MsgError       MessageType = "error"
)

// Message is the wire format for all WebSocket messages.
type Message struct {
	Type    MessageType     `json:"type"`
	Channel string          `json:"channel,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// Client represents a single WebSocket connection.
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID string
	subs   map[string]bool // subscribed channels
	mu     sync.Mutex
}

// ShellHandler is called when a shell:data message is received.
// It should execute the command and return the output.
type ShellHandler func(channel string, input string) (string, error)

// Hub manages all active WebSocket clients and channel subscriptions.
type Hub struct {
	clients      map[*Client]bool
	channels     map[string]map[*Client]bool // channel -> set of clients
	register     chan *Client
	unregister   chan *Client
	broadcast    chan *channelMessage
	mu           sync.RWMutex
	shellHandler ShellHandler
}

type channelMessage struct {
	channel string
	data    []byte
}

// NewHub creates a new WebSocket hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		channels:   make(map[string]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *channelMessage, 256),
	}
}

// SetShellHandler registers a handler for shell exec requests.
func (h *Hub) SetShellHandler(handler ShellHandler) {
	h.shellHandler = handler
}

// Run starts the hub's event loop. Call this in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				// Remove from all channels
				for ch := range client.subs {
					if subscribers, ok := h.channels[ch]; ok {
						delete(subscribers, client)
						if len(subscribers) == 0 {
							delete(h.channels, ch)
						}
					}
				}
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			if subscribers, ok := h.channels[msg.channel]; ok {
				for client := range subscribers {
					select {
					case client.send <- msg.data:
					default:
						// Client buffer full, disconnect
						go func(c *Client) {
							h.unregister <- c
						}(client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastToChannel sends a message to all clients subscribed to a channel.
func (h *Hub) BroadcastToChannel(channel string, msgType MessageType, data interface{}) {
	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("ws: failed to marshal broadcast data: %v", err)
		return
	}

	msg := Message{
		Type:    msgType,
		Channel: channel,
		Data:    payload,
	}
	encoded, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.broadcast <- &channelMessage{
		channel: channel,
		data:    encoded,
	}
}

// BroadcastToAll sends a message to all connected clients.
func (h *Hub) BroadcastToAll(msgType MessageType, data interface{}) {
	payload, err := json.Marshal(data)
	if err != nil {
		return
	}

	msg := Message{
		Type: msgType,
		Data: payload,
	}
	encoded, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	for client := range h.clients {
		select {
		case client.send <- encoded:
		default:
		}
	}
	h.mu.RUnlock()
}

// HandleWebSocket is the Gin handler for upgrading HTTP to WebSocket.
func (h *Hub) HandleWebSocket(c *gin.Context) {
	// Authenticate via query param token (WebSocket can't send headers easily)
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token query parameter required"})
		return
	}

	claims, err := auth.ValidateToken(token, auth.AccessToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("ws: upgrade failed: %v", err)
		return
	}

	client := &Client{
		hub:    h,
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: claims.UserID,
		subs:   make(map[string]bool),
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case MsgSubscribe:
			c.subscribe(msg.Channel)
		case MsgUnsubscribe:
			c.unsubscribe(msg.Channel)
		case MsgShellData:
			// Extract input and execute via shell handler
			if c.hub.shellHandler != nil {
				var shellData struct {
					Input string `json:"input"`
				}
				if err := json.Unmarshal(msg.Data, &shellData); err == nil && shellData.Input != "" {
					go func(ch, input string) {
						output, err := c.hub.shellHandler(ch, input)
						if err != nil {
							output = "Error: " + err.Error() + "\n"
						}
						if output != "" {
							c.hub.BroadcastToChannel(ch, MsgShellData, map[string]string{"output": output})
						}
					}(msg.Channel, shellData.Input)
				}
			}
		}
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()

	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			break
		}
	}
}

func (c *Client) subscribe(channel string) {
	if channel == "" {
		return
	}
	// Validate channel format: lab:{uuid}, lab:{uuid}:logs, shell:{id}
	if !isValidChannel(channel) {
		return
	}

	c.mu.Lock()
	c.subs[channel] = true
	c.mu.Unlock()

	c.hub.mu.Lock()
	if c.hub.channels[channel] == nil {
		c.hub.channels[channel] = make(map[*Client]bool)
	}
	c.hub.channels[channel][c] = true
	c.hub.mu.Unlock()
}

func (c *Client) unsubscribe(channel string) {
	c.mu.Lock()
	delete(c.subs, channel)
	c.mu.Unlock()

	c.hub.mu.Lock()
	if subscribers, ok := c.hub.channels[channel]; ok {
		delete(subscribers, c)
		if len(subscribers) == 0 {
			delete(c.hub.channels, channel)
		}
	}
	c.hub.mu.Unlock()
}

func isValidChannel(ch string) bool {
	// Allow: lab:{uuid}, lab:{uuid}:logs, lab:{uuid}:nodes, shell:{id}, status
	parts := strings.Split(ch, ":")
	if len(parts) < 1 || len(parts) > 3 {
		return false
	}
	switch parts[0] {
	case "lab", "shell", "status":
		return true
	default:
		return false
	}
}
