package config

import (
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	// Worker identity
	Name string
	Port string

	// Platform connection
	PlatformURL    string
	PlatformSecret string

	// Containerlab
	ClabRuntime string
	WorkDir     string // base directory for topology files

	// Limits
	MaxConcurrentLabs int
}

var AppConfig Config

func Load() error {
	viper.SetConfigName("worker-config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("/etc/labbed/")

	// Defaults
	viper.SetDefault("name", "worker-1")
	viper.SetDefault("port", "8081")
	viper.SetDefault("platform_url", "http://localhost:8080")
	viper.SetDefault("platform_secret", "change-me")
	viper.SetDefault("clab_runtime", "docker")
	viper.SetDefault("work_dir", "/tmp/labbed-worker")
	viper.SetDefault("max_concurrent_labs", 0) // 0 = unlimited

	// Env overrides
	viper.SetEnvPrefix("LABBED_WORKER")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	_ = viper.ReadInConfig()

	AppConfig = Config{
		Name:              viper.GetString("name"),
		Port:              viper.GetString("port"),
		PlatformURL:       viper.GetString("platform_url"),
		PlatformSecret:    viper.GetString("platform_secret"),
		ClabRuntime:       viper.GetString("clab_runtime"),
		WorkDir:           viper.GetString("work_dir"),
		MaxConcurrentLabs: viper.GetInt("max_concurrent_labs"),
	}

	return nil
}
