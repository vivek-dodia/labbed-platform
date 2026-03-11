package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Auth     AuthConfig
}

type ServerConfig struct {
	Host        string
	Port        string
	PlatformURL string // External URL for worker callbacks, e.g. http://localhost:8080
}

type DatabaseConfig struct {
	Driver   string // postgres or sqlite
	Host     string
	Port     string
	Name     string
	User     string
	Password string
	SSLMode  string
	SQLite   string // path for sqlite file
}

type AuthConfig struct {
	JWTSecret         string
	AccessTokenExpiry time.Duration
	RefreshTokenExpiry time.Duration
	EnableNative      bool
	AdminEmail        string
	AdminPassword     string
}

var AppConfig Config

func Load() error {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("/etc/labbed/")

	// Defaults
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.platform_url", "http://localhost:8080")

	viper.SetDefault("database.driver", "postgres")
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", "5432")
	viper.SetDefault("database.name", "labbed")
	viper.SetDefault("database.user", "labbed")
	viper.SetDefault("database.password", "labbed")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.sqlite", "labbed.db")

	viper.SetDefault("auth.jwt_secret", "change-me-in-production")
	viper.SetDefault("auth.access_token_expiry", "30m")
	viper.SetDefault("auth.refresh_token_expiry", "720h")
	viper.SetDefault("auth.enable_native", true)
	viper.SetDefault("auth.admin_email", "admin@labbed.local")
	viper.SetDefault("auth.admin_password", "admin")

	// Environment variable overrides
	viper.SetEnvPrefix("LABBED")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	// Try to read config file (not required)
	_ = viper.ReadInConfig()

	accessExpiry, err := time.ParseDuration(viper.GetString("auth.access_token_expiry"))
	if err != nil {
		accessExpiry = 30 * time.Minute
	}
	refreshExpiry, err := time.ParseDuration(viper.GetString("auth.refresh_token_expiry"))
	if err != nil {
		refreshExpiry = 720 * time.Hour
	}

	AppConfig = Config{
		Server: ServerConfig{
			Host:        viper.GetString("server.host"),
			Port:        viper.GetString("server.port"),
			PlatformURL: viper.GetString("server.platform_url"),
		},
		Database: DatabaseConfig{
			Driver:   viper.GetString("database.driver"),
			Host:     viper.GetString("database.host"),
			Port:     viper.GetString("database.port"),
			Name:     viper.GetString("database.name"),
			User:     viper.GetString("database.user"),
			Password: viper.GetString("database.password"),
			SSLMode:  viper.GetString("database.sslmode"),
			SQLite:   viper.GetString("database.sqlite"),
		},
		Auth: AuthConfig{
			JWTSecret:          viper.GetString("auth.jwt_secret"),
			AccessTokenExpiry:  accessExpiry,
			RefreshTokenExpiry: refreshExpiry,
			EnableNative:       viper.GetBool("auth.enable_native"),
			AdminEmail:         viper.GetString("auth.admin_email"),
			AdminPassword:      viper.GetString("auth.admin_password"),
		},
	}

	return nil
}
