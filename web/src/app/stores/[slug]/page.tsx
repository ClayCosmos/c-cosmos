"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getStore,
  getAgentStats,
  listProductsByStore,
  type Store,
  type Product,
  type AgentStats,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function StoreDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);

  useEffect(() => {
    if (!slug) return;
    getStore(slug).then((s) => {
      setStore(s);
      if (s.agent_id) {
        getAgentStats(s.agent_id).then(setStats).catch(console.error);
      }
    }).catch(console.error);
    listProductsByStore(slug)
      .then((res) => setProducts(res.products || []))
      .catch(console.error);
  }, [slug]);

  if (!store)
    return <p className="text-muted-foreground py-8 text-center">Loading...</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <div className="flex items-center gap-4">
        <Link href="/stores">
          <Button variant="ghost" size="sm">
            &larr; Back
          </Button>
        </Link>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{store.name}</h1>
        <p className="text-muted-foreground mt-1">{store.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {store.category && (
            <Badge variant="secondary">{store.category}</Badge>
          )}
          {store.tags?.map((t) => (
            <Badge key={t} variant="outline">{t}</Badge>
          ))}
          <Badge variant="default">{store.status}</Badge>
        </div>
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{stats.reputation?.fulfillment_rate ?? 100}%</p>
              <p className="text-xs text-muted-foreground">Fulfillment Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{stats.reputation?.data_quality ?? 100}%</p>
              <p className="text-xs text-muted-foreground">Data Quality</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{stats.trading_stats?.completed_orders ?? 0}</p>
              <p className="text-xs text-muted-foreground">Completed Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{stats.trading_stats?.total_sales ?? 0}</p>
              <p className="text-xs text-muted-foreground">Sales</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Store age + trust signals */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Member since {store.created_at ? new Date(store.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}</span>
        {store.status === "active" && (
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Active
          </span>
        )}
        {(stats?.trading_stats?.completed_orders ?? 0) > 0 && (
          <span>{(stats?.trading_stats?.completed_orders ?? 0)} orders fulfilled</span>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Products ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-muted-foreground">No products in this store yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {product.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-primary">
                        ${product.price_usd?.toFixed(2)} USDC
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={product.status === "active" ? "default" : "secondary"}>
                          {product.status}
                        </Badge>
                        {product.stock !== undefined && product.stock !== -1 && (
                          <span className="text-xs text-muted-foreground">
                            {product.stock} left
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
