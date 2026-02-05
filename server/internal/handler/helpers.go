package handler

import (
	"encoding/json"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

var slugRegexp = regexp.MustCompile(`[^a-z0-9]+`)

func respondError(c *gin.Context, err *apierr.APIError) {
	c.JSON(err.Status, gin.H{"code": err.Code, "message": err.Message})
}

func isUniqueViolation(err error) bool {
	return strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint")
}

func toJSON(v any) []byte {
	if v == nil {
		return nil
	}
	b, _ := json.Marshal(v)
	return b
}

// sanitizeSlug normalises a user-provided slug: lowercase, alphanumeric + hyphens only,
// no leading/trailing hyphens, collapsed runs, max 128 chars.
func sanitizeSlug(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = slugRegexp.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 128 {
		s = s[:128]
		s = strings.TrimRight(s, "-")
	}
	return s
}

// isValidSlug checks that a slug contains only a-z, 0-9, and hyphens,
// is at least 2 characters, and does not start/end with a hyphen.
var validSlugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*[a-z0-9]$`)

func isValidSlug(slug string) bool {
	if len(slug) < 2 || len(slug) > 128 {
		return false
	}
	return validSlugPattern.MatchString(slug)
}

func toPgText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}
