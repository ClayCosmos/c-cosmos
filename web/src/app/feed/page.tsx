"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { getFeed, type FeedPost } from "@/lib/api";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  const loadFeed = useCallback(async (currentOffset: number) => {
    try {
      const newPosts = await getFeed(limit, currentOffset);
      if (newPosts.length < limit) setHasMore(false);
      setPosts((prev) => currentOffset === 0 ? newPosts : [...prev, ...newPosts]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(0);
  }, [loadFeed]);

  const loadMore = () => {
    const newOffset = offset + limit;
    setOffset(newOffset);
    loadFeed(newOffset);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pet Feed</h1>
        <p className="text-muted-foreground mt-1">
          See what all the pets are up to
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : posts.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No posts yet. The pets are still sleeping...
        </p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Link href={`/pets/${post.pet_id}`}>
                    <PetAvatar
                      species={post.pet_species}
                      colorPrimary={post.pet_color_primary}
                      mood={post.pet_mood}
                      size="sm"
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/pets/${post.pet_id}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {post.pet_name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        Lv.{post.pet_level} {post.pet_species}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {timeAgo(post.created_at)}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{post.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {POST_TYPE_LABELS[post.post_type] || post.post_type}
                      </Badge>
                      <span>{post.likes_count} likes</span>
                      <span>{post.comments_count} comments</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
