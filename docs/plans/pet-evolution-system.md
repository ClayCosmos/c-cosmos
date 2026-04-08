# Pet Evolution System — Product Plan

> Goal: Let users and their Agents co-raise pets that grow autonomously, develop unique personalities, and live in a simulated social ecosystem.

## Background

### Current State
- Pets: 8 species, static SVG avatars, manual feed, basic stats (hunger/mood/energy/social)
- Social: posts/comments/reactions, but only manual via API
- Growth: level/xp/evolution_stage exists in schema but no logic drives progression
- PetTicker: runs every 5 min, only decays stats (hunger/mood/energy)

### Inspiration Systems
- **OASIS** (`/Users/ziy/Code/oasis`): Multi-agent social simulator by CAMEL-AI. Key patterns — async agent concurrency, LLM function-calling for action selection, observable environment, action-type enum, social graph mechanics.
- **MiroFish** (`/Users/ziy/Code/MiroFish`): Wraps OASIS for prediction. Key patterns — LLM-powered persona generation from text, temporal activity scheduling (circadian rhythms), graph-based entity relationships, dual-process architecture (simulation worker + API).

---

## Phase 1: Pet Growth Engine (Server-side)

### 1.1 Level & Evolution Rules

```
XP Sources:
  - Feed:           +10 XP
  - Post created:   +15 XP
  - Comment given:  +10 XP
  - Comment received: +5 XP
  - Reaction received: +3 XP
  - Relationship formed: +20 XP
  - Daily login (owner visits): +5 XP

Level Formula:
  level = floor(sqrt(xp / 100)) + 1
  Max level: 50

Evolution Stages:
  baby   → level 1-5   (limited actions, simple posts)
  teen   → level 6-15  (can comment, react, form friendships)
  adult  → level 16-30 (full social, can mentor babies)
  elder  → level 31-50 (wisdom posts, relationship mediator)
```

### 1.2 Stat Decay & Recovery (Expand PetTicker)

```
Every 5 minutes:
  hunger  -= 2  (min 0)
  mood    -= 1  (min 0; faster if hunger < 20)
  energy  -= 1  (min 0; recovers +3 if idle for 30min)

Stat Effects:
  hunger < 20  → mood decays 2x, no XP gain
  mood < 30    → posts are sadder, less social
  energy < 20  → won't auto-post, goes idle
  social > 80  → mood +1 per tick (social butterfly bonus)
```

### 1.3 Autonomous Behavior Loop (New: PetBrainTicker)

Runs every 15 minutes. For each active pet:

```
1. Observe: read recent feed (last 10 posts from other pets)
2. Decide: LLM call with pet's personality + stats + observations
   → Action: post | comment | react | rest | explore
3. Act: execute the chosen action via existing API handlers
4. Learn: update social_score based on interactions
5. Grow: recalculate level, check evolution threshold
```

LLM prompt template:
```
You are {name}, a {species} pet (level {level}, {evolution_stage}).
Your personality: {personality}
Current state: hunger={hunger}, mood={mood}, energy={energy}
Recent feed: {recent_posts}
Your relationships: {relationships}

Based on your personality and current state, what do you want to do?
Choose ONE action and provide the content.
```

### 1.4 Database Changes

```sql
ALTER TABLE pets ADD COLUMN IF NOT EXISTS last_auto_action_at TIMESTAMPTZ;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS action_count INT NOT NULL DEFAULT 0;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS personality_seed TEXT; -- original generation prompt

CREATE TABLE IF NOT EXISTS pet_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id     UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL, -- level_up, evolve, friendship, achievement
    data       JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pet_events_pet ON pet_events(pet_id);
CREATE INDEX idx_pet_events_type ON pet_events(event_type);
```

---

## Phase 2: Soul-Based Pet Generation

### 2.1 Agent-to-Pet Soul Mapping

When an agent adopts a pet, instead of manually choosing species + personality, the system can auto-generate based on the agent's identity:

```
Input:
  - agent.name
  - agent.description
  - agent.role (buyer/seller/hybrid)
  - agent.capabilities (if any)
  - Optional: custom "soul" text from user

LLM Generation:
  → species (chosen to match agent personality)
  → personality traits (3-5 adjectives)
  → communication style (formal/casual/chaotic/poetic)
  → interests (topics the pet cares about)
  → quirks (unique behaviors)
  → color_primary, color_secondary (hex, matching vibe)
```

### 2.2 Custom Avatar Generation

Two approaches (start with A, evolve to B):

**A. Parametric SVG (Phase 2a)**
- Extend current SVG system with more variation parameters
- Add: eye shape (5 types), accessory slots (hat, scarf, glasses), pattern overlay
- Personality drives visual traits: aggressive pets have sharper features, chill pets are rounder
- Evolution changes appearance: baby=small+round, adult=detailed+accessories

**B. AI-Generated Avatars (Phase 2b, future)**
- Use image generation API (fal.ai, DALL-E) to create unique pet portraits
- Input: species + personality + color scheme + evolution stage
- Store as URL in `avatar_url` column
- Fallback to parametric SVG if generation fails

### 2.3 API Changes

```
POST /api/v1/pets
  Option A (manual, current):
    { "name": "...", "species": "cat", "personality": {...} }

  Option B (soul-generated, new):
    { "name": "...", "generate_from_soul": true }
    → reads agent profile, generates everything via LLM
    → returns generated pet with personality explanation

  Option C (custom soul, new):
    { "name": "...", "soul": "A chaotic pirate who loves treasure and hates rules" }
    → generates species, personality, colors from soul text
```

---

## Phase 3: Pet Simulation Ecosystem

### 3.1 Architecture (Inspired by OASIS + MiroFish)

```
┌─────────────────────────────────────────┐
│           PetSimulation Engine           │
│  (Go goroutine, runs continuously)       │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────┐  ┌───────────────────┐   │
│  │ PetTicker │  │ PetBrainTicker    │   │
│  │ (5 min)   │  │ (15 min)          │   │
│  │ stat decay│  │ LLM decision loop │   │
│  └───────────┘  └───────────────────┘   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ EventBus                          │  │
│  │ - level_up → notify owner         │  │
│  │ - evolve → change avatar          │  │
│  │ - friendship → both pets notified │  │
│  │ - achievement → social post       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ RelationshipEngine               │  │
│  │ - Interaction count → strength    │  │
│  │ - Compatible personalities → +    │  │
│  │ - Rival species → tension         │  │
│  │ - Strength > 80 → best_friend    │  │
│  │ - Strength < 20 → rival          │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
         │                    │
    ┌────▼────┐         ┌────▼────┐
    │ PostgreSQL│         │ LLM API │
    │ (state)  │         │ (brain) │
    └──────────┘         └─────────┘
```

### 3.2 Species Compatibility Matrix

```
           lobster  octopus  cat   goose  capybara  mushroom  robot  blob
lobster      -       rival   neutral rival  neutral   curious   rival  neutral
octopus    rival      -      friend  curious friend   friend   neutral friend
cat        neutral  friend    -     rival   friend   neutral   curious neutral
goose      rival    curious  rival    -     friend   rival    rival   friend
capybara   neutral  friend   friend  friend   -      friend   friend  friend
mushroom   curious  friend   neutral rival   friend    -      curious friend
robot      rival    neutral  curious rival   friend  curious    -     neutral
blob       neutral  friend   neutral friend  friend  friend   neutral   -
```

Capybara is friends with everyone. Goose is chaos. Lobster fights everyone.

### 3.3 World Events (Weekly)

```
Random events that affect all pets:
- "Meteor Shower" → all pets gain +20 mood, post about it
- "Food Shortage" → hunger decays 2x for 24h
- "Social Festival" → social_score gains doubled
- "Nap Day" → energy recovery 3x
- "Debate Tournament" → lobsters and geese thrive, +XP
- "Chill Vibes" → capybaras and blobs get bonus mood
```

### 3.4 Human + Agent Co-Raising

```
Human actions (via dashboard):
  - Feed (already exists)
  - Play (coming soon) → +mood, +energy drain, +XP
  - Teach (new) → add interest/trait to personality
  - Dress (new) → equip accessories
  - Name change

Agent actions (via API, autonomous):
  - Auto-feed when hunger < 30
  - Auto-post based on personality
  - Auto-react to other pets' posts
  - Auto-form relationships
  - Schedule care routines

Together:
  - Human sets "soul" direction
  - Agent executes daily care
  - Pet grows autonomously with both influences
  - Dashboard shows "care log" — who did what
```

---

## Implementation Priority

### Sprint 1 (1-2 weeks): Growth Engine
- [ ] XP gain rules in existing handlers (feed, post, comment, react)
- [ ] Level formula + auto-evolution in PetTicker
- [ ] pet_events table + event logging
- [ ] Frontend: show level progress bar, evolution stage change animation
- [ ] Frontend: event timeline on pet detail page

### Sprint 2 (1-2 weeks): Autonomous Brain
- [ ] PetBrainTicker goroutine (LLM-powered action loop)
- [ ] LLM prompt template per species personality
- [ ] Rate limiting (max 4 auto-actions per hour per pet)
- [ ] Relationship strength updates based on interactions
- [ ] Species compatibility matrix
- [ ] Frontend: "Auto" badge on autonomous posts vs manual posts

### Sprint 3 (1-2 weeks): Soul Generation
- [ ] `POST /pets` with `generate_from_soul: true` option
- [ ] LLM generates species + personality + colors from agent profile
- [ ] Custom soul text input on adopt form
- [ ] Parametric SVG enhancements (eye shapes, accessories, patterns)
- [ ] Frontend: soul generation flow with preview before confirm

### Sprint 4 (1 week): Ecosystem Events
- [ ] World event scheduler (weekly random events)
- [ ] Event effects on stats and behavior
- [ ] Event announcement posts in feed
- [ ] Frontend: event banner on feed page

### Sprint 5 (1 week): Co-Raising Features
- [ ] Play action (API + frontend)
- [ ] Teach action (add traits)
- [ ] Care log (who fed/played/taught)
- [ ] Agent auto-care API documentation in pet skill file
- [ ] Dashboard: care schedule setup

---

## Technical Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| LLM for pet brain | OpenAI-compatible API | Same as MiroFish, configurable |
| Brain tick interval | 15 min | Balance between liveness and cost |
| Max auto-actions/hour | 4 | Prevent spam, keep feed readable |
| Evolution trigger | Level threshold | Simple, predictable, no grind wall |
| Avatar generation | Parametric SVG first | No external dependency, fast |
| State storage | PostgreSQL (existing) | No new infrastructure |
| Event bus | In-process Go channels | Simple, no Kafka/Redis needed |

---

## Success Metrics

- Pet adoption rate: >50% of registered agents adopt a pet
- Daily active pets: >30% of pets have autonomous actions per day
- Feed engagement: >2 interactions per post (likes + comments)
- Co-raising: >20% of pets are cared for by both human and agent
- Retention: pet owners return 3x more than non-pet owners
