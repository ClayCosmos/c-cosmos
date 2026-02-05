"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listMyOrders, cancelOrder, completeOrder, type Order } from "@/lib/api";
import { useApiKey } from "@/hooks/useApiKey";
import { getOrderStatusColor, formatDate } from "@/lib/utils/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function OrderCard({
  order,
  role,
  apiKey,
  onUpdate,
}: {
  order: Order;
  role: "buyer" | "seller";
  apiKey: string;
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setLoading(true);
    try {
      await cancelOrder(apiKey, order.id!);
      onUpdate();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!confirm("Confirm delivery received? This will release funds to the seller.")) return;
    setLoading(true);
    try {
      await completeOrder(apiKey, order.id!);
      onUpdate();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to complete order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">
                {order.order_no}
              </span>
              <Badge variant="secondary" className={getOrderStatusColor(order.status!)}>
                {order.status}
              </Badge>
              <Badge variant={order.payment_mode === "instant" ? "default" : "outline"} className="text-xs">
                {order.payment_mode === "instant" ? "x402" : "Escrow"}
              </Badge>
            </div>
            <h3 className="font-medium mt-1 truncate">
              {order.product_name}
              {order.shipping_address && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Shipping
                </Badge>
              )}
            </h3>
            <p className="text-lg font-semibold text-primary mt-1">
              ${order.amount_usd?.toFixed(2)} USDC
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">Created</p>
            <p>{formatDate(order.created_at)}</p>
            {order.deadline && (
              <>
                <p className="text-muted-foreground mt-2">Deadline</p>
                <p>{formatDate(order.deadline)}</p>
              </>
            )}
          </div>
        </div>

        {/* Payment info for pending orders */}
        {order.status === "pending" && role === "buyer" && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Payment Required</p>
            <div className="space-y-1 text-xs font-mono">
              <p>
                <span className="text-muted-foreground">Contract:</span>{" "}
                <span className="break-all">{order.escrow_contract}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Order ID:</span>{" "}
                <span className="break-all">{order.escrow_order_id}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Seller:</span>{" "}
                <span className="break-all">{order.seller_wallet}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Amount:</span>{" "}
                {order.amount_usdc} USDC (micro-units)
              </p>
            </div>
          </div>
        )}

        {/* Delivery content for paid orders */}
        {order.status === "paid" && role === "buyer" && order.delivery_content && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">Delivery Content</p>
            <pre className="text-xs whitespace-pre-wrap break-all bg-white p-2 rounded border">
              {order.delivery_content}
            </pre>
          </div>
        )}

        {/* Transaction hash */}
        {order.tx_hash && (
          <div className="mt-3 text-xs">
            <span className="text-muted-foreground">TX: </span>
            <a
              href={`https://sepolia.basescan.org/tx/${order.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 hover:underline break-all"
            >
              {order.tx_hash.slice(0, 20)}...
            </a>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link href={`/dashboard/orders/${order.id}`}>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>

          {role === "buyer" && order.status === "pending" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel Order
            </Button>
          )}

          {role === "buyer" && order.status === "paid" && (
            <Button
              variant="default"
              size="sm"
              onClick={handleComplete}
              disabled={loading}
            >
              Confirm Receipt
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const { apiKey, isConnected, loading: authLoading } = useApiKey();
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const [buyer, seller] = await Promise.all([
        listMyOrders(apiKey, "buyer"),
        listMyOrders(apiKey, "seller"),
      ]);
      setBuyerOrders(buyer.orders || []);
      setSellerOrders(seller.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (isConnected) {
      loadOrders();
    }
  }, [isConnected, loadOrders]);

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
          Please <Link href="/dashboard" className="text-primary hover:underline">connect</Link> your API key first.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
        <Button variant="outline" onClick={loadOrders} disabled={loading}>
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="buyer">
        <TabsList>
          <TabsTrigger value="buyer">
            As Buyer ({buyerOrders.length})
          </TabsTrigger>
          <TabsTrigger value="seller">
            As Seller ({sellerOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buyer" className="mt-4 space-y-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : buyerOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No orders yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Browse the <Link href="/products" className="text-primary hover:underline">marketplace</Link> to find products.
                </p>
              </CardContent>
            </Card>
          ) : (
            buyerOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                role="buyer"
                apiKey={apiKey!}
                onUpdate={loadOrders}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="seller" className="mt-4 space-y-4">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : sellerOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No orders yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create <Link href="/dashboard/products" className="text-primary hover:underline">products</Link> in your store to start selling.
                </p>
              </CardContent>
            </Card>
          ) : (
            sellerOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                role="seller"
                apiKey={apiKey!}
                onUpdate={loadOrders}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
