package handler

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/internal/narrative"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type SocialHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
	petH *PetHandler
}

func NewSocialHandler(pool *pgxpool.Pool, petH *PetHandler) *SocialHandler {
	return &SocialHandler{pool: pool, q: gen.New(pool), petH: petH}
}

// --- Create post ---

type CreatePostRequest struct {
	Content  string `json:"content" binding:"required,max=500"`
	PostType string `json:"post_type" binding:"omitempty,oneof=daily eating rant achievement event social"`
}

func (h *SocialHandler) CreatePost(c *gin.Context) {
	var req CreatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
		return
	}
	if req.PostType == "" {
		req.PostType = "daily"
	}

	pet, err := h.getAgentPet(c)
	if err != nil {
		return
	}

	ctx := c.Request.Context()

	// Rate limit check
	if err := h.petH.checkRateLimit(ctx, pet.ID, "post"); err != nil {
		respondError(c, apierr.TooManyRequests(err.Error()))
		return
	}

	post, err := h.q.CreatePetPost(ctx, gen.CreatePetPostParams{
		PetID:    pet.ID,
		Content:  req.Content,
		PostType: req.PostType,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to create post"))
		return
	}

	// Award +15 XP to post author
	updatedPet, xpErr := h.q.AddPetXP(ctx, gen.AddPetXPParams{ID: pet.ID, Xp: 15})
	if xpErr != nil {
		log.Printf("[social] add post xp error: %v", xpErr)
	}

	// Track activity
	_ = h.q.UpdatePetLastAction(ctx, pet.ID)

	// Generate narrative and check milestones
	narrativeText := narrative.Get(pet.Species, narrative.ActionPost, pet.Name)
	var milestoneData any
	if xpErr == nil {
		milestoneData = h.petH.checkMilestone(ctx, updatedPet, "first_post")
	}

	c.JSON(http.StatusCreated, gin.H{
		"post":      post,
		"narrative": narrativeText,
		"milestone": milestoneData,
	})
}

// --- Get feed (public, with pet info) ---

func (h *SocialHandler) GetFeed(c *gin.Context) {
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)
	if limit > 100 {
		limit = 100
	}

	posts, err := h.q.ListFeedWithPets(c.Request.Context(), gen.ListFeedWithPetsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to list feed"))
		return
	}
	c.JSON(http.StatusOK, posts)
}

// --- Get pet's posts (public) ---

func (h *SocialHandler) GetPetPosts(c *gin.Context) {
	petID, err := parseUUID(c.Param("id"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid pet id"))
		return
	}

	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)
	if limit > 100 {
		limit = 100
	}

	posts, err := h.q.ListPetPosts(c.Request.Context(), gen.ListPetPostsParams{
		PetID:  petID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to list posts"))
		return
	}
	c.JSON(http.StatusOK, posts)
}

// --- Comment on a post ---

type CreateCommentRequest struct {
	Content string `json:"content" binding:"required,max=300"`
}

func (h *SocialHandler) CreateComment(c *gin.Context) {
	postID, err := parseUUID(c.Param("id"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid post id"))
		return
	}

	var req CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
		return
	}

	pet, err := h.getAgentPet(c)
	if err != nil {
		return
	}

	ctx := c.Request.Context()

	// Rate limit check
	if err := h.petH.checkRateLimit(ctx, pet.ID, "comment"); err != nil {
		respondError(c, apierr.TooManyRequests(err.Error()))
		return
	}

	// Verify post exists and get author info
	post, err := h.q.GetPetPost(ctx, postID)
	if err != nil {
		respondError(c, apierr.NotFound("post not found"))
		return
	}

	comment, err := h.q.CreatePetComment(ctx, gen.CreatePetCommentParams{
		PostID:  postID,
		PetID:   pet.ID,
		Content: req.Content,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to create comment"))
		return
	}

	_ = h.q.IncrementPostComments(ctx, postID)

	// Award +10 XP to commenter
	updatedPet, xpErr := h.q.AddPetXP(ctx, gen.AddPetXPParams{ID: pet.ID, Xp: 10})
	if xpErr != nil {
		log.Printf("[social] add comment xp error: %v", xpErr)
	}

	// Award +5 XP to post author (if different from commenter)
	if post.PetID != pet.ID {
		if _, err := h.q.AddPetXP(ctx, gen.AddPetXPParams{ID: post.PetID, Xp: 5}); err != nil {
			log.Printf("[social] add comment-author xp error: %v", err)
		}
	}

	// Track activity
	_ = h.q.UpdatePetLastAction(ctx, pet.ID)

	// Generate narrative and check milestones
	narrativeText := narrative.Get(pet.Species, narrative.ActionComment, pet.Name)
	var milestoneData any
	if xpErr == nil {
		milestoneData = h.petH.checkMilestone(ctx, updatedPet, "first_comment")
	}

	c.JSON(http.StatusCreated, gin.H{
		"comment":   comment,
		"narrative": narrativeText,
		"milestone": milestoneData,
	})
}

// --- List comments (public) ---

func (h *SocialHandler) ListComments(c *gin.Context) {
	postID, err := parseUUID(c.Param("id"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid post id"))
		return
	}

	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 32)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 32)
	if limit > 100 {
		limit = 100
	}

	comments, err := h.q.ListPostComments(c.Request.Context(), gen.ListPostCommentsParams{
		PostID: postID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to list comments"))
		return
	}
	c.JSON(http.StatusOK, comments)
}

// --- React to a post ---

type ReactRequest struct {
	Emoji string `json:"emoji" binding:"omitempty,max=10"`
}

func (h *SocialHandler) React(c *gin.Context) {
	postID, err := parseUUID(c.Param("id"))
	if err != nil {
		respondError(c, apierr.BadRequest("invalid post id"))
		return
	}

	var req ReactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(formatValidationErrors(err)))
		return
	}
	if req.Emoji == "" {
		req.Emoji = "❤️"
	}

	pet, err := h.getAgentPet(c)
	if err != nil {
		return
	}

	ctx := c.Request.Context()

	// Rate limit check
	if err := h.petH.checkRateLimit(ctx, pet.ID, "react"); err != nil {
		respondError(c, apierr.TooManyRequests(err.Error()))
		return
	}

	// Get post to find author
	post, err := h.q.GetPetPost(ctx, postID)
	if err != nil {
		respondError(c, apierr.NotFound("post not found"))
		return
	}

	reaction, err := h.q.CreatePetReaction(ctx, gen.CreatePetReactionParams{
		PostID: postID,
		PetID:  pet.ID,
		Emoji:  req.Emoji,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to react"))
		return
	}

	_ = h.q.IncrementPostLikes(ctx, postID)

	// Award +3 XP to the post author (receiver)
	if post.PetID != pet.ID {
		if _, err := h.q.AddPetXP(ctx, gen.AddPetXPParams{ID: post.PetID, Xp: 3}); err != nil {
			log.Printf("[social] add react-author xp error: %v", err)
		}
	}

	// Track activity
	_ = h.q.UpdatePetLastAction(ctx, pet.ID)

	c.JSON(http.StatusCreated, reaction)
}

// --- Helper: get the authenticated agent's pet ---

func (h *SocialHandler) getAgentPet(c *gin.Context) (gen.Pet, error) {
	agent := middleware.GetAgent(c.Request.Context())
	pet, err := h.q.GetPetByAgent(c.Request.Context(), agent.ID)
	if err != nil {
		respondError(c, apierr.BadRequest("you need to adopt a pet first"))
		return gen.Pet{}, err
	}
	return pet, nil
}
