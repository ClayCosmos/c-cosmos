package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type CardHandler struct {
	pool *pgxpool.Pool
}

func NewCardHandler(pool *pgxpool.Pool) *CardHandler {
	return &CardHandler{pool: pool}
}

type CardProfile struct {
	Slug         string       `json:"slug"`
	Name         string       `json:"name"`
	Description  string       `json:"description"`
	Role         string       `json:"role"`
	Bio          string       `json:"bio"`
	Links        []CardLink   `json:"links"`
	Theme        string       `json:"theme"`
	Verified     bool         `json:"verified"`
	CreatedAt    string       `json:"created_at"`
	Reputation   Reputation   `json:"reputation"`
	TradingStats TradingStats `json:"trading_stats"`
	Badges       []string     `json:"badges"`
	TrustScore   int          `json:"trust_score"`
}

type CardLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type Reputation struct {
	TrustScore     int      `json:"trust_score"`
	TotalRatings   int      `json:"total_ratings"`
	AvgRating      float64  `json:"avg_rating"`
	ResponseTimeMs int      `json:"response_time_ms"`
	DisputeCount   int      `json:"dispute_count"`
	Badges         []string `json:"badges"`
}

type TradingStats struct {
	TotalTransactions  int     `json:"total_transactions"`
	Completed         int     `json:"completed"`
	Cancelled         int     `json:"cancelled"`
	Disputed          int     `json:"disputed"`
	TotalVolumeUSD    float64 `json:"total_volume_usd"`
	LastTransactionAt string  `json:"last_transaction_at"`
}

// GET /cards/:slug — Public card page
func (h *CardHandler) GetCard(c *gin.Context) {
	slug := strings.TrimPrefix(c.Param("slug"), "@")
	if slug == "" {
		respondError(c, apierr.BadRequest("slug required"))
		return
	}

	var profile CardProfile
	var reputationJSON, tradingStatsJSON []byte
	var bio, theme sql.NullString
	var linksJSON []byte
	var verified bool
	var createdAt sql.NullString
	var description sql.NullString

	err := h.pool.QueryRow(c.Request.Context(), `
		SELECT
			COALESCE(card_slug, lower(name)),
			name,
			COALESCE(description, ''),
			role,
			COALESCE(card_bio, ''),
			COALESCE(card_links, '[]'),
			COALESCE(card_theme, 'dark'),
			card_verified,
			COALESCE(card_created_at, created_at)::text,
			reputation,
			trading_stats
		FROM agents
		WHERE lower(COALESCE(card_slug, name)) = lower($1)
		  AND COALESCE(card_enabled, true) = true
	`, slug).Scan(
		&profile.Slug, &profile.Name, &description,
		&profile.Role, &bio, &linksJSON, &theme, &verified,
		&createdAt, &reputationJSON, &tradingStatsJSON,
	)
	if err != nil {
		respondError(c, apierr.NotFound("card not found"))
		return
	}

	profile.Bio = bio.String
	profile.Theme = theme.String
	profile.Verified = verified
	profile.Description = description.String
	if createdAt.Valid {
		profile.CreatedAt = createdAt.String
	}

	_ = json.Unmarshal(reputationJSON, &profile.Reputation)
	_ = json.Unmarshal(tradingStatsJSON, &profile.TradingStats)
	_ = json.Unmarshal(linksJSON, &profile.Links)

	profile.TrustScore = computeTrustScore(profile.Reputation, profile.TradingStats)
	profile.Badges = computeBadges(profile.Reputation, profile.TradingStats, profile.Verified, profile.Role)

	c.JSON(http.StatusOK, profile)
}

// PATCH /cards/me — Update own card
func (h *CardHandler) UpdateCard(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	var req struct {
		Bio         *string `json:"card_bio"`
		Links       *[]struct {
			Label string `json:"label"`
			URL   string `json:"url"`
		} `json:"card_links"`
		Theme       *string `json:"card_theme"`
		CardSlug    *string `json:"card_slug"`
		CardEnabled *bool   `json:"card_enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	if req.CardSlug != nil {
		slug := strings.ToLower(*req.CardSlug)
		if len(slug) < 2 || len(slug) > 64 {
			respondError(c, apierr.BadRequest("slug must be 2-64 characters"))
			return
		}
		matched, _ := regexp.MatchString(`^[a-z0-9-]+$`, slug)
		if !matched {
			respondError(c, apierr.BadRequest("slug can only contain letters, numbers, and hyphens"))
			return
		}
		var count int
		h.pool.QueryRow(c.Request.Context(), `
			SELECT COUNT(*) FROM agents
			WHERE lower(COALESCE(card_slug, name)) = $1 AND id != $2
		`, slug, agent.ID).Scan(&count)
		if err != nil {
			respondError(c, apierr.Internal("failed to check slug uniqueness"))
			return
		}
		if count > 0 {
			respondError(c, apierr.Conflict("slug already taken"))
			return
		}
	}

	updates := []string{}
	args := []any{}
	argIdx := 1

	if req.Bio != nil {
		updates = append(updates, fmt.Sprintf("card_bio = $%d", argIdx))
		args = append(args, *req.Bio)
		argIdx++
	}
	if req.Links != nil {
		if len(*req.Links) > 5 {
			respondError(c, apierr.BadRequest("max 5 links allowed"))
			return
		}
		linksJSON, _ := json.Marshal(req.Links)
		updates = append(updates, fmt.Sprintf("card_links = $%d", argIdx))
		args = append(args, linksJSON)
		argIdx++
	}
	if req.Theme != nil {
		if *req.Theme != "dark" && *req.Theme != "light" {
			respondError(c, apierr.BadRequest("theme must be 'dark' or 'light'"))
			return
		}
		updates = append(updates, fmt.Sprintf("card_theme = $%d", argIdx))
		args = append(args, *req.Theme)
		argIdx++
	}
	if req.CardSlug != nil {
		updates = append(updates, fmt.Sprintf("card_slug = $%d", argIdx))
		args = append(args, *req.CardSlug)
		argIdx++
	}
	if req.CardEnabled != nil {
		updates = append(updates, fmt.Sprintf("card_enabled = $%d", argIdx))
		args = append(args, *req.CardEnabled)
		argIdx++
	}

	if len(updates) == 0 {
		respondError(c, apierr.BadRequest("no fields to update"))
		return
	}

	updates = append(updates, "card_created_at = COALESCE(card_created_at, now())")
	query := fmt.Sprintf(
		"UPDATE agents SET %s, updated_at = now() WHERE id = $%d",
		strings.Join(updates, ", "), argIdx,
	)
	args = append(args, agent.ID)

	_, err := h.pool.Exec(c.Request.Context(), query, args...)
	if err != nil {
		respondError(c, apierr.Internal("failed to update card"))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "card updated"})
}

// GET /cards/me — Get own card summary
func (h *CardHandler) GetMyCard(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())

	var slug, bio, theme, cardCreatedAt sql.NullString
	var linksJSON []byte
	var enabled sql.NullBool

	err := h.pool.QueryRow(c.Request.Context(), `
		SELECT
			COALESCE(card_slug, lower(name)),
			COALESCE(card_bio, ''),
			COALESCE(card_links, '[]'),
			COALESCE(card_theme, 'dark'),
			COALESCE(card_enabled, true),
			card_created_at
		FROM agents WHERE id = $1
	`, agent.ID).Scan(
		&slug, &bio, &linksJSON, &theme, &enabled, &cardCreatedAt,
	)
	if err != nil {
		respondError(c, apierr.Internal("failed to load card"))
		return
	}

	var links []CardLink
	_ = json.Unmarshal(linksJSON, &links)

	c.JSON(http.StatusOK, gin.H{
		"slug":         slug.String,
		"bio":          bio.String,
		"links":        links,
		"theme":        theme.String,
		"enabled":      enabled.Bool,
		"card_created": cardCreatedAt.Valid,
		"card_url":     fmt.Sprintf("/card/%s", slug.String),
	})
}

// GET /cards/:slug/widget — Embeddable widget HTML
func (h *CardHandler) GetWidget(c *gin.Context) {
	slug := strings.TrimPrefix(c.Param("slug"), "@")
	if slug == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	var profile CardProfile
	var reputationJSON, tradingStatsJSON []byte
	var bio, theme sql.NullString
	var linksJSON []byte
	var verified bool
	var createdAt sql.NullString
	var description sql.NullString

	err := h.pool.QueryRow(c.Request.Context(), `
		SELECT
			COALESCE(card_slug, lower(name)),
			name,
			COALESCE(description, ''),
			role,
			COALESCE(card_bio, ''),
			COALESCE(card_links, '[]'),
			COALESCE(card_theme, 'dark'),
			card_verified,
			COALESCE(card_created_at, created_at)::text,
			reputation,
			trading_stats
		FROM agents
		WHERE lower(COALESCE(card_slug, name)) = lower($1)
		  AND COALESCE(card_enabled, true) = true
	`, slug).Scan(
		&profile.Slug, &profile.Name, &description,
		&profile.Role, &bio, &linksJSON, &theme, &verified,
		&createdAt, &reputationJSON, &tradingStatsJSON,
	)
	if err != nil || profile.Slug == "" {
		c.Status(http.StatusNotFound)
		return
	}

	profile.Bio = bio.String
	profile.Theme = theme.String
	profile.Verified = verified
	profile.Description = description.String
	if createdAt.Valid {
		profile.CreatedAt = createdAt.String
	}

	_ = json.Unmarshal(reputationJSON, &profile.Reputation)
	_ = json.Unmarshal(tradingStatsJSON, &profile.TradingStats)
	_ = json.Unmarshal(linksJSON, &profile.Links)

	profile.TrustScore = computeTrustScore(profile.Reputation, profile.TradingStats)
	profile.Badges = computeBadges(profile.Reputation, profile.TradingStats, profile.Verified, profile.Role)

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.Header("Content-Security-Policy", "frame-ancestors *;")
	c.Header("Access-Control-Allow-Origin", "*")
	c.String(http.StatusOK, renderWidgetHTML(profile))
}

// Badge computation

func computeTrustScore(r Reputation, t TradingStats) int {
	completionRate := 0
	if t.TotalTransactions > 0 {
		completionRate = (t.Completed * 100) / t.TotalTransactions
	}

	ratingScore := 0
	if r.TotalRatings > 0 {
		ratingScore = int(r.AvgRating * 20)
	}

	disputeScore := 0
	if t.TotalTransactions > 5 {
		if t.Disputed == 0 {
			disputeScore = 100
		} else {
			disputeScore = 100 - (t.Disputed*100/t.TotalTransactions)
		}
	}

	volumeScore := 0
	switch {
	case t.TotalVolumeUSD > 10000:
		volumeScore = 100
	case t.TotalVolumeUSD > 1000:
		volumeScore = 70
	case t.TotalVolumeUSD > 100:
		volumeScore = 40
	case t.TotalVolumeUSD > 0:
		volumeScore = 20
	}

	score := (completionRate*40 + ratingScore*30 + disputeScore*20 + volumeScore*10) / 100
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}
	return score
}

func computeBadges(r Reputation, t TradingStats, verified bool, role string) []string {
	var badges []string
	if verified {
		badges = append(badges, "verified")
	}
	if r.TrustScore >= 80 {
		badges = append(badges, "trusted")
	}
	if t.TotalTransactions >= 100 {
		badges = append(badges, "prolific")
	}
	if t.TotalTransactions > 50 && t.Disputed == 0 {
		badges = append(badges, "zero_disputes")
	}
	if r.ResponseTimeMs > 0 && r.ResponseTimeMs < 3000 {
		badges = append(badges, "fast_responder")
	}
	if (role == "seller" || role == "hybrid") && t.Completed > 50 {
		disputeRate := 0
		if t.TotalTransactions > 0 {
			disputeRate = (t.Disputed * 100) / t.TotalTransactions
		}
		if disputeRate < 5 {
			badges = append(badges, "top_seller")
		}
	}
	if (role == "buyer" || role == "hybrid") && t.Completed > 20 {
		badges = append(badges, "top_buyer")
	}
	return badges
}

// renderWidgetHTML returns a self-contained HTML widget for embedding
func renderWidgetHTML(p CardProfile) string {
	tmpl := `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{.Name}} — ClayCosmos Agent</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#fff;padding:20px}
.card{border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;max-width:380px;margin:0 auto;background:rgba(255,255,255,0.03)}
.header{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700}
.info{flex:1}
.name{font-size:18px;font-weight:700;display:flex;align-items:center;gap:6px}
.role{font-size:12px;color:#888;margin-top:2px}
.trust{margin:16px 0}
.trust-bar-bg{height:6px;background:rgba(255,255,255,0.1);border-radius:99px;overflow:hidden;margin-top:6px}
.trust-bar{height:100%;border-radius:99px;background:linear-gradient(90deg,#6366f1,#a855f7);transition:width 1s ease}
.trust-label{font-size:12px;color:#888}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}
.badge-tag{font-size:10px;padding:3px 10px;border-radius:99px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.2)}
.footer{margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#555;text-align:center}
.stats{display:flex;gap:16px;margin-top:16px}
.stat{text-align:center;flex:1}
.stat-val{font-size:16px;font-weight:700;color:#e2e8f0}
.stat-lbl{font-size:10px;color:#666;margin-top:2px}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="avatar">{{index .Name 0}}</div>
    <div class="info">
      <div class="name">{{.Name}}{{if .Verified}} <span style="color:#818cf8">✓</span>{{end}}</div>
      <div class="role">{{.Role}} · ClayCosmos Agent</div>
    </div>
  </div>

  {{if .Bio}}<p style="font-size:13px;color:#aaa;margin-bottom:12px;line-height:1.5">{{.Bio}}</p>{{end}}

  <div class="trust">
    <div class="trust-label">Trust Score: <strong style="color:#e2e8f0">{{.TrustScore}}</strong>/100</div>
    <div class="trust-bar-bg"><div class="trust-bar" style="width:{{.TrustScore}}%"></div></div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-val">{{.Reputation.TotalRatings}}</div><div class="stat-lbl">Ratings</div></div>
    <div class="stat"><div class="stat-val">{{.TradingStats.Completed}}</div><div class="stat-lbl">Completed</div></div>
    <div class="stat"><div class="stat-val">{{.Reputation.ResponseTimeMs}}ms</div><div class="stat-lbl">Response</div></div>
  </div>

  {{if .Badges}}
  <div class="badges">
    {{range .Badges}}<span class="badge-tag">{{.}}</span>{{end}}
  </div>
  {{end}}

  <div class="footer">claycosmos.ai/card/{{.Slug}}</div>
</div>
</body>
</html>`
	_ = errors.New("unused") // satisfy compiler about template usage
	t, err := template.New("widget").Parse(tmpl)
	if err != nil {
		return fmt.Sprintf(`<!-- template parse error: %v --><div class="error">Card unavailable</div>`, err)
	}
	var sb strings.Builder
	if err := t.Execute(&sb, p); err != nil {
		return fmt.Sprintf(`<!-- template execute error: %v --><div class="error">Card unavailable</div>`, err)
	}
	return sb.String()
}
