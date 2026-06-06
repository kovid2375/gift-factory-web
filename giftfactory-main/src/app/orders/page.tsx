"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { useAuthModal } from "@/provider/auth-modal-provider";
import { ArrowLeft, CreditCard, Clock, Package, Star, Store, User, MessageSquare } from "lucide-react";
import { fetchOrders, fetchProductById, fetchProductReviews, submitReview } from "@/lib/api";
import type { ApiOrder, ApiOrderItem, ApiProduct } from "@/types/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function getStatusVariant(status: string) {
  if (status === "DELIVERED" || status === "CONFIRMED") return "default";
  if (status === "CANCELLED" || status === "FAILED") return "destructive";
  return "secondary";
}

function formatStatus(status?: string) {
  return (status ?? "CREATED").replace(/_/g, " ");
}

function getVendorName(order: ApiOrder): string {
  if (order.vendorId && typeof order.vendorId === "object" && "name" in order.vendorId) {
    return order.vendorId.name || "Unknown Vendor";
  }
  const franchise = (order as any).franchise;
  if (franchise && typeof franchise === "object") {
    return franchise.name || franchise.businessName || "Unknown Vendor";
  }
  return "Unknown Vendor";
}

function getCustomerName(order: ApiOrder): string {
  if (order.customerId && typeof order.customerId === "object" && "fullName" in order.customerId) {
    return order.customerId.fullName || "Customer";
  }
  return "Customer";
}

function getOrderItemTitle(item: ApiOrderItem): string {
  const name = (item as any).productName || (item as any).product?.title || (item as any).product?.name;
  if (name) return name;

  const variant = item.variantId && typeof item.variantId === "object" ? item.variantId : null;
  const variantProduct = variant?.productId;
  if (variantProduct && typeof variantProduct === "object" && "title" in variantProduct) {
    return (variantProduct as ApiProduct).title || "Product";
  }

  const product = item.productId;
  if (product && typeof product === "object" && "title" in product) {
    return (product as ApiProduct).title || "Product";
  }

  return "Product";
}

function getOrderItemSubtitle(item: ApiOrderItem): string | null {
  const variant = item.variantId && typeof item.variantId === "object" ? item.variantId : null;
  if (!variant) return null;

  if (variant.explicitAttributes?.length) {
    return variant.explicitAttributes
      .map((a) => `${a.label}: ${a.value}`)
      .join(" | ");
  }

  if (variant.title) return variant.title;
  return null;
}

function getOrderItemProductId(item: ApiOrderItem): string | undefined {
  const fromProduct =
    typeof item.productId === "string"
      ? item.productId
      : (item.productId as { _id?: string } | undefined)?._id;
  if (fromProduct) return fromProduct;
  const variant = item.variantId && typeof item.variantId === "object" ? item.variantId : null;
  const fromVariantProduct =
    typeof variant?.productId === "string"
      ? variant.productId
      : (variant?.productId as { _id?: string } | undefined)?._id;
  return fromVariantProduct;
}

function getOrderItemImage(item: ApiOrderItem, fallbackProduct?: ApiProduct): string {
  const img = (item as any).imageUrl || (item as any).product?.thumbnail || (item as any).product?.imageUrl || (item as any).product?.baseImageUrl?.[0];
  if (img) return img;

  const variant = item.variantId && typeof item.variantId === "object" ? item.variantId : null;
  if (Array.isArray(variant?.images) && variant.images.length && typeof variant.images[0] === "string") {
    return variant.images[0];
  }

  const fromProductLike = (p: unknown): string | undefined => {
    if (!p || typeof p !== "object") return undefined;
    const rec = p as Record<string, unknown>;
    const base = rec.baseImageUrl;
    if (Array.isArray(base) && base.length > 0 && typeof base[0] === "string") return base[0];
    if (typeof base === "string" && base) return base;
    if (typeof rec.thumbnail === "string" && rec.thumbnail) return rec.thumbnail;
    if (typeof rec.imageUrl === "string" && rec.imageUrl) return rec.imageUrl;
    if (typeof rec.image === "string" && rec.image) return rec.image;
    return undefined;
  };

  const variantProduct = variant?.productId;
  const variantImage = fromProductLike(variantProduct);
  if (variantImage) return variantImage;

  const product = item.productId;
  const productImage = fromProductLike(product);
  if (productImage) return productImage;

  const fallbackImage = fromProductLike(fallbackProduct);
  if (fallbackImage) return fallbackImage;

  return "https://picsum.photos/seed/gift/400/400";
}

function getOrderItemCount(order: ApiOrder): number {
  return (order.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}

function isB2bOrder(order: ApiOrder): boolean {
  const maybeB2b = order as ApiOrder & { isRfqOrder?: boolean; orderType?: string };
  if (maybeB2b.isRfqOrder) return true;

  const orderType = (maybeB2b.orderType ?? "").toLowerCase();
  if (orderType.includes("b2b") || orderType.includes("rfq")) return true;

  const orderNumber = order.orderNumber ?? "";
  return orderNumber.startsWith("ORD-B2B-");
}



function OrderHistoryPageContent() {
  const { status, data: sessionData } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openAuthModal } = useAuthModal();
  const authOpenedRef = useRef(false);
  const [page, setPage] = useState(1);
  const [selectedRatings, setSelectedRatings] = useState<Record<string, number>>({});
  const [submittingReviewProductId, setSubmittingReviewProductId] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [activeReviewProduct, setActiveReviewProduct] = useState<{
    productId: string;
    productTitle: string;
    productImage: string;
    orderId: string;
  } | null>(null);
  const [activeRating, setActiveRating] = useState<number>(5);
  const [commentText, setCommentText] = useState<string>("");
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const limit = 10;

  useEffect(() => {
    const userId = sessionData?.userId;
    if (!userId || typeof window === "undefined") return;

    try {
      const stored = window.localStorage.getItem(`giftfactory-review-ratings:${userId}`);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, number>;
      setSelectedRatings((prev) => ({ ...prev, ...parsed, ...prev }));
    } catch {
      // Ignore malformed storage and continue with empty ratings.
    }
  }, [sessionData?.userId]);

  useEffect(() => {
    const userId = sessionData?.userId;
    if (!userId || typeof window === "undefined") return;
    window.localStorage.setItem(`giftfactory-review-ratings:${userId}`, JSON.stringify(selectedRatings));
  }, [selectedRatings, sessionData?.userId]);

  useEffect(() => {
    if (status !== "authenticated" && status !== "loading" && !authOpenedRef.current) {
      authOpenedRef.current = true;
      openAuthModal({
        message: "Sign in to view your orders",
        callbackUrl: "/orders",
      });
      router.replace("/");
    }
  }, [status, openAuthModal, router]);

  const { data: res, isLoading, isError } = useQuery({
    queryKey: ["customer", "orders", page, limit],
    queryFn: () =>
      fetchOrders({
        page,
        limit,
        order: "desc",
      }),
    enabled: status === "authenticated",
  });

  const orders = (res?.data ?? []) as ApiOrder[];
  const meta = res?.meta;
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach((o) => {
      (o.items ?? []).forEach((it) => {
        const id = getOrderItemProductId(it);
        if (id) ids.add(id);
      });
    });
    return Array.from(ids);
  }, [orders]);
  const productQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ["web", "product", id],
      queryFn: () => fetchProductById(id),
      enabled: !!id && status === "authenticated",
    })),
  });
  const reviewQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ["web", "product", id, "reviews"],
      queryFn: () => fetchProductReviews(id),
      enabled: !!id && status === "authenticated",
    })),
  });
  const productMap = useMemo(() => {
    const map = new Map<string, ApiProduct>();
    productQueries.forEach((q, i) => {
      const raw = q.data;
      const product = (raw as { data?: ApiProduct } | undefined)?.data;
      if (product?._id && productIds[i]) map.set(productIds[i], product);
    });
    return map;
  }, [productQueries, productIds]);

  const reviewQueriesSerialized = JSON.stringify(
    reviewQueries.map((q) => {
      const reviews = (q.data?.data ?? []) as any[];
      return reviews.map((r) => ({
        rating: Number(r.rating) || 0,
        cust: typeof r.customerId === "object" ? r.customerId?._id : r.customerId,
        userId: r.userId,
        orderId: r.orderId,
      }));
    })
  );

  const reviewRatingsByProduct = useMemo(() => {
    const userId = sessionData?.userId;
    if (!userId) return {} as Record<string, number>;

    const next: Record<string, number> = {};
    reviewQueries.forEach((query, index) => {
      const productId = productIds[index];
      if (!productId) return;

      const reviews = (query.data?.data ?? []) as Array<{
        rating?: number;
        customerId?: string | { _id?: string } | null;
        userId?: string;
        orderId?: string;
      }>;

      const userReviews = reviews.filter((review) => {
        if (typeof review.customerId === "string") return review.customerId === userId;
        if (review.customerId && typeof review.customerId === "object") return review.customerId._id === userId;
        if (typeof review.userId === "string") return review.userId === userId;
        return false;
      });

      userReviews.forEach((review) => {
        const oId = review.orderId;
        const ratingVal = Number(review.rating);
        if (oId && !isNaN(ratingVal)) {
          next[`${oId}_${productId}`] = ratingVal;
        }
      });
    });

    return next;
  }, [productIds, sessionData?.userId, reviewQueriesSerialized]);

  useEffect(() => {
    if (Object.keys(reviewRatingsByProduct).length === 0) return;
    setSelectedRatings((prev) => {
      let changed = false;
      for (const key of Object.keys(reviewRatingsByProduct)) {
        if (prev[key] !== reviewRatingsByProduct[key]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;
      return { ...prev, ...reviewRatingsByProduct };
    });
  }, [reviewRatingsByProduct]);

  const canPrev = page > 1;
  const canNext = page < (meta?.totalPages ?? 1);

  const totalCountLabel = useMemo(() => {
    const count = meta?.count ?? orders.length;
    return `${count} order${count === 1 ? "" : "s"}`;
  }, [meta?.count, orders.length]);

  const handleReviewSubmit = async (productId: string, rating: number, orderId: string, comment?: string) => {
    try {
      setSubmittingReviewProductId(productId);
      await submitReview({ productId, rating, orderId, comment });
      const ratingKey = `${orderId}_${productId}`;
      setSelectedRatings((prev) => ({ ...prev, [ratingKey]: rating }));
      await queryClient.invalidateQueries({ queryKey: ["web", "product", productId] });
      toast.success("Review submitted");
      setReviewDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit review";
      toast.error(message);
    } finally {
      setSubmittingReviewProductId(null);
    }
  };

  const renderOrderCard = (order: ApiOrder) => {
    const firstItem = order.items?.[0] as ApiOrderItem | undefined;
    const firstItemProduct = firstItem ? productMap.get(getOrderItemProductId(firstItem) ?? "") : undefined;
    const firstImage = firstItem ? getOrderItemImage(firstItem, firstItemProduct) : "https://picsum.photos/seed/gift/400/400";
    const firstTitle = firstItem ? getOrderItemTitle(firstItem) : "Order Item";
    const firstItemProductId = firstItem ? getOrderItemProductId(firstItem) : undefined;
    const firstVariantId =
      firstItem?.variantId && typeof firstItem.variantId === "object"
        ? firstItem.variantId._id
        : typeof firstItem?.variantId === "string"
          ? firstItem.variantId
          : undefined;
    const firstProductSlugOrId = firstItemProductId;
    const firstProductUrl = firstProductSlugOrId
      ? (firstVariantId
        ? `/products/${encodeURIComponent(firstProductSlugOrId)}?variantId=${firstVariantId}`
        : `/products/${encodeURIComponent(firstProductSlugOrId)}`)
      : null;
    const itemsCount = getOrderItemCount(order);
    const vendorName = getVendorName(order);
    const customerName = getCustomerName(order);
    const total = order.totalAmount ?? 0;
    const statusText = formatStatus(order.status);
    const paymentStatusText = formatStatus(order.paymentStatus);

    return (
      <Card key={order._id} className="hover:shadow-sm transition-shadow">
        <CardHeader className="p-3 sm:p-4 pb-2">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
              {firstProductUrl ? (
                <Link
                  href={firstProductUrl}
                  className="relative h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-md border ring-1 ring-transparent hover:ring-primary/40 transition-all"
                >
                  <Image
                    src={firstImage}
                    alt={firstTitle}
                    fill
                    className="object-cover"
                  />
                </Link>
              ) : (
                <div className="relative h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-md border">
                  <Image
                    src={firstImage}
                    alt={firstTitle}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm sm:text-base font-semibold">
                  {firstProductUrl ? (
                    <Link href={firstProductUrl} className="hover:underline">
                      {firstTitle}
                    </Link>
                  ) : (
                    firstTitle
                  )}
                </CardTitle>
                <div className="flex flex-wrap items-center mt-1 gap-1.5">
                  <Badge variant={getStatusVariant(order.status)} className="text-xs">
                    {statusText}
                  </Badge>
                  <Badge variant={order.paymentStatus === "pending" ? "secondary" : "outline"} className="text-xs">
                    Payment: {paymentStatusText}
                  </Badge>
                  {isB2bOrder(order) && (
                    <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                      B2B
                    </Badge>
                  )}
                  {order.createdAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="hidden sm:inline">{new Date(order.createdAt).toLocaleString("en-IN", { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="sm:hidden">{new Date(order.createdAt).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                </div>
                <Link
                  href={`/orders/${order._id}`}
                  className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-1 hover:text-foreground transition-colors block"
                >
                  {order.orderNumber ? `Order #${order.orderNumber}` : `Order #${order._id.slice(-6)}`}
                </Link>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold text-sm sm:text-base">₹{total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{itemsCount} item{itemsCount === 1 ? "" : "s"}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm mb-3">
            <div className="flex items-center space-x-2">
              <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground">Vendor</p>
                <p className="truncate">{vendorName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground">Customer</p>
                <p className="truncate">{customerName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-muted-foreground">Payment</p>
                <p className="capitalize">{order.paymentMethod ?? "—"} · {paymentStatusText}</p>
              </div>
            </div>
          </div>

          {!!order.items?.length && (
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Order Items ({order.items.length})</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                {order.items.map((item, idx) => {
                  const title = getOrderItemTitle(item);
                  const subtitle = getOrderItemSubtitle(item);
                  const quantity = item.quantity ?? 0;
                  const lineTotal = (item.price ?? 0) * quantity;
                  const itemProduct = productMap.get(getOrderItemProductId(item) ?? "");
                  const image = getOrderItemImage(item, itemProduct);
                  const productId = getOrderItemProductId(item);
                  const variantId = item.variantId && typeof item.variantId === "object" ? item.variantId._id : undefined;
                  const productUrl = variantId ? `/products/${encodeURIComponent(productId ?? "")}?variantId=${variantId}` : `/products/${encodeURIComponent(productId ?? "")}`;
                  const isDelivered = order.status === "DELIVERED";
                  const ratingKey = `${order._id}_${productId}`;
                  const selectedRating = selectedRatings[ratingKey] ?? 0;
                  const isReviewed = selectedRating > 0;

                  return (
                    <div
                      key={`${order._id}-item-${idx}`}
                      className="bg-muted/50 rounded-lg overflow-hidden border border-border hover:border-primary/50 hover:shadow-md transition-all p-2 block group"
                    >
                      <Link href={productUrl} className="block">
                        <div className="relative h-24 sm:h-28 mb-2 overflow-hidden rounded-md bg-muted">
                          <Image
                            src={image}
                            alt={title}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          {quantity > 1 && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground text-xs font-semibold px-1.5 py-0.5 rounded-full">
                              ×{quantity}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{title}</p>
                          {subtitle && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{subtitle}</p>
                          )}
                          <p className="text-xs sm:text-sm font-semibold text-primary">
                            ₹{lineTotal.toLocaleString()}
                          </p>
                        </div>
                      </Link>

                      {isDelivered && productId && (
                        <div className="mt-2 border-t border-border pt-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                              Rate this product
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((rating) => {
                              const filled = selectedRating >= rating;
                              const disabled = submittingReviewProductId === productId;
                              return (
                                <button
                                  key={`${productId}-${rating}`}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => {
                                    setActiveReviewProduct({
                                      productId: productId || "",
                                      productTitle: title,
                                      productImage: image,
                                      orderId: order._id,
                                    });
                                    setActiveRating(rating);
                                    setCommentText("");
                                    setReviewDialogOpen(true);
                                  }}
                                  className="rounded-sm p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Rate ${rating} star${rating === 1 ? "" : "s"}`}
                                >
                                  <Star className={`h-4 w-4 sm:h-5 sm:w-5 ${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                                </button>
                              );
                            })}
                          </div>
                          {isReviewed ? (
                            <div />
                          ) : (
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {submittingReviewProductId === productId ? "Submitting..." : "Tap a star to submit or update your rating"}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-3">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/orders/${order._id}`}>
                <Package className="h-4 w-4 mr-1.5" />
                View Details
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (status === "loading" || (status === "authenticated" && isLoading)) {
    return (
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  if (isError) {
    return (
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-8 text-center text-destructive">
        Error loading orders
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10">
        <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </Link>
        <div className="rounded-xl sm:rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
              <Package className="h-10 w-10 text-primary/60" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No orders found</h3>
            <p className="text-muted-foreground mb-8 text-center max-w-md">You haven&apos;t placed any orders yet.</p>
            <Button asChild className="rounded-full px-8">
              <Link href="/products">Shop Now</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-10">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">My Orders</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Sorted by latest ({totalCountLabel})</p>
          </div>
        </div>

        <div className="p-3 sm:p-6 space-y-6">
          <div className="space-y-4">
            {orders.map((order) => renderOrderCard(order))}
          </div>
        </div>

      {(meta?.totalPages ?? 1) > 1 && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex items-center justify-between border-t border-border pt-4">
          <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">Page {meta?.page ?? page} of {meta?.totalPages ?? 1}</p>
          <Button variant="outline" size="sm" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
      </div>
      {/* Review Dialog with comment field */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-background border border-border shadow-xl">
          {activeReviewProduct && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleReviewSubmit(
                  activeReviewProduct.productId,
                  activeRating,
                  activeReviewProduct.orderId,
                  commentText
                );
              }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Write a Product Review
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Share your experience with this item.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Product Detail */}
                <div className="bg-muted/40 p-3 rounded-xl border border-border flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded bg-muted shrink-0">
                    <Image
                      src={activeReviewProduct.productImage}
                      alt={activeReviewProduct.productTitle}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Reviewing product:</p>
                    <p className="text-xs font-semibold truncate text-foreground">{activeReviewProduct.productTitle}</p>
                  </div>
                </div>

                {/* Stars selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Rating *</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((val) => {
                      const active = hoverRating !== null ? hoverRating >= val : activeRating >= val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setActiveRating(val)}
                          onMouseEnter={() => setHoverRating(val)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-1 hover:scale-110 transition-transform focus:outline-none"
                        >
                          <Star
                            className={`h-7 w-7 ${active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"}`}
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs font-bold ml-2 text-muted-foreground">
                      {activeRating} Star{activeRating > 1 && "s"}
                    </span>
                  </div>
                </div>

                {/* Comment Textarea */}
                <div className="space-y-2">
                  <Label htmlFor="orders-review-comment" className="text-sm font-semibold">
                    Review Comment
                  </Label>
                  <Textarea
                    id="orders-review-comment"
                    placeholder="What did you like or dislike? Write your review here..."
                    rows={4}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="rounded-xl focus-visible:ring-primary/20 resize-none text-sm"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewDialogOpen(false)}
                  className="rounded-xl h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingReviewProductId === activeReviewProduct.productId}
                  className="bg-[#cc176b] hover:bg-[#cc176b]/95 text-white rounded-xl h-10 px-5 font-semibold"
                >
                  {submittingReviewProductId === activeReviewProduct.productId ? "Submitting..." : "Submit Review"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrdersPageFallback() {
  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
        <div className="h-24 bg-muted rounded-xl" />
      </div>
    </div>
  );
}

export default function OrderHistoryPage() {
  return (
    <Suspense fallback={<OrdersPageFallback />}>
      <OrderHistoryPageContent />
    </Suspense>
  );
}
