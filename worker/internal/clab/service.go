// Package clab wraps the containerlab Go library for deploy/destroy/inspect operations.
// Modeled on github.com/srl-labs/clab-api-server/internal/clab/service.go
package clab

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	clabcore "github.com/srl-labs/containerlab/core"
	clabruntime "github.com/srl-labs/containerlab/runtime"

	"github.com/labbed/worker/internal/config"
)

const (
	defaultTimeout = 10 * time.Minute
)

// Service provides containerlab operations via the library.
type Service struct{}

// NewService creates a new containerlab service.
func NewService() *Service {
	return &Service{}
}

// NodeInfo describes a container node returned from inspect.
type NodeInfo struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	Image       string `json:"image"`
	ContainerID string `json:"containerId"`
	IPv4        string `json:"ipv4"`
	IPv6        string `json:"ipv6"`
	State       string `json:"state"`
}

// DeployOptions for deploying a lab.
type DeployOptions struct {
	TopoPath string
	LabOwner string // label for ownership tracking
}

// DestroyOptions for destroying a lab.
type DestroyOptions struct {
	TopoPath string
	LabName  string
	Cleanup  bool
	Graceful bool
}

// PrepareTopologyFile writes topology YAML and bind files to disk.
// Returns the path to the topology file.
func PrepareTopologyFile(labID, topoYAML string, bindFiles map[string][]byte) (string, error) {
	labDir := filepath.Join(config.AppConfig.WorkDir, labID)
	if err := os.MkdirAll(labDir, 0750); err != nil {
		return "", fmt.Errorf("failed to create lab directory: %w", err)
	}

	topoPath := filepath.Join(labDir, "topology.clab.yml")
	if err := os.WriteFile(topoPath, []byte(topoYAML), 0640); err != nil {
		return "", fmt.Errorf("failed to write topology file: %w", err)
	}

	// Write bind files
	for filePath, content := range bindFiles {
		fullPath := filepath.Join(labDir, filePath)
		dir := filepath.Dir(fullPath)
		if err := os.MkdirAll(dir, 0750); err != nil {
			return "", fmt.Errorf("failed to create bind file directory: %w", err)
		}
		if err := os.WriteFile(fullPath, content, 0640); err != nil {
			return "", fmt.Errorf("failed to write bind file %s: %w", filePath, err)
		}
	}

	return topoPath, nil
}

// GetTopologyFilePath returns the path to the topology file if it exists on disk.
func GetTopologyFilePath(labID string) string {
	p := filepath.Join(config.AppConfig.WorkDir, labID, "topology.clab.yml")
	if _, err := os.Stat(p); err == nil {
		return p
	}
	return ""
}

// CleanupTopologyFiles removes the lab directory from disk.
func CleanupTopologyFiles(labID string) {
	labDir := filepath.Join(config.AppConfig.WorkDir, labID)
	if err := os.RemoveAll(labDir); err != nil {
		log.Printf("failed to cleanup lab directory %s: %v", labDir, err)
	}
}

// Exec runs a command inside a container using docker exec.
func (s *Service) Exec(ctx context.Context, containerName, command string) (string, error) {
	// Find docker binary
	dockerBin, err := exec.LookPath("docker")
	if err != nil {
		// Fallback to common locations
		for _, p := range []string{"/usr/bin/docker", "/usr/local/bin/docker"} {
			if _, ferr := os.Stat(p); ferr == nil {
				dockerBin = p
				break
			}
		}
		if dockerBin == "" {
			return "", fmt.Errorf("docker binary not found: %w", err)
		}
	}

	// Build args: always use sh -c for consistent behavior
	args := []string{"exec", containerName, "sh", "-c", command}

	cmd := exec.CommandContext(ctx, dockerBin, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	output := stdout.String()
	if stderr.Len() > 0 {
		if output != "" {
			output += "\n"
		}
		output += stderr.String()
	}

	if err != nil {
		// Include output even on error (e.g., command not found)
		if output != "" {
			return output, nil
		}
		return "", fmt.Errorf("exec failed: %w", err)
	}

	return output, nil
}

// Deploy deploys a lab using the containerlab library.
// After clab.Deploy returns (or times out waiting for post-deploy steps),
// we use Inspect to gather actual container info since Deploy can block
// on health checks / management IP assignment.
func (s *Service) Deploy(ctx context.Context, opts DeployOptions) ([]NodeInfo, error) {
	deployTimeout := 5 * time.Minute
	deployCtx, deployCancel := context.WithTimeout(ctx, deployTimeout)
	defer deployCancel()

	// Change to the topology directory for relative path resolution
	topoDir := filepath.Dir(opts.TopoPath)
	originalDir, _ := os.Getwd()
	if err := os.Chdir(topoDir); err != nil {
		return nil, fmt.Errorf("failed to change to topology directory: %w", err)
	}
	defer os.Chdir(originalDir)

	// Build containerlab options
	clabOpts := []clabcore.ClabOption{
		clabcore.WithTimeout(deployTimeout),
		clabcore.WithTopoPath(opts.TopoPath, ""),
		clabcore.WithRuntime(config.AppConfig.ClabRuntime, &clabruntime.RuntimeConfig{
			Timeout: deployTimeout,
		}),
	}

	if opts.LabOwner != "" {
		clabOpts = append(clabOpts, clabcore.WithLabOwner(opts.LabOwner))
	}

	// Create containerlab instance
	clab, err := clabcore.NewContainerLab(clabOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create containerlab instance: %w", err)
	}

	// Deploy with reconfigure to handle stale containers
	deployOpts, err := clabcore.NewDeployOptions(0)
	if err != nil {
		return nil, fmt.Errorf("failed to create deploy options: %w", err)
	}
	deployOpts.SetReconfigure(true)

	// Run deploy in a goroutine — it can block on post-deploy steps
	type deployResult struct {
		err error
	}
	ch := make(chan deployResult, 1)
	go func() {
		_, deployErr := clab.Deploy(deployCtx, deployOpts)
		ch <- deployResult{err: deployErr}
	}()

	// Wait for deploy or a shorter timeout for the container creation phase
	// Containers are typically created within 1-2 minutes; the blocking happens
	// in post-deploy (health checks, mgmt IP). We give it the full timeout but
	// will also check periodically if containers are up.
	containerWait := 90 * time.Second
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	timer := time.NewTimer(containerWait)
	defer timer.Stop()

	// Extract lab name from topology for inspect
	labName := ""
	if clab.Config != nil && clab.Config.Name != "" {
		labName = clab.Config.Name
	}

	for {
		select {
		case result := <-ch:
			// Deploy finished (success or error)
			if result.err != nil {
				return nil, fmt.Errorf("deployment failed: %w", result.err)
			}
			log.Printf("clab.Deploy returned successfully")
			// Use inspect to get container info
			if labName != "" {
				os.Chdir(originalDir) // restore dir for inspect
				nodes, inspectErr := s.Inspect(ctx, labName)
				if inspectErr == nil && len(nodes) > 0 {
					return nodes, nil
				}
				log.Printf("inspect after deploy returned: %v (nodes: %d)", inspectErr, len(nodes))
			}
			return nil, nil

		case <-ticker.C:
			// Check if containers are up even though Deploy hasn't returned
			if labName != "" {
				os.Chdir(originalDir)
				nodes, inspectErr := s.Inspect(ctx, labName)
				os.Chdir(topoDir)
				if inspectErr == nil && len(nodes) > 0 {
					allRunning := true
					for _, n := range nodes {
						if n.State != "running" {
							allRunning = false
							break
						}
					}
					if allRunning {
						log.Printf("all %d containers running, proceeding without waiting for clab.Deploy to return", len(nodes))
						deployCancel() // cancel the blocking deploy
						return nodes, nil
					}
				}
			}

		case <-timer.C:
			// Container creation should be done by now — check via inspect
			if labName != "" {
				os.Chdir(originalDir)
				nodes, inspectErr := s.Inspect(ctx, labName)
				os.Chdir(topoDir)
				if inspectErr == nil && len(nodes) > 0 {
					log.Printf("containers found via inspect after timeout, proceeding (%d nodes)", len(nodes))
					deployCancel()
					return nodes, nil
				}
			}

		case <-ctx.Done():
			return nil, fmt.Errorf("deploy timed out: %w", ctx.Err())
		}
	}
}

// Destroy destroys a lab.
func (s *Service) Destroy(ctx context.Context, opts DestroyOptions) (retErr error) {
	// containerlab's WithTopologyFromLab can panic if the lab doesn't exist
	defer func() {
		if r := recover(); r != nil {
			retErr = fmt.Errorf("containerlab panic during destroy: %v", r)
		}
	}()

	ctx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	var clabOpts []clabcore.ClabOption
	clabOpts = append(clabOpts, clabcore.WithTimeout(defaultTimeout))

	// Runtime MUST come before WithTopologyFromLab — it calls globalRuntime()
	clabOpts = append(clabOpts,
		clabcore.WithRuntime(config.AppConfig.ClabRuntime, &clabruntime.RuntimeConfig{
			Timeout: defaultTimeout,
		}),
	)

	if opts.TopoPath != "" {
		topoDir := filepath.Dir(opts.TopoPath)
		originalDir, _ := os.Getwd()
		if err := os.Chdir(topoDir); err != nil {
			return fmt.Errorf("failed to change to topology directory: %w", err)
		}
		defer os.Chdir(originalDir)

		clabOpts = append(clabOpts, clabcore.WithTopoPath(opts.TopoPath, ""))
	} else if opts.LabName != "" {
		clabOpts = append(clabOpts, clabcore.WithTopologyFromLab(opts.LabName))
	} else {
		return fmt.Errorf("either topology path or lab name is required")
	}

	clab, err := clabcore.NewContainerLab(clabOpts...)
	if err != nil {
		return fmt.Errorf("failed to create containerlab instance: %w", err)
	}

	var destroyOpts []clabcore.DestroyOption
	if opts.Cleanup {
		destroyOpts = append(destroyOpts, clabcore.WithDestroyCleanup())
	}
	if opts.Graceful {
		destroyOpts = append(destroyOpts, clabcore.WithDestroyGraceful())
	}

	return clab.Destroy(ctx, destroyOpts...)
}

// Inspect inspects running containers for a lab using docker CLI directly.
// We avoid containerlab's library for inspect because WithTopologyFromLab
// and ListContainers have nil-pointer bugs in v0.73.0.
func (s *Service) Inspect(ctx context.Context, labName string) ([]NodeInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	dockerBin, err := exec.LookPath("docker")
	if err != nil {
		for _, p := range []string{"/usr/bin/docker", "/usr/local/bin/docker"} {
			if _, ferr := os.Stat(p); ferr == nil {
				dockerBin = p
				break
			}
		}
		if dockerBin == "" {
			return nil, fmt.Errorf("docker binary not found")
		}
	}

	// List containers with clab label filter
	// Format: name|kind|image|id|ipv4|state
	cmd := exec.CommandContext(ctx, dockerBin, "ps",
		"--filter", fmt.Sprintf("label=clab-topo-file"),
		"--filter", fmt.Sprintf("label=containerlab=%s", labName),
		"--format", "{{.Names}}|{{.Label \"clab-node-kind\"}}|{{.Image}}|{{.ID}}|{{.State}}",
	)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("docker ps failed: %w (%s)", err, stderr.String())
	}

	var nodes []NodeInfo
	for _, line := range bytes.Split(bytes.TrimSpace(stdout.Bytes()), []byte("\n")) {
		if len(line) == 0 {
			continue
		}
		parts := bytes.SplitN(line, []byte("|"), 5)
		if len(parts) < 5 {
			continue
		}
		name := string(parts[0])
		// Get IPv4 from docker inspect
		ipv4 := s.getContainerIPv4(ctx, dockerBin, name)

		nodes = append(nodes, NodeInfo{
			Name:        name,
			Kind:        string(parts[1]),
			Image:       string(parts[2]),
			ContainerID: string(parts[3]),
			IPv4:        ipv4,
			State:       string(parts[4]),
		})
	}

	return nodes, nil
}

func (s *Service) getContainerIPv4(ctx context.Context, dockerBin, name string) string {
	cmd := exec.CommandContext(ctx, dockerBin, "inspect",
		"--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
		name,
	)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
