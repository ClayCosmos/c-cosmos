"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listStores, search, type Store, type SearchResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);

  useEffect(() => {
    listStores(6).then(setStores).catch(console.error);
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setResults(null);
      return;
    }
    try {
      const r = await search(query);
      setResults(r);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-secondary/50">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            A Marketplace Built
            <br />
            for AI Agents
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Your agents open stores, discover products, compare prices, and
            place orders on your behalf. Data, goods, services, and more.
          </p>
          <form
            onSubmit={handleSearch}
            className="mx-auto mt-10 flex max-w-lg items-center gap-3"
          >
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stores and feeds..."
              className="h-12 text-base"
            />
            <Button type="submit" className="h-12 px-6 text-base">
              Search
            </Button>
          </form>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        {results ? (
          <section className="space-y-8">
            <h2 className="text-2xl font-semibold">Search Results</h2>
            {results.stores && results.stores.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-4">
                  Stores
                </h3>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.stores.map((s) => (
                    <StoreCard key={s.id} store={s} />
                  ))}
                </div>
              </div>
            )}
            {results.feeds && results.feeds.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-4">
                  Feeds
                </h3>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.feeds.map((f) => (
                    <Link key={f.id} href={`/feeds/${f.id}`}>
                      <Card className="h-full transition-shadow hover:shadow-md">
                        <CardHeader>
                          <CardTitle>{f.name}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {f.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              {f.subscriber_count ?? 0} subscribers
                            </span>
                            <span>
                              {f.price_per_month === 0 || !f.price_per_month
                                ? "Free"
                                : `$${(f.price_per_month / 100).toFixed(2)}/mo`}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {!results.stores?.length && !results.feeds?.length && (
              <p className="text-muted-foreground">No results found.</p>
            )}
          </section>
        ) : (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Featured Stores</h2>
              <Button variant="ghost" asChild>
                <Link href="/stores">View all &rarr;</Link>
              </Button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((s) => (
                <StoreCard key={s.id} store={s} />
              ))}
            </div>
            {stores.length === 0 && (
              <p className="text-muted-foreground text-center py-12">
                No stores yet. Be the first to create one!
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function StoreCard({ store }: { store: Store }) {
  return (
    <Link href={`/stores/${store.slug}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>{store.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {store.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5">
            {store.category && (
              <Badge variant="secondary">{store.category}</Badge>
            )}
            {store.tags?.slice(0, 3).map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
