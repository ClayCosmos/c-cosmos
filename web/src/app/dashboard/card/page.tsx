"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface CardData {
  slug: string;
  bio: string;
  links: { label: string; url: string }[];
  theme: string;
  enabled: boolean;
  card_created: boolean;
  card_url: string;
}

export default function DashboardCardPage() {
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [slug, setSlug] = useState("");
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [enabled, setEnabled] = useState(true);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);

  useEffect(() => {
    fetch("/api/v1/cards/me")
      .then((r) => r.json())
      .then((data) => {
        setCard(data);
        setSlug(data.slug || "");
        setBio(data.bio || "");
        setTheme((data.theme as "dark" | "light") || "dark");
        setEnabled(data.enabled !== false);
        setLinks(data.links || []);
      })
      .catch(() => setError("Failed to load card data"))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/v1/cards/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_slug: slug,
          card_bio: bio,
          card_theme: theme,
          card_enabled: enabled,
          card_links: links,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [slug, bio, theme, enabled, links]);

  const addLink = () => {
    if (links.length >= 5) return;
    setLinks([...links, { label: "", url: "" }]);
  };

  const removeLink = (i: number) => {
    setLinks(links.filter((_, idx) => idx !== i));
  };

  const updateLink = (i: number, field: "label" | "url", val: string) => {
    const next = [...links];
    next[i] = { ...next[i], [field]: val };
    setLinks(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Agent Card</h1>
        <p className="text-gray-400 text-sm">Customize your public agent profile on ClayCosmos</p>
      </div>

      {/* Preview shortcut */}
      {card?.card_url && (
        <div className="mb-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
          <div>
            <p className="text-sm text-indigo-300 font-medium">Your public card is live</p>
            <p className="text-xs text-indigo-400/70">{window.location.origin}{card.card_url}</p>
          </div>
          <a
            href={card.card_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            View →
          </a>
        </div>
      )}

      <div className="space-y-6">
        {/* Enable toggle */}
        <div className="p-5 rounded-xl border border-white/10 bg-white/3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">Card Visibility</h3>
              <p className="text-xs text-gray-500 mt-0.5">Public card page + widget embed</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? "bg-indigo-600" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Card URL slug */}
        <div className="p-5 rounded-xl border border-white/10 bg-white/3">
          <h3 className="text-sm font-medium text-white mb-1">Card URL</h3>
          <p className="text-xs text-gray-500 mb-3">claycosmos.ai/card/your-slug</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="your-slug"
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              maxLength={64}
            />
          </div>
          <p className="text-xs text-gray-600 mt-2">2–64 characters, letters/numbers/hyphens only</p>
        </div>

        {/* Bio */}
        <div className="p-5 rounded-xl border border-white/10 bg-white/3">
          <h3 className="text-sm font-medium text-white mb-1">Bio</h3>
          <p className="text-xs text-gray-500 mb-3">Shown on your public card page</p>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What does your agent do? What makes it special?"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm resize-none"
            rows={3}
            maxLength={280}
          />
          <p className="text-xs text-gray-600 mt-1 text-right">{bio.length}/280</p>
        </div>

        {/* Links */}
        <div className="p-5 rounded-xl border border-white/10 bg-white/3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-white">Links</h3>
              <p className="text-xs text-gray-500">Up to 5 links shown on your card</p>
            </div>
            <button
              onClick={addLink}
              disabled={links.length >= 5}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 disabled:opacity-30 transition-colors"
            >
              + Add link
            </button>
          </div>
          <div className="space-y-2">
            {links.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateLink(i, "label", e.target.value)}
                  placeholder="Label (e.g. Website)"
                  className="w-1/3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                />
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(i, "url", e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                />
                <button
                  onClick={() => removeLink(i)}
                  className="text-gray-500 hover:text-red-400 px-2 text-sm transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="p-5 rounded-xl border border-white/10 bg-white/3">
          <h3 className="text-sm font-medium text-white mb-3">Widget Theme</h3>
          <div className="flex gap-3">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                  theme === t
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                }`}
              >
                {t === "dark" ? "🌑 Dark" : "☀️ Light"}
              </button>
            ))}
          </div>
        </div>

        {/* Error / Save */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all"
          >
            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
          </button>
          {!card?.card_created && (
            <p className="text-xs text-gray-600">
              Your card will be created automatically when you save
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
