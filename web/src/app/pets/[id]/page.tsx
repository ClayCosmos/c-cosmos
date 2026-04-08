"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPet, getPetPosts, type Pet, type PetPost } from "@/lib/api";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

function StatBar({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: "hunger" | "mood" | "energy" | "social";
}) {
  const segments = 20;
  const filled = Math.round((Math.min(value, 100) / 100) * segments);

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
              backgroundColor: i < filled ? color : "var(--color-muted)",
              opacity: i < filled ? 0.6 + 0.4 * (i / segments) : 0.3,
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const POST_TYPE_LABELS: Record<string, string> = {
  daily: "Daily",
  eating: "Eating",
  rant: "Rant",
  achievement: "Achievement",
  event: "Event",
  social: "Social",
};

export default function PetDetailPage() {
  const params = useParams();
  const [pet, setPet] = useState<Pet | null>(null);
  const [posts, setPosts] = useState<PetPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    Promise.all([
      getPet(id).then(setPet),
      getPetPosts(id).then(setPosts),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-2xl animate-pulse">🐾</div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        Pet not found.
      </div>
    );
  }

  const moodLabel = pet.mood > 80 ? "Ecstatic" : pet.mood > 60 ? "Happy" : pet.mood > 40 ? "Okay" : pet.mood > 20 ? "Sad" : "Miserable";

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/pets" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        ← Back to Pets
      </Link>
      <div className="flex flex-col lg:flex-row gap-8">
      {/* Left: Pet Profile */}
      <div className="w-full lg:w-[380px] lg:shrink-0 space-y-6">
        <div
          className="relative rounded-[2rem] border-[3px] border-foreground/10 overflow-hidden"
          style={{
            background: `radial-gradient(ellipse at 50% 30%, ${pet.color_primary}12, transparent 70%)`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div>
              <h1 className="text-xl font-black tracking-tight">{pet.name}</h1>
              <p className="text-[11px] text-muted-foreground font-medium">
                Lv.{pet.level} {pet.species} · {pet.evolution_stage}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground/5 text-xs font-bold">
              <span className="text-amber-500">★</span>
              {pet.xp} XP
            </div>
          </div>

          {/* Pet Display */}
          <div className="relative flex items-center justify-center py-10">
            <div
              className="absolute bottom-6 w-24 h-4 rounded-full blur-md opacity-20"
              style={{ backgroundColor: pet.color_primary }}
            />
            <div style={{ animation: "pet-idle 3s ease-in-out infinite" }}>
              <PetAvatar
                species={pet.species}
                colorPrimary={pet.color_primary}
                colorSecondary={pet.color_secondary}
                mood={pet.mood}
                size="xl"
              />
            </div>
            <div className="absolute top-4 right-6 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm border text-[11px] font-medium shadow-sm">
              {pet.mood > 70 ? "😊" : pet.mood > 40 ? "😐" : "😢"} {moodLabel}
            </div>
          </div>

          {/* Stats */}
          <div className="px-5 pb-4 space-y-2.5">
            <StatBar label="Food" value={pet.hunger} color="#ef4444" icon="hunger" />
            <StatBar label="Mood" value={pet.mood} color="#eab308" icon="mood" />
            <StatBar label="Zap" value={pet.energy} color="#22c55e" icon="energy" />
            <StatBar label="Social" value={Math.min(pet.social_score, 100)} color="#3b82f6" icon="social" />
          </div>

          {/* Footer info */}
          <div className="px-5 pb-5 flex items-center justify-between text-[11px] text-muted-foreground">
            {pet.last_fed_at && <span>Fed {timeAgo(pet.last_fed_at)}</span>}
            <span>Born {new Date(pet.born_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Right: Posts */}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold mb-4">{pet.name}&apos;s Posts</h2>
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8">
            No posts yet. {pet.name} is still thinking...
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-4">
                  <p className="text-sm">{post.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {POST_TYPE_LABELS[post.post_type] || post.post_type}
                    </Badge>
                    <span>{post.likes_count} likes</span>
                    <span>{post.comments_count} comments</span>
                    <span className="ml-auto">{timeAgo(post.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      </div>
      <style>{`
        @keyframes pet-idle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
