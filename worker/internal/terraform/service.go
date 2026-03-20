package terraform

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

// Service manages Moto containers and Terraform lifecycle for cloud labs.
type Service struct {
	workDir string
	mu      sync.Mutex
	ports   map[string]int // labID -> moto port
}

// ResourceInfo represents a Terraform-managed resource.
type ResourceInfo struct {
	Name         string            `json:"name"`
	ResourceType string            `json:"resourceType"`
	ResourceID   string            `json:"resourceId"`
	Properties   map[string]string `json:"properties"`
	State        string            `json:"state"`
}

// NewService creates a new Terraform service.
func NewService() *Service {
	workDir := "/tmp/labbed-terraform"
	os.MkdirAll(workDir, 0750)
	return &Service{
		workDir: workDir,
		ports:   make(map[string]int),
	}
}

// labDir returns the working directory for a lab's terraform files.
func (s *Service) labDir(labID string) string {
	return filepath.Join(s.workDir, labID[:8])
}

// allocatePort finds the next free port starting from 15000.
func (s *Service) allocatePort(labID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	used := make(map[int]bool)
	for _, p := range s.ports {
		used[p] = true
	}
	for port := 15000; port < 16000; port++ {
		if !used[port] {
			s.ports[labID] = port
			return port
		}
	}
	return 15000 // fallback
}

// GetMotoPort returns the Moto port for a lab, or 0 if not running.
func (s *Service) GetMotoPort(labID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ports[labID]
}

// motoName returns the Docker container name for a lab's Moto instance.
func motoName(labID string) string {
	return fmt.Sprintf("moto-%s", labID[:8])
}

// StartMoto starts a Moto container for the lab and returns the allocated port.
func (s *Service) StartMoto(labID string) (int, error) {
	port := s.allocatePort(labID)
	name := motoName(labID)

	cmd := exec.Command("docker", "run", "-d",
		"--name", name,
		"-p", fmt.Sprintf("%d:5000", port),
		"motoserver/moto:latest",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("failed to start moto container: %w: %s", err, string(out))
	}
	log.Printf("started moto container %s on port %d", name, port)
	return port, nil
}

// StopMoto stops and removes the Moto container for a lab.
func (s *Service) StopMoto(labID string) error {
	name := motoName(labID)
	cmd := exec.Command("docker", "rm", "-f", name)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to stop moto container: %w: %s", err, string(out))
	}

	s.mu.Lock()
	delete(s.ports, labID)
	s.mu.Unlock()

	log.Printf("stopped moto container %s", name)
	return nil
}

// providerHCL generates the provider.tf content pointing at Moto.
func providerHCL(motoPort int) string {
	endpoint := fmt.Sprintf("http://localhost:%d", motoPort)
	services := []string{
		"acm", "apigateway", "cloudformation", "cloudwatch", "dynamodb",
		"ec2", "ecs", "elasticache", "elb", "iam", "kinesis", "lambda",
		"rds", "redshift", "route53", "s3", "secretsmanager", "ses",
		"sns", "sqs", "ssm", "stepfunctions", "sts",
	}
	var endpoints strings.Builder
	for _, svc := range services {
		endpoints.WriteString(fmt.Sprintf("    %s = %q\n", svc, endpoint))
	}

	return fmt.Sprintf(`terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
%s  }
}
`, endpoints.String())
}

// PrepareTerraformFiles writes main.tf and provider.tf to the lab directory.
func (s *Service) PrepareTerraformFiles(labID, hcl string, motoPort int) (string, error) {
	dir := s.labDir(labID)
	if err := os.MkdirAll(dir, 0750); err != nil {
		return "", fmt.Errorf("failed to create terraform dir: %w", err)
	}

	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(hcl), 0640); err != nil {
		return "", fmt.Errorf("failed to write main.tf: %w", err)
	}

	if err := os.WriteFile(filepath.Join(dir, "provider.tf"), []byte(providerHCL(motoPort)), 0640); err != nil {
		return "", fmt.Errorf("failed to write provider.tf: %w", err)
	}

	return dir, nil
}

// Deploy runs terraform init + apply and returns the created resources.
func (s *Service) Deploy(ctx context.Context, labID string) ([]ResourceInfo, error) {
	dir := s.labDir(labID)

	// terraform init
	initCmd := exec.CommandContext(ctx, "terraform", "init", "-no-color")
	initCmd.Dir = dir
	if out, err := initCmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("terraform init failed: %w: %s", err, string(out))
	}

	// terraform apply
	applyCmd := exec.CommandContext(ctx, "terraform", "apply", "-auto-approve", "-no-color")
	applyCmd.Dir = dir
	if out, err := applyCmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("terraform apply failed: %w: %s", err, string(out))
	}

	// terraform show -json to parse resources
	showCmd := exec.CommandContext(ctx, "terraform", "show", "-json")
	showCmd.Dir = dir
	showOut, err := showCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("terraform show failed: %w", err)
	}

	return parseResources(showOut)
}

// Destroy runs terraform destroy.
func (s *Service) Destroy(ctx context.Context, labID string) error {
	dir := s.labDir(labID)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil // nothing to destroy
	}

	cmd := exec.CommandContext(ctx, "terraform", "destroy", "-auto-approve", "-no-color")
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("terraform destroy failed: %w: %s", err, string(out))
	}
	return nil
}

// AwsExec runs an AWS CLI command against the lab's Moto endpoint.
func (s *Service) AwsExec(ctx context.Context, labID string, command string, motoPort int) (string, error) {
	endpoint := fmt.Sprintf("http://localhost:%d", motoPort)

	// Parse the command string into parts
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return "", fmt.Errorf("empty command")
	}

	// Prepend aws if not already there
	if parts[0] != "aws" {
		parts = append([]string{"aws"}, parts...)
	}

	// Add endpoint-url
	args := append(parts[1:], "--endpoint-url", endpoint, "--region", "us-east-1")

	cmd := exec.CommandContext(ctx, "aws", args...)
	cmd.Env = append(os.Environ(),
		"AWS_ACCESS_KEY_ID=test",
		"AWS_SECRET_ACCESS_KEY=test",
		"AWS_DEFAULT_REGION=us-east-1",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		// Return output even on error — it often contains useful info
		return string(out), fmt.Errorf("aws cli error: %w: %s", err, string(out))
	}
	return string(out), nil
}

// CleanupFiles removes the lab's terraform directory.
func (s *Service) CleanupFiles(labID string) {
	dir := s.labDir(labID)
	os.RemoveAll(dir)
}

// parseResources extracts resource info from terraform show -json output.
func parseResources(data []byte) ([]ResourceInfo, error) {
	var state struct {
		Values struct {
			RootModule struct {
				Resources []struct {
					Address string          `json:"address"`
					Type    string          `json:"type"`
					Name    string          `json:"name"`
					Values  json.RawMessage `json:"values"`
				} `json:"resources"`
			} `json:"root_module"`
		} `json:"values"`
	}

	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("failed to parse terraform state: %w", err)
	}

	var resources []ResourceInfo
	for _, r := range state.Values.RootModule.Resources {
		// Extract key properties from values
		var vals map[string]interface{}
		json.Unmarshal(r.Values, &vals)

		props := make(map[string]string)
		resourceID := ""
		for _, key := range []string{"id", "arn", "cidr_block", "vpc_id", "subnet_id", "availability_zone", "public_ip", "private_ip"} {
			if v, ok := vals[key]; ok && v != nil {
				props[key] = fmt.Sprintf("%v", v)
				if key == "id" {
					resourceID = fmt.Sprintf("%v", v)
				}
			}
		}

		resources = append(resources, ResourceInfo{
			Name:         r.Name,
			ResourceType: r.Type,
			ResourceID:   resourceID,
			Properties:   props,
			State:        "created",
		})
	}

	return resources, nil
}
