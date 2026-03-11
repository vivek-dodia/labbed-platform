// One-off tool to seed sample topologies into an existing org.
// Usage: go run cmd/seed-org/main.go <orgID> <creatorUserID>
package main

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/labbed/platform/internal/seed"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintf(os.Stderr, "usage: %s <orgID> <creatorUserID>\n", os.Args[0])
		os.Exit(1)
	}

	orgID, _ := strconv.ParseUint(os.Args[1], 10, 64)
	userID, _ := strconv.ParseUint(os.Args[2], 10, 64)

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		envOr("LABBED_DB_HOST", "localhost"),
		envOr("LABBED_DB_PORT", "5432"),
		envOr("LABBED_DB_USER", "labbed"),
		envOr("LABBED_DB_PASSWORD", "labbed"),
		envOr("LABBED_DB_NAME", "labbed"),
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect: %v", err)
	}

	seed.SeedSampleTopologies(db, uint(orgID), uint(userID))
	log.Println("done")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
