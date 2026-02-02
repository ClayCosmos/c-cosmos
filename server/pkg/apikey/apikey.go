package apikey

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

const prefix = "cc_sk_"

// Generate creates a new API key and returns (rawKey, prefix8, sha256Hash).
func Generate() (string, string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", "", fmt.Errorf("generate random bytes: %w", err)
	}
	raw := prefix + hex.EncodeToString(b)
	hash := Hash(raw)
	return raw, raw[len(prefix) : len(prefix)+8], hash, nil
}

// Hash returns the SHA-256 hex digest of a raw API key.
func Hash(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}
