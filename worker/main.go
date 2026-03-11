package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labbed/worker/internal/api"
	"github.com/labbed/worker/internal/clab"
	"github.com/labbed/worker/internal/config"
	"github.com/labbed/worker/internal/platformclient"
)

func main() {
	log.Println("labbed worker starting...")

	// Load config
	if err := config.Load(); err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Ensure work directory exists
	if err := os.MkdirAll(config.AppConfig.WorkDir, 0750); err != nil {
		log.Fatalf("failed to create work directory: %v", err)
	}

	// Initialize services
	clabService := clab.NewService()
	platClient := platformclient.NewClient()
	handler := api.NewHandler(clabService, platClient)

	// Register with platform
	workerAddr := fmt.Sprintf("http://%s:%s", getOutboundIP(), config.AppConfig.Port)
	registerCtx, registerCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer registerCancel()

	resp, err := platClient.Register(registerCtx, platformclient.RegisterRequest{
		Name:    config.AppConfig.Name,
		Address: workerAddr,
		Secret:  config.AppConfig.PlatformSecret,
	})
	if err != nil {
		log.Printf("WARNING: failed to register with platform: %v (will retry via heartbeat)", err)
	} else {
		log.Printf("registered with platform as worker %s (UUID: %s)", config.AppConfig.Name, resp.UUID)
	}

	// Start heartbeat loop with cancellation
	heartbeatCtx, heartbeatCancel := context.WithCancel(context.Background())
	defer heartbeatCancel()
	go heartbeatLoop(heartbeatCtx, platClient, handler)

	// Setup HTTP server
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()
	api.SetupRoutes(router, handler, config.AppConfig.PlatformSecret)

	listenAddr := fmt.Sprintf(":%s", config.AppConfig.Port)
	log.Printf("worker listening on %s", listenAddr)

	server := &http.Server{
		Addr:    listenAddr,
		Handler: router,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("worker shutting down...")

	// Stop heartbeat
	heartbeatCancel()

	// Shut down HTTP server gracefully
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("server shutdown error: %v", err)
	}

	// Log active labs warning
	if count := handler.ActiveLabCount(); count > 0 {
		log.Printf("WARNING: %d labs still active on this worker", count)
	}

	log.Println("worker stopped")
}

func heartbeatLoop(ctx context.Context, client *platformclient.Client, handler *api.Handler) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			hbCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			if err := client.Heartbeat(hbCtx, handler.ActiveLabCount()); err != nil {
				log.Printf("heartbeat failed: %v", err)
			}
			cancel()
		}
	}
}

// getOutboundIP gets the preferred outbound IP of this machine.
func getOutboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "localhost"
	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP.String()
}
