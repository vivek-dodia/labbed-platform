package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/labbed/platform/internal/auth"
	"github.com/labbed/platform/internal/config"
	"github.com/labbed/platform/internal/domain/collection"
	"github.com/labbed/platform/internal/domain/lab"
	"github.com/labbed/platform/internal/domain/nosimage"
	"github.com/labbed/platform/internal/domain/organization"
	"github.com/labbed/platform/internal/domain/topology"
	"github.com/labbed/platform/internal/domain/user"
	"github.com/labbed/platform/internal/domain/worker"
	"github.com/labbed/platform/internal/seed"
	"github.com/labbed/platform/internal/workerclient"
	"github.com/labbed/platform/internal/ws"
)

func main() {
	log.Println("labbed platform starting...")

	// Load configuration
	if err := config.Load(); err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Connect to database
	db, err := connectDB()
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Auto-migrate all models
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
		&nosimage.NosImage{},
	); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}
	log.Println("database migrated successfully")

	// Initialize repositories
	userRepo := user.NewRepository(db)
	orgRepo := organization.NewRepository(db)
	collectionRepo := collection.NewRepository(db)
	topologyRepo := topology.NewRepository(db)
	workerRepo := worker.NewRepository(db)
	labRepo := lab.NewRepository(db)
	nosImageRepo := nosimage.NewRepository(db)

	// Helper functions for cross-domain resolution
	resolveUserID := func(uuid string) (uint, error) {
		u, err := userRepo.GetByUUID(uuid)
		if err != nil {
			return 0, err
		}
		return u.ID, nil
	}

	resolveCollectionID := func(uuid string) (uint, error) {
		c, err := collectionRepo.GetByUUID(uuid)
		if err != nil {
			return 0, err
		}
		return c.ID, nil
	}

	resolveCollectionUUID := func(id uint) (string, error) {
		var c collection.Collection
		if err := db.First(&c, id).Error; err != nil {
			return "", err
		}
		return c.UUID, nil
	}

	resolveUserUUID := func(id uint) (string, error) {
		var u user.User
		if err := db.First(&u, id).Error; err != nil {
			return "", err
		}
		return u.UUID, nil
	}

	getUserCollectionIDs := func(userID uint, isAdmin bool) ([]uint, error) {
		var cols []collection.Collection
		var err error
		if isAdmin {
			cols, err = collectionRepo.GetAll()
		} else {
			cols, err = collectionRepo.GetByUserID(userID)
		}
		if err != nil {
			return nil, err
		}
		ids := make([]uint, len(cols))
		for i, c := range cols {
			ids[i] = c.ID
		}
		return ids, nil
	}

	// Initialize services (resolvers defined above)
	userService := user.NewService(userRepo)

	resolveUser := func(uuid string) (*user.User, error) {
		return userRepo.GetByUUID(uuid)
	}

	resolveUserInfo := func(id uint) (string, string, string, error) {
		var u user.User
		if err := db.First(&u, id).Error; err != nil {
			return "", "", "", err
		}
		return u.UUID, u.Email, u.DisplayName, nil
	}

	orgService := organization.NewService(orgRepo, userService, resolveUser)
	orgService.SetOnOrgCreated(func(orgDBID uint, creatorDBID uint) {
		seed.SeedSampleTopologies(db, orgDBID, creatorDBID)
	})
	collectionService := collection.NewService(collectionRepo, resolveUserUUID)
	topologyService := topology.NewService(topologyRepo, resolveCollectionUUID, resolveUserUUID)
	workerService := worker.NewService(workerRepo)
	workerHTTPClient := workerclient.NewClient()
	topoLoader := topology.NewLoader(topologyRepo)
	nosImageService := nosimage.NewService(nosImageRepo)
	labService := lab.NewService(labRepo, workerService, workerHTTPClient, topoLoader, config.AppConfig.Server.PlatformURL)
	labService.SetNosImageResolver(nosImageService)

	// Initialize WebSocket hub
	hub := ws.NewHub(config.AppConfig.Server.CORSOrigins)

	// Initialize Google OAuth (if enabled)
	var googleOAuth *auth.GoogleOAuth
	if config.AppConfig.Auth.Google.Enabled {
		googleOAuth = auth.NewGoogleOAuth(
			config.AppConfig.Auth.Google.ClientID,
			config.AppConfig.Auth.Google.ClientSecret,
			config.AppConfig.Auth.Google.RedirectURI,
		)
		log.Println("google OAuth enabled")
	}

	// Initialize handlers
	userHandler := user.NewHandler(userService)
	if googleOAuth != nil {
		userHandler.SetGoogleAuth(googleOAuth)
		userHandler.SetCreateOrgCallback(func(userDBID uint, name string) error {
			_, err := orgService.Create(userDBID, organization.CreateRequest{Name: name})
			return err
		})
	}
	orgHandler := organization.NewHandler(orgService, resolveUserID, resolveUserInfo)
	collectionHandler := collection.NewHandler(collectionService, resolveUserID)
	topologyHandler := topology.NewHandler(topologyService, resolveCollectionID, resolveUserID, getUserCollectionIDs)
	labHandler := lab.NewHandler(labService, hub, resolveUserID, getUserCollectionIDs)
	workerHandler := worker.NewHandler(workerService)
	nosImageHandler := nosimage.NewHandler(nosImageService)

	// Wire shell exec handler: channel format is "shell:{labUuid}:{nodeName}"
	hub.SetShellHandler(func(channel string, input string) (string, error) {
		parts := strings.SplitN(channel, ":", 3)
		if len(parts) != 3 || parts[0] != "shell" {
			return "", fmt.Errorf("invalid shell channel: %s", channel)
		}
		labUUID := parts[1]
		nodeName := parts[2]

		// Look up the lab to find its worker and clab name
		labResp, err := labService.GetByUUID(labUUID)
		if err != nil {
			return "", fmt.Errorf("lab not found: %w", err)
		}

		// Get the lab's worker
		labEntity, err := labRepo.GetByUUID(labUUID)
		if err != nil || labEntity.WorkerID == nil {
			return "", fmt.Errorf("lab has no worker assigned")
		}

		w, err := workerService.GetWorkerByID(*labEntity.WorkerID)
		if err != nil {
			return "", fmt.Errorf("worker not found: %w", err)
		}

		// Build the full container name: clab-{clabName}-{nodeName}
		// But the node names from the lab already include the clab prefix
		// Use the node name as-is if it matches, otherwise try with prefix
		containerName := nodeName
		for _, n := range labResp.Nodes {
			if n.Name == nodeName || strings.HasSuffix(n.Name, "-"+nodeName) {
				containerName = n.Name
				break
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		// Strip trailing newline from input for cleaner command execution
		cmd := strings.TrimRight(input, "\n\r")

		resp, err := workerHTTPClient.Exec(ctx, w.Address, w.Secret, workerclient.ExecRequest{
			LabID:    labUUID,
			NodeName: containerName,
			Command:  cmd,
		})
		if err != nil {
			return "", err
		}
		return resp.Output, nil
	})

	go hub.Run()

	// Ensure default admin exists and seed sample data
	if config.AppConfig.Auth.EnableNative {
		adminUser := userService.EnsureAdminExists(config.AppConfig.Auth.AdminEmail, config.AppConfig.Auth.AdminPassword)
		if adminUser != nil {
			seed.SeedDefaults(db, adminUser.ID)
		}
	}

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// CORS middleware
	router.Use(corsMiddleware(config.AppConfig.Server.CORSOrigins))

	// Global body size limit (1MB default, topology routes override)
	router.Use(auth.MaxBodySize(1 << 20))

	// Health check with DB connectivity
	router.GET("/health", func(c *gin.Context) {
		sqlDB, err := db.DB()
		if err != nil {
			c.JSON(503, gin.H{"status": "error", "database": "unavailable"})
			return
		}
		if err := sqlDB.Ping(); err != nil {
			c.JSON(503, gin.H{"status": "error", "database": "unreachable"})
			return
		}
		c.JSON(200, gin.H{"status": "ok", "database": "connected"})
	})

	// Rate limiter for auth endpoints: 20 requests per minute per IP
	authRateLimit := auth.RateLimit(20, time.Minute)

	// Register user/auth routes (has its own public + authenticated groups)
	user.RegisterRoutes(router, userHandler, authRateLimit)

	// Register public org routes (signup)
	organization.RegisterPublicRoutes(router, orgHandler, authRateLimit)

	// Authenticated API group
	apiV1 := router.Group("/api/v1")
	apiV1.Use(auth.AuthRequired())
	{
		// Organization management (no org context needed)
		organization.RegisterRoutes(apiV1, orgHandler)

		// Org-scoped routes: require X-Org-ID header
		orgScoped := apiV1.Group("")
		orgScoped.Use(auth.OrgContext(orgService.CheckMembership, resolveUserID))
		{
			// Collections
			collections := orgScoped.Group("/collections")
			collection.RegisterRoutes(collections, collectionHandler)

			// Topologies
			topologies := orgScoped.Group("/topologies")
			topology.RegisterRoutes(topologies, topologyHandler)

			// Labs
			lab.RegisterRoutes(orgScoped, labHandler)

			// NOS Images
			nosimage.RegisterRoutes(orgScoped, nosImageHandler)

			// Workers (admin only, handled in routes.go)
			worker.RegisterRoutes(orgScoped, workerHandler)
		}
	}

	// Internal API group (worker-to-platform, shared-secret auth)
	internal := router.Group("/api/internal")
	internal.Use(auth.WorkerAuth(config.AppConfig.Auth.JWTSecret))
	{
		worker.RegisterInternalRoutes(internal, workerHandler)
		lab.RegisterInternalRoutes(internal, labHandler)
	}

	// WebSocket endpoint
	router.GET("/ws", hub.HandleWebSocket)

	// Start stale worker detection
	go runStaleWorkerDetection(workerService)

	// Start orphaned lab cleanup
	go runOrphanedLabCleanup(labService)

	// Start server
	listenAddr := fmt.Sprintf("%s:%s", config.AppConfig.Server.Host, config.AppConfig.Server.Port)
	log.Printf("platform API listening on %s", listenAddr)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := router.Run(listenAddr); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit
	log.Println("platform shutting down...")
}

func connectDB() (*gorm.DB, error) {
	cfg := config.AppConfig.Database

	switch cfg.Driver {
	case "sqlite":
		return gorm.Open(sqlite.Open(cfg.SQLite), &gorm.Config{})
	case "postgres":
		dsn := fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name, cfg.SSLMode,
		)
		return gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		return nil, fmt.Errorf("unsupported database driver: %s", cfg.Driver)
	}
}

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Org-ID")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func runStaleWorkerDetection(workerService *worker.WorkerService) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		workerService.MarkStaleWorkers(45 * time.Second)
	}
}

func runOrphanedLabCleanup(labService *lab.LabService) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		labService.CleanupStuckLabs(5 * time.Minute)
	}
}
