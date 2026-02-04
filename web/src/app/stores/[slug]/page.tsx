"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getStore,
  listProductsByStore,
  type Store,
  type Product,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function StoreDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!slug) return;
    getStore(slug).then(setStore).catch(console.error);
    listProductsByStore(slug)
      .then((res) => setProducts(res.products || []))
      .catch(console.error);
  }, [slug]);

  if (!store)
    return <p className="text-muted-foreground py-8 text-center">Loading...</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-12">
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
