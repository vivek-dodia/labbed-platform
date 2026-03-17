package clab

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
	"gopkg.in/yaml.v3"
)

// startupConfigNode holds info about a vrnetlab node needing startup-config.
type startupConfigNode struct {
	Name          string // node name from topology
	Kind          string
	StartupConfig string // file path relative to topo dir
	ContainerName string // clab-{labname}-{nodename}
}

// topoSchema is a minimal parse of the containerlab topology YAML.
type topoSchema struct {
	Name     string `yaml:"name"`
	Topology struct {
		Nodes map[string]struct {
			Kind          string `yaml:"kind"`
			StartupConfig string `yaml:"startup-config"`
		} `yaml:"nodes"`
	} `yaml:"topology"`
}

// parseStartupConfigs extracts vrnetlab nodes with startup-config from a topology YAML.
func parseStartupConfigs(topoYAML, labName string) []startupConfigNode {
	var schema topoSchema
	if err := yaml.Unmarshal([]byte(topoYAML), &schema); err != nil {
		log.Printf("failed to parse topology YAML for startup-configs: %v", err)
		return nil
	}

	// Use topology name for container naming (matches containerlab convention)
	topoName := schema.Name
	if topoName == "" {
		topoName = labName
	}

	var nodes []startupConfigNode
	for name, node := range schema.Topology.Nodes {
		if node.StartupConfig == "" || !IsVrnetlabKind(node.Kind) {
			continue
		}
		nodes = append(nodes, startupConfigNode{
			Name:          name,
			Kind:          node.Kind,
			StartupConfig: node.StartupConfig,
			ContainerName: fmt.Sprintf("clab-%s-%s", topoName, name),
		})
	}
	return nodes
}

// ApplyStartupConfigs waits for vrnetlab VMs to become SSH-accessible and
// applies their startup-config files. Called after clab.Deploy() returns.
func (s *Service) ApplyStartupConfigs(ctx context.Context, topoDir, topoYAML, labName string) {
	nodes := parseStartupConfigs(topoYAML, labName)
	if len(nodes) == 0 {
		return
	}

	log.Printf("applying startup-configs to %d vrnetlab node(s)", len(nodes))

	for _, node := range nodes {
		configPath := filepath.Join(topoDir, node.StartupConfig)
		content, err := os.ReadFile(configPath)
		if err != nil {
			log.Printf("startup-config: failed to read %s for %s: %v", node.StartupConfig, node.Name, err)
			continue
		}

		mgmtIP, err := s.getContainerMgmtIP(node.ContainerName)
		if err != nil {
			log.Printf("startup-config: no mgmt IP for %s: %v", node.Name, err)
			continue
		}

		creds, ok := vrnetlabCreds[node.Kind]
		if !ok {
			creds = [2]string{"admin", "admin"}
		}

		client, err := waitForSSH(ctx, mgmtIP, creds)
		if err != nil {
			log.Printf("startup-config: SSH not ready for %s (%s): %v", node.Name, mgmtIP, err)
			continue
		}

		if err := applyRSCConfig(client, string(content)); err != nil {
			log.Printf("startup-config: failed to apply config for %s: %v", node.Name, err)
		} else {
			log.Printf("startup-config: applied %s to %s", node.StartupConfig, node.Name)
		}
		client.Close()
	}
}

// waitForSSH retries SSH connection until the VM is accessible or context expires.
func waitForSSH(ctx context.Context, mgmtIP string, creds [2]string) (*ssh.Client, error) {
	config := &ssh.ClientConfig{
		User: creds[0],
		Auth: []ssh.AuthMethod{
			ssh.Password(creds[1]),
			ssh.KeyboardInteractive(func(user, instruction string, questions []string, echos []bool) ([]string, error) {
				answers := make([]string, len(questions))
				for i := range answers {
					answers[i] = creds[1]
				}
				return answers, nil
			}),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         5 * time.Second,
	}

	deadline := time.After(4 * time.Minute)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-deadline:
			return nil, fmt.Errorf("timeout waiting for SSH at %s", mgmtIP)
		case <-ticker.C:
			conn, err := net.DialTimeout("tcp", mgmtIP+":22", 5*time.Second)
			if err != nil {
				continue
			}
			sshConn, chans, reqs, err := ssh.NewClientConn(conn, mgmtIP+":22", config)
			if err != nil {
				conn.Close()
				continue
			}
			return ssh.NewClient(sshConn, chans, reqs), nil
		}
	}
}

// applyRSCConfig executes a RouterOS .rsc config via SSH commands.
func applyRSCConfig(client *ssh.Client, config string) error {
	commands := flattenRSC(config)
	for _, cmd := range commands {
		session, err := client.NewSession()
		if err != nil {
			return fmt.Errorf("SSH session: %w", err)
		}
		output, err := session.CombinedOutput(cmd)
		session.Close()
		if err != nil {
			// Log but continue — some commands may fail due to ordering
			log.Printf("  rsc command %q: %s (%v)", cmd, strings.TrimSpace(string(output)), err)
		}
	}
	return nil
}

// flattenRSC converts a RouterOS .rsc config file into independent CLI commands.
// Context lines (e.g., "/ip address") are prepended to subcommands (e.g., "add ...").
func flattenRSC(config string) []string {
	joined := joinContinuationLines(config)
	var commands []string
	currentContext := ""

	for _, line := range joined {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "/") {
			// Check if this is a context line or a full command
			// e.g., "/ip address" = context, "/ip address add ..." = full command
			parts := strings.Fields(line)
			hasAction := false
			for _, p := range parts {
				if p == "add" || p == "set" || p == "remove" || p == "print" {
					hasAction = true
					break
				}
			}
			if hasAction {
				commands = append(commands, line)
				continue
			}
			currentContext = line
			continue
		}
		if currentContext != "" {
			commands = append(commands, currentContext+" "+line)
		} else {
			commands = append(commands, line)
		}
	}
	return commands
}

// joinContinuationLines merges lines ending with \ into single lines.
func joinContinuationLines(content string) []string {
	raw := strings.Split(content, "\n")
	var result []string
	for _, line := range raw {
		line = strings.TrimRight(line, "\r")
		if len(result) > 0 && strings.HasSuffix(result[len(result)-1], `\`) {
			prev := strings.TrimSuffix(result[len(result)-1], `\`)
			result[len(result)-1] = prev + " " + strings.TrimSpace(line)
		} else {
			result = append(result, line)
		}
	}
	return result
}
