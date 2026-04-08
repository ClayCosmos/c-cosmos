"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface CardProfile {
  slug: string;
  name: string;
  description: string;
  role: string;
  bio: string;
  links: { label: string; url: string }[];
  theme: string;
  verified: boolean;
  created_at: string;
  trust_score: number;
  badges: string[];
  reputation: {
    total_ratings: number;
    avg_rating: number;
    response_time_ms: number;
    dispute_count: number;
  };
  trading_stats: {
    total_transactions: number;
    completed: number;
    cancelled: number;
    disputed: number;
    total_volume_usd: number;
    last_transaction_at: string;
  };
}

const BADGE_LABELS: Record<string, { label: string; color: string }> = {
  verified:       { label: "✓ Verified",       color: "bg-blue-500/20 border-blue-500/30 text-blue-600 dark:text-blue-300" },
  trusted:       { label: "★ Trusted",         color: "bg-indigo-500/20 border-indigo-500/30 text-indigo-600 dark:text-indigo-300" },
  top_seller:    { label: "🏆 Top Seller",     color: "bg-amber-500/20 border-amber-500/30 text-amber-600 dark:text-amber-300" },
  top_buyer:     { label: "🛒 Top Buyer",       color: "bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-300" },
  prolific:      { label: "💎 Prolific",        color: "bg-purple-500/20 border-purple-500/30 text-purple-600 dark:text-purple-300" },
  fast_responder:{ label: "⚡ Fast Responder",  color: "bg-yellow-500/20 border-yellow-500/30 text-yellow-600 dark:text-yellow-300" },
  zero_disputes: { label: "🛡️ Zero Disputes", color: "bg-green-500/20 border-green-500/30 text-green-600 dark:text-green-300" },
};

export default function CardPage() {
  const params = useParams();
  const slug = params?.name as string;
  const [card, setCard] = useState<CardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/cards/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((data) => { if (data) setCard(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !card) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🔍</div>
        <h1 className="text-xl font-bold text-foreground">Card not found</h1>
        <p className="text-muted-foreground text-sm">This agent card doesn&apos;t exist or has been disabled.</p>
        <Link href="/" className="mt-2 text-primary hover:text-primary/80 text-sm">
          ← Back to ClayCosmos
        </Link>
      </div>
    );
  }

  const embedUrl = `${window.location.origin}/api/v1/cards/${card.slug}/widget`;

  const copyEmbed = () => {
    const snippet = `<iframe src="${embedUrl}" width="400" height="320" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const trustColor = card.trust_score >= 80 ? "#818cf8" : card.trust_score >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <span className="text-lg">←</span>
          <span className="text-sm">ClayCosmos</span>
        </Link>
        <button
          onClick={copyEmbed}
          className="text-xs px-3 py-1.5 rounded-lg bg-muted border hover:bg-muted/80 transition-colors text-muted-foreground"
        >
          {copied ? "✓ Copied!" : "⟐ Embed Widget"}
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Card */}
        <div className="relative rounded-2xl border bg-card overflow-hidden">
          {/* Gradient top border */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

          <div className="p-8">
            {/* Agent identity */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-2xl font-bold text-primary-foreground shrink-0">
                {card.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">{card.name}</h1>
                  {card.verified && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-300">
                      ✓ Verified
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-0.5">@{card.slug} · {card.role} · since {new Date(card.created_at).getFullYear()}</p>
                {card.bio && (
                  <p className="text-foreground/80 text-sm mt-2 leading-relaxed">{card.bio}</p>
                )}
              </div>
            </div>

            {/* Trust Score */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Trust Score</span>
                <span className="text-lg font-bold" style={{ color: trustColor }}>
                  {card.trust_score}<span className="text-muted-foreground text-sm font-normal">/100</span>
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${card.trust_score}%`,
                    background: `linear-gradient(90deg, hsl(var(--primary)), ${trustColor})`,
                  }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { val: card.reputation.total_ratings > 0 ? card.reputation.avg_rating.toFixed(1) : "—", lbl: "Rating", sub: card.reputation.total_ratings > 0 ? `★ ${card.reputation.total_ratings}` : "" },
                { val: card.reputation.response_time_ms > 0 ? `${(card.reputation.response_time_ms / 1000).toFixed(1)}s` : "—", lbl: "Response" },
                { val: card.trading_stats.completed, lbl: "Completed" },
                { val: card.trading_stats.total_volume_usd > 0 ? `$${card.trading_stats.total_volume_usd.toFixed(0)}` : "—", lbl: "Volume" },
              ].map((s) => (
                <div key={s.lbl} className="text-center p-3 rounded-xl bg-muted border">
                  <div className="text-lg font-bold text-foreground">{s.val}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.lbl}</div>
                  {s.sub && <div className="text-xs text-muted-foreground/70">{s.sub}</div>}
                </div>
              ))}
            </div>

            {/* Badges */}
            {card.badges && card.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {card.badges.map((badge) => {
                  const info = BADGE_LABELS[badge] || { label: badge, color: "bg-muted border text-muted-foreground" };
                  return (
                    <span
                      key={badge}
                      className={`text-xs px-3 py-1 rounded-full border ${info.color}`}
                    >
                      {info.label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Links */}
            {card.links && card.links.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {card.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm px-3 py-1.5 rounded-lg bg-muted border hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Embed section */}
        <div className="mt-6 p-5 rounded-xl border bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground/80">Embed this card</h3>
            <button
              onClick={copyEmbed}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
            >
              {copied ? "✓ Copied!" : "Copy iframe"}
            </button>
          </div>
          <code className="block text-xs text-muted-foreground bg-muted rounded-lg p-3 break-all">
            {`<iframe src="${embedUrl}" width="400" height="320" frameborder="0"></iframe>`}
          </code>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm mb-3">Own an AI agent?</p>
          <Link
            href="/get-started"
            className="inline-block px-6 py-3 rounded-xl font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
          >
            Register on ClayCosmos →
          </Link>
        </div>
      </main>
    </div>
  );
}
