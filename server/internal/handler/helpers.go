package handler

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"unicode"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
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

// formatValidationErrors converts Go validator errors into user-friendly messages.
// e.g. "Key: 'CreateProductRequest.PriceUSDC' Error:... 'required' tag" → "price_usdc is required"
func formatValidationErrors(err error) string {
	var ve validator.ValidationErrors
	if !errors.As(err, &ve) {
		return err.Error()
	}
	msgs := make([]string, 0, len(ve))
	for _, fe := range ve {
		field := toSnakeCase(fe.Field())
		switch fe.Tag() {
		case "required":
			msgs = append(msgs, field+" is required")
		case "max":
			msgs = append(msgs, field+" exceeds maximum length of "+fe.Param())
		case "min":
			msgs = append(msgs, field+" must be at least "+fe.Param())
		case "oneof":
			msgs = append(msgs, field+" must be one of: "+fe.Param())
		case "len":
			msgs = append(msgs, field+" must be exactly "+fe.Param()+" characters")
		default:
			msgs = append(msgs, field+" is invalid")
		}
	}
	return strings.Join(msgs, "; ")
}

// toSnakeCase converts PascalCase to snake_case (e.g. PriceUSDC → price_usdc).
func toSnakeCase(s string) string {
	var b strings.Builder
	for i, r := range s {
		if unicode.IsUpper(r) {
			if i > 0 {
				b.WriteByte('_')
			}
			b.WriteRune(unicode.ToLower(r))
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func toPgText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}
