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

// mockTopoLoader implements TopologyLoader for testing.
type mockTopoLoader struct {
	definition string
	bindFiles  map[string][]byte
	err        error
}

func (m *mockTopoLoader) GetDefinition(topoUUID string) (string, error) {
	return m.definition, m.err
}
func (m *mockTopoLoader) GetBindFiles(topoUUID string) (map[string][]byte, error) {
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
	tl := &mockTopoLoader{
		definition: "name: test-topo\ntopology:\n  nodes:\n    r1:\n      kind: linux\n      image: alpine:3.20",
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
		TopologyID: "topo-uuid-1",
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
	if resp.TopologyID != "topo-uuid-1" {
		t.Errorf("expected topologyId 'topo-uuid-1', got %q", resp.TopologyID)
	}
}

func TestCreateLab_WithSchedule(t *testing.T) {
	svc, _ := setupLabService(t)

	start := time.Now().Add(1 * time.Hour).Format(time.RFC3339)
	end := time.Now().Add(2 * time.Hour).Format(time.RFC3339)

	resp, err := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:           "scheduled-lab",
		TopologyID:     "topo-uuid-2",
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
		TopologyID: "topo-uuid-3",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
	})

	nodes := []NodeResponse{
		{Name: "router1", Kind: "linux", Image: "alpine:3.20", ContainerID: "abc123", IPv4: "172.20.20.2", State: "running"},
		{Name: "host1", Kind: "linux", Image: "alpine:3.20", ContainerID: "def456", IPv4: "172.20.20.3", State: "running"},
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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
	tl := &mockTopoLoader{definition: "name: test", bindFiles: map[string][]byte{}}
	svc := NewService(repo, ws, wc, tl, "http://localhost:8080")

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "no-worker-lab",
		TopologyID: "topo-1",
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
		TopologyID: "topo-1",
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

func TestGetStuckLabs(t *testing.T) {
	svc, db := setupLabService(t)

	created, _ := svc.CreateWithOrg(1, 1, CreateRequest{
		Name:       "stuck-lab",
		TopologyID: "topo-1",
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
