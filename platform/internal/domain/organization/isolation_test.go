package organization_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/labbed/platform/internal/auth"
	"github.com/labbed/platform/internal/domain/collection"
	"github.com/labbed/platform/internal/domain/lab"
	"github.com/labbed/platform/internal/domain/organization"
	"github.com/labbed/platform/internal/domain/topology"
	"github.com/labbed/platform/internal/domain/user"
	"github.com/labbed/platform/internal/domain/worker"
)

func init() {
	gin.SetMode(gin.TestMode)
}

type testEnv struct {
	db             *gorm.DB
	router         *gin.Engine
	orgService     *organization.OrgService
	colService     *collection.CollectionService
	topoService    *topology.TopologyService
	labService     *lab.LabService
	workerService  *worker.WorkerService
	user1          *user.User // member of org1
	user2          *user.User // member of org2
	org1DBID       uint
	org2DBID       uint
	org1UUID       string
	org2UUID       string
}

func setupFullEnv(t *testing.T) *testEnv {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.AutoMigrate(
		&user.User{},
		&organization.Organization{},
		&organization.OrganizationMember{},
		&collection.Collection{},
		&collection.CollectionMember{},
		&topology.Topology{},
		&topology.BindFile{},
		&worker.Worker{},
		&lab.Lab{},
		&lab.LabNode{},
		&lab.LabEvent{},
	); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	// Create users
	u1 := &user.User{UUID: uuid.New().String(), Email: "user1@test.com", PasswordHash: "x", DisplayName: "User1"}
	u2 := &user.User{UUID: uuid.New().String(), Email: "user2@test.com", PasswordHash: "x", DisplayName: "User2"}
	db.Create(u1)
	db.Create(u2)

	// Create orgs
	org1 := &organization.Organization{UUID: uuid.New().String(), Name: "Org1", Slug: "org1", Plan: "free", MaxLabs: 5, MaxWorkers: 2}
	org2 := &organization.Organization{UUID: uuid.New().String(), Name: "Org2", Slug: "org2", Plan: "free", MaxLabs: 5, MaxWorkers: 2}
	db.Create(org1)
	db.Create(org2)

	// Add memberships
	db.Create(&organization.OrganizationMember{OrgID: org1.ID, UserID: u1.ID, Role: organization.RoleOwner})
	db.Create(&organization.OrganizationMember{OrgID: org2.ID, UserID: u2.ID, Role: organization.RoleOwner})

	// Services
	userRepo := user.NewRepository(db)
	userService := user.NewService(userRepo)
	orgRepo := organization.NewRepository(db)
	resolveUser := func(uuid string) (*user.User, error) { return userRepo.GetByUUID(uuid) }
	orgService := organization.NewService(orgRepo, userService, resolveUser)

	resolveUserUUID := func(id uint) (string, error) {
		var u user.User
		if err := db.First(&u, id).Error; err != nil {
			return "", err
		}
		return u.UUID, nil
	}
	resolveCollectionUUID := func(id uint) (string, error) {
		var c collection.Collection
		if err := db.First(&c, id).Error; err != nil {
			return "", err
		}
		return c.UUID, nil
	}

	colRepo := collection.NewRepository(db)
	colService := collection.NewService(colRepo, resolveUserUUID)

	topoRepo := topology.NewRepository(db)
	topoService := topology.NewService(topoRepo, resolveCollectionUUID, resolveUserUUID)

	workerRepo := worker.NewRepository(db)
	workerService := worker.NewService(workerRepo)

	labRepo := lab.NewRepository(db)
	labService := lab.NewService(labRepo, workerService, nil, nil, "http://localhost:8080")

	// Resolve helpers
	resolveUserID := func(uuid string) (uint, error) {
		u, err := userRepo.GetByUUID(uuid)
		if err != nil {
			return 0, err
		}
		return u.ID, nil
	}
	resolveCollectionID := func(uuid string) (uint, error) {
		c, err := colRepo.GetByUUID(uuid)
		if err != nil {
			return 0, err
		}
		return c.ID, nil
	}
	getUserCollectionIDs := func(userID uint, isAdmin bool) ([]uint, error) {
		cols, err := colRepo.GetAll()
		if err != nil {
			return nil, err
		}
		ids := make([]uint, len(cols))
		for i, c := range cols {
			ids[i] = c.ID
		}
		return ids, nil
	}

	resolveUserInfo := func(id uint) (string, string, string, error) {
		var u user.User
		if err := db.First(&u, id).Error; err != nil {
			return "", "", "", err
		}
		return u.UUID, u.Email, u.DisplayName, nil
	}

	// Handlers
	colHandler := collection.NewHandler(colService, resolveUserID)
	topoHandler := topology.NewHandler(topoService, resolveCollectionID, resolveUserID, getUserCollectionIDs)
	labHandler := lab.NewHandler(labService, nil, resolveUserID, getUserCollectionIDs)
	workerHandler := worker.NewHandler(workerService)
	orgHandler := organization.NewHandler(orgService, resolveUserID, resolveUserInfo)

	// Router
	router := gin.New()

	// Org management routes (authenticated, no org context)
	apiV1 := router.Group("/api/v1")
	apiV1.Use(fakeAuth())
	organization.RegisterRoutes(apiV1, orgHandler)

	// Org-scoped routes
	orgScoped := apiV1.Group("")
	orgScoped.Use(auth.OrgContext(orgService.CheckMembership, resolveUserID))
	{
		cols := orgScoped.Group("/collections")
		collection.RegisterRoutes(cols, colHandler)

		topos := orgScoped.Group("/topologies")
		topology.RegisterRoutes(topos, topoHandler)

		lab.RegisterRoutes(orgScoped, labHandler)
		worker.RegisterRoutes(orgScoped, workerHandler)
	}

	return &testEnv{
		db:            db,
		router:        router,
		orgService:    orgService,
		colService:    colService,
		topoService:   topoService,
		labService:    labService,
		workerService: workerService,
		user1:         u1,
		user2:         u2,
		org1DBID:      org1.ID,
		org2DBID:      org2.ID,
		org1UUID:      org1.UUID,
		org2UUID:      org2.UUID,
	}
}

// fakeAuth sets user context from X-Test-User-UUID and X-Test-Is-Admin headers.
func fakeAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if userUUID := c.GetHeader("X-Test-User-UUID"); userUUID != "" {
			c.Set("user_id", userUUID)
		}
		if c.GetHeader("X-Test-Is-Admin") == "true" {
			c.Set("is_admin", true)
		}
		c.Next()
	}
}

func doRequest(router *gin.Engine, method, path string, body interface{}, userUUID, orgUUID string) *httptest.ResponseRecorder {
	return doRequestAdmin(router, method, path, body, userUUID, orgUUID, false)
}

func doRequestAdmin(router *gin.Engine, method, path string, body interface{}, userUUID, orgUUID string, isAdmin bool) *httptest.ResponseRecorder {
	var bodyReader *strings.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		bodyReader = strings.NewReader(string(b))
	} else {
		bodyReader = strings.NewReader("")
	}

	req := httptest.NewRequest(method, path, bodyReader)
	req.Header.Set("Content-Type", "application/json")
	if userUUID != "" {
		req.Header.Set("X-Test-User-UUID", userUUID)
	}
	if orgUUID != "" {
		req.Header.Set("X-Org-ID", orgUUID)
	}
	if isAdmin {
		req.Header.Set("X-Test-Is-Admin", "true")
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// --- Collection isolation tests ---

func TestCollectionIsolation_CreateAndList(t *testing.T) {
	env := setupFullEnv(t)

	// User1 creates collection in org1
	w := doRequest(env.router, "POST", "/api/v1/collections",
		map[string]interface{}{"name": "Org1 Collection"},
		env.user1.UUID, env.org1UUID)
	if w.Code != http.StatusCreated {
		t.Fatalf("create collection: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	// User1 lists collections in org1 — should see it
	w = doRequest(env.router, "GET", "/api/v1/collections", nil, env.user1.UUID, env.org1UUID)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", w.Code)
	}
	var cols []map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &cols)
	if len(cols) != 1 {
		t.Errorf("expected 1 collection in org1, got %d", len(cols))
	}

	// User2 lists collections in org2 — should see none
	w = doRequest(env.router, "GET", "/api/v1/collections", nil, env.user2.UUID, env.org2UUID)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", w.Code)
	}
	json.Unmarshal(w.Body.Bytes(), &cols)
	if len(cols) != 0 {
		t.Errorf("expected 0 collections in org2, got %d", len(cols))
	}
}

func TestCollectionIsolation_CrossOrgAccessDenied(t *testing.T) {
	env := setupFullEnv(t)

	// Create collection in org1
	col, err := env.colService.Create(env.user1.ID, env.user1.UUID, env.org1DBID,
		collection.CreateRequest{Name: "Org1 Only"})
	if err != nil {
		t.Fatalf("create collection failed: %v", err)
	}

	// User2 in org2 tries to GET org1's collection
	w := doRequest(env.router, "GET", "/api/v1/collections/"+col.UUID, nil, env.user2.UUID, env.org2UUID)
	if w.Code != http.StatusNotFound {
		t.Errorf("cross-org GET: expected 404, got %d", w.Code)
	}

	// User2 in org2 tries to DELETE org1's collection
	w = doRequest(env.router, "DELETE", "/api/v1/collections/"+col.UUID, nil, env.user2.UUID, env.org2UUID)
	if w.Code != http.StatusNotFound {
		t.Errorf("cross-org DELETE: expected 404, got %d", w.Code)
	}
}

// --- Lab isolation tests ---

func TestLabIsolation_CrossOrgAccessDenied(t *testing.T) {
	env := setupFullEnv(t)

	// Create a lab directly in org1
	labResp, err := env.labService.CreateWithOrg(env.user1.ID, env.org1DBID, lab.CreateRequest{
		Name:       "Org1 Lab",
		TopologyID: "topo-1",
	})
	if err != nil {
		t.Fatalf("create lab failed: %v", err)
	}

	// User1 in org1 can access it
	w := doRequest(env.router, "GET", "/api/v1/labs/"+labResp.UUID, nil, env.user1.UUID, env.org1UUID)
	if w.Code != http.StatusOK {
		t.Errorf("same-org GET: expected 200, got %d", w.Code)
	}

	// User2 in org2 cannot access it
	w = doRequest(env.router, "GET", "/api/v1/labs/"+labResp.UUID, nil, env.user2.UUID, env.org2UUID)
	if w.Code != http.StatusNotFound {
		t.Errorf("cross-org GET: expected 404, got %d: %s", w.Code, w.Body.String())
	}

	// User2 in org2 cannot delete it
	w = doRequest(env.router, "DELETE", "/api/v1/labs/"+labResp.UUID, nil, env.user2.UUID, env.org2UUID)
	if w.Code != http.StatusNotFound {
		t.Errorf("cross-org DELETE: expected 404, got %d", w.Code)
	}
}

func TestLabIsolation_ListScoped(t *testing.T) {
	env := setupFullEnv(t)

	// Create labs in both orgs
	_, _ = env.labService.CreateWithOrg(env.user1.ID, env.org1DBID, lab.CreateRequest{Name: "Lab A", TopologyID: "t1"})
	_, _ = env.labService.CreateWithOrg(env.user1.ID, env.org1DBID, lab.CreateRequest{Name: "Lab B", TopologyID: "t2"})
	_, _ = env.labService.CreateWithOrg(env.user2.ID, env.org2DBID, lab.CreateRequest{Name: "Lab C", TopologyID: "t3"})

	// Org1 should see 2 labs
	w := doRequest(env.router, "GET", "/api/v1/labs", nil, env.user1.UUID, env.org1UUID)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].([]interface{})
	if len(data) != 2 {
		t.Errorf("expected 2 labs in org1, got %d", len(data))
	}

	// Org2 should see 1 lab
	w = doRequest(env.router, "GET", "/api/v1/labs", nil, env.user2.UUID, env.org2UUID)
	json.Unmarshal(w.Body.Bytes(), &resp)
	data = resp["data"].([]interface{})
	if len(data) != 1 {
		t.Errorf("expected 1 lab in org2, got %d", len(data))
	}
}

// --- Topology isolation tests ---

func TestTopologyIsolation_CrossOrgAccessDenied(t *testing.T) {
	env := setupFullEnv(t)

	// Create a collection in org1
	col, _ := env.colService.Create(env.user1.ID, env.user1.UUID, env.org1DBID,
		collection.CreateRequest{Name: "Org1 Col"})
	colDBID := uint(0)
	env.db.Model(&collection.Collection{}).Where("uuid = ?", col.UUID).Pluck("id", &colDBID)

	// Create a topology in org1
	topoResp, err := env.topoService.CreateWithOrg(env.user1.ID, colDBID, env.org1DBID,
		topology.CreateRequest{
			Name:         "Org1 Topo",
			Definition:   "name: test\ntopology:\n  nodes:\n    n1:\n      kind: linux\n      image: alpine:3.20",
			CollectionID: col.UUID,
		})
	if err != nil {
		t.Fatalf("create topology failed: %v", err)
	}

	// User1 in org1 can access it
	w := doRequest(env.router, "GET", "/api/v1/topologies/"+topoResp.UUID, nil, env.user1.UUID, env.org1UUID)
	if w.Code != http.StatusOK {
		t.Errorf("same-org GET: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// User2 in org2 cannot access it
	w = doRequest(env.router, "GET", "/api/v1/topologies/"+topoResp.UUID, nil, env.user2.UUID, env.org2UUID)
	if w.Code != http.StatusNotFound {
		t.Errorf("cross-org GET: expected 404, got %d", w.Code)
	}
}

// --- Worker isolation tests ---

func TestWorkerIsolation_OrgScopedAccess(t *testing.T) {
	env := setupFullEnv(t)

	// Create worker in org1 directly
	w1 := &worker.Worker{
		UUID:    uuid.New().String(),
		Name:    "worker-org1",
		OrgID:   env.org1DBID,
		Address: "http://10.0.0.1:8081",
		Secret:  "secret1",
		State:   worker.StateOnline,
	}
	env.db.Create(w1)

	// Platform admin accessing org1 can see the worker
	resp := doRequestAdmin(env.router, "GET", "/api/v1/workers/"+w1.UUID, nil, env.user1.UUID, env.org1UUID, true)
	if resp.Code != http.StatusOK {
		t.Errorf("same-org GET worker: expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	// Platform admin accessing org2 cannot see org1's worker (org scoping)
	// Note: platform admins bypass org membership check but org scoping still applies
	resp = doRequestAdmin(env.router, "GET", "/api/v1/workers/"+w1.UUID, nil, env.user1.UUID, env.org2UUID, true)
	if resp.Code != http.StatusNotFound {
		t.Errorf("cross-org GET worker: expected 404, got %d", resp.Code)
	}
}

func TestWorkerIsolation_ListScoped(t *testing.T) {
	env := setupFullEnv(t)

	// Workers in different orgs
	env.db.Create(&worker.Worker{UUID: uuid.New().String(), Name: "w1", OrgID: env.org1DBID, Address: "http://1:8081", Secret: "s", State: worker.StateOnline})
	env.db.Create(&worker.Worker{UUID: uuid.New().String(), Name: "w2", OrgID: env.org1DBID, Address: "http://2:8081", Secret: "s", State: worker.StateOnline})
	env.db.Create(&worker.Worker{UUID: uuid.New().String(), Name: "w3", OrgID: env.org2DBID, Address: "http://3:8081", Secret: "s", State: worker.StateOnline})

	// Org1 admin should see 2
	resp := doRequestAdmin(env.router, "GET", "/api/v1/workers", nil, env.user1.UUID, env.org1UUID, true)
	if resp.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var workers []map[string]interface{}
	json.Unmarshal(resp.Body.Bytes(), &workers)
	if len(workers) != 2 {
		t.Errorf("expected 2 workers in org1, got %d", len(workers))
	}

	// Org2 admin should see 1
	resp = doRequestAdmin(env.router, "GET", "/api/v1/workers", nil, env.user2.UUID, env.org2UUID, true)
	json.Unmarshal(resp.Body.Bytes(), &workers)
	if len(workers) != 1 {
		t.Errorf("expected 1 worker in org2, got %d", len(workers))
	}
}

// --- Org membership tests via API ---

func TestOrgContext_NonMemberDenied(t *testing.T) {
	env := setupFullEnv(t)

	// User2 tries to access org1's resources (not a member)
	w := doRequest(env.router, "GET", "/api/v1/collections", nil, env.user2.UUID, env.org1UUID)
	if w.Code != http.StatusForbidden {
		t.Errorf("non-member access: expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestOrgContext_MissingOrgHeader(t *testing.T) {
	env := setupFullEnv(t)

	// Request to org-scoped route without X-Org-ID
	w := doRequest(env.router, "GET", "/api/v1/collections", nil, env.user1.UUID, "")
	if w.Code != http.StatusBadRequest {
		t.Errorf("missing org header: expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
