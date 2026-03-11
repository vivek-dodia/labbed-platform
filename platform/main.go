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
		&collection.Collection{},
		&collection.CollectionMember{},
		&topology.Topology{},
		&topology.BindFile{},
		&worker.Worker{},
		&lab.Lab{},
		&lab.LabNode{},
	); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}
	log.Println("database migrated successfully")

	// Initialize repositories
	userRepo := user.NewRepository(db)
	collectionRepo := collection.NewRepository(db)
	topologyRepo := topology.NewRepository(db)
	workerRepo := worker.NewRepository(db)
	labRepo := lab.NewRepository(db)

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
	collectionService := collection.NewService(collectionRepo, resolveUserUUID)
	topologyService := topology.NewService(topologyRepo, resolveCollectionUUID, resolveUserUUID)
	workerService := worker.NewService(workerRepo)
	workerHTTPClient := workerclient.NewClient()
	topoLoader := topology.NewLoader(topologyRepo)
	labService := lab.NewService(labRepo, workerService, workerHTTPClient, topoLoader, config.AppConfig.Server.PlatformURL)

	// Initialize handlers
	userHandler := user.NewHandler(userService)
	collectionHandler := collection.NewHandler(collectionService, resolveUserID)
	topologyHandler := topology.NewHandler(topologyService, resolveCollectionID, resolveUserID, getUserCollectionIDs)
	labHandler := lab.NewHandler(labService, resolveUserID, getUserCollectionIDs)
	workerHandler := worker.NewHandler(workerService)

	// Initialize WebSocket hub
	hub := ws.NewHub()

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
	router.Use(corsMiddleware())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Register user/auth routes (has its own public + authenticated groups)
	user.RegisterRoutes(router, userHandler)

	// Authenticated API group
	apiV1 := router.Group("/api/v1")
	apiV1.Use(auth.AuthRequired())
	{
		// Collections
		collections := apiV1.Group("/collections")
		collection.RegisterRoutes(collections, collectionHandler)

		// Topologies
		topologies := apiV1.Group("/topologies")
		topology.RegisterRoutes(topologies, topologyHandler)

		// Labs
		lab.RegisterRoutes(apiV1, labHandler)

		// Workers (admin only, handled in routes.go)
		worker.RegisterRoutes(apiV1, workerHandler)
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

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
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
