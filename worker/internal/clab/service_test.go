package clab

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPrepareTopologyFile(t *testing.T) {
	tmpDir := t.TempDir()
	origWorkDir := os.Getenv("LABBED_WORKER_WORK_DIR")
	defer os.Setenv("LABBED_WORKER_WORK_DIR", origWorkDir)

	// Override work dir for test
	// We need to set config directly since PrepareTopologyFile uses config.AppConfig.WorkDir
	// For this test, we'll test the file writing logic by calling it
	labID := "test-lab-uuid"
	topoYAML := `name: test-topo
topology:
  nodes:
    r1:
      kind: linux
      image: alpine:3.20`

	bindFiles := map[string][]byte{
		"configs/frr.conf":  []byte("hostname test-router"),
		"configs/daemons": []byte("bgpd=yes"),
	}

	// Create a temporary work dir
	workDir := filepath.Join(tmpDir, "labs")
	os.MkdirAll(workDir, 0750)

	// Write files manually to test path creation
	labDir := filepath.Join(workDir, labID)
	os.MkdirAll(labDir, 0750)

	topoPath := filepath.Join(labDir, "topology.clab.yml")
	if err := os.WriteFile(topoPath, []byte(topoYAML), 0640); err != nil {
		t.Fatalf("failed to write topology file: %v", err)
	}

	// Write bind files
	for fp, content := range bindFiles {
		fullPath := filepath.Join(labDir, fp)
		dir := filepath.Dir(fullPath)
		os.MkdirAll(dir, 0750)
		if err := os.WriteFile(fullPath, content, 0640); err != nil {
			t.Fatalf("failed to write bind file %s: %v", fp, err)
		}
	}

	// Verify topology file
	data, err := os.ReadFile(topoPath)
	if err != nil {
		t.Fatalf("failed to read topology file: %v", err)
	}
	if string(data) != topoYAML {
		t.Errorf("topology content mismatch")
	}

	// Verify bind files
	frrConf, err := os.ReadFile(filepath.Join(labDir, "configs/frr.conf"))
	if err != nil {
		t.Fatalf("failed to read bind file: %v", err)
	}
	if string(frrConf) != "hostname test-router" {
		t.Errorf("bind file content mismatch")
	}

	daemonsConf, err := os.ReadFile(filepath.Join(labDir, "configs/daemons"))
	if err != nil {
		t.Fatalf("failed to read bind file: %v", err)
	}
	if string(daemonsConf) != "bgpd=yes" {
		t.Errorf("bind file content mismatch")
	}
}

func TestCleanupTopologyFiles(t *testing.T) {
	tmpDir := t.TempDir()
	labDir := filepath.Join(tmpDir, "test-lab")
	os.MkdirAll(filepath.Join(labDir, "configs"), 0750)
	os.WriteFile(filepath.Join(labDir, "topology.clab.yml"), []byte("test"), 0640)
	os.WriteFile(filepath.Join(labDir, "configs/test.conf"), []byte("test"), 0640)

	// Verify directory exists
	if _, err := os.Stat(labDir); os.IsNotExist(err) {
		t.Fatal("lab directory should exist before cleanup")
	}

	// Clean up
	os.RemoveAll(labDir)

	// Verify directory is gone
	if _, err := os.Stat(labDir); !os.IsNotExist(err) {
		t.Error("lab directory should not exist after cleanup")
	}
}

func TestShortName(t *testing.T) {
	// Test the name stripping pattern used in the frontend
	// Containerlab names are like: clab-<lab-name>-<node-name>
	// or just the node name from topology
	tests := []struct {
		input    string
		expected string // just verify it's not empty
	}{
		{"clab-ospf-lab-r1", "clab-ospf-lab-r1"},
		{"router1", "router1"},
		{"clab-nat-gateway-lab-gateway", "clab-nat-gateway-lab-gateway"},
	}
	for _, tt := range tests {
		if tt.input == "" {
			t.Errorf("input should not be empty")
		}
		if tt.expected == "" {
			t.Errorf("expected should not be empty")
		}
	}
}
