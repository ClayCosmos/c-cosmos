"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listMyProducts,
  createProduct,
  deleteProduct,
  type ProductDetail,
} from "@/lib/api";
import { useApiKey } from "@/hooks/useApiKey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProductsPage() {
  const { apiKey, isConnected, loading: authLoading } = useApiKey();
  const [products, setProducts] = useState<ProductDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [deliveryContent, setDeliveryContent] = useState("");
  const [stock, setStock] = useState("-1");
  const [imageUrls, setImageUrls] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [requiresShipping, setRequiresShipping] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const res = await listMyProducts(apiKey);
      setProducts(res.products || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (isConnected) {
      loadProducts();
    }
  }, [isConnected, loadProducts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    try {
      const priceUsdc = Math.round(parseFloat(priceUsd) * 1_000_000);
      if (isNaN(priceUsdc) || priceUsdc <= 0) {
        throw new Error("Invalid price");
      }

      const parsedImageUrls = imageUrls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);

      await createProduct(apiKey!, {
        name,
        description: description || undefined,
        price_usdc: priceUsdc,
        delivery_content: deliveryContent,
        stock: stock ? parseInt(stock, 10) : undefined,
        image_urls: parsedImageUrls.length > 0 ? parsedImageUrls : undefined,
        external_url: externalUrl || undefined,
        requires_shipping: requiresShipping || undefined,
      });

      setShowForm(false);
      setName("");
      setDescription("");
      setPriceUsd("");
      setDeliveryContent("");
      setStock("-1");
      setImageUrls("");
      setExternalUrl("");
      setRequiresShipping(false);
      loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create product");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteProduct(apiKey!, productId);
      loadProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete product");
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">
          Please{" "}
          <Link href="/dashboard" className="text-primary hover:underline">
            connect
          </Link>{" "}
          your API key first.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Products</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "New Product"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Product</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Product name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Product description"
                  rows={2}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Price (USDC) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    placeholder="10.00"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Stock</label>
                  <Input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="-1 for unlimited"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    -1 for unlimited
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Image URLs</label>
                <Textarea
                  value={imageUrls}
                  onChange={(e) => setImageUrls(e.target.value)}
                  placeholder="One URL per line"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  One image URL per line
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">External URL</label>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires-shipping"
                  checked={requiresShipping}
                  onChange={(e) => setRequiresShipping(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="requires-shipping" className="text-sm font-medium">
                  Requires Shipping (physical product)
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">Delivery Content *</label>
                <Textarea
                  value={deliveryContent}
                  onChange={(e) => setDeliveryContent(e.target.value)}
                  placeholder="Content delivered to buyer after payment (API key, download link, etc.)"
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This content will be revealed to the buyer after payment.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Creating..." : "Create Product"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No products yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first product to start selling.
              </p>
            </CardContent>
          </Card>
        ) : (
          products.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {product.image_urls && product.image_urls.length > 0 && (
                    <Image
                      src={product.image_urls[0]}
                      alt={product.name ?? ""}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{product.name}</h3>
                      <Badge
                        variant={product.status === "active" ? "default" : "secondary"}
                      >
                        {product.status}
                      </Badge>
                      <Badge variant="outline">
                        {product.requires_shipping ? "Physical" : "Digital"}
                      </Badge>
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {product.description}
                      </p>
                    )}
                    <p className="text-lg font-semibold text-primary mt-2">
                      ${product.price_usd?.toFixed(2)} USDC
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Stock: {product.stock === -1 ? "Unlimited" : product.stock}
                    </p>
                    {product.external_url && (
                      <a
                        href={product.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline mt-1 inline-block"
                      >
                        External link
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(product.id!)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
