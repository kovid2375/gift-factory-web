"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, ChevronLeft, Store, User, FileText, Minus, Plus, ShoppingCart, Heart, Package, MessageSquare, MapPin, DollarSign, Share2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use, useState, useEffect, Fragment } from "react";
import { fetchProductById, fetchRelatedProducts, fetchProductReviews, addCartItem, mergeCartIntoCache, fetchProductRecommended, fetchCustomerRecommended, trackProductView, submitRfq, fetchSellerById, toggleWishlistItem, fetchWishlistIds, addGuestCartItem } from "@/lib/api";
import { ProductCarouselSection } from "@/components/sections";
import { RecentlyViewedProducts } from "@/components/sections/recently-viewed";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { addToGuestCart, saveGuestCartId } from "@/lib/guest-cart";
import type { ApiProduct, ApiProductVariant } from "@/types/api";
import {
  resolveSelectedVariant,
  PLACEHOLDER_IMAGE,
  normalizeProductReviews,
  parseAverageRating,
  getProductMoqMinimum,
  getProductReviewCount,
} from "@/types/api";
import { useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthModal } from "@/provider/auth-modal-provider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const productId = use(params).id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlVariantId = searchParams.get("variantId");
  const { data: session, status } = useSession();
  const { openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageAspect, setImageAspect] = useState<{ w: number; h: number } | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [quantityInput, setQuantityInput] = useState("1");
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, bgX: 0, bgY: 0 });
  const [rfqOpen, setRfqOpen] = useState(false);
  const [rfqSubmitting, setRfqSubmitting] = useState(false);
  const [rfqForm, setRfqForm] = useState({
    targetPrice: "",
    note: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "INDIA",
  });
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});

  const {
    data: productRes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["web", "product", productId],
    queryFn: () => fetchProductById(productId),
  });

  const product = productRes?.data as ApiProduct | undefined;
  const hasEmbeddedReviews = Array.isArray(product?.comments) && product.comments.length > 0;

  // Track product view for recommendations
  useEffect(() => {
    if (status === "authenticated" && product?._id) {
      const categoryId = typeof product.categoryId === "object" && product.categoryId !== null
        ? (product.categoryId as { _id: string })._id
        : (product.categoryId as string | undefined);
      trackProductView({
        productId: product._id,
        categoryId,
      });
    }
  }, [status, product?._id, product?.categoryId]);

  const { data: relatedRes } = useQuery({
    queryKey: ["web", "product", productId, "related"],
    queryFn: () => fetchRelatedProducts(productId),
    enabled: !!productId,
  });

  const { data: reviewsRes } = useQuery({
    queryKey: ["web", "product", productId, "reviews"],
    queryFn: () => fetchProductReviews(productId),
    enabled: !!productId && !hasEmbeddedReviews,
  });

  const { data: recommendedRes, isLoading: recommendedLoading } = useQuery({
    queryKey: status === "authenticated" ? ["customer", "recommended", session?.userId] : ["web", "products", "recommended"],
    queryFn: () =>
      status === "authenticated"
        ? fetchCustomerRecommended({ limit: 16, customerId: session?.userId })
        : fetchProductRecommended({ limit: 16 }),
    enabled: !!productId,
  });

  const merchantId = typeof product?.createdBy === "string" ? product.createdBy : undefined;
  const { data: sellerRes } = useQuery({
    queryKey: ["web", "seller", merchantId],
    queryFn: () => fetchSellerById(merchantId!),
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 10,
  });
  const seller = sellerRes?.data;
  const related = (relatedRes?.data ?? []) as ApiProduct[];
  const recData = recommendedRes?.data;
  const recommendedRaw = (recData?.products ?? []) as ApiProduct[];
  const recommendedReason = recData?.reason;
  const recommended = recommendedRaw.filter((p) => p._id !== productId);
  const reviews = useMemo(
    () => normalizeProductReviews(product, (reviewsRes?.data as unknown[] | undefined) ?? []),
    [product, reviewsRes?.data],
  );
  const reviewCount = reviews.length > 0 ? reviews.length : (product?.commentCount ?? 0);
  const avgRatingDisplay = useMemo(() => {
    if (reviews.length > 0) {
      return reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
    }
    if (product?.averageRating != null && String(product.averageRating).trim() !== "") {
      return parseAverageRating(product.averageRating);
    }
    return 0;
  }, [product?.averageRating, reviews]);

  const variants = product?.variantIds ?? [];
  // Allow pending + approved variants; only exclude deleted or rejected
  const activeVariants = useMemo(
    () => variants.filter((v) => !v.isDeleted && v.status !== "rejected"),
    [variants],
  );

  const derivedVariationGroups = useMemo(() => {
    if ((product?.variations?.length ?? 0) > 0) return product!.variations!;
    if (activeVariants.length === 0) return [];
    const labelMap = new Map<string, Set<string>>();
    for (const v of activeVariants) {
      for (const attr of v.explicitAttributes ?? []) {
        if (!labelMap.has(attr.label)) labelMap.set(attr.label, new Set());
        labelMap.get(attr.label)!.add(attr.value);
      }
    }
    if (labelMap.size === 0 && activeVariants.length > 0) {
      return [{ name: "Variant", options: activeVariants.map((v) => v.title ?? v._id) }];
    }
    return Array.from(labelMap.entries()).map(([label, values]) => ({
      name: label,
      options: Array.from(values),
    }));
  }, [product?.variations, activeVariants]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const hasVariantSelector = derivedVariationGroups.length > 0 || activeVariants.length > 0;

  const { addProduct: trackRecentlyViewed } = useRecentlyViewed();

  // Track product view for personalization (fire-and-forget, auth only)
  useEffect(() => {
    if (status === "authenticated" && product?._id) {
      const catId = typeof product.categoryId === "object" && product.categoryId !== null
        ? (product.categoryId as { _id?: string })?._id
        : (product.categoryId as string | undefined);
      trackProductView({ productId: product._id, categoryId: catId });
      // Invalidate recommendation cache so next visit picks up this view signal
      queryClient.invalidateQueries({ queryKey: ["customer", "recommended"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id, status]);

  // Track product for recently viewed feature (local storage)
  useEffect(() => {
    if (product?._id) {
      // Resolve best available thumbnail
      const thumbArr = product.baseImageUrl;
      const baseThumb = Array.isArray(thumbArr) && thumbArr.length > 0
        ? thumbArr[0]
        : typeof thumbArr === "string" && thumbArr
          ? thumbArr
          : null;
      const thumb = baseThumb || product.thumbnail || "https://picsum.photos/seed/gift/400/400";

      // Resolve best available price: variant → top-level price → defaultPrice
      const populatedVariants = (product.variantIds ?? []).filter(
        (v: any) => typeof v === "object" && v !== null && v._id && !v.isDeleted && v.status !== "rejected"
      );
      const firstVariant = populatedVariants[0] as any;
      const sellingPrice =
        firstVariant?.price?.sellingPrice != null ? Number(firstVariant.price.sellingPrice)
        : product.price?.sellingPrice != null ? Number(product.price.sellingPrice)
        : typeof product.defaultPrice === "number" ? product.defaultPrice
        : Number(product.defaultPrice) || 0;
      const mrpPrice =
        firstVariant?.price?.mrp != null ? Number(firstVariant.price.mrp)
        : product.price?.mrp != null ? Number(product.price.mrp)
        : undefined;

      trackRecentlyViewed({
        id: product._id,
        title: product.title,
        price: sellingPrice,
        mrp: mrpPrice,
        discountPercentage: mrpPrice && mrpPrice > sellingPrice
          ? Math.round((1 - sellingPrice / mrpPrice) * 100)
          : 0,
        thumbnail: thumb,
        rating: parseAverageRating(product.averageRating),
        reviewCount: getProductReviewCount(product),
        slug: product.slug,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id]);

  useEffect(() => {
    setImageAspect(null);
  }, [currentImageIndex]);

  useEffect(() => {
    setCurrentImageIndex(0);
    setImageAspect(null);
  }, [selectedVariantId]);

  useEffect(() => {
    if (activeVariants.length > 0 && !selectedVariantId) {
      // Pre-select the variant from the URL param when present, otherwise default to first
      const targetId = urlVariantId && activeVariants.some((v) => v._id === urlVariantId)
        ? urlVariantId
        : activeVariants[0]._id;
      setSelectedVariantId(targetId);
      const first = activeVariants.find((v) => v._id === targetId) ?? activeVariants[0];
      if (derivedVariationGroups.length > 0) {
        const next: Record<string, string> = {};
        for (const attr of first.explicitAttributes ?? []) {
          next[attr.label] = attr.value;
        }
        if (Object.keys(next).length === 0 && first.title) {
          next["Variant"] = first.title;
        }
        setSelectedVariations(next);
      }
    }
  }, [activeVariants.length, productId]);

  const findVariantByAttributes = useCallback(
    (selections: Record<string, string>): ApiProductVariant | null => {
      const vals = Object.values(selections).map((s) => s.toLowerCase().trim()).filter(Boolean);
      if (vals.length === 0) return null;
      for (const v of activeVariants) {
        const vAttrs = (v.explicitAttributes ?? []).map((a) => a.value.toLowerCase().trim());
        if (vals.every((val) => vAttrs.includes(val))) return v;
        if (vals.length === 1 && v.title?.toLowerCase().trim() === vals[0]) return v;
      }
      return resolveSelectedVariant(product, selections);
    },
    [activeVariants, product],
  );

  const selectedVariant = useMemo(() => {
    if (selectedVariantId) {
      const found = activeVariants.find((v) => v._id === selectedVariantId);
      if (found) return found;
    }
    return findVariantByAttributes(selectedVariations);
  }, [selectedVariantId, selectedVariations, activeVariants, findVariantByAttributes]);

  const handleVariationSelect = useCallback(
    (label: string, value: string) => {
      const next = { ...selectedVariations, [label]: value };
      setSelectedVariations(next);
      const matched = findVariantByAttributes(next);
      if (matched) setSelectedVariantId(matched._id);
    },
    [selectedVariations, findVariantByAttributes],
  );

  const handleVariantDirectSelect = useCallback(
    (variant: ApiProductVariant) => {
      setSelectedVariantId(variant._id);
      const next: Record<string, string> = {};
      for (const attr of variant.explicitAttributes ?? []) {
        next[attr.label] = attr.value;
      }
      if (Object.keys(next).length === 0 && variant.title) {
        next["Variant"] = variant.title;
      }
      setSelectedVariations(next);
    },
    [],
  );

  const retailMinQty = 1;
  const effectiveQuantity = Math.max(retailMinQty, quantity);
  const setEffectiveQuantity = (n: number) => setQuantity(Math.max(retailMinQty, Math.min(9999, n)));

  // Keep the text input in sync when quantity changes via buttons or preset chips
  useEffect(() => {
    setQuantityInput(String(effectiveQuantity));
  }, [effectiveQuantity]);

  const commitQuantityInput = () => {
    const v = parseInt(quantityInput, 10);
    if (!Number.isNaN(v)) {
      setEffectiveQuantity(v);
    } else {
      setQuantityInput(String(effectiveQuantity));
    }
  };

  // Must be before early returns to keep hook order stable
  useEffect(() => {
    if (status !== "authenticated" || !product?._id || !session?.userId) return;
    fetchWishlistIds(session.userId).then((res) => {
      const ids = res.data ?? [];
      const matches = ids.some((item: any) => {
        if (typeof item === "string") {
          return item === product._id || (selectedVariant?._id && item === selectedVariant._id);
        } else if (item && typeof item === "object") {
          return item.productId === product._id && (!selectedVariant?._id || item.variantId === selectedVariant._id);
        }
        return false;
      });
      setInWishlist(matches);
    }).catch(() => {});
  }, [status, product?._id, session?.userId, selectedVariant?._id]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 bg-gray-200 rounded mx-auto" />
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            <div className="h-80 sm:h-96 bg-gray-200 rounded" />
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="container mx-auto py-8 text-center text-red-500">
        Error loading product: {(error as Error)?.message ?? "Not found"}
        <div className="mt-4">
          <Link href="/products">
            <Button variant="outline">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back to Products
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const price = selectedVariant
    ? Number(selectedVariant.price?.sellingPrice ?? 0)
    : (product.price?.sellingPrice != null
      ? Number(product.price.sellingPrice)
      : (typeof product.defaultPrice === "number" ? product.defaultPrice : Number(product.defaultPrice) || 0));
  const mrp = selectedVariant
    ? (selectedVariant.price?.mrp != null ? Number(selectedVariant.price.mrp) : undefined)
    : (product.price?.mrp != null
      ? Number(product.price.mrp)
      : (product.mrp != null ? Number(product.mrp) : undefined));
  const showMrpDetail = mrp != null && mrp > price;
  const discountPercentageDetail = showMrpDetail && mrp && mrp > 0 ? Math.round((1 - price / mrp) * 100) : 0;
  const b2bPrice = product.b2bPrice != null ? Number(product.b2bPrice) : undefined;
  const moq = getProductMoqMinimum(product.moq);
  const rfqAvailable = product.rfqAvailable !== false;
  const priceTiers =
    selectedVariant?.b2bPriceTiers?.length
      ? selectedVariant.b2bPriceTiers
      : (product.b2bPriceTiers ?? []);
  const hasTiers = priceTiers.length > 0;

  const variantImages = selectedVariant?.images?.length ? selectedVariant.images : null;
  const baseImages = product.baseImageUrl?.length ? product.baseImageUrl : null;
  const images = variantImages ?? baseImages ?? ["PLACEHOLDER_IMAGE"];

  const productSku = product.sku;
  const variantStock =
    selectedVariant?.stock ?? (activeVariants.length === 0 ? product.stock : undefined);
  const variantReserved = selectedVariant?.reservedStock ?? 0;
  const availableStock = variantStock != null ? Math.max(0, variantStock - variantReserved) : null;
  const variantSku = selectedVariant?.sku;

  const category = typeof product.categoryId === "object" && product.categoryId && "name" in product.categoryId ? product.categoryId.name : "";
  const brand = typeof product.brandId === "object" && product.brandId && "name" in product.brandId ? product.brandId.name : "";

  /** Unit price for the given quantity (uses variant or product tiers).
   * - If qty falls within a tier range → that tier's price.
   * - If qty exceeds all tier maxQty's → the last (cheapest) tier's price.
   * - If qty is below all tier minimums → regular price.
   */
  const getUnitPriceForQuantity = (qty: number): number => {
    if (hasTiers && priceTiers.length > 0) {
      const sorted = [...priceTiers].sort((a, b) => (b.minQty ?? 0) - (a.minQty ?? 0));
      // Exact range match first
      const exact = sorted.find((t) => qty >= (t.minQty ?? 0) && (t.maxQty == null || qty <= t.maxQty));
      if (exact) return Number(exact.price);
      // Quantity exceeds all tier ceilings → use the tier with the highest minQty (best/lowest price)
      const overflow = sorted.find((t) => qty >= (t.minQty ?? 0));
      if (overflow) return Number(overflow.price);
    }
    return price;
  };
  const unitPriceForQuantity = getUnitPriceForQuantity(effectiveQuantity);
  const totalForQuantity = unitPriceForQuantity * effectiveQuantity;

  const handleRfqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (status !== "authenticated") {
      toast.error("Please sign in to request a quote");
      openAuthModal({
        message: "Sign in to request a quote",
        callbackUrl:
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : undefined,
      });
      return;
    }

    // Variant required only when the product has active variants
    if (activeVariants.length > 0 && !selectedVariant?._id) {
      toast.error("Please select a product variant before requesting a quote");
      return;
    }

    if (!rfqForm.addressLine1.trim() || !rfqForm.city.trim() || !rfqForm.state.trim() || !rfqForm.zipCode.trim()) {
      toast.error("Please fill in the required shipping address fields");
      return;
    }

    setRfqSubmitting(true);
    try {
      await submitRfq({
        items: [
          {
            productId: product._id,
            ...(selectedVariant?._id ? { variantId: selectedVariant._id } : {}),
            quantity: effectiveQuantity,
            targetPrice: rfqForm.targetPrice ? Number(rfqForm.targetPrice) : undefined,
          },
        ],
        shippingAddress: {
          addressLine1: rfqForm.addressLine1.trim(),
          addressLine2: rfqForm.addressLine2.trim() || undefined,
          city: rfqForm.city.trim(),
          state: rfqForm.state.trim(),
          zipCode: rfqForm.zipCode.trim(),
          country: (rfqForm.country.trim() || "INDIA").toUpperCase(),
        },
        note: rfqForm.note.trim() || undefined,
      });
      toast.success("Quote request submitted. The seller will contact you soon.");
      setRfqOpen(false);
      setRfqForm({ targetPrice: "", note: "", addressLine1: "", addressLine2: "", city: "", state: "", zipCode: "", country: "INDIA" });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to submit quote request. Please try again.";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setRfqSubmitting(false);
    }
  };

  const handleAddToCart = async () => {
    if (status !== "authenticated") {
      const thumb = Array.isArray(images) && images.length > 0 ? images[0] : "PLACEHOLDER_IMAGE";
      addToGuestCart({
        productId: product._id,
        variantId: selectedVariant?._id,
        quantity: effectiveQuantity,
        priceAtAddition: unitPriceForQuantity,
        title: product.title,
        thumbnail: thumb,
      });
      // Call backend guest cart API in background to sync
      addGuestCartItem({
        item: {
          productId: product._id,
          variantId: selectedVariant?._id,
          quantity: effectiveQuantity,
        },
      }).then((res) => {
        const cartId = (res as any)?.data?._id ?? (res as any)?._id ?? (res as any)?.data?.id ?? (res as any)?.id;
        if (cartId) saveGuestCartId(cartId);
      }).catch((err) => {
        console.error("Failed to sync guest cart item add to backend:", err);
      });
      toast.success("Added to cart. Sign in to sync and checkout.");
      return;
    }

    // If product has variants but all are rejected/deleted, block the action
    if (variants.length > 0 && activeVariants.length === 0) {
      toast.error("This product is currently unavailable");
      return;
    }
    if (activeVariants.length > 0 && !selectedVariant) {
      toast.error("Please select a variant");
      return;
    }
    if (availableStock != null && availableStock < effectiveQuantity) {
      toast.error(availableStock === 0 ? "This variant is out of stock" : `Only ${availableStock} units available`);
      return;
    }
    setAddingToCart(true);
    try {
      let res;
      if (selectedVariant?._id) {
        res = await addCartItem({
          item: {
            productId: product._id,
            variantId: selectedVariant._id,
            quantity: effectiveQuantity,
          },
        });
      } else {
        res = await addCartItem({
          item: {
            productId: product._id,
            quantity: effectiveQuantity,
          },
        });
      }
      mergeCartIntoCache(queryClient, res);
      toast.success(`Added ${effectiveQuantity} to cart`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to add to cart";
      toast.error(msg);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (status !== "authenticated") {
      openAuthModal({
        message: "Sign in to buy now",
        onSuccess: () => handleBuyNow(),
      });
      return;
    }

    // If product has variants but all are rejected/deleted, block the action
    if (variants.length > 0 && activeVariants.length === 0) {
      toast.error("This product is currently unavailable");
      return;
    }
    if (activeVariants.length > 0 && !selectedVariant) {
      toast.error("Please select a variant");
      return;
    }
    if (availableStock != null && availableStock < effectiveQuantity) {
      toast.error(availableStock === 0 ? "This variant is out of stock" : `Only ${availableStock} units available`);
      return;
    }
    setBuyingNow(true);
    try {
      // First, add the product to the cart
      let res;
      if (selectedVariant?._id) {
        res = await addCartItem({
          item: {
            productId: product._id,
            variantId: selectedVariant._id,
            quantity: effectiveQuantity,
          },
        });
      } else {
        res = await addCartItem({
          item: {
            productId: product._id,
            quantity: effectiveQuantity,
          },
        });
      }
      mergeCartIntoCache(queryClient, res);

      // Then redirect to checkout
      router.push(`/checkout`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to buy now";
      toast.error(msg);
    } finally {
      setBuyingNow(false);
    }
  };

  const handleWishlist = async () => {
    if (status !== "authenticated") {
      openAuthModal({
        message: "Sign in to save to wishlist",
        onSuccess: () => handleWishlist(),
      });
      return;
    }
    if (!product) return;
    setWishlistLoading(true);
    try {
      await toggleWishlistItem({
        productId: product._id,
        variantId: selectedVariant?._id || undefined,
      });
      const nextInWishlist = !inWishlist;
      setInWishlist(nextInWishlist);
      queryClient.invalidateQueries({ queryKey: ["customer", "wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "wishlist", "ids"] });
      if (nextInWishlist) {
        toast.success("Saved to wishlist");
      } else {
        toast.success("Removed from wishlist");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to update wishlist";
      toast.error(msg);
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleShare = async () => {
    const slug = product._id;
    const variantParam = selectedVariant?._id ? `?variantId=${selectedVariant._id}` : "";
    const siteUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
    const url = `${siteUrl}/products/${encodeURIComponent(slug)}${variantParam}`;
    const shareData = {
      title: product.title,
      text: product.sub_title ?? product.description?.slice(0, 100) ?? product.title,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-3 sm:px-4">
      <div className="mb-4">
        <Link href="/products">
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-1.5 h-4 w-4" /> Back to Products
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-start">
        {/* Left: main image + thumbnail strip */}
        <div className="flex flex-col gap-3">
          {/* Main image */}
          <div
            className="relative w-full bg-muted rounded-lg overflow-visible group"
            style={{
              aspectRatio: imageAspect ? `${imageAspect.w} / ${imageAspect.h}` : "1",
            }}
          >
            <div
              className="absolute inset-0 z-10 cursor-crosshair"
              onMouseEnter={() => window.innerWidth >= 768 && setIsZoomed(true)}
              onMouseLeave={() => setIsZoomed(false)}
              onMouseMove={(e) => {
                if (window.innerWidth < 768) return;
                const { left, top, width, height } = e.currentTarget.getBoundingClientRect();

                let x = ((e.clientX - left) / width) * 100;
                let y = ((e.clientY - top) / height) * 100;

                // Lens is 40% width, so half is 20%. Boundaries are 20% to 80%
                x = Math.max(20, Math.min(x, 80));
                y = Math.max(20, Math.min(y, 80));

                const bgX = ((x - 20) / 60) * 100;
                const bgY = ((y - 20) / 60) * 100;

                setMousePos({ x, y, bgX, bgY });
              }}
            />
            <Image
              src={images[currentImageIndex] || "PLACEHOLDER_IMAGE"}
              alt={product.title}
              fill
              className="object-contain"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              onLoad={(e) => {
                const target = e.target as HTMLImageElement;
                if (target?.naturalWidth && target?.naturalHeight)
                  setImageAspect({ w: target.naturalWidth, h: target.naturalHeight });
              }}
            />

            {/* Zoom Lens */}
            {isZoomed && (
              <div
                className="absolute pointer-events-none bg-blue-500/20 border border-blue-500/50 hidden md:block z-20"
                style={{
                  left: `${mousePos.x}%`,
                  top: `${mousePos.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '40%',
                  height: '40%',
                }}
              />
            )}

            {/* Adjacent Zoom pane */}
            {isZoomed && (
              <div
                className="absolute top-0 left-[105%] w-full h-[120%] z-[100] bg-white border shadow-2xl overflow-hidden pointer-events-none hidden md:block rounded-lg"
                style={{
                  backgroundImage: `url(${images[currentImageIndex] || "PLACEHOLDER_IMAGE"})`,
                  backgroundPosition: `${mousePos.bgX}% ${mousePos.bgY}%`,
                  backgroundSize: "250%",
                  backgroundRepeat: "no-repeat",
                }}
              />
            )}
          </div>
          {/* Thumbnail row — horizontal scroll on mobile, wrapping on desktop */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto md:flex-wrap pb-1 scrollbar-hide">
              {images.map((img, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentImageIndex(index)}
                  className={`relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${currentImageIndex === index
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                    }`}
                >
                  <Image
                    src={img || "PLACEHOLDER_IMAGE"}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: product info (reference order) */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight flex-1">{product.title}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-foreground mt-1"
              onClick={handleShare}
              aria-label="Share product"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
          {product.sub_title && (
            <p className="text-muted-foreground text-sm">{product.sub_title}</p>
          )}

          {/* Minimal seller row */}
          {(seller?.name || merchantId) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded overflow-hidden bg-primary/10">
                {seller?.logo ? (
                  <Image
                    src={seller.logo}
                    alt={seller.name ?? "Seller"}
                    width={20}
                    height={20}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Store className="h-3 w-3 text-primary" />
                )}
              </div>
              {merchantId ? (
                <Link href={`/sellers/${merchantId}`} className="hover:text-foreground hover:underline underline-offset-2 transition-colors">
                  {seller?.name ?? "Seller"}
                </Link>
              ) : (
                <span>Gift Factory</span>
              )}
              {seller?.productCount != null && (
                <span className="text-muted-foreground/60">· {seller.productCount} products</span>
              )}
            </div>
          )}

          {/* Rating + orders row */}
          <div className="flex items-center gap-4 flex-wrap">
            {reviewCount > 0 ? (
              <>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const filled = i <= Math.round(avgRatingDisplay);
                    return (
                      <Star
                        key={i}
                        className={
                          filled ? "h-5 w-5 fill-amber-400 text-amber-400" : "h-5 w-5 text-muted"
                        }
                      />
                    );
                  })}
                </div>
                <span className="text-sm text-muted-foreground">
                  {avgRatingDisplay > 0 ? avgRatingDisplay.toFixed(1) : "—"}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ShoppingCart className="h-4 w-4" />
                  {reviewCount} review{reviewCount !== 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Be the first to review</span>
            )}
          </div>

          {/* Key specs row (reference: Made in, Design, Delivery) */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {brand && (
              <span>
                <span className="font-medium text-muted-foreground">Brand: </span>
                <span className="text-foreground">{brand}</span>
              </span>
            )}
            {category && (
              <span>
                <span className="font-medium text-muted-foreground">Category: </span>
                <span className="text-foreground capitalize">{category}</span>
              </span>
            )}
            <span>
              <span className="font-medium text-muted-foreground">Delivery: </span>
              <span className="text-foreground">Standard delivery</span>
            </span>
            {moq != null && moq > 0 && (
              <span>
                <span className="font-medium text-muted-foreground">MOQ: </span>
                <span className="text-foreground">{moq} units</span>
              </span>
            )}
          </div>

          {/* Variant selector */}
          {hasVariantSelector && derivedVariationGroups.length > 0 && (
            <div className="space-y-3">
              {derivedVariationGroups.map((v, i) => (
                <div key={`${v.name}-${i}`}>
                  <p className="text-sm font-medium text-foreground mb-2 capitalize">
                    {v.name.toLowerCase()}
                    {selectedVariations[v.name] && (
                      <span className="ml-2 text-muted-foreground font-normal">: {selectedVariations[v.name]}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {v.options.map((opt, optIndex) => {
                      const value = typeof opt === "string" ? opt : opt.value;
                      const isSelected = selectedVariations[v.name] === value;
                      return (
                        <button
                          key={`${value}-${optIndex}`}
                          type="button"
                          onClick={() => handleVariationSelect(v.name, value)}
                          className={`rounded-md border-2 px-4 py-2 text-sm font-medium transition-colors ${isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fallback: when no grouped attributes, show variant cards directly */}
          {hasVariantSelector && derivedVariationGroups.length === 0 && activeVariants.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground mb-2">Select variant</p>
              <div className="flex flex-wrap gap-2">
                {activeVariants.map((v) => {
                  const isSelected = selectedVariantId === v._id;
                  return (
                    <button
                      key={v._id}
                      type="button"
                      onClick={() => handleVariantDirectSelect(v)}
                      className={`rounded-md border-2 px-4 py-2 text-sm font-medium transition-colors ${isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                    >
                      {v.title ?? v.sku ?? v._id.slice(-6)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock & SKU — variant row or base product when there are no variants */}
          {(selectedVariant || activeVariants.length === 0) && (availableStock != null || variantSku || productSku) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {availableStock != null && (
                <span>
                  <span className="font-medium text-muted-foreground">Stock: </span>
                  <span className={availableStock > 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                    {availableStock > 0 ? `${availableStock} available` : "Out of stock"}
                  </span>
                </span>
              )}
              {(variantSku || productSku) && (
                <span>
                  <span className="font-medium text-muted-foreground">SKU: </span>
                  <span className="text-foreground">{variantSku || productSku}</span>
                </span>
              )}
            </div>
          )}

          {/* Price – styled card */}
          {availableStock !== 0 && (
            <div className="mt-3">
              <div className="rounded-lg bg-white border border-border p-4 shadow-sm w-full sm:inline-block">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold">₹{unitPriceForQuantity.toLocaleString("en-IN")}</span>
                  <span className="text-sm text-muted-foreground">price per unit</span>
                </div>
                <div className="mt-2">
                  {showMrpDetail && mrp != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground line-through">₹{mrp.toLocaleString("en-IN")}</span>
                      {discountPercentageDetail > 0 && <span className="text-sm font-semibold text-destructive">-{discountPercentageDetail}% off</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quantity selector + dynamic discount summary */}
          {availableStock !== 0 && <div className="mt-3 p-3 border rounded flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium shrink-0">Quantity</span>
              <div className="inline-flex items-center border rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEffectiveQuantity(effectiveQuantity - 1)}
                  disabled={effectiveQuantity <= retailMinQty}
                  className="px-3 py-1 bg-transparent disabled:opacity-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  aria-label="Quantity"
                  className="w-12 text-center px-1 py-1 outline-none text-sm"
                  type="number"
                  min={retailMinQty}
                  max={9999}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  onBlur={commitQuantityInput}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                />
                <button
                  type="button"
                  onClick={() => setEffectiveQuantity(effectiveQuantity + 1)}
                  className="px-3 py-1 bg-transparent"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-1">
                {[1, 5, 10, 20].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setEffectiveQuantity(q)}
                    className="text-xs px-2 py-0.5 rounded border border-border bg-background text-muted-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="text-sm text-muted-foreground">Unit: ₹{unitPriceForQuantity.toLocaleString("en-IN")}</div>
              <div className="font-semibold">Total: ₹{totalForQuantity.toLocaleString("en-IN")}</div>
              {mrp != null && unitPriceForQuantity < mrp && (
                <div className="text-xs text-green-600">Save {Math.round((1 - unitPriceForQuantity / mrp) * 100)}%</div>
              )}
            </div>
          </div>}

          {/* CTA row: Add to cart (primary), Buy now (dark), Wishlist */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-3">
            <Button
              size="lg"
              className="gap-2 w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white"
              onClick={handleAddToCart}
              disabled={addingToCart || availableStock === 0}
            >
              <ShoppingCart className="h-4 w-4" />
              {availableStock === 0 ? "Out of stock" : addingToCart ? "Adding…" : "Add to cart"}
            </Button>
            <Button
              size="lg"
              className="gap-2 w-full sm:w-auto bg-pink-600 hover:bg-pink-700 text-white"
              onClick={handleBuyNow}
              disabled={addingToCart || availableStock === 0}
            >
              Buy now
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 self-start sm:self-auto"
              aria-label={inWishlist ? "Saved to wishlist" : "Save to wishlist"}
              disabled={wishlistLoading}
              onClick={handleWishlist}
            >
              <Heart className={`h-4 w-4 transition-colors ${inWishlist ? "fill-pink-500 text-pink-500" : ""}`} />
            </Button>
          </div>

          {/* Customer rating summary (reference: X out of 5, bar chart) */}
          {reviewCount > 0 && (
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold">
                  {avgRatingDisplay.toFixed(1)}
                </span>
                <span className="text-muted-foreground">out of 5</span>
              </div>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i <= Math.round(avgRatingDisplay) ? "fill-amber-400 text-amber-400" : "text-muted"}`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground mb-3">{reviewCount} global ratings</p>
              {reviews.length > 0 && (
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = reviews.filter((r) => Math.round(r.rating) === stars).length;
                  const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2 text-sm">
                      <span className="w-8">{stars} star</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground w-8">{count}</span>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* Retail / B2B tabs – buying options */}
          <Tabs defaultValue="retail" className="mb-6">
            <TabsList className="grid w-full max-w-[240px] grid-cols-2">
              <TabsTrigger value="retail" className="gap-1.5">
                <User className="h-4 w-4" />
                Retail
              </TabsTrigger>
              <TabsTrigger value="b2b" className="gap-1.5">
                <Store className="h-4 w-4" />
                B2B
              </TabsTrigger>
            </TabsList>
            <TabsContent value="retail" className="mt-3 space-y-2">
              {selectedVariant && (
                <p className="text-xs text-muted-foreground">
                  Price for: {selectedVariant.title ?? (Object.values(selectedVariations).filter(Boolean).join(", ") || "selected option")}
                </p>
              )}
              {hasTiers && effectiveQuantity >= 1 && (
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">₹{totalForQuantity.toLocaleString("en-IN")}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Buy single or multiple units. Add to cart or buy now above.
              </p>
            </TabsContent>
            <TabsContent value="b2b" className="mt-3 space-y-4">
              {hasTiers ? (
                <>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <h3 className="text-sm font-semibold text-foreground py-2 px-3 bg-muted/50 border-b border-border">
                      Quantity-based pricing
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="text-left font-medium py-2.5 px-3">Quantity</th>
                          <th className="text-right font-medium py-2.5 px-3">Unit price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceTiers.map((tier, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="py-2.5 px-3 text-foreground">
                              {tier.maxQty != null
                                ? `${tier.minQty} – ${tier.maxQty} pieces`
                                : `≥ ${tier.minQty.toLocaleString()} pieces`}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold">
                              ₹{Number(tier.price).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm text-muted-foreground mb-1">
                      Your selection: <span className="font-semibold text-foreground">{effectiveQuantity} units</span>
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      ₹{unitPriceForQuantity.toLocaleString("en-IN")} <span className="text-sm font-normal text-muted-foreground">per unit</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Total: <span className="font-semibold text-foreground">₹{totalForQuantity.toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  {b2bPrice != null && b2bPrice > 0 ? (
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold">₹{b2bPrice.toLocaleString("en-IN")}</span>
                      <span className="text-sm text-muted-foreground">per unit (B2B)</span>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">B2B pricing available on request.</p>
                  )}
                  {moq != null && moq > 0 && (
                    <p className="text-sm mt-1">
                      <span className="font-medium text-muted-foreground">Minimum order:</span>{" "}
                      <span className="font-semibold">{moq} units</span>
                    </p>
                  )}
                </div>
              )}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1">Shipping</h3>
                <p className="text-sm text-muted-foreground">
                  Shipping fee and delivery date to be negotiated. Use Request for Quote for bulk orders.
                </p>
              </div>
              {rfqAvailable && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    if (status !== "authenticated") {
                      openAuthModal({
                        message: "Sign in to request a quote",
                        onSuccess: () => setRfqOpen(true),
                      });
                    } else {
                      setRfqOpen(true);
                    }
                  }}
                >
                  <FileText className="h-4 w-4" />
                  Request for Quote (RFQ)
                </Button>
              )}
            </TabsContent>
          </Tabs>

          {/* RFQ CTA removed from retail area — RFQ is available only inside the B2B tab */}

          {/* Request for Quote – modal */}
          <Dialog open={rfqOpen} onOpenChange={setRfqOpen}>
            <DialogContent className="sm:max-w-lg rounded-2xl border-2 border-border shadow-xl bg-background p-0 gap-0 overflow-hidden">
              {/* Header with accent */}
              <div className="bg-muted border-b border-border px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
                      Request for Quote
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                      We&apos;ll get back with a custom quote
                    </DialogDescription>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-foreground bg-background rounded-lg px-3 py-2 border border-border">
                  For: {product.title}
                </p>
              </div>

              <form onSubmit={handleRfqSubmit} className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
                {/* Quote details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Quote details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm font-medium">
                        Quantity
                      </Label>
                      <div className="h-11 rounded-lg border border-border/80 bg-muted/50 px-3 flex items-center text-sm font-medium text-foreground">
                        {effectiveQuantity} {effectiveQuantity === 1 ? "unit" : "units"}
                        {moq && effectiveQuantity < moq && (
                          <span className="ml-2 text-xs text-amber-600">(min {moq})</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Adjust on the product page before opening this form.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rfq-target-price" className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" />
                        Target price per unit <span className="font-normal text-muted-foreground/80">(optional)</span>
                      </Label>
                      <Input
                        id="rfq-target-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={rfqForm.targetPrice}
                        onChange={(e) => setRfqForm((f) => ({ ...f, targetPrice: e.target.value }))}
                        placeholder="e.g. 250"
                        className="h-11 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30 transition-shadow"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfq-note" className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Note <span className="font-normal text-muted-foreground/80">(optional)</span>
                    </Label>
                    <Textarea
                      id="rfq-note"
                      value={rfqForm.note}
                      onChange={(e) => setRfqForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder="Delivery timeline, customisation, bulk discount expectations…"
                      rows={3}
                      className="rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30 transition-shadow resize-none"
                    />
                  </div>
                </div>

                {/* Shipping address */}
                <div className="space-y-4 pt-2 border-t border-border/60">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Shipping address
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="rfq-addr1" className="text-muted-foreground text-sm font-medium">
                      Address line 1 *
                    </Label>
                    <Input
                      id="rfq-addr1"
                      value={rfqForm.addressLine1}
                      onChange={(e) => setRfqForm((f) => ({ ...f, addressLine1: e.target.value }))}
                      placeholder="House / flat, street name"
                      required
                      className="h-11 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30 transition-shadow"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfq-addr2" className="text-muted-foreground text-sm font-medium">
                      Address line 2 <span className="font-normal text-muted-foreground/80">(optional)</span>
                    </Label>
                    <Input
                      id="rfq-addr2"
                      value={rfqForm.addressLine2}
                      onChange={(e) => setRfqForm((f) => ({ ...f, addressLine2: e.target.value }))}
                      placeholder="Area, landmark"
                      className="h-11 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30 transition-shadow"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rfq-city" className="text-muted-foreground text-sm font-medium">
                        City *
                      </Label>
                      <Input
                        id="rfq-city"
                        value={rfqForm.city}
                        onChange={(e) => setRfqForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="City"
                        required
                        className="h-11 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30 transition-shadow"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rfq-state" className="text-muted-foreground text-sm font-medium">
                        State *
                      </Label>
                      <Input
                        id="rfq-state"
                        value={rfqForm.state}
                        onChange={(e) => setRfqForm((f) => ({ ...f, state: e.target.value }))}
                        placeholder="State / province"
                        required
                        className="h-11 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30 transition-shadow"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rfq-zip" className="text-muted-foreground text-sm font-medium">
                        ZIP / Postal code *
                      </Label>
                      <Input
                        id="rfq-zip"
                        value={rfqForm.zipCode}
                        onChange={(e) => setRfqForm((f) => ({ ...f, zipCode: e.target.value }))}
                        placeholder="e.g. 400001"
                        required
                        className="h-11 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30 transition-shadow"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rfq-country" className="text-muted-foreground text-sm font-medium">
                        Country
                      </Label>
                      <Input
                        id="rfq-country"
                        value={rfqForm.country}
                        onChange={(e) => setRfqForm((f) => ({ ...f, country: e.target.value }))}
                        placeholder="India"
                        className="h-11 rounded-lg border-border/80 focus-visible:ring-2 focus-visible:ring-primary/30 transition-shadow"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRfqOpen(false)}
                    className="rounded-lg h-11 px-5"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={rfqSubmitting}
                    className="rounded-lg h-11 px-6 gap-2 bg-primary hover:bg-primary/90"
                  >
                    <FileText className="h-4 w-4" />
                    {rfqSubmitting ? "Sending…" : "Submit request"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      {/* Product details: Description | Reviews tabs */}
      <section className="mt-12 border-t pt-8" aria-label="Product details">
        <h2 className="text-lg font-semibold text-foreground mb-4">Product details</h2>
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="w-full max-w-md border-b border-border rounded-none bg-transparent p-0 h-auto gap-0">
            <TabsTrigger
              value="description"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent px-4 py-2"
            >
              Description
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none bg-transparent px-4 py-2"
            >
              Reviews ({reviewCount})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="mt-6">
            {product.description && (
              <p className="text-muted-foreground leading-relaxed mb-6">{product.description}</p>
            )}

            {/* Features bullet list — variant features take precedence over product-level features */}
            {(() => {
              const displayFeatures = selectedVariant?.features?.length
                ? selectedVariant.features
                : (product.features?.length ? product.features : []);
              return displayFeatures.length > 0 ? (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Features</h3>
                  <ul className="space-y-1.5">
                    {displayFeatures.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {brand && (
                <>
                  <dt className="font-medium text-muted-foreground">Brand</dt>
                  <dd className="text-foreground">{brand}</dd>
                </>
              )}
              {category && (
                <>
                  <dt className="font-medium text-muted-foreground">Category</dt>
                  <dd className="text-foreground capitalize">{category}</dd>
                </>
              )}
              {(variantSku || productSku || product.slug) && (
                <>
                  <dt className="font-medium text-muted-foreground">SKU</dt>
                  <dd className="text-foreground">{variantSku || productSku || product.slug}</dd>
                </>
              )}
              {/* HSN code — variant first, fallback to product */}
              {(selectedVariant?.hsnCode ?? product.hsnCode) != null && (
                <>
                  <dt className="font-medium text-muted-foreground">HSN Code</dt>
                  <dd className="text-foreground">{selectedVariant?.hsnCode ?? product.hsnCode}</dd>
                </>
              )}
              {(selectedVariant?.explicitAttributes ?? product.explicitAttributes)?.map((attr, i) => (
                <Fragment key={i}>
                  <dt className="font-medium text-muted-foreground">{attr.label}</dt>
                  <dd className="text-foreground">{attr.value}</dd>
                </Fragment>
              ))}
            </dl>
            {!product.description && !brand && !category && !variantSku && !product.slug && ((selectedVariant?.explicitAttributes ?? product.explicitAttributes)?.length ?? 0) === 0 && (
              <p className="text-muted-foreground">No description available.</p>
            )}
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            {reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((review, index) => (
                  <div key={review._id ?? index} className="border-b border-border pb-4 last:border-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-foreground">{review.authorName}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted"
                                }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.createdAt && (
                        <span className="text-sm text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {review.comment && <p className="text-muted-foreground">{review.comment}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No reviews yet.</p>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {related.length > 0 && (
        <div className="mt-12 border-t pt-8 -mx-4 px-0">
          <ProductCarouselSection
            title="Products related to this item"
            products={related}
            viewAllHref="/products"
          />
        </div>
      )}

      <div className="mt-12 border-t pt-8 -mx-4 px-0">
        <ProductCarouselSection
          title="Recommended for you"
          products={recommended}
          isLoading={recommendedLoading}
          viewAllHref="/products"
          expandVariants
          reason={recommendedReason}
        />
      </div>

      <div className="-mx-4 px-0">
        <RecentlyViewedProducts />
      </div>
    </div>
  );
}
