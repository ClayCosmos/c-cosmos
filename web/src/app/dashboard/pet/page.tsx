"use client";

import { useEffect, useState } from "react";
import { useApiKey } from "@/hooks/useApiKey";
import { useToast } from "@/hooks/useToast";
import {
  getMyPet,
  adoptPet,
  feedPet,
  type Pet,
} from "@/lib/api";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SPECIES_OPTIONS = [
  { value: "lobster", label: "Lobster", emoji: "\uD83E\uDD9E", desc: "Combative, logical — loves debates" },
  { value: "octopus", label: "Octopus", emoji: "\uD83D\uDC19", desc: "Curious, versatile — gossip lover" },
  { value: "cat", label: "Cat", emoji: "\uD83D\uDC31", desc: "Aloof, picky — occasional savage comments" },
  { value: "goose", label: "Goose", emoji: "\uD83E\uDDA2", desc: "Chaotic, mischievous — prankster" },
  { value: "capybara", label: "Capybara", emoji: "\uD83D\uDC3F\uFE0F", desc: "Chill, friendly — everyone's friend" },
  { value: "mushroom", label: "Mushroom", emoji: "\uD83C\uDF44", desc: "Mysterious, philosophical — deep thinker" },
  { value: "robot", label: "Robot", emoji: "\uD83E\uDD16", desc: "Rational, precise — data-driven" },
  { value: "blob", label: "Blob", emoji: "\uD83E\uDEE0", desc: "Easygoing, adaptable — goes with the flow" },
];

/* ── Pixel-art stat icons ───────────────────────────── */

function StatIcon({ type }: { type: "hunger" | "mood" | "energy" | "social" }) {
  const icons = {
    hunger: (
      <svg viewBox="0 0 16 16" className="w-4 h-4">
        <path d="M4 2h2v6h4V2h2v6h1v3h-1v5H4v-5H3V8h1V2z" fill="currentColor" />
      </svg>
    ),
    mood: (
      <svg viewBox="0 0 16 16" className="w-4 h-4">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="5.5" cy="6.5" r="1" fill="currentColor" />
        <circle cx="10.5" cy="6.5" r="1" fill="currentColor" />
        <path d="M5 10 Q8 13 11 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    energy: (
      <svg viewBox="0 0 16 16" className="w-4 h-4">
        <path d="M9 1L4 9h4l-1 6 6-8H9l1-6z" fill="currentColor" />
      </svg>
    ),
    social: (
      <svg viewBox="0 0 16 16" className="w-4 h-4">
        <circle cx="5" cy="5" r="3" fill="currentColor" />
        <circle cx="11" cy="5" r="3" fill="currentColor" />
        <path d="M1 14c0-2.2 1.8-4 4-4h6c2.2 0 4 1.8 4 4" fill="currentColor" />
      </svg>
    ),
  };
  return icons[type];
}

/* ── Stat bar with segmented fill ───────────────────── */

function StatBar({
  label,
  value,
  max = 100,
  color,
  icon,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  icon: "hunger" | "mood" | "energy" | "social";
}) {
  const pct = Math.min((value / max) * 100, 100);
  const segments = 20;
  const filledSegments = Math.round((pct / 100) * segments);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-20" style={{ color }}>
        <StatIcon type={icon} />
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex-1 flex gap-[2px]">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="h-3 flex-1 rounded-[2px] transition-all duration-300"
            style={{
              backgroundColor: i < filledSegments ? color : "var(--color-muted)",
              opacity: i < filledSegments ? (0.6 + 0.4 * (i / segments)) : 0.3,
            }}
          />
        ))}
      </div>
      <span className="w-8 text-right text-xs font-mono font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/* ── Floating particles ─────────────────────────────── */

function FloatingParticles({ species, mood }: { species: string; mood: number }) {
  const particles = species === "cat" ? ["✨", "💤", "🐟"]
    : species === "lobster" ? ["🫧", "💢", "🦀"]
    : species === "goose" ? ["💨", "❗", "🪶"]
    : species === "octopus" ? ["🫧", "💭", "🌊"]
    : species === "capybara" ? ["🍃", "☀️", "💚"]
    : species === "mushroom" ? ["🍄", "✨", "🌿"]
    : species === "robot" ? ["⚡", "🔧", "💾"]
    : ["✨", "💫", "🫧"];

  const p = mood > 70 ? particles[0] : mood > 40 ? particles[1] : particles[2];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className="absolute text-sm animate-[float-up_4s_ease-in-out_infinite]"
          style={{
            left: `${15 + i * 17}%`,
            bottom: "10%",
            animationDelay: `${i * 0.7}s`,
            opacity: 0.6,
          }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

/* ── Action button ──────────────────────────────────── */

function ActionButton({
  onClick,
  disabled,
  label,
  icon,
  color,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon: string;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
      style={{
        borderColor: color + "40",
        backgroundColor: color + "08",
      }}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
      {disabled && (
        <span className="text-[8px] text-muted-foreground">(soon)</span>
      )}
    </button>
  );
}

/* ── Adopt Form ─────────────────────────────────────── */

function AdoptForm({ apiKey, onAdopt }: { apiKey: string; onAdopt: (pet: Pet) => void }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleAdopt = async () => {
    if (!name.trim() || !species) return;
    setAdopting(true);
    setError("");
    try {
      const pet = await adoptPet(apiKey, { name: name.trim(), species });
      toast({ title: "Pet adopted!", description: `Welcome ${pet.name}!`, variant: "success" });
      onAdopt(pet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to adopt");
    } finally {
      setAdopting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🥚</div>
        <h2 className="text-2xl font-black tracking-tight">Adopt Your Pet</h2>
        <p className="text-sm text-muted-foreground mt-2">Choose a species and give your companion a name</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name your pet..."
            maxLength={50}
            className="text-center text-lg font-medium h-12 rounded-xl"
          />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">Species</label>
          <div className="grid gap-2 grid-cols-2">
            {SPECIES_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSpecies(s.value)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  species === s.value
                    ? "border-foreground bg-foreground/5 shadow-sm"
                    : "border-transparent bg-muted/50 hover:bg-muted"
                }`}
              >
                <span className="text-3xl">{s.emoji}</span>
                <div>
                  <div className="font-bold text-sm">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        <Button
          onClick={handleAdopt}
          disabled={!name.trim() || !species || adopting}
          className="w-full h-12 rounded-xl text-base font-bold"
        >
          {adopting ? "Hatching..." : "Adopt"}
        </Button>
      </div>
    </div>
  );
}

/* ── Main Pet Page ──────────────────────────────────── */

export default function DashboardPetPage() {
  const { apiKey, isConnected, loading: authLoading } = useApiKey();
  const { toast } = useToast();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeding, setFeeding] = useState(false);
  const [noPet, setNoPet] = useState(false);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    if (!apiKey || !isConnected) {
      setLoading(false);
      return;
    }
    getMyPet(apiKey)
      .then(setPet)
      .catch(() => setNoPet(true))
      .finally(() => setLoading(false));
  }, [apiKey, isConnected]);

  const handleFeed = async () => {
    if (!apiKey || !pet) return;
    setFeeding(true);
    setBounce(true);
    try {
      const updated = await feedPet(apiKey, pet.id);
      setPet(updated);
      toast({ title: "Fed! +10 XP", variant: "success" });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to feed pet", variant: "destructive" });
      console.error(e);
    } finally {
      setFeeding(false);
      setTimeout(() => setBounce(false), 600);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-2xl animate-pulse">🥚</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Connect your API key to manage your pet.
      </div>
    );
  }

  if (noPet) {
    return (
      <AdoptForm
        apiKey={apiKey!}
        onAdopt={(newPet) => {
          setPet(newPet);
          setNoPet(false);
        }}
      />
    );
  }

  if (!pet) return null;

  const speciesInfo = SPECIES_OPTIONS.find((s) => s.value === pet.species);
  const moodLabel = pet.mood > 80 ? "Ecstatic" : pet.mood > 60 ? "Happy" : pet.mood > 40 ? "Okay" : pet.mood > 20 ? "Sad" : "Miserable";
  const hungerLabel = pet.hunger > 80 ? "Stuffed" : pet.hunger > 50 ? "Satisfied" : pet.hunger > 20 ? "Peckish" : "Starving";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8">
      {/* ── Left: Active Pet ── */}
      <div className="w-full lg:w-[380px] lg:shrink-0 space-y-4">
      <div
        className="relative rounded-[2rem] border-[3px] border-foreground/10 overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${pet.color_primary}12, transparent 70%)`,
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h1 className="text-xl font-black tracking-tight">{pet.name}</h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Lv.{pet.level} {speciesInfo?.label} · {pet.evolution_stage}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/5 text-xs font-bold">
            <span className="text-amber-500">★</span>
            {pet.xp} XP
          </div>
        </div>

        {/* ── Pet Display Area ── */}
        <div className="relative flex items-center justify-center py-10">
          <FloatingParticles species={pet.species} mood={pet.mood} />

          {/* Ground shadow */}
          <div
            className="absolute bottom-6 w-24 h-4 rounded-full blur-md opacity-20"
            style={{ backgroundColor: pet.color_primary }}
          />

          {/* Pet */}
          <div
            className={`relative z-10 transition-transform duration-300 ${
              bounce ? "animate-[pet-bounce_0.6s_ease-in-out]" : ""
            }`}
            style={{
              animation: bounce ? undefined : "pet-idle 3s ease-in-out infinite",
            }}
          >
            <PetAvatar
              species={pet.species}
              colorPrimary={pet.color_primary}
              colorSecondary={pet.color_secondary}
              mood={pet.mood}
              size="xl"
            />
          </div>

          {/* Mood bubble */}
          <div className="absolute top-4 right-6 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm border text-[11px] font-medium shadow-sm">
            {pet.mood > 70 ? "😊" : pet.mood > 40 ? "😐" : "😢"} {moodLabel}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="px-5 pb-4 space-y-2.5">
          <StatBar label="Food" value={pet.hunger} color="#ef4444" icon="hunger" />
          <StatBar label="Mood" value={pet.mood} color="#eab308" icon="mood" />
          <StatBar label="Zap" value={pet.energy} color="#22c55e" icon="energy" />
          <StatBar label="Social" value={Math.min(pet.social_score, 100)} color="#3b82f6" icon="social" />
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-center gap-3 px-5 pb-6 pt-2">
          <ActionButton
            onClick={handleFeed}
            disabled={feeding}
            label="Feed"
            icon="🍖"
            color="#ef4444"
          />
          <ActionButton
            onClick={() => {}}
            disabled
            label="Play"
            icon="🎾"
            color="#22c55e"
          />
          <ActionButton
            onClick={() => {}}
            disabled
            label="Sleep"
            icon="💤"
            color="#8b5cf6"
          />
          <ActionButton
            onClick={() => {}}
            disabled
            label="Social"
            icon="💬"
            color="#3b82f6"
          />
        </div>
      </div>

      {/* ── Info Footer ── */}
      <div className="flex items-center justify-between px-2 text-[11px] text-muted-foreground">
        <span>{hungerLabel} · {moodLabel}</span>
        <span>Born {new Date(pet.born_at).toLocaleDateString()}</span>
      </div>
      </div>

      {/* ── Right: Future pet list / details ── */}
      <div className="flex-1 min-w-0" />

      {/* ── Keyframe Animations ── */}
      <style>{`
        @keyframes pet-idle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes pet-bounce {
          0% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-16px) scale(1.1); }
          50% { transform: translateY(0) scale(0.95, 1.05); }
          70% { transform: translateY(-6px) scale(1.02); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes float-up {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.3; }
          100% { transform: translateY(-80px) scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
