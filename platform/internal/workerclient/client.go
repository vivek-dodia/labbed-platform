package workerclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client communicates with worker agents via HTTP.
type Client struct {
	httpClient *http.Client
}

// NewClient creates a new worker HTTP client.
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 10 * time.Minute, // Deployments can take a while
		},
	}
}

// DeployRequest is sent to a worker to deploy a lab.
type DeployRequest struct {
	LabID      string            `json:"labId"`
	ClabName   string            `json:"clabName"`
	Topology   string            `json:"topology"`   // YAML content
	BindFiles  map[string][]byte `json:"bindFiles"`  // filePath -> content
	CallbackURL string           `json:"callbackUrl"` // Platform URL for status updates
}

// DestroyRequest is sent to a worker to destroy a lab.
type DestroyRequest struct {
	LabID       string `json:"labId"`
	ClabName    string `json:"clabName"`
	CallbackURL string `json:"callbackUrl"`
	CleanupOnly bool   `json:"cleanupOnly,omitempty"` // skip status callbacks, just remove containers
}

// InspectRequest is sent to a worker to inspect a lab.
type InspectRequest struct {
	ClabName string `json:"clabName"`
}

// NodeInfo is returned from worker inspection.
type NodeInfo struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	Image       string `json:"image"`
	ContainerID string `json:"containerId"`
	IPv4        string `json:"ipv4"`
	IPv6        string `json:"ipv6"`
	State       string `json:"state"`
}

// InspectResponse is the worker's response to an inspect call.
type InspectResponse struct {
	Nodes []NodeInfo `json:"nodes"`
}

// Deploy sends a deploy request to a worker.
func (c *Client) Deploy(ctx context.Context, workerAddr, workerSecret string, req DeployRequest) error {
	return c.post(ctx, workerAddr+"/api/v1/labs/deploy", workerSecret, req, nil)
}

// Destroy sends a destroy request to a worker.
func (c *Client) Destroy(ctx context.Context, workerAddr, workerSecret string, req DestroyRequest) error {
	return c.post(ctx, workerAddr+"/api/v1/labs/destroy", workerSecret, req, nil)
}

// Inspect sends an inspect request to a worker.
func (c *Client) Inspect(ctx context.Context, workerAddr, workerSecret string, req InspectRequest) (*InspectResponse, error) {
	var resp InspectResponse
	if err := c.post(ctx, workerAddr+"/api/v1/labs/inspect", workerSecret, req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ExecRequest is sent to a worker to execute a command in a container.
type ExecRequest struct {
	LabID    string `json:"labId"`
	NodeName string `json:"nodeName"`
	Command  string `json:"command"`
}

// ExecResponse is the worker's response to an exec call.
type ExecResponse struct {
	Output string `json:"output"`
}

// Exec sends a command execution request to a worker.
func (c *Client) Exec(ctx context.Context, workerAddr, workerSecret string, req ExecRequest) (*ExecResponse, error) {
	var resp ExecResponse
	if err := c.post(ctx, workerAddr+"/api/v1/labs/exec", workerSecret, req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// HealthCheck checks if a worker is reachable.
func (c *Client) HealthCheck(ctx context.Context, workerAddr string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, workerAddr+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("worker health check returned %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) post(ctx context.Context, url, secret string, body interface{}, result interface{}) error {
	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Worker-Secret", secret)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("worker request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("worker returned %d: %s", resp.StatusCode, string(body))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("failed to decode worker response: %w", err)
		}
	}

	return nil
}
