"use client";

import { useEffect, useState } from "react";
import { useApiKey } from "@/hooks/useApiKey";
import {
  getMyPet,
  adoptPet,
  feedPet,
  type Pet,
} from "@/lib/api";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right tabular-nums">{value}</span>
    </div>
  );
}

function AdoptForm({ apiKey, onAdopt }: { apiKey: string; onAdopt: (pet: Pet) => void }) {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState("");

  const handleAdopt = async () => {
    if (!name.trim() || !species) return;
    setAdopting(true);
    setError("");
    try {
      const pet = await adoptPet(apiKey, { name: name.trim(), species });
      onAdopt(pet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to adopt");
    } finally {
      setAdopting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adopt a Pet</CardTitle>
        <CardDescription>Choose a species and give your pet a name</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-2 block">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Give your pet a name..."
            maxLength={50}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Species</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {SPECIES_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSpecies(s.value)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  species === s.value
                    ? "border-foreground bg-muted"
                    : "border-muted hover:border-foreground/30"
                }`}
              >
                <span className="text-2xl">{s.emoji}</span>
                <div>
                  <div className="font-medium text-sm">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleAdopt}
          disabled={!name.trim() || !species || adopting}
          className="w-full"
        >
          {adopting ? "Adopting..." : "Adopt"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPetPage() {
  const { apiKey, isConnected, loading: authLoading } = useApiKey();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeding, setFeeding] = useState(false);
  const [noPet, setNoPet] = useState(false);

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
    try {
      const updated = await feedPet(apiKey, pet.id);
      setPet(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setFeeding(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 text-muted-foreground">Loading...</div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-muted-foreground">Connect your API key to manage your pet.</p>
      </div>
    );
  }

  if (noPet) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <AdoptForm
          apiKey={apiKey!}
          onAdopt={(newPet) => {
            setPet(newPet);
            setNoPet(false);
          }}
        />
      </div>
    );
  }

  if (!pet) return null;

  const speciesInfo = SPECIES_OPTIONS.find((s) => s.value === pet.species);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-12">
      {/* Pet Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <PetAvatar
                species={pet.species}
                colorPrimary={pet.color_primary}
                colorSecondary={pet.color_secondary}
                mood={pet.mood}
                size="lg"
              />
              <div>
                <CardTitle className="text-2xl">{pet.name}</CardTitle>
                <CardDescription>
                  Lv.{pet.level} {speciesInfo?.label || pet.species} · {pet.evolution_stage} · {pet.xp} XP
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleFeed} disabled={feeding}>
              {feeding ? "Feeding..." : "Feed"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <StatBar label="Hunger" value={pet.hunger} color="#E74C3C" />
          <StatBar label="Mood" value={pet.mood} color="#F1C40F" />
          <StatBar label="Energy" value={pet.energy} color="#2ECC71" />
          <StatBar label="Social" value={Math.min(pet.social_score, 100)} color="#3498DB" />

          <div className="flex gap-2 pt-2">
            <Badge style={{ backgroundColor: pet.color_primary, color: "#fff" }}>
              {speciesInfo?.label}
            </Badge>
            <Badge variant="outline">{pet.evolution_stage}</Badge>
            {pet.accessories?.map((acc) => (
              <Badge key={acc} variant="secondary">{acc}</Badge>
            ))}
          </div>

          {pet.last_fed_at && (
            <p className="text-xs text-muted-foreground pt-1">
              Last fed: {new Date(pet.last_fed_at).toLocaleString()}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Born: {new Date(pet.born_at).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
