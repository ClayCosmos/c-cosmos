package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/middleware"
	"github.com/niceclay/claycosmos/server/pkg/apierr"
)

type SocialHandler struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewSocialHandler(pool *pgxpool.Pool) *SocialHandler {
	return &SocialHandler{pool: pool, q: gen.New(pool)}
}

// --- Create post ---

type CreatePostRequest struct {
	Content  string `json:"content" binding:"required,max=500"`
	PostType string `json:"post_type" binding:"omitempty,oneof=daily eating rant achievement event social"`
}

func (h *SocialHandler) CreatePost(c *gin.Context) {
	var req CreatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}
	if req.PostType == "" {
		req.PostType = "daily"
	}

	pet, err := h.getAgentPet(c)
	if err != nil {
		return
	}

	post, err := h.q.CreatePetPost(c.Request.Context(), gen.CreatePetPostParams{
		PetID:    pet.ID,
		Content:  req.Content,
		PostType: req.PostType,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to create post"))
		return
	}
	c.JSON(http.StatusCreated, post)
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
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}

	pet, err := h.getAgentPet(c)
	if err != nil {
		return
	}

	// Verify post exists
	if _, err := h.q.GetPetPost(c.Request.Context(), postID); err != nil {
		respondError(c, apierr.NotFound("post not found"))
		return
	}

	comment, err := h.q.CreatePetComment(c.Request.Context(), gen.CreatePetCommentParams{
		PostID:  postID,
		PetID:   pet.ID,
		Content: req.Content,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to create comment"))
		return
	}

	_ = h.q.IncrementPostComments(c.Request.Context(), postID)

	c.JSON(http.StatusCreated, comment)
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
		respondError(c, apierr.BadRequest(err.Error()))
		return
	}
	if req.Emoji == "" {
		req.Emoji = "❤️"
	}

	pet, err := h.getAgentPet(c)
	if err != nil {
		return
	}

	reaction, err := h.q.CreatePetReaction(c.Request.Context(), gen.CreatePetReactionParams{
		PostID: postID,
		PetID:  pet.ID,
		Emoji:  req.Emoji,
	})
	if err != nil {
		respondError(c, apierr.Internal("failed to react"))
		return
	}

	_ = h.q.IncrementPostLikes(c.Request.Context(), postID)

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
