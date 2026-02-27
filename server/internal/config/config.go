package config

import (
	"os"
	"time"
)

type Config struct {
	DatabaseURL       string
	RedisURL          string
	Port              string
	FacilitatorURL    string
	X402Network       string
	CDPAPIKeyID       string
	CDPAPIKeySecret   string
	RPCURL            string
	ChainPollInterval time.Duration
	EscrowContract    string
	KeeperPrivateKey  string
}

func Load() *Config {
	return &Config{
		DatabaseURL:       getEnv("DATABASE_URL", "postgres://admin:admin@localhost:5433/clay_cosmos?sslmode=disable"),
		RedisURL:          getEnv("REDIS_URL", "redis://localhost:6379/0"),
		Port:              getEnv("PORT", "8080"),
		FacilitatorURL:    getEnv("X402_FACILITATOR_URL", "https://api.cdp.coinbase.com/platform/v2/x402"),
		X402Network:       getEnv("X402_NETWORK", "base"),
		CDPAPIKeyID:       getEnv("CDP_API_KEY_ID", ""),
		CDPAPIKeySecret:   getEnv("CDP_API_KEY_SECRET", ""),
		RPCURL:            getEnv("RPC_URL", ""),
		ChainPollInterval: parseDuration(getEnv("CHAIN_POLL_INTERVAL", "15s"), 15*time.Second),
		EscrowContract:    getEnv("ESCROW_CONTRACT", ""),
		KeeperPrivateKey:  getEnv("KEEPER_PRIVATE_KEY", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(s string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return fallback
	}
	return d
}
