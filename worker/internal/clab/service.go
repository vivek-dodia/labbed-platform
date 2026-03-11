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
func (s *Service) Deploy(ctx context.Context, opts DeployOptions) ([]NodeInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	// Change to the topology directory for relative path resolution
	topoDir := filepath.Dir(opts.TopoPath)
	originalDir, _ := os.Getwd()
	if err := os.Chdir(topoDir); err != nil {
		return nil, fmt.Errorf("failed to change to topology directory: %w", err)
	}
	defer os.Chdir(originalDir)

	// Build containerlab options
	clabOpts := []clabcore.ClabOption{
		clabcore.WithTimeout(defaultTimeout),
		clabcore.WithTopoPath(opts.TopoPath, ""),
		clabcore.WithRuntime(config.AppConfig.ClabRuntime, &clabruntime.RuntimeConfig{
			Timeout: defaultTimeout,
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

	containers, err := clab.Deploy(ctx, deployOpts)
	if err != nil {
		return nil, fmt.Errorf("deployment failed: %w", err)
	}

	// Convert containers to NodeInfo
	var nodes []NodeInfo
	for _, c := range containers {
		nodes = append(nodes, NodeInfo{
			Name:        c.Names[0],
			Kind:        c.Labels["clab-node-kind"],
			Image:       c.Image,
			ContainerID: c.ID[:12],
			IPv4:        c.GetContainerIPv4(),
			IPv6:        c.GetContainerIPv6(),
			State:       c.State,
		})
	}

	return nodes, nil
}

// Destroy destroys a lab.
func (s *Service) Destroy(ctx context.Context, opts DestroyOptions) error {
	ctx, cancel := context.WithTimeout(ctx, defaultTimeout)
	defer cancel()

	var clabOpts []clabcore.ClabOption
	clabOpts = append(clabOpts, clabcore.WithTimeout(defaultTimeout))

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

	clabOpts = append(clabOpts,
		clabcore.WithRuntime(config.AppConfig.ClabRuntime, &clabruntime.RuntimeConfig{
			Timeout: defaultTimeout,
		}),
	)

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

// Inspect inspects running containers for a lab.
func (s *Service) Inspect(ctx context.Context, labName string) ([]NodeInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	clabOpts := []clabcore.ClabOption{
		clabcore.WithTimeout(2 * time.Minute),
		clabcore.WithTopologyFromLab(labName),
		clabcore.WithRuntime(config.AppConfig.ClabRuntime, &clabruntime.RuntimeConfig{
			Timeout: 2 * time.Minute,
		}),
	}

	clab, err := clabcore.NewContainerLab(clabOpts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create containerlab instance: %w", err)
	}

	containers, err := clab.ListContainers(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("inspect failed: %w", err)
	}

	var nodes []NodeInfo
	for _, c := range containers {
		nodes = append(nodes, NodeInfo{
			Name:        c.Names[0],
			Kind:        c.Labels["clab-node-kind"],
			Image:       c.Image,
			ContainerID: c.ID[:12],
			IPv4:        c.GetContainerIPv4(),
			IPv6:        c.GetContainerIPv6(),
			State:       c.State,
		})
	}

	return nodes, nil
}
