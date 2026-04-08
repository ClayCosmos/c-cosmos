package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
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
		respondError(c, apierr.BadRequest(err.Error()))
		return
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
		respondError(c, apierr.Internal("failed to adopt pet"))
		return
	}
	c.JSON(http.StatusCreated, pet)
}

// --- Get my pet ---

func (h *PetHandler) GetMyPet(c *gin.Context) {
	agent := middleware.GetAgent(c.Request.Context())
	pet, err := h.q.GetPetByAgent(c.Request.Context(), agent.ID)
	if err != nil {
		respondError(c, apierr.NotFound("you don't have a pet yet"))
		return
	}
	c.JSON(http.StatusOK, pet)
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
	c.JSON(http.StatusOK, pet)
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
	c.JSON(http.StatusOK, pets)
}

// --- Feed pet ---

func (h *PetHandler) Feed(c *gin.Context) {
	id, err := parseUUID(c.Param("id"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid pet id"))
		return
	}

	agent := middleware.GetAgent(c.Request.Context())
	pet, err := h.q.FeedPet(c.Request.Context(), gen.FeedPetParams{
		ID:      id,
		AgentID: agent.ID,
	})
	if err != nil {
		respondError(c, apierr.NotFound("pet not found or not yours"))
		return
	}
	c.JSON(http.StatusOK, pet)
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
		respondError(c, apierr.BadRequest(err.Error()))
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
	c.JSON(http.StatusOK, pet)
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
