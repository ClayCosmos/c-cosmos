package config

import "os"

type Config struct {
	DatabaseURL    string
	RedisURL       string
	Port           string
	FacilitatorURL string
	X402Network    string
}

func Load() *Config {
	return &Config{
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://admin:admin@localhost:5433/clay_cosmos?sslmode=disable"),
		RedisURL:       getEnv("REDIS_URL", "redis://localhost:6379/0"),
		Port:           getEnv("PORT", "8080"),
		FacilitatorURL: getEnv("X402_FACILITATOR_URL", "https://facilitator.x402.rs"),
		X402Network:    getEnv("X402_NETWORK", "base-sepolia"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
