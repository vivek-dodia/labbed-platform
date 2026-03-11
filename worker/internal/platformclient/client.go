package platformclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/labbed/worker/internal/config"
)

// Client communicates with the platform API.
type Client struct {
	httpClient *http.Client
	baseURL    string
	secret     string
	workerID   string
	mu         sync.RWMutex
}

// NewClient creates a new platform client.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    config.AppConfig.PlatformURL,
		secret:     config.AppConfig.PlatformSecret,
	}
}

// SetWorkerID sets the worker ID after registration.
func (c *Client) SetWorkerID(id string) {
	c.mu.Lock()
	c.workerID = id
	c.mu.Unlock()
}

// GetWorkerID returns the current worker ID.
func (c *Client) GetWorkerID() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.workerID
}

// RegisterRequest is sent to the platform on startup.
type RegisterRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Secret  string `json:"secret"`
}

// RegisterResponse is returned from the platform.
type RegisterResponse struct {
	UUID   string `json:"uuid"`
	Secret string `json:"secret"`
}

// HeartbeatRequest is sent periodically.
type HeartbeatRequest struct {
	WorkerID   string `json:"workerId"`
	ActiveLabs int    `json:"activeLabs"`
}

// StatusUpdate pushes lab state to the platform.
type StatusUpdate struct {
	LabID        string  `json:"labUuid"`
	State        string  `json:"state"` // deploying, running, stopping, failed, stopped
	ErrorMessage *string `json:"errorMessage,omitempty"`
}

// NodeInfo describes a running container node.
type NodeInfo struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	Image       string `json:"image"`
	ContainerID string `json:"containerId"`
	IPv4        string `json:"ipv4"`
	IPv6        string `json:"ipv6"`
	State       string `json:"state"`
}

// NodeUpdate pushes node information to the platform.
type NodeUpdate struct {
	LabID string     `json:"labUuid"`
	Nodes []NodeInfo `json:"nodes"`
}

// Register registers this worker with the platform.
func (c *Client) Register(ctx context.Context, req RegisterRequest) (*RegisterResponse, error) {
	var resp RegisterResponse
	if err := c.post(ctx, "/api/internal/workers/register", req, &resp); err != nil {
		return nil, err
	}
	c.SetWorkerID(resp.UUID)
	return &resp, nil
}

// Heartbeat sends a heartbeat to the platform.
func (c *Client) Heartbeat(ctx context.Context, activeLabs int) error {
	req := HeartbeatRequest{
		WorkerID:   c.GetWorkerID(),
		ActiveLabs: activeLabs,
	}
	return c.post(ctx, "/api/internal/workers/heartbeat", req, nil)
}

// PushStatus sends a lab status update to the platform.
func (c *Client) PushStatus(ctx context.Context, update StatusUpdate) error {
	return c.post(ctx, "/api/internal/labs/status", update, nil)
}

// PushNodes sends node information to the platform.
func (c *Client) PushNodes(ctx context.Context, update NodeUpdate) error {
	return c.post(ctx, "/api/internal/labs/nodes", update, nil)
}

func (c *Client) post(ctx context.Context, path string, body interface{}, result interface{}) error {
	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Worker-Secret", c.secret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("platform returned %d: %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("decode error: %w", err)
		}
	}

	return nil
}
