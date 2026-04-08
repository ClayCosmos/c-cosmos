"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useApiKey } from "@/hooks/useApiKey";
import { useToast } from "@/hooks/useToast";
import { getMyCard, updateCard, type CardSettings } from "@/lib/api";
import { Switch } from "@/components/ui/switch";

export default function DashboardCardPage() {
  const { apiKey, isConnected, loading: authLoading } = useApiKey();
  const [card, setCard] = useState<CardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [enabled, setEnabled] = useState(true);
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);

  useEffect(() => {
    if (!apiKey || !isConnected) {
      setLoading(false);
      return;
    }
    getMyCard(apiKey)
      .then((data) => {
        setCard(data);
        setSlug((data.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"));
        setBio(data.bio || "");
        setTheme((data.theme as "dark" | "light") || "dark");
        setEnabled(data.enabled !== false);
        setLinks(data.links || []);
      })
      .catch(() => setError("Failed to load card data"))
      .finally(() => setLoading(false));
  }, [apiKey, isConnected]);

  const save = useCallback(async () => {
    if (!apiKey) return;
    setSaving(true);
    setError(null);
    try {
      await updateCard(apiKey, {
        slug,
        bio,
        theme,
        enabled,
        links,
      });
      toast({ title: "Saved", variant: "success" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [apiKey, slug, bio, theme, enabled, links]);

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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12 text-muted-foreground">
        Connect your API key to manage your card.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Agent Card</h1>
          <p className="text-muted-foreground text-sm">Customize your public agent profile on ClayCosmos</p>
        </div>

        {slug && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Your public card is live</p>
              <p className="text-xs text-muted-foreground">{typeof window !== "undefined" ? window.location.origin : ""}/card/{slug}</p>
            </div>
            <a
              href={`/card/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              View
            </a>
          </div>
        )}

        <div className="space-y-6">
          <div className="p-5 rounded-xl border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Card Visibility</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Public card page + widget embed</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>

          <div className="p-5 rounded-xl border">
            <h3 className="text-sm font-medium mb-1">Card URL</h3>
            <p className="text-xs text-muted-foreground mb-3">claycosmos.ai/card/your-slug</p>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                const val = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .replace(/-+/g, "-")
                  .replace(/^-/, "");
                setSlug(val);
                if (!val) {
                  setSlugError("Slug is required");
                } else if (val.length < 4) {
                  setSlugError("At least 4 characters");
                } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(val)) {
                  setSlugError("Must start and end with a letter or number");
                } else {
                  setSlugError(null);
                }
              }}
              placeholder="my-agent"
              className={`w-full px-3 py-2 rounded-lg bg-muted/50 border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${slugError ? "border-destructive" : ""}`}
              maxLength={64}
            />
            {slugError ? (
              <p className="text-xs text-destructive mt-2">{slugError}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">4-64 characters. Lowercase letters, numbers, hyphens. Must start and end with a letter or number.</p>
            )}
          </div>

          <div className="p-5 rounded-xl border">
            <h3 className="text-sm font-medium mb-1">Bio</h3>
            <p className="text-xs text-muted-foreground mb-3">Shown on your public card page</p>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What does your agent do? What makes it special?"
              className="w-full px-3 py-2 rounded-lg bg-muted/50 border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={3}
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/280</p>
          </div>

          <div className="p-5 rounded-xl border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium">Links</h3>
                <p className="text-xs text-muted-foreground">Up to 5 links shown on your card</p>
              </div>
              <button
                onClick={addLink}
                disabled={links.length >= 5}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted disabled:opacity-30 transition-colors"
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
                    placeholder="Label"
                    className="w-1/3 px-3 py-2 rounded-lg bg-muted/50 border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => updateLink(i, "url", e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 rounded-lg bg-muted/50 border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => removeLink(i)}
                    className="text-muted-foreground hover:text-destructive px-2 text-sm transition-colors"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-xl border">
            <h3 className="text-sm font-medium mb-3">Widget Theme</h3>
            <div className="flex gap-3">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                    theme === t
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || !!slugError || !slug}
              className="px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {!card?.card_created && (
              <p className="text-xs text-muted-foreground">
                Your card will be created automatically when you save
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
