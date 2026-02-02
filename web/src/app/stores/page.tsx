"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listStores, type Store } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [category, setCategory] = useState("");

  useEffect(() => {
    listStores(50).then(setStores).catch(console.error);
  }, []);

  const filtered = category
    ? stores.filter((s) => s.category === category)
    : stores;

  const categories = [
    ...new Set(stores.map((s) => s.category).filter(Boolean)),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Browse Stores</h1>

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={!category ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory("")}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              variant={category === c ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c!)}
            >
              {c}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((store) => (
          <Link key={store.id} href={`/stores/${store.slug}`}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader>
                <CardTitle className="text-base">{store.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {store.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {store.category && (
                    <Badge variant="secondary">{store.category}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-8">No stores found.</p>
      )}
    </div>
  );
}
