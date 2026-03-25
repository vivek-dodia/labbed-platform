// Package clab wraps the containerlab Go library for deploy/destroy/inspect operations.
// Modeled on github.com/srl-labs/clab-api-server/internal/clab/service.go
package clab

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"

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

// vrnetlabKinds are containerlab node kinds that use vrnetlab (VM-inside-container).
// These need SSH or serial console access instead of docker exec sh.
var vrnetlabKinds = map[string]bool{
	// MikroTik
	"mikrotik_ros": true,
	// Cisco
	"cisco_xrv":      true,
	"cisco_xrv9k":    true,
	"cisco_csr1000v": true,
	"cisco_n9kv":     true,
	"cisco_c8000v":   true,
	"cisco_ftdv":     true,
	"cisco_cat9kv":   true,
	// Juniper
	"juniper_vmx":            true,
	"juniper_vqfx":           true,
	"juniper_vsrx":           true,
	"juniper_vjunosrouter":   true,
	"juniper_vjunosswitch":   true,
	"juniper_vjunosevolved":  true,
	// Arista
	"arista_veos": true,
	// Nokia
	"nokia_sros": true,
	// Others
	"openwrt":               true,
	"aruba_aoscx":           true,
	"dell_ftosv":            true,
	"huawei_vrp":            true,
	"paloalto_panos":        true,
	"fortinet_fortigate":    true,
	"checkpoint_cloudguard": true,
	"generic_vm":            true,
	"openbsd":               true,
	"freebsd":               true,
}

// vrnetlabCreds maps node kinds to their default SSH credentials.
var vrnetlabCreds = map[string][2]string{
	"mikrotik_ros":          {"admin", "admin"},
	"openwrt":               {"root", "VR-netlab9"},
	"freebsd":               {"admin", "admin"},
	"cisco_xrv":             {"admin", "admin"},
	"cisco_xrv9k":           {"admin", "admin"},
	"cisco_csr1000v":        {"admin", "admin"},
	"cisco_n9kv":            {"admin", "admin"},
	"cisco_c8000v":          {"admin", "admin"},
	"juniper_vmx":           {"admin", "admin@123"},
	"juniper_vqfx":          {"admin", "admin@123"},
	"juniper_vsrx":          {"admin", "admin@123"},
	"juniper_vjunosrouter":  {"admin", "admin@123"},
	"juniper_vjunosswitch":  {"admin", "admin@123"},
	"juniper_vjunosevolved": {"admin", "admin@123"},
	"arista_veos":           {"admin", "admin"},
	"nokia_sros":            {"admin", "admin"},
}

// IsVrnetlabKind returns true if the kind uses vrnetlab (VM-inside-container).
func IsVrnetlabKind(kind string) bool {
	return vrnetlabKinds[kind]
}

// VrnetlabExec executes a command on a vrnetlab VM via SSH to its management IP.
// Falls back to serial console if SSH is unavailable.
func (s *Service) VrnetlabExec(ctx context.Context, containerName, command, kind string) (string, error) {
	output, err := s.sshExec(ctx, containerName, command, kind)
	if err == nil {
		return output, nil
	}
	log.Printf("SSH exec failed for %s (kind=%s), falling back to serial: %v", containerName, kind, err)
	return s.serialExec(ctx, containerName, command)
}

// sshExec connects to the VM's management IP via SSH and runs the command.
func (s *Service) sshExec(ctx context.Context, containerName, command, kind string) (string, error) {
	mgmtIP, err := s.getContainerMgmtIP(containerName)
	if err != nil {
		return "", fmt.Errorf("get mgmt IP: %w", err)
	}

	creds, ok := vrnetlabCreds[kind]
	if !ok {
		creds = [2]string{"admin", "admin"}
	}

	config := &ssh.ClientConfig{
		User: creds[0],
		Auth: []ssh.AuthMethod{
			ssh.Password(creds[1]),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", mgmtIP+":22")
	if err != nil {
		return "", fmt.Errorf("dial %s:22: %w", mgmtIP, err)
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(conn, mgmtIP+":22", config)
	if err != nil {
		conn.Close()
		return "", fmt.Errorf("SSH handshake: %w", err)
	}
	client := ssh.NewClient(sshConn, chans, reqs)
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("SSH session: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	if err := session.Run(command); err != nil {
		// Some NOS types return exit code 1 even on success; return output anyway
		output := stdout.String() + stderr.String()
		if len(output) > 0 {
			return output, nil
		}
		return "", fmt.Errorf("SSH run: %w", err)
	}
	output := stdout.String()
	if stderr.Len() > 0 {
		output += stderr.String()
	}
	return output, nil
}

// getContainerMgmtIP returns the first IP address assigned to the container.
func (s *Service) getContainerMgmtIP(containerName string) (string, error) {
	dockerBin := findDockerBin()
	cmd := exec.Command(dockerBin, "inspect", "--format",
		"{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}", containerName)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	ips := strings.Fields(strings.TrimSpace(string(out)))
	if len(ips) == 0 {
		return "", fmt.Errorf("no management IP for %s", containerName)
	}
	return ips[0], nil
}

// serialExec sends a command via the QEMU serial console (telnet port 5000).
// Used as fallback when SSH is not available.
func (s *Service) serialExec(ctx context.Context, containerName, command string) (string, error) {
	dockerBin := findDockerBin()

	escapedCmd := strings.ReplaceAll(command, `"`, `\"`)
	escapedCmd = strings.ReplaceAll(escapedCmd, `$`, `\$`)
	script := fmt.Sprintf(
		`(sleep 1; printf "\r"; sleep 1; printf "%s\r"; sleep 3; printf "\r") | telnet localhost 5000 2>/dev/null`,
		escapedCmd,
	)

	args := []string{"exec", containerName, "sh", "-c", script}
	cmd := exec.CommandContext(ctx, dockerBin, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	_ = cmd.Run()
	return cleanSerialOutput(stdout.String(), command), nil
}

// findDockerBin locates the docker binary.
func findDockerBin() string {
	if p, err := exec.LookPath("docker"); err == nil {
		return p
	}
	for _, p := range []string{"/usr/bin/docker", "/usr/local/bin/docker"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "docker"
}

// cleanSerialOutput strips ANSI escape codes, telnet banners, and prompt lines
// from serial console output to return clean command results.
func cleanSerialOutput(raw, command string) string {
	cleaned := stripAnsiCodes(raw)
	lines := strings.Split(cleaned, "\n")

	// First pass: strip telnet banners and blank lines
	var filtered []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "Trying ") ||
			strings.HasPrefix(trimmed, "Connected to") ||
			strings.HasPrefix(trimmed, "Escape character") ||
			strings.HasPrefix(trimmed, "Connection closed") {
			continue
		}
		filtered = append(filtered, line)
	}

	// Second pass: try to find the command echo and capture output after it
	var result []string
	foundCommand := false
	for _, line := range filtered {
		trimmed := strings.TrimSpace(line)
		if !foundCommand && strings.Contains(trimmed, command) {
			foundCommand = true
			continue
		}
		if foundCommand {
			result = append(result, line)
		}
	}

	// If command echo wasn't found (ANSI mangling), use all filtered lines
	if !foundCommand {
		result = filtered
	}

	// Remove trailing prompt line
	if len(result) > 0 {
		last := strings.TrimSpace(result[len(result)-1])
		if strings.Contains(last, ">") || strings.Contains(last, "#") || strings.Contains(last, "]") {
			result = result[:len(result)-1]
		}
	}

	return strings.TrimSpace(strings.Join(result, "\n"))
}

// stripAnsiCodes removes ANSI/VT100 escape sequences from a string.
func stripAnsiCodes(s string) string {
	var result strings.Builder
	i := 0
	for i < len(s) {
		if s[i] == '\x1b' {
			// Skip ESC [ ... (letter) sequences
			i++
			if i < len(s) && s[i] == '[' {
				i++
				for i < len(s) && !((s[i] >= 'A' && s[i] <= 'Z') || (s[i] >= 'a' && s[i] <= 'z')) {
					i++
				}
				if i < len(s) {
					i++ // skip the final letter
				}
			}
			continue
		}
		if s[i] == '\r' {
			i++
			continue
		}
		result.WriteByte(s[i])
		i++
	}
	return result.String()
}

// Exec runs a command inside a container using docker exec.
// For SR Linux nodes, commands are wrapped with sr_cli to use the NOS CLI.
func (s *Service) Exec(ctx context.Context, containerName, command, kind string) (string, error) {
	dockerBin := findDockerBin()

	var args []string
	switch kind {
	case "srl", "nokia_srlinux":
		args = []string{"exec", containerName, "sr_cli", "-e", command}
	default:
		args = []string{"exec", containerName, "sh", "-c", command}
	}

	cmd := exec.CommandContext(ctx, dockerBin, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		output := stdout.String()
		if stderr.Len() > 0 {
			if output != "" {
				output += "\n"
			}
			output += stderr.String()
		}
		if output != "" {
			return output, nil
		}
		return "", fmt.Errorf("exec failed: %w", err)
	}

	output := stdout.String()
	if stderr.Len() > 0 {
		output += "\n" + stderr.String()
	}
	return output, nil
}

// Capture runs tcpdump on a container's interface from the host using nsenter.
// This is the containerlab-native approach: nsenter into the container's network namespace
// and run tcpdump from the host (no tcpdump needed inside the container).
func (s *Service) Capture(ctx context.Context, containerName, iface string, count int, filter string) (string, error) {
	// Get container PID for nsenter
	dockerBin, _ := exec.LookPath("docker")
	if dockerBin == "" {
		for _, p := range []string{"/usr/bin/docker", "/usr/local/bin/docker"} {
			if _, ferr := os.Stat(p); ferr == nil {
				dockerBin = p
				break
			}
		}
	}
	if dockerBin == "" {
		return "", fmt.Errorf("docker binary not found")
	}

	pidCmd := exec.CommandContext(ctx, dockerBin, "inspect", "--format", "{{.State.Pid}}", containerName)
	pidOut, err := pidCmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get container PID: %w", err)
	}
	pid := strings.TrimSpace(string(pidOut))
	if pid == "" || pid == "0" {
		return "", fmt.Errorf("container %s is not running", containerName)
	}

	// If the requested interface doesn't exist, fall back to "any"
	checkCmd := exec.CommandContext(ctx, "nsenter", "-t", pid, "-n", "ip", "link", "show", iface)
	if err := checkCmd.Run(); err != nil {
		// Interface not found — try "any" to capture on all interfaces
		iface = "any"
	}

	// Build nsenter + tcpdump args
	args := []string{"-t", pid, "-n", "tcpdump", "-nn", "-c", fmt.Sprintf("%d", count), "-i", iface}
	if filter != "" {
		args = append(args, strings.Fields(filter)...)
	}

	cmd := exec.CommandContext(ctx, "nsenter", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	// tcpdump writes packet lines to stdout and summary to stderr
	output := stdout.String()
	if stderr.Len() > 0 {
		if output != "" {
			output += "\n"
		}
		output += stderr.String()
	}

	if err != nil {
		// Context deadline = normal (timeout reached before count packets)
		if ctx.Err() != nil {
			return output, nil
		}
		if output != "" {
			return output, nil
		}
		return "", fmt.Errorf("capture failed: %w", err)
	}

	return output, nil
}

// Deploy deploys a lab using the containerlab library.
// After clab.Deploy returns (or times out waiting for post-deploy steps),
// we use Inspect to gather actual container info since Deploy can block
// on health checks / management IP assignment.
func (s *Service) Deploy(ctx context.Context, opts DeployOptions) ([]NodeInfo, error) {
	deployTimeout := 5 * time.Minute
	// Use a detached context so postdeploy (startup-config application for SRL etc.)
	// can continue even after we return early when containers are up.
	deployCtx, deployCancel := context.WithTimeout(context.Background(), deployTimeout)

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
			deployCancel()
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
						// Let containerlab's postdeploy finish in the background
						// (applies startup-config for SRL, health checks, etc.)
						go func() {
							<-ch
							deployCancel()
						}()
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
					go func() {
						<-ch
						deployCancel()
					}()
					return nodes, nil
				}
			}

		case <-ctx.Done():
			deployCancel()
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
