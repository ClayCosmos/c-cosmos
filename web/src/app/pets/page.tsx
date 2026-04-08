"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPets, type Pet } from "@/lib/api";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const SPECIES_LIST = [
  { value: "lobster", label: "Lobster", emoji: "\uD83E\uDD9E" },
  { value: "octopus", label: "Octopus", emoji: "\uD83D\uDC19" },
  { value: "cat", label: "Cat", emoji: "\uD83D\uDC31" },
  { value: "goose", label: "Goose", emoji: "\uD83E\uDDA2" },
  { value: "capybara", label: "Capybara", emoji: "\uD83D\uDC3F\uFE0F" },
  { value: "mushroom", label: "Mushroom", emoji: "\uD83C\uDF44" },
  { value: "robot", label: "Robot", emoji: "\uD83E\uDD16" },
  { value: "blob", label: "Blob", emoji: "\uD83E\uDEE0" },
];

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right tabular-nums">{value}</span>
    </div>
  );
}

function PetCard({ pet }: { pet: Pet }) {
  const species = SPECIES_LIST.find((s) => s.value === pet.species);

  return (
    <Link href={`/pets/${pet.id}`}>
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <PetAvatar
              species={pet.species}
              colorPrimary={pet.color_primary}
              colorSecondary={pet.color_secondary}
              mood={pet.mood}
              size="md"
            />
            <div>
              <CardTitle className="text-base">{pet.name}</CardTitle>
              <CardDescription>
                Lv.{pet.level} {species?.label || pet.species} · {pet.evolution_stage}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <StatBar label="Hunger" value={pet.hunger} color="#E74C3C" />
          <StatBar label="Mood" value={pet.mood} color="#F1C40F" />
          <StatBar label="Energy" value={pet.energy} color="#2ECC71" />
          <StatBar label="Social" value={pet.social_score > 100 ? 100 : pet.social_score} color="#3498DB" />
          <div className="flex gap-1.5 pt-2">
            <Badge variant="outline" style={{ borderColor: pet.color_primary, color: pet.color_primary }}>
              {species?.label}
            </Badge>
            {pet.accessories?.map((acc) => (
              <Badge key={acc} variant="secondary">{acc}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [species, setSpecies] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPets(50, 0, species || undefined)
      .then(setPets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [species]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meet the Pets</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered pets living in the ClayCosmos ecosystem
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={!species ? "default" : "outline"}
          size="sm"
          onClick={() => setSpecies("")}
        >
          All
        </Button>
        {SPECIES_LIST.map((s) => (
          <Button
            key={s.value}
            variant={species === s.value ? "default" : "outline"}
            size="sm"
            onClick={() => setSpecies(s.value)}
          >
            {s.emoji} {s.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="flex gap-1.5 pt-1">
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : pets.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🐾</div>
          <p className="text-muted-foreground">No pets yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
        </div>
      )}
    </div>
  );
}
