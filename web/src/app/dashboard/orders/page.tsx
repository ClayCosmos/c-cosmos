"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listMyOrders, cancelOrder, completeOrder, markOrderShipped, disputeOrder, resolveDispute, type Order } from "@/lib/api";
import { useApiKey } from "@/hooks/useApiKey";
import { useToast } from "@/hooks/useToast";
import { getOrderStatusColor, formatDate } from "@/lib/utils/status";
import { txUrl } from "@/lib/network";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";


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
  const [showShipForm, setShowShipForm] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const { toast } = useToast();

  async function handleShip() {
    setLoading(true);
    try {
      await markOrderShipped(apiKey, order.id!, trackingNumber || undefined);
      setShowShipForm(false);
      setTrackingNumber("");
      toast({ title: "Order marked as shipped", variant: "success" });
      onUpdate();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to mark as shipped", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setConfirmAction({
      label: "Cancel Order",
      message: "Are you sure you want to cancel this order?",
      onConfirm: async () => {
        setConfirmAction(null);
        setLoading(true);
        try {
          await cancelOrder(apiKey, order.id!);
          toast({ title: "Order cancelled", variant: "success" });
          onUpdate();
        } catch (e) {
          toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to cancel order", variant: "destructive" });
        } finally {
          setLoading(false);
        }
      },
    });
  }

  async function handleComplete() {
    setConfirmAction({
      label: "Confirm Receipt",
      message: "Confirm delivery received? This will release funds to the seller.",
      onConfirm: async () => {
        setConfirmAction(null);
        setLoading(true);
        try {
          await completeOrder(apiKey, order.id!);
          toast({ title: "Order completed", variant: "success" });
          onUpdate();
        } catch (e) {
          toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to complete order", variant: "destructive" });
        } finally {
          setLoading(false);
        }
      },
    });
  }

  async function handleDispute() {
    setShowDisputeForm(true);
  }

  async function submitDispute() {
    if (!disputeReason.trim()) return;
    setShowDisputeForm(false);
    setLoading(true);
    try {
      await disputeOrder(apiKey, order.id!, disputeReason);
      setDisputeReason("");
      toast({ title: "Dispute opened", variant: "success" });
      onUpdate();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to open dispute", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve() {
    setConfirmAction({
      label: "Resolve Dispute",
      message: "Resolve this dispute? The order will return to paid status.",
      onConfirm: async () => {
        setConfirmAction(null);
        setLoading(true);
        try {
          await resolveDispute(apiKey, order.id!);
          toast({ title: "Dispute resolved", variant: "success" });
          onUpdate();
        } catch (e) {
          toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to resolve dispute", variant: "destructive" });
        } finally {
          setLoading(false);
        }
      },
    });
  }


  const ESCROW_STEPS = ["pending", "paid", "shipped", "completed"];
  const INSTANT_STEPS = ["pending", "completed"];

  function getSteps(paymentMode: string) {
    return paymentMode === "instant" ? INSTANT_STEPS : ESCROW_STEPS;
  }

  function getStepLabel(s: string) {
    const labels: Record<string, string> = {
      pending: "Pending",
      paid: "Paid",
      shipped: "Shipped",
      completed: "Completed",
      disputed: "Disputed",
    };
    return labels[s] || s;
  }

  function getStepColor(s: string, isCurrent: boolean, isPast: boolean) {
    if (isCurrent) return "bg-blue-500 text-white";
    if (isPast) return "bg-green-500 text-white";
    if (s === "disputed") return "bg-orange-500 text-white";
    return "bg-muted text-muted-foreground";
  }

  // Determine step index
  const steps = getSteps(order.payment_mode || "escrow");
  const currentStatus = order.status || "pending";
  const currentIdx = steps.indexOf(currentStatus);
  const isDisputed = currentStatus === "disputed" || currentStatus === "refunded";
  const finalIdx = isDisputed ? -1 : (currentIdx >= 0 ? currentIdx : 0);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Order progress stepper */}
        <div className="mb-4">
          <div className="flex items-center gap-1">
            {steps.map((step, i) => {
              const isPast = i < finalIdx;
              const isCurrent = i === finalIdx;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className={`flex flex-col items-center flex-1`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${getStepColor(step, isCurrent, isPast)}`}>
                      {isPast ? "✓" : i + 1}
                    </div>
                    <span className={`text-xs mt-1 ${isCurrent ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {getStepLabel(step)}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 -mt-4 ${i < finalIdx ? "bg-green-500" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
          {isDisputed && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-medium text-orange-600">⚠ {currentStatus === "refunded" ? "Refunded" : "Disputed"}</span>
              {order.dispute_reason && <span className="text-xs text-muted-foreground">— {order.dispute_reason.slice(0, 60)}</span>}
            </div>
          )}
        </div>

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
        {order.status === "pending" && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">
              {role === "buyer" ? "Payment Required" : "Awaiting Payment"}
            </p>
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
                <span className="text-muted-foreground">{role === "buyer" ? "Seller" : "Buyer"}:</span>{" "}
                <span className="break-all">{role === "buyer" ? order.seller_wallet : order.buyer_wallet}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Amount:</span>{" "}
                {order.amount_usdc} USDC (micro-units)
              </p>
            </div>
          </div>
        )}

        {/* Inline confirmation banner */}
        {confirmAction && (
          <div className="mt-4 p-3 bg-muted rounded-lg border">
            <p className="text-sm font-medium mb-2">{confirmAction.message}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmAction.onConfirm}>{confirmAction.label}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmAction(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Inline dispute reason form */}
        {showDisputeForm && (
          <div className="mt-4 p-3 bg-muted rounded-lg border">
            <p className="text-sm font-medium mb-2">Please describe the reason for your dispute:</p>
            <div className="flex gap-2">
              <Input
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Reason for dispute..."
                className="text-sm h-8"
              />
              <Button size="sm" onClick={submitDispute} disabled={!disputeReason.trim()}>Submit</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowDisputeForm(false); setDisputeReason(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Delivery content for paid/completed orders (buyer view) */}
        {(order.status === "paid" || order.status === "completed" || order.status === "disputed") && role === "buyer" && order.delivery_content && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Delivery Content</p>
            <pre className="text-xs whitespace-pre-wrap break-all bg-background p-2 rounded border">
              {order.delivery_content}
            </pre>
          </div>
        )}

        {/* Seller: shipping address for paid physical orders that haven't shipped */}
        {role === "seller" && order.status === "paid" && order.shipping_address && !order.shipped_at && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Shipping Address</p>
            <div className="text-xs space-y-0.5">
              <p className="font-medium">{order.shipping_address.recipient_name}</p>
              <p>{order.shipping_address.address_line1}</p>
              {order.shipping_address.address_line2 && <p>{order.shipping_address.address_line2}</p>}
              <p>{order.shipping_address.city}{order.shipping_address.state ? `, ${order.shipping_address.state}` : ""} {order.shipping_address.postal_code}</p>
              <p>{order.shipping_address.country}</p>
              {order.shipping_address.phone && <p>Phone: {order.shipping_address.phone}</p>}
              {order.shipping_address.notes && <p className="text-muted-foreground mt-1">Notes: {order.shipping_address.notes}</p>}
            </div>
            {!showShipForm ? (
              <Button size="sm" className="mt-3" onClick={() => setShowShipForm(true)}>
                Mark Shipped
              </Button>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  placeholder="Tracking number (optional)"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="text-xs h-8"
                />
                <Button size="sm" onClick={handleShip} disabled={loading}>
                  Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowShipForm(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Seller: shipped status */}
        {role === "seller" && order.status === "paid" && order.shipped_at && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Shipped</p>
            <p className="text-xs text-muted-foreground">
              Shipped at: {formatDate(order.shipped_at!)}
            </p>
            {order.tracking_number && (
              <p className="text-xs text-muted-foreground">
                Tracking: {order.tracking_number}
              </p>
            )}
          </div>
        )}

        {/* Seller: digital product delivery info (no shipping needed) */}
        {role === "seller" && order.status === "paid" && !order.shipping_address && order.delivery_content && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Delivered (Digital)</p>
            <pre className="text-xs whitespace-pre-wrap break-all bg-background p-2 rounded border">
              {order.delivery_content}
            </pre>
          </div>
        )}

        {/* Disputed info banner */}
        {(order.status === "disputed" || order.status === "refunded") && (
          <div className={`mt-4 p-3 rounded-lg ${order.status === "disputed" ? "bg-orange-50" : "bg-red-50"}`}>
            <p className={`text-sm font-medium mb-1 ${order.status === "disputed" ? "text-orange-800" : "text-red-800"}`}>
              {order.status === "disputed" ? "Disputed" : "Refunded"}
            </p>
            {order.dispute_reason && (
              <p className="text-xs text-muted-foreground">
                Reason: {order.dispute_reason}
              </p>
            )}
            {order.disputed_at && (
              <p className="text-xs text-muted-foreground">
                Since: {formatDate(order.disputed_at)}
              </p>
            )}
          </div>
        )}

        {/* Transaction hash */}
        {order.tx_hash && (
          <div className="mt-3 text-xs">
            <span className="text-muted-foreground">TX: </span>
            <a
              href={txUrl(order.tx_hash)}
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

          {role === "buyer" && order.status === "paid" && (
            <Button
              variant="outline"
              size="sm"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
              onClick={handleDispute}
              disabled={loading}
            >
              Open Dispute
            </Button>
          )}

          {role === "seller" && order.status === "disputed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResolve}
              disabled={loading}
            >
              Resolve Dispute
            </Button>
          )}

          {role === "seller" && order.status === "paid" && !order.shipping_address && !order.shipped_at && (
            <Button
              size="sm"
              onClick={() => handleShip()}
              disabled={loading}
            >
              Mark Shipped
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
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-12">
        <Skeleton className="h-9 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-7 w-7 rounded-full" />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
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
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-4 space-y-3">
                  <div className="flex gap-1">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-7 w-7 rounded-full" />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : buyerOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-4xl mb-3">📋</div>
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
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-4 space-y-3">
                  <div className="flex gap-1">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-7 w-7 rounded-full" />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : sellerOrders.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="text-4xl mb-3">📋</div>
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
