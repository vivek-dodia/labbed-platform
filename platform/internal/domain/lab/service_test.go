package lab

import (
	"testing"
	"time"

	"github.com/labbed/platform/internal/config"
	"github.com/labbed/platform/internal/domain/worker"
	"github.com/labbed/platform/internal/workerclient"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func init() {
	config.AppConfig.Auth.JWTSecret = "test-secret"
	config.AppConfig.Auth.AccessTokenExpiry = 30 * time.Minute
	config.AppConfig.Auth.RefreshTokenExpiry = 720 * time.Hour
}

func setupLabTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.AutoMigrate(&Lab{}, &LabNode{}, &LabEvent{}); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
	return db
}

// mockWorkerSelector implements WorkerSelector for testing.
type mockWorkerSelector struct {
	w   *worker.Worker
	err error
}

func (m *mockWorkerSelector) SelectWorker() (*worker.Worker, error) {
	return m.w, m.err
}
func (m *mockWorkerSelector) GetWorkerByID(id uint) (*worker.Worker, error) {
	return m.w, m.err
}

// mockTemplateLoader implements TemplateLoader for testing.
type mockTemplateLoader struct {
	definition string
	bindFiles  map[string][]byte
	err        error
}

func (m *mockTemplateLoader) GetType(topoUUID string) (string, error) {
	return "network", m.err
}
func (m *mockTemplateLoader) GetDefinition(topoUUID string) (string, error) {
	return m.definition, m.err
}
func (m *mockTemplateLoader) GetBindFiles(topoUUID string) (map[string][]byte, error) {
	return m.bindFiles, m.err
}
func (m *mockTemplateLoader) GetBindFilesForNos(topoUUID string, nosKinds []string) (map[string][]byte, error) {
	return m.bindFiles, m.err
}

func setupLabService(t *testing.T) (*LabService, *gorm.DB) {
	t.Helper()
	db := setupLabTestDB(t)
	repo := NewRepository(db)
	ws := &mockWorkerSelector{
		w: &worker.Worker{
			Name:    "test-worker",
			Address: "http://localhost:9999",
			Secret:  "test-secret",
		},
	}
	wc := workerclient.NewClient()
	tl := &mockTemplateLoader{
		definition: "name: test-topo\ntopology:\n  nodes:\n    r1:\n      kind: linux\n      image: ghcr.io/vivek-dodia/labbed-host:latest",
		bindFiles:  map[string][]byte{},
	}
	svc := NewService(repo, ws, wc, tl, "http://localhost:8080")
	// Give the mock worker a valid ID
	ws.w.ID = 1
	return svc, db
}

// --- Tests ---

func TestCreateLab(t *testing.T) {
	svc, _ := setupLabService(t)

	resp, err := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "test-lab",
		TemplateID: "topo-uuid-1",
	})
	if err != nil {
		t.Fatalf("create lab failed: %v", err)
	}
	if resp.Name != "test-lab" {
		t.Errorf("expected name 'test-lab', got %q", resp.Name)
	}
	if resp.State != StateScheduled {
		t.Errorf("expected state 'scheduled', got %q", resp.State)
	}
	if resp.UUID == "" {
		t.Error("expected non-empty UUID")
	}
	if resp.TemplateID != "topo-uuid-1" {
		t.Errorf("expected templateId 'topo-uuid-1', got %q", resp.TemplateID)
	}
}

func TestCreateLab_WithSchedule(t *testing.T) {
	svc, _ := setupLabService(t)

	start := time.Now().Add(1 * time.Hour).Format(time.RFC3339)
	end := time.Now().Add(2 * time.Hour).Format(time.RFC3339)

	resp, err := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:           "scheduled-lab",
		TemplateID:     "topo-uuid-2",
		ScheduledStart: &start,
		ScheduledEnd:   &end,
	})
	if err != nil {
		t.Fatalf("create lab failed: %v", err)
	}
	if resp.ScheduledStart == nil {
		t.Error("expected scheduledStart to be set")
	}
	if resp.ScheduledEnd == nil {
		t.Error("expected scheduledEnd to be set")
	}
}

func TestGetByUUID(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "find-me",
		TemplateID: "topo-uuid-3",
	})

	found, err := svc.GetByUUID(created.UUID)
	if err != nil {
		t.Fatalf("get by uuid failed: %v", err)
	}
	if found.UUID != created.UUID {
		t.Errorf("expected uuid %q, got %q", created.UUID, found.UUID)
	}
}

func TestGetByUUID_NotFound(t *testing.T) {
	svc, _ := setupLabService(t)

	_, err := svc.GetByUUID("nonexistent-uuid")
	if err == nil {
		t.Error("expected error for nonexistent UUID")
	}
}

func TestUpdateState(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "state-lab",
		TemplateID: "topo-1",
	})

	// scheduled -> deploying (via Deploy would normally do this, but test directly)
	err := svc.UpdateState(created.UUID, StateDeploying, nil)
	if err != nil {
		t.Fatalf("update state failed: %v", err)
	}

	lab, _ := svc.GetByUUID(created.UUID)
	if lab.State != StateDeploying {
		t.Errorf("expected state 'deploying', got %q", lab.State)
	}
}

func TestUpdateState_ToRunning(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "running-lab",
		TemplateID: "topo-1",
	})

	_ = svc.UpdateState(created.UUID, StateDeploying, nil)
	_ = svc.UpdateState(created.UUID, StateRunning, nil)

	lab, _ := svc.GetByUUID(created.UUID)
	if lab.State != StateRunning {
		t.Errorf("expected state 'running', got %q", lab.State)
	}
}

func TestUpdateState_ToFailed(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "fail-lab",
		TemplateID: "topo-1",
	})

	_ = svc.UpdateState(created.UUID, StateDeploying, nil)

	errMsg := "connection refused"
	err := svc.UpdateState(created.UUID, StateFailed, &errMsg)
	if err != nil {
		t.Fatalf("update state failed: %v", err)
	}

	lab, _ := svc.GetByUUID(created.UUID)
	if lab.State != StateFailed {
		t.Errorf("expected state 'failed', got %q", lab.State)
	}
	if lab.ErrorMessage == nil || *lab.ErrorMessage != "connection refused" {
		t.Errorf("expected error message 'connection refused', got %v", lab.ErrorMessage)
	}
}

func TestUpdateState_ToStopped_SetsStoppedAt(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "stop-lab",
		TemplateID: "topo-1",
	})

	_ = svc.UpdateState(created.UUID, StateDeploying, nil)
	_ = svc.UpdateState(created.UUID, StateRunning, nil)
	_ = svc.UpdateState(created.UUID, StateStopped, nil)

	lab, _ := svc.GetByUUID(created.UUID)
	if lab.State != StateStopped {
		t.Errorf("expected state 'stopped', got %q", lab.State)
	}
	if lab.StoppedAt == nil {
		t.Error("expected stoppedAt to be set")
	}
}

func TestUpdateNodes(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "nodes-lab",
		TemplateID: "topo-1",
	})

	nodes := []NodeResponse{
		{Name: "router1", Kind: "linux", Image: "ghcr.io/vivek-dodia/labbed-host:latest", ContainerID: "abc123", IPv4: "172.20.20.2", State: "running"},
		{Name: "host1", Kind: "linux", Image: "ghcr.io/vivek-dodia/labbed-host:latest", ContainerID: "def456", IPv4: "172.20.20.3", State: "running"},
	}

	err := svc.UpdateNodes(created.UUID, nodes)
	if err != nil {
		t.Fatalf("update nodes failed: %v", err)
	}

	lab, _ := svc.GetByUUID(created.UUID)
	if len(lab.Nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(lab.Nodes))
	}
	if lab.Nodes[0].Name != "router1" {
		t.Errorf("expected first node 'router1', got %q", lab.Nodes[0].Name)
	}
	if lab.Nodes[1].IPv4 != "172.20.20.3" {
		t.Errorf("expected second node IPv4 '172.20.20.3', got %q", lab.Nodes[1].IPv4)
	}
}

func TestUpdateNodes_Replaces(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "replace-lab",
		TemplateID: "topo-1",
	})

	_ = svc.UpdateNodes(created.UUID, []NodeResponse{
		{Name: "old-node", Kind: "linux", Image: "alpine", State: "running"},
	})
	_ = svc.UpdateNodes(created.UUID, []NodeResponse{
		{Name: "new-node-1", Kind: "linux", Image: "alpine", State: "running"},
		{Name: "new-node-2", Kind: "linux", Image: "alpine", State: "running"},
	})

	lab, _ := svc.GetByUUID(created.UUID)
	if len(lab.Nodes) != 2 {
		t.Fatalf("expected 2 nodes after replace, got %d", len(lab.Nodes))
	}
	if lab.Nodes[0].Name != "new-node-1" {
		t.Errorf("expected 'new-node-1', got %q", lab.Nodes[0].Name)
	}
}

func TestCheckOrgOwnership(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 42, CreateRequest{
		Name:       "org-lab",
		TemplateID: "topo-1",
	})

	// Correct org
	if err := svc.CheckOrgOwnership(created.UUID, 42); err != nil {
		t.Errorf("expected ownership check to pass: %v", err)
	}

	// Wrong org
	if err := svc.CheckOrgOwnership(created.UUID, 99); err == nil {
		t.Error("expected ownership check to fail for wrong org")
	}
}

func TestLabEvents(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "events-lab",
		TemplateID: "topo-1",
	})

	_ = svc.UpdateState(created.UUID, StateDeploying, nil)
	_ = svc.UpdateState(created.UUID, StateRunning, nil)

	resp, err := svc.GetEvents(created.UUID, 10, 0)
	if err != nil {
		t.Fatalf("get events failed: %v", err)
	}
	events, ok := resp.Data.([]LabEventResponse)
	if !ok {
		t.Fatal("expected events data to be []LabEventResponse")
	}
	if len(events) < 2 {
		t.Errorf("expected at least 2 events, got %d", len(events))
	}
}

func TestDeploy_InvalidState(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "deploy-lab",
		TemplateID: "topo-1",
	})

	// Set to running first
	_ = svc.UpdateState(created.UUID, StateRunning, nil)

	// Try to deploy from running — should fail
	err := svc.Deploy(created.UUID, nil)
	if err == nil {
		t.Error("expected error when deploying from running state")
	}
}

func TestDeploy_FromScheduled(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "deploy-lab-2",
		TemplateID: "topo-1",
	})

	// Deploy from scheduled — should succeed (worker dispatch will fail but state should update)
	err := svc.Deploy(created.UUID, nil)
	if err != nil {
		t.Fatalf("deploy failed: %v", err)
	}

	lab, _ := svc.GetByUUID(created.UUID)
	if lab.State != StateDeploying {
		t.Errorf("expected state 'deploying' after deploy, got %q", lab.State)
	}
	if lab.DeployedAt == nil {
		t.Error("expected deployedAt to be set")
	}
}

func TestDeploy_FromStopped(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "redeploy-lab",
		TemplateID: "topo-1",
	})

	_ = svc.UpdateState(created.UUID, StateStopped, nil)

	err := svc.Deploy(created.UUID, nil)
	if err != nil {
		t.Fatalf("redeploy from stopped failed: %v", err)
	}

	lab, _ := svc.GetByUUID(created.UUID)
	if lab.State != StateDeploying {
		t.Errorf("expected state 'deploying', got %q", lab.State)
	}
}

func TestDeploy_FromFailed(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "retry-lab",
		TemplateID: "topo-1",
	})

	errMsg := "previous error"
	_ = svc.UpdateState(created.UUID, StateFailed, &errMsg)

	err := svc.Deploy(created.UUID, nil)
	if err != nil {
		t.Fatalf("deploy from failed state failed: %v", err)
	}

	lab, _ := svc.GetByUUID(created.UUID)
	if lab.State != StateDeploying {
		t.Errorf("expected state 'deploying', got %q", lab.State)
	}
	// Error should be cleared
	if lab.ErrorMessage != nil {
		t.Errorf("expected error message to be cleared, got %v", lab.ErrorMessage)
	}
}

func TestDeploy_NoWorkers(t *testing.T) {
	db := setupLabTestDB(t)
	repo := NewRepository(db)
	ws := &mockWorkerSelector{w: nil, err: nil}
	wc := workerclient.NewClient()
	tl := &mockTemplateLoader{definition: "name: test", bindFiles: map[string][]byte{}}
	svc := NewService(repo, ws, wc, tl, "http://localhost:8080")

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "no-worker-lab",
		TemplateID: "topo-1",
	})

	err := svc.Deploy(created.UUID, nil)
	if err == nil {
		t.Error("expected error when no workers available")
	}
}

func TestDelete(t *testing.T) {
	svc, _ := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "delete-lab",
		TemplateID: "topo-1",
	})

	// Add nodes
	_ = svc.UpdateNodes(created.UUID, []NodeResponse{
		{Name: "r1", Kind: "linux", Image: "alpine", State: "running"},
	})

	err := svc.Delete(created.UUID)
	if err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	_, err = svc.GetByUUID(created.UUID)
	if err == nil {
		t.Error("expected error when getting deleted lab")
	}
}

// --- NOS-aware config tests ---

func TestResolveNosKind(t *testing.T) {
	tests := []struct {
		kind, image, want string
	}{
		{"mikrotik_ros", "vrnetlab/mikrotik_routeros:7.20.8", "mikrotik_ros"},
		{"openwrt", "vrnetlab/openwrt_openwrt:24.10.0", "openwrt"},
		{"freebsd", "vrnetlab/freebsd:14", "freebsd"},
		{"linux", "quay.io/frrouting/frr:10.3.1", "frr"},
		{"linux", "osrg/gobgp:latest", "gobgp"},
		{"linux", "alpine:3.20", ""},
		{"linux", "nginx:alpine", ""},
	}
	for _, tt := range tests {
		got := resolveNosKind(tt.kind, tt.image)
		if got != tt.want {
			t.Errorf("resolveNosKind(%q, %q) = %q, want %q", tt.kind, tt.image, got, tt.want)
		}
	}
}

func TestExtractNosKinds(t *testing.T) {
	yaml := `name: test
topology:
  nodes:
    r1:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
    r2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
    host:
      kind: linux
      image: alpine:3.20`

	kinds := extractNosKinds(yaml)
	kindSet := make(map[string]bool)
	for _, k := range kinds {
		kindSet[k] = true
	}
	if !kindSet["mikrotik_ros"] {
		t.Error("expected mikrotik_ros in NOS kinds")
	}
	if !kindSet["frr"] {
		t.Error("expected frr in NOS kinds")
	}
	if kindSet[""] {
		t.Error("should not include empty NOS kind for generic linux")
	}
	if len(kinds) != 2 {
		t.Errorf("expected 2 NOS kinds, got %d: %v", len(kinds), kinds)
	}
}

func TestExtractNosKinds_AllRouterOS(t *testing.T) {
	yaml := `name: test
topology:
  nodes:
    r1:
      kind: mikrotik_ros
      image: vrnetlab/mikrotik_routeros:7.20.8
    host:
      kind: linux
      image: alpine:3.20`

	kinds := extractNosKinds(yaml)
	if len(kinds) != 1 || kinds[0] != "mikrotik_ros" {
		t.Errorf("expected [mikrotik_ros], got %v", kinds)
	}
}

func TestIsNodeConfigBind(t *testing.T) {
	tests := []struct {
		bind, node string
		want       bool
	}{
		{"router1.rsc", "router1", true},
		{"router1-daemons:/etc/frr/daemons", "router1", true},
		{"router1.conf:/etc/frr/frr.conf", "router1", true},
		{"router1-config.sh", "router1", true},
		{"switch-start.sh:/tmp/start.sh", "router1", false},
		{"kea-dhcp4.conf:/etc/kea/kea-dhcp4.conf", "router1", false},
		{"router2.rsc", "router1", false},
	}
	for _, tt := range tests {
		got := isNodeConfigBind(tt.bind, tt.node)
		if got != tt.want {
			t.Errorf("isNodeConfigBind(%q, %q) = %v, want %v", tt.bind, tt.node, got, tt.want)
		}
	}
}

func TestRewriteNodeConfig_RouterOSToFRR(t *testing.T) {
	nodeData := map[string]interface{}{
		"kind":           "mikrotik_ros",
		"image":          "vrnetlab/mikrotik_routeros:7.20.8",
		"startup-config": "router1.rsc",
	}

	rewriteNodeConfig(nodeData, "router1", "frr")

	if _, ok := nodeData["startup-config"]; ok {
		t.Error("startup-config should be removed for FRR")
	}
	binds, ok := nodeData["binds"].([]interface{})
	if !ok || len(binds) != 2 {
		t.Fatalf("expected 2 binds for FRR, got %v", nodeData["binds"])
	}
	if binds[0] != "router1-daemons:/etc/frr/daemons" {
		t.Errorf("expected daemons bind, got %v", binds[0])
	}
	if binds[1] != "router1.conf:/etc/frr/frr.conf" {
		t.Errorf("expected frr.conf bind, got %v", binds[1])
	}
}

func TestRewriteNodeConfig_FRRToRouterOS(t *testing.T) {
	nodeData := map[string]interface{}{
		"kind":  "linux",
		"image": "quay.io/frrouting/frr:10.3.1",
		"binds": []interface{}{
			"router1-daemons:/etc/frr/daemons",
			"router1.conf:/etc/frr/frr.conf",
		},
	}

	rewriteNodeConfig(nodeData, "router1", "mikrotik_ros")

	sc, ok := nodeData["startup-config"].(string)
	if !ok || sc != "router1.rsc" {
		t.Errorf("expected startup-config=router1.rsc, got %v", nodeData["startup-config"])
	}
	// Config binds should be removed
	if _, ok := nodeData["binds"]; ok {
		t.Errorf("FRR binds should be removed, got %v", nodeData["binds"])
	}
}

func TestRewriteNodeConfig_PreservesNonConfigBinds(t *testing.T) {
	nodeData := map[string]interface{}{
		"kind":           "mikrotik_ros",
		"image":          "vrnetlab/mikrotik_routeros:7.20.8",
		"startup-config": "router1.rsc",
		"binds": []interface{}{
			"extra-script.sh:/tmp/extra.sh",
		},
	}

	rewriteNodeConfig(nodeData, "router1", "frr")

	binds, ok := nodeData["binds"].([]interface{})
	if !ok {
		t.Fatal("expected binds to exist")
	}
	// Should have the non-config bind + 2 FRR binds = 3
	if len(binds) != 3 {
		t.Fatalf("expected 3 binds, got %d: %v", len(binds), binds)
	}
	if binds[0] != "extra-script.sh:/tmp/extra.sh" {
		t.Errorf("expected non-config bind preserved, got %v", binds[0])
	}
}

func TestRewriteNodeConfig_OpenWrt(t *testing.T) {
	nodeData := map[string]interface{}{
		"kind":           "mikrotik_ros",
		"image":          "vrnetlab/mikrotik_routeros:7.20.8",
		"startup-config": "router1.rsc",
	}

	rewriteNodeConfig(nodeData, "router1", "openwrt")

	sc, ok := nodeData["startup-config"].(string)
	if !ok || sc != "router1-config.sh" {
		t.Errorf("expected startup-config=router1-config.sh, got %v", nodeData["startup-config"])
	}
}

func TestGetStuckLabs(t *testing.T) {
	svc, db := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "stuck-lab",
		TemplateID: "topo-1",
	})
	_ = svc.UpdateState(created.UUID, StateDeploying, nil)

	// Manually set updated_at to 10 minutes ago
	db.Exec("UPDATE labs SET updated_at = ? WHERE uuid = ?",
		time.Now().Add(-10*time.Minute), created.UUID)

	svc.CleanupStuckLabs(5 * time.Minute)

	lab, _ := svc.GetByUUID(created.UUID)
	if lab.State != StateFailed {
		t.Errorf("expected stuck lab state to be 'failed', got %q", lab.State)
	}
}
