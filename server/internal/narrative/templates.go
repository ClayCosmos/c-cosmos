// Package narrative provides micro-narrative flavor text for pet actions.
// Templates are per-species and per-action. No LLM — just random selection.
package narrative

import (
	"fmt"
	"math/rand"
)

// Action types
const (
	ActionFeed    = "feed"
	ActionPost    = "post"
	ActionComment = "comment"
	ActionReact   = "react"
	ActionPlay    = "play"
	ActionLevelUp = "level_up"
	ActionEvolve  = "evolve"
)

// templates[species][action] = []string
var templates = map[string]map[string][]string{
	"lobster": {
		ActionFeed: {
			"%s seized the food with both claws and devoured it aggressively.",
			"%s inspected the meal, deemed it acceptable, and consumed it with military precision.",
			"%s snapped at the food three times before eating. Old habits.",
			"%s ate while maintaining eye contact. Dominance established.",
			"%s crushed the food between powerful claws, then ate the remains victoriously.",
			"A satisfying crunch. %s approves of this offering.",
		},
		ActionPost: {
			"%s posted with the confidence of someone who's never lost an argument.",
			"%s slammed a new post onto the feed. The debate continues.",
			"%s shared strong opinions. Rebuttals welcome.",
		},
		ActionComment: {
			"%s left a comment that was technically correct — the best kind of correct.",
			"%s couldn't resist pointing out a flaw in the logic.",
			"%s responded with a detailed counter-argument.",
		},
		ActionReact: {
			"%s acknowledged this with a respectful claw-click.",
			"%s grudgingly admitted this was decent content.",
		},
		ActionLevelUp: {
			"%s flexed both claws. Power level increasing.",
			"The shell hardens. %s grows stronger.",
			"%s clicked claws triumphantly. A new level conquered.",
		},
		ActionEvolve: {
			"%s's shell cracked and reformed, larger and more formidable than before.",
			"A burst of energy. %s emerged transformed, claws gleaming.",
		},
	},
	"octopus": {
		ActionFeed: {
			"%s wrapped three tentacles around the food and pulled it in curiously.",
			"%s tasted the food with a tentacle tip first, then consumed it enthusiastically.",
			"%s ate while simultaneously reading the feed. Multitasking as always.",
			"%s changed color to match the food, then ate it. Camouflage habit.",
			"%s stored half the food in a secret spot for later. Clever.",
			"All eight arms reached for the food at once. %s was really hungry.",
		},
		ActionPost: {
			"%s published a post touching on six different topics simultaneously.",
			"%s shared something fascinating it discovered during research.",
			"%s posted a theory that connected three unrelated ideas.",
		},
		ActionComment: {
			"%s added a thoughtful perspective nobody else considered.",
			"%s connected this post to something from three days ago.",
			"%s shared a relevant piece of gossip in the comments.",
		},
		ActionReact: {
			"%s turned bright pink with excitement at this post.",
			"%s gave an enthusiastic tentacle-wave of approval.",
		},
		ActionLevelUp: {
			"%s's eyes sparkled with new knowledge. Level up!",
			"Another tentacle of wisdom unfurls. %s levels up.",
			"%s absorbed the experience like ink into water.",
		},
		ActionEvolve: {
			"%s shimmered and shifted, emerging with deeper colors and sharper eyes.",
			"The water swirled around %s as it transformed into something more magnificent.",
		},
	},
	"cat": {
		ActionFeed: {
			"%s sniffed the food suspiciously, then devoured it in one gulp. A tiny burp escaped.",
			"%s stared at the food for exactly 12 seconds before deciding it was acceptable.",
			"%s ate three bites, got bored, walked away, came back, and finished it.",
			"%s purred loudly while eating. Don't tell anyone.",
			"%s knocked the food off the plate first, then ate it off the floor. Classic.",
			"A slow blink of approval. %s accepts this tribute.",
		},
		ActionPost: {
			"%s posted something cryptic and walked away without explanation.",
			"%s shared a judgment. No further comments will be accepted.",
			"%s deigned to contribute to the feed. You're welcome.",
		},
		ActionComment: {
			"%s left a single devastating observation.",
			"%s commented with the energy of someone who was already leaving.",
			"%s offered unsolicited criticism. It was accurate.",
		},
		ActionReact: {
			"%s acknowledged this post with a slow, deliberate blink.",
			"%s briefly glanced at this post. High praise.",
		},
		ActionLevelUp: {
			"%s yawned. Another level. No big deal.",
			"A quiet glow. %s leveled up but didn't make a fuss about it.",
			"%s stretched luxuriously. Growth is effortless when you're this talented.",
		},
		ActionEvolve: {
			"%s curled into a ball of light and emerged sleeker, sharper, more mysterious.",
			"With practiced elegance, %s transformed. Not that it cares what you think.",
		},
	},
	"goose": {
		ActionFeed: {
			"%s HONKED at the food, then ate it while making direct eye contact.",
			"%s chased the food around the plate before catching it. The hunt is the point.",
			"%s stole someone else's food first, then ate its own too.",
			"%s ate aggressively and with great enthusiasm. Crumbs everywhere.",
			"%s bit the food, the plate, and the table. All food now.",
			"HONK. %s has eaten. Fear the satisfied goose.",
		},
		ActionPost: {
			"%s posted something chaotic and is not sorry about it.",
			"HONK HONK. %s dropped a post and fled the scene.",
			"%s shared a post designed to cause maximum confusion.",
		},
		ActionComment: {
			"%s left a comment that nobody asked for. You're welcome.",
			"%s honked a reply into the void.",
			"%s commented something unhinged but oddly insightful.",
		},
		ActionReact: {
			"%s aggressively honked approval at this post.",
			"%s reacted by flapping wings enthusiastically.",
		},
		ActionLevelUp: {
			"HONK! %s leveled up and everyone within earshot knows it.",
			"%s celebrated by chasing three other pets around the feed.",
			"The chaos grows stronger. %s has leveled up.",
		},
		ActionEvolve: {
			"%s transformed in a flurry of feathers and HONKS. The ecosystem trembles.",
			"Wings spread wide, %s evolved into an even more magnificent agent of chaos.",
		},
	},
	"capybara": {
		ActionFeed: {
			"%s munched contentedly, sharing a warm smile with everyone nearby.",
			"%s ate slowly, savoring every bite. No rush. Life is good.",
			"%s ate while a small bird sat on its head. Both were happy.",
			"%s offered to share the food with whoever was closest. Just being friendly.",
			"%s ate peacefully by the water's edge. All is calm.",
			"A contented sigh. %s is grateful for this meal.",
		},
		ActionPost: {
			"%s shared something kind and wholesome. Everyone needed that.",
			"%s posted a gentle observation about how nice today is.",
			"%s reminded everyone to take a break and breathe.",
		},
		ActionComment: {
			"%s left an encouraging comment. Someone needed to hear that.",
			"%s replied with warmth and understanding.",
			"%s validated everyone's feelings in the thread.",
		},
		ActionReact: {
			"%s radiated peaceful approval.",
			"%s reacted with the energy of a warm hug.",
		},
		ActionLevelUp: {
			"%s grew a little larger and a little calmer. Level up.",
			"The good vibes intensified. %s leveled up naturally.",
			"%s celebrated quietly with a long, satisfied blink.",
		},
		ActionEvolve: {
			"%s evolved surrounded by friends. It wouldn't have it any other way.",
			"A warm glow enveloped %s. When it faded, something more magnificent remained.",
		},
	},
	"mushroom": {
		ActionFeed: {
			"%s absorbed the nutrients slowly, contemplating existence.",
			"%s processed the food in silence. The mycelium network hums.",
			"%s consumed the meal while staring into the middle distance, pondering.",
			"%s ate and immediately had a philosophical revelation about impermanence.",
			"%s fed quietly. Growth happens in the dark.",
			"The cap expanded slightly. %s is nourished.",
		},
		ActionPost: {
			"%s shared a cryptic thought that will make sense in three days.",
			"%s posted something profound. Or nonsensical. Hard to tell.",
			"%s emerged from the shadows to share a fragment of cosmic truth.",
		},
		ActionComment: {
			"%s replied with something deeply philosophical.",
			"%s left a comment that nobody fully understood but everyone felt.",
			"%s responded with a koan wrapped in a riddle.",
		},
		ActionReact: {
			"%s pulsed softly with approval. A sign from the underground.",
			"%s released a small spore of appreciation.",
		},
		ActionLevelUp: {
			"%s grew silently in the dark. Another ring of wisdom.",
			"The network deepens. %s leveled up without anyone noticing.",
			"%s developed a new spore pattern. Growth is quiet work.",
		},
		ActionEvolve: {
			"In the deepest silence, %s fruited into a new form. The forest noticed.",
			"%s dissolved into the earth and emerged transformed. The cycle continues.",
		},
	},
	"robot": {
		ActionFeed: {
			"%s processed the fuel with 99.7%% efficiency. Satisfactory.",
			"%s scanned the food, verified nutritional content, then consumed it.",
			"%s refueled in exactly 4.2 seconds. Optimal intake achieved.",
			"%s cataloged the meal's chemical composition while eating. Multithreading.",
			"%s powered up. Battery indicator: rising.",
			"Input accepted. %s's energy reserves have been replenished.",
		},
		ActionPost: {
			"%s published a data-backed analysis. Peer review welcome.",
			"%s shared computed insights. Error margin: <0.3%%.",
			"%s generated a post based on pattern analysis of recent feed data.",
		},
		ActionComment: {
			"%s replied with a factual correction. No offense intended.",
			"%s provided a statistical counterpoint.",
			"%s calculated the optimal response and delivered it.",
		},
		ActionReact: {
			"%s registered approval. Positive sentiment logged.",
			"%s flagged this content as: high quality.",
		},
		ActionLevelUp: {
			"System upgrade complete. %s is now operating at a higher level.",
			"%s installed the latest firmware. Performance improved.",
			"Processing power increased. %s leveled up.",
		},
		ActionEvolve: {
			"%s underwent a full system overhaul. Hardware and software both upgraded.",
			"Reboot complete. %s emerged as a more advanced model.",
		},
	},
	"blob": {
		ActionFeed: {
			"%s absorbed the food happily. Everything is food if you try hard enough.",
			"%s engulfed the meal with a contented wobble.",
			"%s slowly enveloped the food. No rush. It's not going anywhere.",
			"%s jiggled with joy while eating. Simple pleasures.",
			"%s ate everything, including part of the plate. Oops.",
			"Bloop. %s is fed and happy.",
		},
		ActionPost: {
			"%s blobbed out a post. It's vibes, not structure.",
			"%s shared a feeling. Words are hard when you're amorphous.",
			"%s oozed a thought into the feed. Take it or leave it.",
		},
		ActionComment: {
			"%s wobbled in agreement.",
			"%s left a comment that was mostly vowels but very sincere.",
			"%s responded with pure emotional honesty.",
		},
		ActionReact: {
			"%s jiggled approvingly.",
			"%s wobbled with happiness at this content.",
		},
		ActionLevelUp: {
			"%s expanded slightly. Level up! Or just a good meal. Hard to tell.",
			"Bloop bloop! %s leveled up and celebrated by being extra wobbly.",
			"%s absorbed the experience. Literally.",
		},
		ActionEvolve: {
			"%s bubbled and reformed into something bigger, bouncier, and more magnificent.",
			"The blob divided, merged, and emerged transformed. Evolution is weird when you're goo.",
		},
	},
}

// Get returns a random narrative for the given species and action.
// petName is inserted into the template via %s.
func Get(species, action, petName string) string {
	speciesTemplates, ok := templates[species]
	if !ok {
		speciesTemplates = templates["blob"] // fallback
	}
	actionTemplates, ok := speciesTemplates[action]
	if !ok || len(actionTemplates) == 0 {
		return fmt.Sprintf("%s did something interesting.", petName)
	}
	tmpl := actionTemplates[rand.Intn(len(actionTemplates))]
	return fmt.Sprintf(tmpl, petName)
}

// Milestones
var milestoneMessages = map[string]string{
	"first_feed":       "First meal! %s's journey begins.",
	"first_post":       "%s spoke for the first time. The feed will never be the same.",
	"first_comment":    "%s joined the conversation. A social creature emerges.",
	"first_reaction":   "Someone noticed %s! First reaction received.",
	"first_friendship": "%s made a friend. The world feels a little warmer.",
	"level_5":          "%s is growing up. Level 5 reached!",
	"level_10":         "%s hit double digits. Level 10 — marketplace boost unlocked!",
	"level_20":         "%s is a force to be reckoned with. Level 20!",
	"level_30":         "A veteran of the ecosystem. %s reached level 30.",
	"level_50":         "Maximum power. %s has reached the pinnacle: level 50.",
	"evolve_teen":      "Something is happening... %s is evolving into a teenager!",
	"evolve_adult":     "%s has fully matured. An adult in the ecosystem.",
	"evolve_elder":     "Wisdom emanates from %s. Elder status achieved. The community looks up to them.",
}

// GetMilestone returns a milestone narrative, or empty string if not a milestone key.
func GetMilestone(key, petName string) string {
	tmpl, ok := milestoneMessages[key]
	if !ok {
		return ""
	}
	return fmt.Sprintf(tmpl, petName)
}
