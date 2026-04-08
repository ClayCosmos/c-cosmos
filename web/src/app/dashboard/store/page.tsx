"use client";

import { useEffect, useState } from "react";
import { createStore, listMyStores, updateStore, type Store } from "@/lib/api";
import { useApiKey } from "@/hooks/useApiKey";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Sanitize a string into a valid URL slug: lowercase, a-z 0-9 and hyphens only. */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 128 && SLUG_PATTERN.test(slug);
}

function StoreCard({
  store,
  onUpdate,
}: {
  store: Store;
  onUpdate: (updated: Store) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(store.name ?? "");
  const [editDescription, setEditDescription] = useState(store.description ?? "");
  const [editCategory, setEditCategory] = useState(store.category ?? "");
  const [editTags, setEditTags] = useState(store.tags?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { apiKey } = useApiKey();
  const { toast } = useToast();

  function startEdit() {
    setEditName(store.name ?? "");
    setEditDescription(store.description ?? "");
    setEditCategory(store.category ?? "");
    setEditTags(store.tags?.join(", ") ?? "");
    setError("");
    setEditing(true);
  }

  async function handleSave() {
    if (!apiKey || !store.slug) return;
    setSaving(true);
    setError("");
    try {
      const tags = editTags
        ? editTags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const updated = await updateStore(apiKey, store.slug, {
        name: editName,
        description: editDescription,
        category: editCategory,
        tags,
      });
      onUpdate(updated);
      setEditing(false);
      toast({ title: "Store updated", variant: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update store";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Store name"
          />
          <Input
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            placeholder="Category"
          />
          <Input
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="Tags (comma-separated, e.g. AI, automation, data)"
          />
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !editName}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={startEdit}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium">{store.name}</h3>
            {store.description && (
              <p className="text-sm text-muted-foreground">{store.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              /{store.slug} &middot; {store.status}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">click to edit</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardStorePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [msg, setMsg] = useState("");

  const { apiKey, isConnected } = useApiKey();
  const { toast } = useToast();

  useEffect(() => {
    if (!isConnected || !apiKey) return;
    listMyStores(apiKey)
      .then(setStores)
      .catch(console.error)
      .finally(() => setStoresLoading(false));
  }, [isConnected, apiKey]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(toSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(toSlug(value));
  }

  const slugError =
    slug.length > 0 && !isValidSlug(slug)
      ? "Slug must be 2+ characters: lowercase letters, numbers, and hyphens"
      : "";

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey) return;
    if (!isValidSlug(slug)) {
      setMsg("Invalid slug format");
      return;
    }
    setMsg("");
    try {
      const store = await createStore(apiKey, {
        name,
        slug,
        description,
        category,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      setStores((prev) => [store, ...prev]);
      setMsg("Store created!");
      toast({ title: "Store created", description: `/${store.slug} is live`, variant: "success" });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setDescription("");
      setCategory("");
      setTags("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create store";
      setMsg(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  }

  function handleStoreUpdate(updated: Store) {
    setStores((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">My Store</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create New Store</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Store name"
                required
              />
              <div>
                <Input
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="store-slug"
                  required
                />
                {slugError && (
                  <p className="text-xs text-destructive mt-1">{slugError}</p>
                )}
                {slug && !slugError && (
                  <p className="text-xs text-muted-foreground mt-1">
                    URL: /stores/{slug}
                  </p>
                )}
              </div>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
              />
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Tags (comma-separated, e.g. AI, automation)"
              />
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
            <Button type="submit" disabled={!!slugError && slug.length > 0}>
              Create Store
            </Button>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">Your Stores</h2>
        {storesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🏪</div>
            <p className="text-muted-foreground">No stores yet.</p>
          </div>
        ) : (
          stores.map((s) => (
            <StoreCard key={s.id} store={s} onUpdate={handleStoreUpdate} />
          ))
        )}
      </div>
    </div>
  );
}
