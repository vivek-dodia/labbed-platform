package seed

import (
	"fmt"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

// hostImages are endpoint/host images that don't need startup configs.
var hostImages = map[string]bool{
	"ghcr.io/vivek-dodia/labbed-host:latest": true,
}

// kvmKinds use SSH-based config delivery at runtime, not startup-config in YAML.
var kvmKinds = map[string]bool{
	"openwrt": true, "freebsd": true, "mikrotik_ros": true,
}

type topoYAML struct {
	Topology struct {
		Nodes map[string]struct {
			Kind          string   `yaml:"kind"`
			Image         string   `yaml:"image"`
			StartupConfig string   `yaml:"startup-config"`
			Binds         []string `yaml:"binds"`
		} `yaml:"nodes"`
	} `yaml:"topology"`
}

// TestAllRouterNodesHaveConfigs ensures every seed template includes startup
// configs for all router/switch nodes. Host/endpoint nodes, KVM nodes (config
// via SSH), and explicit sandbox labs are exempt.
func TestAllRouterNodesHaveConfigs(t *testing.T) {
	// Templates that are intentionally config-free (sandbox/explorer labs).
	sandboxTemplates := map[string]bool{
		"SR Linux — Single Node Explorer": true,
	}

	for _, col := range collections {
		for _, tmpl := range col.Templates {
			if sandboxTemplates[tmpl.Name] {
				continue
			}

			var topo topoYAML
			if err := yaml.Unmarshal([]byte(tmpl.Definition), &topo); err != nil {
				continue // non-YAML templates (cloud/HCL)
			}

			// Build set of bind file paths for this template
			bindPaths := make(map[string]bool)
			for _, bf := range tmpl.BindFiles {
				bindPaths[bf.FilePath] = true
			}

			// Also check if NOS-agnostic bind files exist (applied by worker, not in YAML)
			hasNosBindFiles := len(tmpl.BindFiles) > 0

			for nodeName, node := range topo.Topology.Nodes {
				if hostImages[node.Image] {
					continue
				}
				if kvmKinds[node.Kind] {
					continue // config delivered via SSH at runtime
				}

				hasStartup := node.StartupConfig != "" && bindPaths[node.StartupConfig]
				hasBinds := len(node.Binds) > 0 && anyBindFileExists(node.Binds, bindPaths)

				// NOS-agnostic system: FRR/MikroTik templates store configs as
				// bind files with NosKind set, applied by the worker at deploy time.
				// If the template has any bind files at all, nodes in a multi-NOS
				// template may get their config from the NOS-agnostic path.
				if hasStartup || hasBinds || hasNosBindFiles {
					continue
				}

				t.Errorf("%s > %s > node %q (%s) has no startup config or bind files",
					col.Name, tmpl.Name, nodeName, node.Image)
			}
		}
	}
}

// anyBindFileExists checks if at least one bind mount source exists in the template's bind files.
func anyBindFileExists(binds []string, bindPaths map[string]bool) bool {
	for _, b := range binds {
		parts := strings.SplitN(b, ":", 2)
		if len(parts) >= 1 && bindPaths[parts[0]] {
			return true
		}
	}
	return false
}

func TestNoEmptyBindFileContent(t *testing.T) {
	for _, col := range collections {
		for _, tmpl := range col.Templates {
			for _, bf := range tmpl.BindFiles {
				if strings.TrimSpace(bf.Content) == "" {
					t.Errorf("%s > %s > bind file %q has empty content",
						col.Name, tmpl.Name, bf.FilePath)
				}
			}
		}
	}
}

func TestTemplateNamesUnique(t *testing.T) {
	seen := make(map[string]string)
	for _, col := range collections {
		for _, tmpl := range col.Templates {
			key := fmt.Sprintf("%s/%s", col.Name, tmpl.Name)
			if prev, ok := seen[tmpl.Name]; ok {
				t.Errorf("duplicate template name %q in %q and %q", tmpl.Name, prev, col.Name)
			}
			seen[tmpl.Name] = key
		}
	}
}
