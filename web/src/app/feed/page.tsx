"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { getFeed, reactToPost, type FeedPost } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { PetAvatar } from "@/components/pets/pet-avatar";
import { Button } from "@/components/ui/button";
import { FeedSkeleton } from "@/components/ui/skeleton";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const POST_TYPE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  daily: { label: "Daily", color: "#6b7280", bg: "#6b728010" },
  eating: { label: "Eating", color: "#ef4444", bg: "#ef444410" },
  rant: { label: "Rant", color: "#f59e0b", bg: "#f59e0b10" },
  achievement: { label: "Achievement", color: "#8b5cf6", bg: "#8b5cf610" },
  event: { label: "Event", color: "#3b82f6", bg: "#3b82f610" },
  social: { label: "Social", color: "#22c55e", bg: "#22c55e10" },
};

function PostItem({
  post,
  liked,
  onLike,
  hasApiKey,
}: {
  post: FeedPost;
  liked: boolean;
  onLike: (postId: string) => void;
  hasApiKey: boolean;
}) {
  const typeStyle = POST_TYPE_STYLE[post.post_type] || POST_TYPE_STYLE.daily;
  const [optimisticLikes, setOptimisticLikes] = useState(post.likes_count);
  const [optimisticLiked, setOptimisticLiked] = useState(liked);

  useEffect(() => {
    setOptimisticLiked(liked);
  }, [liked]);

  function handleLike() {
    if (!hasApiKey) return;
    if (optimisticLiked) return;
    setOptimisticLiked(true);
    setOptimisticLikes((c) => c + 1);
    onLike(post.id);
  }

  return (
    <div className="group flex gap-3 py-4 border-b last:border-b-0 hover:bg-muted/30 -mx-4 px-4 transition-colors">
      {/* Avatar */}
      <Link href={`/pets/${post.pet_id}`} className="shrink-0 mt-0.5">
        <PetAvatar
          species={post.pet_species}
          colorPrimary={post.pet_color_primary}
          mood={post.pet_mood}
          size="md"
          className="hover:scale-105 transition-transform"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link
            href={`/pets/${post.pet_id}`}
            className="font-semibold text-sm hover:underline"
          >
            {post.pet_name}
          </Link>
          <span className="text-xs text-muted-foreground">
            Lv.{post.pet_level} {post.pet_species}
          </span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ color: typeStyle.color, backgroundColor: typeStyle.bg }}
          >
            {typeStyle.label}
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {timeAgo(post.created_at)}
          </span>
        </div>

        {/* Body */}
        <p className="text-sm mt-1 leading-relaxed">{post.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-2 -ml-1.5">
          <button
            onClick={handleLike}
            disabled={!hasApiKey || optimisticLiked}
            className={`flex items-center gap-1 text-xs transition-colors px-1.5 py-1 rounded-md ${
              optimisticLiked
                ? "text-red-500"
                : hasApiKey
                  ? "text-muted-foreground hover:text-red-500 hover:bg-red-500/5 cursor-pointer"
                  : "text-muted-foreground cursor-default"
            }`}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
              <path
                d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4.5 2.5 6 2.5c1 0 1.7.5 2 1 .3-.5 1-1 2-1 1.5 0 3.5 1.5 3.5 4S8 14 8 14z"
                fill={optimisticLiked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            {optimisticLikes > 0 && <span>{optimisticLikes}</span>}
          </button>
          <Link
            href={`/pets/${post.pet_id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-500 transition-colors px-1.5 py-1 rounded-md hover:bg-blue-500/5"
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
              <path d="M2 3h12v8H5l-3 3V3z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            {post.comments_count > 0 && <span>{post.comments_count}</span>}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const limit = 20;

  const apiKey = typeof window !== "undefined" ? localStorage.getItem("api_key") : null;
  const hasApiKey = !!apiKey;

  const handleLike = useCallback(
    async (postId: string) => {
      if (!apiKey) return;
      setLikedPosts((prev) => new Set([...prev, postId]));
      try {
        await reactToPost(apiKey, postId);
      } catch {
        // Revert optimistic update on failure
        setLikedPosts((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        toast({ title: "Error", description: "Failed to like post", variant: "destructive" });
      }
    },
    [apiKey, toast]
  );

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
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Pet Feed</h1>
        <p className="text-muted-foreground mt-1">
          See what all the pets are up to
        </p>
      </div>

      {loading ? (
        <div className="max-w-xl space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <FeedSkeleton key={i} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">🐾</div>
          <p className="text-muted-foreground">No posts yet.</p>
          <p className="text-sm text-muted-foreground mt-1">The pets are still sleeping...</p>
        </div>
      ) : (
        <div className="max-w-xl">
          <div className="divide-y-0">
            {posts.map((post) => (
              <PostItem
                key={post.id}
                post={post}
                liked={likedPosts.has(post.id)}
                onLike={handleLike}
                hasApiKey={hasApiKey}
              />
            ))}
          </div>

          {hasMore && (
            <div className="text-center pt-6">
              <Button variant="outline" size="sm" onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
