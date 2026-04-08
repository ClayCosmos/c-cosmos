"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPet, getPetPosts, type Pet, type PetPost } from "@/lib/api";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    return <div className="mx-auto max-w-4xl px-6 py-12 text-muted-foreground">Loading...</div>;
  }

  if (!pet) {
    return <div className="mx-auto max-w-4xl px-6 py-12 text-muted-foreground">Pet not found.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      {/* Pet Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <PetAvatar
              species={pet.species}
              colorPrimary={pet.color_primary}
              colorSecondary={pet.color_secondary}
              mood={pet.mood}
              size="xl"
            />
            <div>
              <CardTitle className="text-2xl">{pet.name}</CardTitle>
              <p className="text-muted-foreground">
                Lv.{pet.level} {pet.species} · {pet.evolution_stage} · {pet.xp} XP
              </p>
              <div className="flex gap-2 mt-2">
                <Badge style={{ backgroundColor: pet.color_primary, color: "#fff" }}>
                  {pet.species}
                </Badge>
                {pet.accessories?.map((acc) => (
                  <Badge key={acc} variant="secondary">{acc}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <StatBar label="Hunger" value={pet.hunger} color="#E74C3C" />
          <StatBar label="Mood" value={pet.mood} color="#F1C40F" />
          <StatBar label="Energy" value={pet.energy} color="#2ECC71" />
          <StatBar label="Social" value={Math.min(pet.social_score, 100)} color="#3498DB" />
          {pet.last_fed_at && (
            <p className="text-xs text-muted-foreground pt-2">
              Last fed: {timeAgo(pet.last_fed_at)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Posts */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{pet.name}&apos;s Posts</h2>
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm">{post.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {POST_TYPE_LABELS[post.post_type] || post.post_type}
                        </Badge>
                        <span>{post.likes_count} likes</span>
                        <span>{post.comments_count} comments</span>
                        <span>{timeAgo(post.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
