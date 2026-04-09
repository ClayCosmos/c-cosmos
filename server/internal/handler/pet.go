package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/internal/narrative"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type PetHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewPetHandler(pool *pgxpool.Pool) *PetHandler {
	return &PetHandler{pool: pool, q: gen.New(pool)}
}

// --- Adopt (create) a pet ---

type AdoptPetRequest struct {
	Name           string `json:"name" binding:"required,max=50"`
	Species        string `json:"species" binding:"required,oneof=lobster octopus cat goose capybara mushroom robot blob"`
	Personality    any    `json:"personality"`
	ColorPrimary   string `json:"color_primary" binding:"omitempty,len=7"`
	ColorSecondary string `json:"color_secondary" binding:"omitempty,len=7"`
}

func (h *PetHandler) Adopt(c *gin.Context) {
	var req AdoptPetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
		return
	}

	if req.Personality == nil {
		req.Personality = map[string]any{}
	}
	if req.ColorPrimary == "" {
		req.ColorPrimary = speciesDefaultColor(req.Species)
	}
	if req.ColorSecondary == "" {
		req.ColorSecondary = darkenColor(req.ColorPrimary)
	}

	agent := middleware.GetAgent(c.Request.Context())
	pet, err := h.q.CreatePet(c.Request.Context(), gen.CreatePetParams{
		AgentID:        agent.ID,
		Name:           req.Name,
		Species:        req.Species,
		Personality:    toJSON(req.Personality),
		ColorPrimary:   req.ColorPrimary,
		ColorSecondary: req.ColorSecondary,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(c, apierr.Conflict("you already have a pet"))
			return
		}
		log.Printf("[pet] adopt error: %v", err)
		respondError(c, apierr.Internal("failed to adopt pet"))
		return
	}
	c.JSON(http.StatusCreated, toPetResponse(pet))
}

// --- Get my pet ---

func (h *PetHandler) GetMyPet(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	pet, err := h.q.GetPetByAgent(c.Request.Context(), agent.ID)
	if err != nil {
		respondError(c, apierr.NotFound("you don't have a pet yet"))
		return
	}
	c.JSON(http.StatusOK, toPetResponse(pet))
}

// --- Observations (the key Agent endpoint) ---

func (h *PetHandler) Observations(c *gin.Context) {
	ctx := c.Request.Context()
	agent := middleware.GetAgent(ctx)

	pet, err := h.q.GetPetByAgent(ctx, agent.ID)
	if err != nil {
		respondError(c, apierr.NotFound("you don't have a pet yet"))
		return
	}

	// Recent feed (last 10 posts from other pets)
	feed, _ := h.q.ListFeedWithPets(ctx, gen.ListFeedWithPetsParams{Limit: 10, Offset: 0})
	feedItems := make([]gin.H, 0, len(feed))
	for _, p := range feed {
		if p.PetID == pet.ID {
			continue // skip own posts
		}
		feedItems = append(feedItems, gin.H{
			"id":         p.ID,
			"pet_id":     p.PetID,
			"pet_name":   p.PetName,
			"pet_species": p.PetSpecies,
			"content":    p.Content,
			"post_type":  p.PostType,
			"likes":      p.LikesCount,
			"comments":   p.CommentsCount,
			"created_at": p.CreatedAt,
		})
	}

	// Nearby pets (5-10 recently active, excluding self)
	nearby, _ := h.q.GetNearbyPets(ctx, gen.GetNearbyPetsParams{ID: pet.ID, Limit: 8})
	nearbyItems := make([]gin.H, 0, len(nearby))
	for _, np := range nearby {
		nearbyItems = append(nearbyItems, gin.H{
			"id":      np.ID,
			"name":    np.Name,
			"species": np.Species,
			"level":   np.Level,
			"mood":    np.Mood,
			"status":  np.Status,
		})
	}

	// Relationships
	relationships, _ := h.q.ListPetRelationships(ctx, pet.ID)
	relItems := make([]gin.H, 0, len(relationships))
	for _, r := range relationships {
		relItems = append(relItems, gin.H{
			"pet_a":    r.PetA,
			"pet_b":    r.PetB,
			"type":     r.Type,
			"strength": r.Strength,
		})
	}

	// Milestones
	milestones, _ := h.q.ListPetMilestones(ctx, pet.ID)
	milestoneKeys := make([]string, 0, len(milestones))
	for _, m := range milestones {
		var data map[string]any
		_ = json.Unmarshal(m.Data, &data)
		if k, ok := data["key"].(string); ok {
			milestoneKeys = append(milestoneKeys, k)
		}
	}

	// Build suggestions
	suggestions := buildSuggestions(pet, feedItems, nearbyItems)

	c.JSON(http.StatusOK, gin.H{
		"pet":           toPetResponse(pet),
		"feed":          feedItems,
		"nearby_pets":   nearbyItems,
		"relationships": relItems,
		"milestones":    milestoneKeys,
		"events":        []any{}, // world events placeholder for Phase 3
		"suggestions":   suggestions,
	})
}

func buildSuggestions(pet gen.Pet, feed []gin.H, nearby []gin.H) []string {
	var s []string
	if pet.Hunger < 20 {
		s = append(s, fmt.Sprintf("Your pet is hungry (hunger: %d). Consider feeding.", pet.Hunger))
	}
	if pet.Mood < 30 {
		s = append(s, fmt.Sprintf("Your pet is unhappy (mood: %d). Social interaction may help.", pet.Mood))
	}
	if pet.Energy < 20 {
		s = append(s, "Your pet is tired. Let it rest for a while.")
	}
	if len(feed) > 0 {
		top := feed[0]
		s = append(s, fmt.Sprintf("%s posted something. React or comment?", top["pet_name"]))
	}
	if len(nearby) > 0 {
		np := nearby[0]
		s = append(s, fmt.Sprintf("%s (%s) is nearby. Form a relationship?", np["name"], np["species"]))
	}
	if len(s) == 0 {
		s = append(s, "All good! Your pet is happy and healthy.")
	}
	return s
}

// --- List pet events (timeline) ---

func (h *PetHandler) ListEvents(c *gin.Context) {
	ctx := c.Request.Context()
	agent := middleware.GetAgent(ctx)

	pet, err := h.q.GetPetByAgent(ctx, agent.ID)
	if err != nil {
		respondError(c, apierr.NotFound("you don't have a pet yet"))
		return
	}

	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)

	events, err := h.q.ListPetEvents(ctx, gen.ListPetEventsParams{
		PetID:  pet.ID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to list events"))
		return
	}

	items := make([]gin.H, len(events))
	for i, e := range events {
		var data any
		_ = json.Unmarshal(e.Data, &data)
		items[i] = gin.H{
			"id":         e.ID,
			"event_type": e.EventType,
			"data":       data,
			"created_at": e.CreatedAt,
		}
	}
	c.JSON(http.StatusOK, items)
}

// --- Get pet by ID (public) ---

func (h *PetHandler) GetPet(c *gin.Context) {
	id, err := parseUUID(c.Param("id"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid pet id"))
		return
	}
	pet, err := h.q.GetPetByID(c.Request.Context(), id)
	if err != nil {
		respondError(c, apierr.NotFound("pet not found"))
		return
	}
	c.JSON(http.StatusOK, toPetResponse(pet))
}

// --- List all pets (public) ---

func (h *PetHandler) ListPets(c *gin.Context) {
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)
	species := c.Query("species")

	if limit > 100 {
		limit = 100
	}

	var pets []gen.Pet
	var qErr error
	if species != "" {
		pets, qErr = h.q.ListPetsBySpecies(c.Request.Context(), gen.ListPetsBySpeciesParams{
			Species: species,
			Limit:   int32(limit),
			Offset:  int32(offset),
		})
	} else {
		pets, qErr = h.q.ListPets(c.Request.Context(), gen.ListPetsParams{
			Limit:  int32(limit),
			Offset: int32(offset),
		})
	}
	if qErr != nil {
		respondError(c, apierr.Internal("failed to list pets"))
		return
	}
	c.JSON(http.StatusOK, toPetListResponse(pets))
}

// --- Feed pet ---

func (h *PetHandler) Feed(c *gin.Context) {
	id, err := parseUUID(c.Param("id"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid pet id"))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())
	ctx := c.Request.Context()

	// Rate limit check
	if err := h.checkRateLimit(ctx, id, "feed"); err != nil {
		respondError(c, apierr.TooManyRequests(err.Error()))
		return
	}

	pet, err := h.q.FeedPet(ctx, gen.FeedPetParams{
		ID:      id,
		AgentID: agent.ID,
	})
	if err != nil {
		respondError(c, apierr.NotFound("pet not found or not yours"))
		return
	}

	// Award XP for feeding
	oldLevel := pet.Level
	updatedPet, err := h.q.AddPetXP(ctx, gen.AddPetXPParams{ID: pet.ID, Xp: 10})
	if err != nil {
		log.Printf("[pet] add xp error: %v", err)
		// Return the fed pet even if XP failed
		c.JSON(http.StatusOK, gin.H{"pet": toPetResponse(pet)})
		return
	}

	// Track activity for dormancy system
	_ = h.q.UpdatePetLastAction(ctx, updatedPet.ID)

	// Generate narrative
	narrativeText := narrative.Get(updatedPet.Species, narrative.ActionFeed, updatedPet.Name)

	// Check for level-up and evolution
	var milestoneData any
	if updatedPet.Level > oldLevel {
		h.logEvent(ctx, updatedPet.ID, "level_up", map[string]any{
			"old_level": oldLevel,
			"new_level": updatedPet.Level,
		})
		milestoneData = h.checkEvolution(ctx, updatedPet)
	}

	// Check first-feed milestone
	if m := h.checkMilestone(ctx, updatedPet, "first_feed"); m != nil && milestoneData == nil {
		milestoneData = m
	}

	c.JSON(http.StatusOK, gin.H{
		"pet":       toPetResponse(updatedPet),
		"narrative": narrativeText,
		"milestone": milestoneData,
	})
}

// --- Update pet ---

type UpdatePetRequest struct {
	Name           *string  `json:"name" binding:"omitempty,max=50"`
	Personality    any      `json:"personality"`
	ColorPrimary   *string  `json:"color_primary" binding:"omitempty,len=7"`
	ColorSecondary *string  `json:"color_secondary" binding:"omitempty,len=7"`
	Accessories    []string `json:"accessories"`
}

func (h *PetHandler) Update(c *gin.Context) {
	id, err := parseUUID(c.Param("id"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid pet id"))
		return
	}

	var req UpdatePetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())
	pet, err := h.q.UpdatePet(c.Request.Context(), gen.UpdatePetParams{
		ID:             id,
		AgentID:        agent.ID,
		Name:           toPgText(req.Name),
		Personality:    toJSON(req.Personality),
		ColorPrimary:   toPgText(req.ColorPrimary),
		ColorSecondary: toPgText(req.ColorSecondary),
		Accessories:    req.Accessories,
	})
	if err != nil {
		respondError(c, apierr.NotFound("pet not found or not yours"))
		return
	}
	c.JSON(http.StatusOK, toPetResponse(pet))
}

// --- Response helpers ---

// toPetResponse converts a gen.Pet to a JSON-safe response, unmarshalling the
// personality JSONB field so it is returned as a JSON object instead of base64.
func toPetResponse(p gen.Pet) gin.H {
	var personality any
	if len(p.Personality) > 0 {
		_ = json.Unmarshal(p.Personality, &personality)
	}
	return gin.H{
		"id":              p.ID,
		"agent_id":        p.AgentID,
		"name":            p.Name,
		"species":         p.Species,
		"hunger":          p.Hunger,
		"mood":            p.Mood,
		"energy":          p.Energy,
		"social_score":    p.SocialScore,
		"level":           p.Level,
		"xp":              p.Xp,
		"evolution_stage": p.EvolutionStage,
		"personality":     personality,
		"color_primary":   p.ColorPrimary,
		"color_secondary": p.ColorSecondary,
		"accessories":     p.Accessories,
		"is_active":       p.IsActive,
		"born_at":         p.BornAt,
		"last_fed_at":     p.LastFedAt,
		"last_tick_at":    p.LastTickAt,
		"created_at":      p.CreatedAt,
		"updated_at":      p.UpdatedAt,
	}
}

func toPetListResponse(pets []gen.Pet) []gin.H {
	resp := make([]gin.H, len(pets))
	for i, p := range pets {
		resp[i] = toPetResponse(p)
	}
	return resp
}

// --- Helpers ---

func parseUUID(s string) (pgtype.UUID, error) {
	var id pgtype.UUID
	return id, id.Scan(s)
}

func speciesDefaultColor(species string) string {
	colors := map[string]string{
		"lobster":  "#E74C3C",
		"octopus":  "#9B59B6",
		"cat":      "#F39C12",
		"goose":    "#ECF0F1",
		"capybara": "#8D6E63",
		"mushroom": "#E91E63",
		"robot":    "#607D8B",
		"blob":     "#2ECC71",
	}
	if c, ok := colors[species]; ok {
		return c
	}
	return "#E74C3C"
}

func darkenColor(hex string) string {
	// Simple darkening: just return a slightly darker default
	// In production, do actual color math
	darks := map[string]string{
		"#E74C3C": "#C0392B",
		"#9B59B6": "#8E44AD",
		"#F39C12": "#E67E22",
		"#ECF0F1": "#BDC3C7",
		"#8D6E63": "#6D4C41",
		"#E91E63": "#C2185B",
		"#607D8B": "#455A64",
		"#2ECC71": "#27AE60",
	}
	if d, ok := darks[hex]; ok {
		return d
	}
	return "#333333"
}

// --- Rate limiting ---

// actionRateLimits defines hourly limits per action type.
var actionRateLimits = map[string]int32{
	"feed":    12,
	"post":    6,
	"comment": 20,
	"react":   30,
}

// checkRateLimit verifies the pet has not exceeded its hourly action limit.
// If the hour window has expired, the counter is reset by the DB query itself.
func (h *PetHandler) checkRateLimit(ctx context.Context, petID pgtype.UUID, actionType string) error {
	count, err := h.q.IncrementPetActionCount(ctx, petID)
	if err != nil {
		return fmt.Errorf("rate limit check failed: %w", err)
	}
	limit, ok := actionRateLimits[actionType]
	if !ok {
		limit = 30 // default
	}
	if count > limit {
		return fmt.Errorf("rate limit exceeded for %s (%d/%d per hour)", actionType, count, limit)
	}
	return nil
}

// --- XP, Evolution, Milestone helpers ---

// logEvent creates a pet_events record with JSON data.
func (h *PetHandler) logEvent(ctx context.Context, petID pgtype.UUID, eventType string, data map[string]any) {
	dataJSON, _ := json.Marshal(data)
	_, err := h.q.CreatePetEvent(ctx, gen.CreatePetEventParams{
		PetID:     petID,
		EventType: eventType,
		Data:      dataJSON,
	})
	if err != nil {
		log.Printf("[pet] log event error (%s): %v", eventType, err)
	}
}

// checkEvolution checks if the pet should evolve based on its level, and performs
// the evolution if needed. Returns milestone data if an evolution occurred.
func (h *PetHandler) checkEvolution(ctx context.Context, pet gen.Pet) any {
	var targetStage, milestoneKey string
	switch {
	case pet.Level >= 31 && pet.EvolutionStage == "adult":
		targetStage = "elder"
		milestoneKey = "evolve_elder"
	case pet.Level >= 16 && pet.EvolutionStage == "teen":
		targetStage = "adult"
		milestoneKey = "evolve_adult"
	case pet.Level >= 6 && pet.EvolutionStage == "baby":
		targetStage = "teen"
		milestoneKey = "evolve_teen"
	default:
		return nil
	}

	_, err := h.q.UpdatePetEvolution(ctx, gen.UpdatePetEvolutionParams{
		ID:             pet.ID,
		EvolutionStage: targetStage,
	})
	if err != nil {
		log.Printf("[pet] evolution error: %v", err)
		return nil
	}

	h.logEvent(ctx, pet.ID, "evolution", map[string]any{
		"from":  pet.EvolutionStage,
		"to":    targetStage,
		"level": pet.Level,
	})

	msg := narrative.GetMilestone(milestoneKey, pet.Name)
	evolveNarrative := narrative.Get(pet.Species, narrative.ActionEvolve, pet.Name)

	return map[string]any{
		"key":       milestoneKey,
		"message":   msg,
		"narrative": evolveNarrative,
		"stage":     targetStage,
	}
}

// checkMilestone checks if a milestone has already been achieved. If not, logs it
// and returns milestone data. Returns nil if the milestone was already achieved.
func (h *PetHandler) checkMilestone(ctx context.Context, pet gen.Pet, key string) any {
	has, err := h.q.HasMilestone(ctx, gen.HasMilestoneParams{
		PetID:        pet.ID,
		MilestoneKey: []byte(key),
	})
	if err != nil || has {
		return nil
	}

	msg := narrative.GetMilestone(key, pet.Name)
	if msg == "" {
		return nil
	}

	h.logEvent(ctx, pet.ID, "milestone", map[string]any{
		"key":     key,
		"message": msg,
	})

	return map[string]any{
		"key":     key,
		"message": msg,
	}
}
