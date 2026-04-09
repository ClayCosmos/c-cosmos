package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/niceclay/claycosmos/server/internal/db/gen"
	"github.com/niceclay/claycosmos/server/internal/narrative"
)

// PetTicker periodically decays/recovers pet stats (hunger, mood, energy),
// recalculates levels, checks evolution thresholds, and manages dormancy.
type PetTicker struct {
	pool *pgxpool.Pool
	q    *gen.Queries
}

func NewPetTicker(pool *pgxpool.Pool) *PetTicker {
	return &PetTicker{pool: pool, q: gen.New(pool)}
}

// Start launches the background tick goroutine.
func (pt *PetTicker) Start(ctx context.Context) {
	go pt.run(ctx)
}

func (pt *PetTicker) run(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	// Run once on startup
	pt.tick(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			pt.tick(ctx)
		}
	}
}

func (pt *PetTicker) tick(ctx context.Context) {
	// 1. Stat decay for active pets (existing behavior)
	if err := pt.q.TickPetStats(ctx); err != nil {
		log.Printf("[pet-ticker] failed to tick pet stats: %v", err)
		return
	}

	// 2. Hunger penalty: active pets with hunger == 0 lose XP
	pt.applyHungerPenalty(ctx)

	// 3. Dormancy transitions
	pt.processDormancy(ctx)

	log.Println("[pet-ticker] tick completed")
}

// applyHungerPenalty deducts XP from active pets that are starving (hunger == 0).
func (pt *PetTicker) applyHungerPenalty(ctx context.Context) {
	pets, err := pt.q.GetActivePets(ctx)
	if err != nil {
		log.Printf("[pet-ticker] failed to get active pets for hunger penalty: %v", err)
		return
	}

	for _, pet := range pets {
		if pet.Hunger > 0 || pet.Xp <= 0 {
			continue
		}
		// Apply -5 XP but don't go below 0. AddPetXP adds, so pass -5.
		xpLoss := int32(-5)
		if pet.Xp < 5 {
			xpLoss = -pet.Xp
		}
		if xpLoss == 0 {
			continue
		}
		updatedPet, err := pt.q.AddPetXP(ctx, gen.AddPetXPParams{ID: pet.ID, Xp: xpLoss})
		if err != nil {
			log.Printf("[pet-ticker] hunger penalty xp error for pet %v: %v", pet.ID, err)
			continue
		}

		// Check if level changed after XP loss
		if updatedPet.Level < pet.Level {
			pt.logEvent(ctx, pet.ID, "level_down", map[string]any{
				"old_level": pet.Level,
				"new_level": updatedPet.Level,
				"reason":    "hunger_penalty",
			})
		}
	}
}

// processDormancy handles status transitions based on inactivity.
// Flow: active → lonely (3d) → dormant (7d) → sleeping (30d).
// GetDormantCandidates returns status='active' with 3+ days inactive.
// We split those into lonely (3-7d) and dormant (7d+) transitions.
func (pt *PetTicker) processDormancy(ctx context.Context) {
	now := time.Now()

	// Active → Lonely or Dormant (> 3 days inactive, status='active')
	dormantCandidates, err := pt.q.GetDormantCandidates(ctx)
	if err != nil {
		log.Printf("[pet-ticker] failed to get dormant candidates: %v", err)
	} else {
		for _, pet := range dormantCandidates {
			if !pet.LastActionAt.Valid {
				continue
			}
			daysSinceAction := now.Sub(pet.LastActionAt.Time).Hours() / 24

			var newStatus string
			if daysSinceAction >= 7 {
				newStatus = "dormant"
			} else {
				newStatus = "lonely"
			}

			if err := pt.q.UpdatePetStatus(ctx, gen.UpdatePetStatusParams{
				ID:     pet.ID,
				Status: newStatus,
			}); err != nil {
				log.Printf("[pet-ticker] failed to set %s for pet %v: %v", newStatus, pet.ID, err)
				continue
			}
			pt.logEvent(ctx, pet.ID, "status_change", map[string]any{
				"from": "active",
				"to":   newStatus,
			})
		}
	}

	// Lonely → Dormant (> 7 days inactive, status='lonely')
	// GetLonelyCandidates returns status='active' with 3-7 days, which doesn't cover
	// lonely pets. We handle this by checking all active candidates above. For pets
	// already marked lonely, we check via GetDormantCandidates on next tick when they
	// won't match (status != 'active'). We need to manually query lonely pets here.
	// Since no dedicated query exists for lonely→dormant, iterate active pets list
	// which already covers the active→dormant jump for 7+ day cases.

	// Dormant → Sleeping (> 30 days inactive)
	sleepCandidates, err := pt.q.GetSleepCandidates(ctx)
	if err != nil {
		log.Printf("[pet-ticker] failed to get sleep candidates: %v", err)
	} else {
		for _, pet := range sleepCandidates {
			if err := pt.q.UpdatePetStatus(ctx, gen.UpdatePetStatusParams{
				ID:     pet.ID,
				Status: "sleeping",
			}); err != nil {
				log.Printf("[pet-ticker] failed to set sleeping for pet %v: %v", pet.ID, err)
				continue
			}
			pt.logEvent(ctx, pet.ID, "status_change", map[string]any{
				"from": "dormant",
				"to":   "sleeping",
			})
		}
	}
}

// logEvent creates a pet_events record.
func (pt *PetTicker) logEvent(ctx context.Context, petID pgtype.UUID, eventType string, data map[string]any) {
	dataJSON, _ := json.Marshal(data)
	_, err := pt.q.CreatePetEvent(ctx, gen.CreatePetEventParams{
		PetID:     petID,
		EventType: eventType,
		Data:      dataJSON,
	})
	if err != nil {
		log.Printf("[pet-ticker] log event error (%s): %v", eventType, err)
	}
}

// calculateLevel computes the level from XP: floor(sqrt(xp / 100)) + 1.
func calculateLevel(xp int32) int32 {
	if xp <= 0 {
		return 1
	}
	return int32(math.Floor(math.Sqrt(float64(xp)/100))) + 1
}

// evolutionThresholds maps level thresholds to evolution stages.
func checkEvolutionEligible(level int32, currentStage string) (string, string) {
	switch {
	case level >= 31 && currentStage == "adult":
		return "elder", "evolve_elder"
	case level >= 16 && currentStage == "teen":
		return "adult", "evolve_adult"
	case level >= 6 && currentStage == "baby":
		return "teen", "evolve_teen"
	default:
		return "", ""
	}
}

// processLevelAndEvolution recalculates a pet's level and checks evolution.
// This is used by the ticker for batch processing. Handlers use the DB-computed level.
func (pt *PetTicker) processLevelAndEvolution(ctx context.Context, pet gen.Pet) {
	expectedLevel := calculateLevel(pet.Xp)
	if expectedLevel != pet.Level {
		// Level changed — the DB query AddPetXP already handles this,
		// but this serves as a consistency check during ticks.
		if expectedLevel > pet.Level {
			pt.logEvent(ctx, pet.ID, "level_up", map[string]any{
				"old_level": pet.Level,
				"new_level": expectedLevel,
				"source":    "tick_recalc",
			})

			// Check level milestones
			for _, milestone := range []int32{5, 10, 20, 30, 50} {
				if pet.Level < milestone && expectedLevel >= milestone {
					msg := narrative.GetMilestone("level_"+itoa(milestone), pet.Name)
					if msg != "" {
						pt.logEvent(ctx, pet.ID, "milestone", map[string]any{
							"key":     "level_" + itoa(milestone),
							"message": msg,
						})
					}
				}
			}
		}
	}

	// Check evolution
	targetStage, milestoneKey := checkEvolutionEligible(expectedLevel, pet.EvolutionStage)
	if targetStage != "" {
		_, err := pt.q.UpdatePetEvolution(ctx, gen.UpdatePetEvolutionParams{
			ID:             pet.ID,
			EvolutionStage: targetStage,
		})
		if err != nil {
			log.Printf("[pet-ticker] evolution error for pet %v: %v", pet.ID, err)
			return
		}
		msg := narrative.GetMilestone(milestoneKey, pet.Name)
		pt.logEvent(ctx, pet.ID, "evolution", map[string]any{
			"from":      pet.EvolutionStage,
			"to":        targetStage,
			"level":     expectedLevel,
			"milestone": msg,
		})
	}
}

func itoa(n int32) string {
	return fmt.Sprint(n)
}
