"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MapPin, Plus, Save, Mail, Truck, CreditCard, Smartphone, Wallet, Globe, Banknote, Phone } from "lucide-react";
import { createOrder, createOrderFromCart, fetchAddresses, addAddress, fetchProductById, deleteCart, fetchProfile, sendPhoneOtp, verifyPhoneOtp, updateProfile, validateCoupon, fetchOrders, fetchCheckoutPreview } from "@/lib/api";
import type { PaymentMethod, ApiCoupon, CreateOrderBody, CreateOrderFromCartBody } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/payments";
import type { ApiAddress, ApiCart, ApiCartItem, ApiProduct } from "@/types/api";
import { apiAddressPostalCode, apiAddressStreet } from "@/types/api";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PincodeLookupInput } from "@/components/form/pincode-lookup-input";

const formSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email"),
  phone: z.string().optional().refine(
    (v) => !v || /^\+?[\d\s\-]{7,15}$/.test(v.trim()),
    "Enter a valid mobile number"
  ),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  addressLine1: z.string().min(5, "Address line 1 is required (at least 5 characters)"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  country: z.string().min(2, "Country is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(2, "ZIP / Postal code is required"),
  paymentMethod: z.enum(["wallet", "card", "upi", "cod", "online"]),
  discountCode: z.string().optional(),
  giftMessage: z.string().optional(),
  fulfillmentPreference: z.enum(["SINGLE_ONLY", "ALLOW_SPLIT", "EMERGENCY_PARTIAL"]),
});

type CheckoutFormValues = z.infer<typeof formSchema>;

function getProductId(item: ApiCartItem): string {
  const p = item.productId;
  if (typeof p === "string") return p;
  return (p as ApiProduct)?._id ?? "";
}

function resolveItemIds(item: ApiCartItem, productMap?: Map<string, ApiProduct>) {
  const productId = typeof item.productId === "string" ? item.productId : (item.productId as any)?._id ?? "";
  
  // 1. Get raw variantId
  let variantId = (item as any).variantId;
  if (variantId && typeof variantId === "object") {
    variantId = variantId._id ?? variantId.id;
  }
  if (typeof variantId !== "string" || variantId === "undefined" || variantId === "null") {
    variantId = undefined;
  }

  // 2. Check if product has variants
  const productObj = typeof item.productId === "object" ? item.productId : productMap?.get(productId);

  if (productObj?.variantIds && productObj.variantIds.length > 0) {
    // If product has variants, variantId must be one of them or default to the first one
    if (!variantId) {
      const first = productObj.variantIds[0];
      variantId = typeof first === "string" ? first : first?._id;
    }
  } else {
    // Base product: variantId is undefined (do not send empty string)
    variantId = undefined;
  }

  return { productId, variantId };
}

interface CheckoutFormProps {
  carts: ApiCart[];
  cartId?: string;
  productMap: Map<string, ApiProduct>;
  appliedCoupon: ApiCoupon | null;
  onCouponChange: (coupon: ApiCoupon | null) => void;
}

interface PendingPaymentContext {
  totalInr: number;
  prefillName?: string;
  prefillEmail: string;
  productOrderNumber: string;
}

const NEW_ADDRESS_VALUE = "new";

function normalizePhoneForRazorpay(input?: string): string | undefined {
  if (!input) return undefined;
  const digits = input.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return undefined;
}

export function CheckoutForm({ carts, cartId, productMap, appliedCoupon, onCouponChange }: CheckoutFormProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  // null means "user hasn't picked yet — fall through to default"
  const [userPickedAddressId, setUserPickedAddressId] = useState<string | typeof NEW_ADDRESS_VALUE | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(false);

  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 37.7749,
    longitude: -122.4194,
  });

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Error getting geolocation: ", error);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
      );
    }
  }, []);

  const [paymentLoading, setPaymentLoading] = useState(false);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const { data: addressesRes } = useQuery({
    queryKey: ["customer", "addresses"],
    queryFn: fetchAddresses,
    enabled: !!session?.user,
  });

  const { data: profileRes } = useQuery({
    queryKey: ["customer", "profile"],
    queryFn: fetchProfile,
    enabled: !!session?.user,
  });

  const profileData = (profileRes as { data?: Record<string, unknown> } | undefined)?.data;
  const rawPhone = (profileData?.phoneNumber as string | undefined)
    ?? (profileData?.mobile as string | undefined)
    ?? (profileData?.phone as string | undefined)
    ?? (profileData?.contactNumber as string | undefined)
    ?? ((profileData?.data as Record<string, unknown> | undefined)?.phoneNumber as string | undefined)
    ?? ((profileData?.data as Record<string, unknown> | undefined)?.mobile as string | undefined)
    ?? ((profileData?.data as Record<string, unknown> | undefined)?.phone as string | undefined);
  const addresses = (addressesRes?.data ?? []) as ApiAddress[];
  const defaultAddressId = addresses.find((a) => a.is_default)?._id ?? addresses[0]?._id;
  // Derive the effective selection: user's explicit pick → default address → "new"
  const selectedAddressId: string | typeof NEW_ADDRESS_VALUE =
    userPickedAddressId ?? defaultAddressId ?? NEW_ADDRESS_VALUE;
  const addressesRef = useRef(addresses);
  addressesRef.current = addresses;

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      phone: "",
      firstName: "",
      lastName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      country: "INDIA",
      state: "",
      zipCode: "",
      paymentMethod: "cod",
      discountCode: "",
      fulfillmentPreference: "ALLOW_SPLIT",
    },
  });
  const selectedCountry = form.watch("country");
  const selectedState = form.watch("state");
  const selectedCity = form.watch("city");
  const formPhone = form.watch("phone");

  const selectedFulfillment = form.watch("fulfillmentPreference");

  const { data: previewRes, isLoading: previewLoading, error: previewError } = useQuery({
    queryKey: ["customer", "checkout-preview", cartId, selectedFulfillment, coords.latitude, coords.longitude],
    queryFn: () => fetchCheckoutPreview(cartId!, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      fulfillmentPreference: selectedFulfillment,
    }),
    enabled: !!cartId,
    staleTime: 5000,
  });

  // Prefer phone typed in the form over profile phone
  const effectiveContact = normalizePhoneForRazorpay(formPhone || "") ?? normalizePhoneForRazorpay(rawPhone);

  useEffect(() => {
    const email = (session?.user?.email as string) ?? "";
    const name = (session?.user?.name as string) ?? "";
    if (email) form.setValue("email", email);
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        form.setValue("firstName", parts[0]);
        form.setValue("lastName", parts.slice(1).join(" "));
      } else if (parts.length === 1) {
        form.setValue("firstName", parts[0]);
        form.setValue("lastName", parts[0]);
      }
    }
  }, [session?.user?.email, session?.user?.name]);

  // Pre-fill phone from profile when it loads
  useEffect(() => {
    if (rawPhone && !form.getValues("phone")) {
      form.setValue("phone", rawPhone);
    }
  }, [rawPhone]);

  const lastFilledAddressId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedAddressId === NEW_ADDRESS_VALUE) {
      lastFilledAddressId.current = null;
      return;
    }
    if (selectedAddressId === lastFilledAddressId.current) return;
    lastFilledAddressId.current = selectedAddressId;
    const addrs = addressesRef.current;
    const addr = addrs.find((a) => a._id === selectedAddressId);
    if (addr) {
      form.setValue("addressLine1", (addr.addressLine1 ?? addr.line ?? "").trim(), { shouldValidate: true });
      form.setValue("addressLine2", (addr.addressLine2 ?? "").trim(), { shouldValidate: true });
      form.setValue("city", (addr.city ?? "").trim(), { shouldValidate: true });
      form.setValue("state", (addr.state ?? "").trim(), { shouldValidate: true });
      form.setValue("country", (addr.country ?? "INDIA").trim().toUpperCase() || "INDIA", { shouldValidate: true });
      form.setValue("zipCode", apiAddressPostalCode(addr), { shouldValidate: true });
      // Ensure hidden required fields are considered valid after selecting a saved address.
      void form.trigger(["addressLine1", "city", "state", "country", "zipCode"]);
    }
  }, [selectedAddressId, form]);

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: async () => {
      await clearServerCartsAfterCheckout();
      queryClient.invalidateQueries({ queryKey: ["customer", "cart"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      toast.success("Order placed successfully");
      router.push("/orders");
    },
    onError: (err: Error & { response?: { data?: { message?: string; error?: string } } }) => {
      const apiMsg = err.response?.data?.message ?? err.response?.data?.error;
      const message = apiMsg || err.message || "Failed to place order. Please try again.";
      toast.error(message);
      form.setError("root", { message });
    },
  });

  const createOrderFromCartMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof createOrderFromCart>[1] }) =>
      createOrderFromCart(id, body),
    onSuccess: async (_, variables) => {
      if (variables.id && variables.id !== "buy-now") {
        try {
          await deleteCart(variables.id);
        } catch {
          // non-critical
        }
      }
      queryClient.invalidateQueries({ queryKey: ["customer", "cart"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      toast.success("Order placed successfully");
      router.push("/orders");
    },
    onError: (err: Error & { response?: { data?: { message?: string; error?: string } } }) => {
      const apiMsg = err.response?.data?.message ?? err.response?.data?.error;
      const message = apiMsg || err.message || "Failed to place order. Please try again.";
      toast.error(message);
      form.setError("root", { message });
    },
  });

  async function clearServerCartsAfterCheckout() {
    const cartIds = carts
      .map((c) => c._id)
      .filter((id): id is string => Boolean(id) && id !== "buy-now");

    if (cartIds.length === 0) return;

    await Promise.allSettled(cartIds.map((cartId) => deleteCart(cartId)));
  }

  async function runOnlinePayment(
    payment: PendingPaymentContext,
    contactNumber?: string,
  ) {
    setPaymentLoading(true);
    let paymentError: any = null;

    try {
      await openRazorpayCheckout({
        amountInINR: payment.totalInr,
        name: payment.prefillName,
        description: "Order payment",
        prefill: {
          name: payment.prefillName,
          email: payment.prefillEmail,
          contact: contactNumber,
        },
        productOrderNumber: payment.productOrderNumber,
      });

      // Payment successful
      await clearServerCartsAfterCheckout();
      queryClient.invalidateQueries({ queryKey: ["customer", "cart"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "profile"] });
      toast.success("Payment successful — order placed");
      router.push("/orders");
    } catch (err: any) {
      paymentError = err;
      throw err;
    } finally {
      // Always reset loading state IMMEDIATELY
      setPaymentLoading(false);
      // Clear form errors
      form.clearErrors("root");

      // Force UI update if there's a cancellation error
      if (paymentError?.message?.includes("cancelled")) {
        // Additional safety: make sure loading state is false
        setTimeout(() => setPaymentLoading(false), 0);
      }
    }
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    const activeCarts = cartId ? carts.filter((c) => c._id === cartId) : carts;
    const items: { productId: string; variantId?: string; quantity: number; price?: number }[] = [];

    for (const cart of activeCarts) {
      for (const item of cart.items ?? []) {
        const { productId, variantId } = resolveItemIds(item, productMap);

        if (!productId) {
          form.setError("root", { message: "Invalid product in cart. Please re-add the item from the product page." });
          return;
        }

        // Validate that variantId is either empty (base product) or a valid ID
        if (variantId && !/^[a-z0-9-_]{20,30}$/i.test(variantId)) {
          form.setError("root", { message: "Invalid product variant ID. Please re-add the item from the product page." });
          return;
        }

        items.push({
          productId,
          variantId,
          quantity: item.quantity,
          price: item.priceAtAddition,
        });
      }
    }

    if (items.length === 0) {
      form.setError("root", { message: "No valid items in checkout." });
      return;
    }

    // Save new address to profile if requested
    if (selectedAddressId === NEW_ADDRESS_VALUE && saveNewAddress) {
      try {
        await addAddress({
          fullName: `${values.firstName || ""} ${values.lastName || ""}`.trim() || undefined,
          phone: values.phone?.trim() || undefined,
          addressLine1: values.addressLine1.trim(),
          addressLine2: values.addressLine2?.trim() || undefined,
          city: values.city.trim(),
          state: values.state.trim(),
          country: values.country.trim(),
          postalCode: values.zipCode.trim(),
          isDefault: true,
        });
        queryClient.invalidateQueries({ queryKey: ["customer", "addresses"] });
      } catch {
        // non-critical — continue placing order
      }
    }

    const orderPayload: CreateOrderBody = {
      items: items.map((it) => ({
        productId: it.productId,
        ...(it.variantId ? { variantId: it.variantId } : {}),
        quantity: it.quantity,
      })),
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: {
        street: values.addressLine2?.trim()
          ? `${values.addressLine1.trim()}, ${values.addressLine2.trim()}`
          : values.addressLine1.trim(),
        city: values.city.trim(),
        state: values.state.trim(),
        postalCode: values.zipCode.trim(),
        country: values.country.trim(),
      },
      giftMessage: values.giftMessage?.trim() || "",
      discountCode: values.discountCode?.trim() || "",
      onlinePaymentMethod: values.paymentMethod === "cod" ? "COD" : "ONLINE",
      isInterState: false,
    };

    const orderFromCartPayload: CreateOrderFromCartBody = {
      fulfillmentPreference: values.fulfillmentPreference,
      onlinePaymentMethod: values.paymentMethod === "cod" ? "COD" : "ONLINE",
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: {
        street: values.addressLine2?.trim()
          ? `${values.addressLine1.trim()}, ${values.addressLine2.trim()}`
          : values.addressLine1.trim(),
        city: values.city.trim(),
        state: values.state.trim(),
        postalCode: values.zipCode.trim(),
        country: values.country.trim(),
      },
      giftMessage: values.giftMessage?.trim() || "",
      discountCode: values.discountCode?.trim() || "",
      isInterState: false,
    };

    const isCartCheckout = !!cartId && cartId !== "buy-now";

    // COD -> create order immediately
    if (values.paymentMethod === "cod") {
      if (isCartCheckout) {
        createOrderFromCartMutation.mutate({ id: cartId, body: orderFromCartPayload });
      } else {
        createOrderMutation.mutate(orderPayload);
      }
      return;
    }

    // Online payments flow: create order first, then open gateway checkout
    try {
      const totalInr = items.reduce((s, it) => s + (it.price ?? 0) * it.quantity, 0);

      if (totalInr <= 0) {
        form.setError("root", { message: "Unable to determine order total. Please refresh and try again." });
        return;
      }

      setPaymentLoading(true);

      const orderRes = isCartCheckout
        ? await createOrderFromCart(cartId, orderFromCartPayload)
        : await createOrder(orderPayload);
      console.log("[checkout-form] createOrder response:", orderRes);

      const findKeyInObj = (obj: any, keys: string[]): string | undefined => {
        if (!obj || typeof obj !== "object") return undefined;
        for (const key of keys) {
          if (typeof obj[key] === "string" && obj[key].trim()) return obj[key].trim();
          if (typeof obj[key] === "number") return String(obj[key]);
        }
        for (const k in obj) {
          if (obj[k] && typeof obj[k] === "object") {
            const val = findKeyInObj(obj[k], keys);
            if (val) return val;
          }
        }
        return undefined;
      };

      let productOrderNumber = "";
      const targetRequestId = findKeyInObj(orderRes, ["requestId", "request_id"]);
      console.log("[checkout-form] targetRequestId for polling:", targetRequestId);

      try {
        const maxAttempts = 10;
        const pollIntervalMs = 2000;
        let matchedOrder: any = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          console.log(`[checkout-form] polling order status (attempt ${attempt}/${maxAttempts})...`);
          
          const ordersRes = await fetchOrders({ limit: 10 });
          const orders = ordersRes?.data ?? [];
          
          matchedOrder = orders.find((o: any) => 
            o.requestId === targetRequestId || 
            o.request_id === targetRequestId ||
            o.orderRequestId === targetRequestId ||
            o.id === targetRequestId ||
            o._id === targetRequestId
          );

          if (!matchedOrder && orders.length > 0) {
            matchedOrder = orders[0]; // Fallback to the latest order
          }

          if (matchedOrder) {
            const currentStatus = String(matchedOrder.status).toUpperCase();
            console.log(`[checkout-form] order matched:`, matchedOrder, `status: ${currentStatus}`);

            if (currentStatus === "CREATED" || currentStatus === "COMPLETED") {
              productOrderNumber = matchedOrder.orderNumber ?? matchedOrder._id ?? matchedOrder.id ?? "";
              break;
            }

            if (currentStatus === "FAILED" || currentStatus === "CANCELLED") {
              throw new Error(`Order was ${currentStatus.toLowerCase()} on the server.`);
            }
          }

          // Wait before the next attempt
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          }
        }

        if (!productOrderNumber && matchedOrder) {
          productOrderNumber = matchedOrder.orderNumber ?? matchedOrder._id ?? matchedOrder.id ?? "";
        }
      } catch (fetchErr: any) {
        console.error("[checkout-form] Error in order status polling:", fetchErr);
        if (fetchErr.message && (fetchErr.message.includes("failed") || fetchErr.message.includes("cancelled"))) {
          throw fetchErr;
        }
      }

      if (!productOrderNumber) {
        productOrderNumber = findKeyInObj(orderRes, ["orderNumber", "order_number", "requestId", "request_id", "_id", "id"]) || "";
      }

      if (!productOrderNumber) {
        throw new Error("Failed to retrieve order number from server.");
      }

      const paymentContext: PendingPaymentContext = {
        totalInr,
        prefillName: `${values.firstName || ""} ${values.lastName || ""}`.trim() || undefined,
        prefillEmail: values.email,
        productOrderNumber,
      };

      await runOnlinePayment(paymentContext, effectiveContact);
    } catch (err: any) {
      const message = err?.message || err?.response?.data?.message || "Payment failed. Please try again.";
      if (!message.includes("cancelled")) {
        toast.error(message);
        form.setError("root", { message });
      }
    } finally {
      setPaymentLoading(false);
    }
  }

  return (
    <Form {...form}>
      <>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full min-w-0 space-y-5">

          {/* ── Contact ── */}
          <div className="rounded-xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <Mail className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-base">Contact</h3>
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input type="email" placeholder="your@email.com" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile number <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="tel"
                        placeholder="+91 98765 43210"
                        className="pl-9"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ── Delivery address ── */}
          <div className="rounded-xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <Truck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-base">Delivery address</h3>
            </div>

            {addresses.length > 0 && (
              <div className="space-y-3">
                <Select
                  value={selectedAddressId}
                  onValueChange={(val) => {
                    setUserPickedAddressId(val);
                    if (val === NEW_ADDRESS_VALUE) {
                      form.setValue("addressLine1", "");
                      form.setValue("addressLine2", "");
                      form.setValue("city", "");
                      form.setValue("state", "");
                      form.setValue("country", "INDIA");
                      form.setValue("zipCode", "");
                    }
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Select a delivery address" />
                  </SelectTrigger>
                  <SelectContent align="start" sideOffset={4}>
                    {addresses.map((addr) => (
                      <SelectItem key={addr._id} value={addr._id}>
                        <span className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 whitespace-normal break-words">
                            {(addr.addressLine1 ?? addr.line ?? "").trim()}
                            {(addr.addressLine2 ?? "").trim() ? `, ${(addr.addressLine2 ?? "").trim()}` : ""}
                            {" — "}
                            {addr.city}, {addr.state} {apiAddressPostalCode(addr)}
                            {addr.is_default ? " (Default)" : ""}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_ADDRESS_VALUE}>
                      <span className="flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        Add new address
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Show selected address summary when an existing address is chosen */}
                {selectedAddressId !== NEW_ADDRESS_VALUE && (() => {
                  const addr = addresses.find((a) => a._id === selectedAddressId);
                  if (!addr) return null;
                  return (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                      <div className="font-medium flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {(addr.addressLine1 ?? addr.line ?? "").trim()}
                        {(addr.addressLine2 ?? "").trim() ? `, ${(addr.addressLine2 ?? "").trim()}` : ""}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {addr.city}, {addr.state} {apiAddressPostalCode(addr)}
                      </div>
                      <div className="text-muted-foreground">{addr.country}</div>
                      {addr.is_default && (
                        <span className="inline-block mt-1.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {(selectedAddressId === NEW_ADDRESS_VALUE || addresses.length === 0) && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="addressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address line 2 (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Apartment, suite, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN / Postal code</FormLabel>
                      <FormControl>
                        <PincodeLookupInput
                          value={field.value}
                          onChange={field.onChange}
                          onFilled={(d) => {
                            if (d.country) form.setValue("country", d.country);
                            if (d.state) form.setValue("state", d.state);
                            if (d.city) form.setValue("city", d.city);
                            if (d.pincode) form.setValue("zipCode", d.pincode);
                            const line2 = form.getValues("addressLine2");
                            if (d.block && !line2?.trim()) form.setValue("addressLine2", d.block);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter country" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter state" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District / City</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter city" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Save address checkbox */}
                <div className="flex items-center gap-3 pt-1">
                  <Checkbox
                    id="saveAddress"
                    checked={saveNewAddress}
                    onCheckedChange={(v) => setSaveNewAddress(!!v)}
                  />
                  <label
                    htmlFor="saveAddress"
                    className="text-sm font-normal cursor-pointer flex items-center gap-1.5 text-muted-foreground"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save this address to my profile
                  </label>
                </div>
              </>
            )}
          </div>{/* end address card */}

          {/* ── Gift Message ── */}
          <div className="rounded-xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <span className="text-base font-semibold">Gift Option (Optional)</span>
            </div>
            <FormField
              control={form.control}
              name="giftMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gift Message</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Enter a gift message to be included with your order..."
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ── Promo / Coupon ── */}
          <div className="rounded-xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <span className="text-base font-semibold">Promo / Coupon Code</span>
            </div>
            <FormField
              control={form.control}
              name="discountCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coupon code</FormLabel>
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                    <FormControl>
                      <Input
                        placeholder="e.g. SAVE10"
                        {...field}
                        disabled={!!appliedCoupon}
                        onChange={(e) => {
                          field.onChange(e);
                          setCouponError(null);
                        }}
                        className="min-w-0 flex-1 uppercase"
                      />
                    </FormControl>
                    {appliedCoupon ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 text-destructive border-destructive hover:bg-destructive/10"
                        onClick={() => {
                          onCouponChange(null);
                          form.setValue("discountCode", "");
                          setCouponError(null);
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="default"
                        className="shrink-0 bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
                        disabled={couponValidating || !field.value?.trim()}
                        onClick={async () => {
                          const code = field.value?.trim();
                          if (!code) return;
                          setCouponValidating(true);
                          setCouponError(null);
                          try {
                            const res = await validateCoupon(code);
                            const coupon = res?.data as ApiCoupon | undefined;
                            if (!coupon) throw new Error("Invalid coupon code");
                            // Check min purchase
                            const subtotal = carts.reduce((s, c) => {
                              if (c.totalAmount != null) return s + c.totalAmount;
                              const itemsSum = c.items?.reduce((st, item) => st + (item.priceAtAddition ?? 0) * (item.quantity ?? 1), 0) ?? 0;
                              return s + itemsSum;
                            }, 0);
                            if (coupon.minPurchaseAmount > 0 && subtotal < coupon.minPurchaseAmount) {
                              setCouponError(`Minimum order ₹${coupon.minPurchaseAmount.toLocaleString("en-IN")} required`);
                              return;
                            }
                            onCouponChange(coupon);
                            toast.success("Coupon applied!");
                          } catch (err: any) {
                            const msg = err?.response?.data?.message ?? err?.message ?? "Invalid coupon code";
                            setCouponError(msg);
                          } finally {
                            setCouponValidating(false);
                          }
                        }}
                      >
                        {couponValidating ? "Checking…" : "Apply"}
                      </Button>
                    )}
                  </div>
                  {couponError && (
                    <p className="text-sm text-destructive mt-1">{couponError}</p>
                  )}
                  {appliedCoupon && (
                    <p className="text-sm text-green-600 font-medium mt-1 flex items-center gap-1">
                      ✓ Coupon <span className="font-bold">{appliedCoupon.code}</span> applied
                      {appliedCoupon.discountType === "percentage"
                        ? ` — ${appliedCoupon.discountValue}% off`
                        : ` — ₹${appliedCoupon.discountValue.toLocaleString("en-IN")} off`}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ── Fulfillment Option ── */}
          <div className="rounded-xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <Truck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-base">Fulfillment Option</h3>
            </div>

            <FormField
              control={form.control}
              name="fulfillmentPreference"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                    >
                      {[
                        {
                          value: "ALLOW_SPLIT",
                          label: "Split Delivery",
                          desc: "Multiple shipments, faster delivery.",
                          icon: Truck,
                        },
                        {
                          value: "SINGLE_ONLY",
                          label: "Single Shipment",
                          desc: "All items shipped together.",
                          icon: Save,
                        },
                        {
                          value: "EMERGENCY_PARTIAL",
                          label: "Partial Shipment",
                          desc: "Ship available, rest later.",
                          icon: MapPin,
                        },
                      ].map(({ value, label, desc, icon: Icon }) => (
                        <FormItem key={value} className="space-y-0 flex">
                          <FormControl>
                            <RadioGroupItem value={value} className="sr-only" id={`fp-${value}`} />
                          </FormControl>
                          <FormLabel
                            htmlFor={`fp-${value}`}
                            className={`flex flex-col flex-1 gap-1 cursor-pointer rounded-lg border-2 p-3 transition-all ${
                              field.value === value
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-4 w-4 shrink-0 text-primary" />
                              <span className="font-semibold text-sm leading-none">{label}</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-normal leading-normal">{desc}</span>
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview results details (only when cartId exists) */}
            {cartId && (
              <>
                {previewLoading && (
                  <div className="animate-pulse space-y-2 py-3">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                )}

                {previewError && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                    Fulfillment details unavailable. Using default routing.
                  </div>
                )}

                {previewRes?.success && previewRes.data && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Store / Franchise</span>
                        <span className="font-medium text-foreground text-xs">{previewRes.data.franchiseName || "Local Hub"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Est. Delivery</span>
                        <span className="font-medium text-foreground text-xs">{previewRes.data.estimatedDelivery || "Standard"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Distance</span>
                        <span className="font-medium text-foreground text-xs">
                          {previewRes.data.distanceKm ? `${previewRes.data.distanceKm.toFixed(1)} km` : "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Allocated Items lists */}
                    {previewRes.data.items && previewRes.data.items.length > 0 && (
                      <div className="pt-3 border-t border-primary/10 space-y-2">
                        <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Item Allocation Details</span>
                        <div className="divide-y divide-primary/5">
                          {previewRes.data.items.map((item) => {
                            const hasShortfall = item.shortfallQuantity > 0;
                            return (
                              <div key={item.productId + (item.variantId || "")} className="flex items-center justify-between text-xs py-1.5 first:pt-0 last:pb-0">
                                <span className="text-muted-foreground truncate pr-2 max-w-[65%]">
                                  {item.productName} {item.variantName ? `(${item.variantName})` : ""}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-medium">Qty: {item.quantity}</span>
                                  {hasShortfall ? (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                                      Allocated: {item.allocatedQuantity} ({item.shortfallQuantity} short)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-medium">
                                      Available
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Payment ── */}
          <div className="rounded-xl border bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-base">Payment</h3>
            </div>
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      {[
                        { value: "card", label: "Credit / Debit Card", Icon: CreditCard },
                        { value: "upi", label: "UPI", Icon: Smartphone },
                        { value: "wallet", label: "Wallet", Icon: Wallet },
                        { value: "online", label: "Online Payment", Icon: Globe },
                        { value: "cod", label: "Cash on Delivery", Icon: Banknote },
                      ].map(({ value, label, Icon }) => (
                        <FormItem key={value} className="space-y-0">
                          <FormControl>
                            <RadioGroupItem value={value} className="sr-only" id={`pm-${value}`} />
                          </FormControl>
                          <FormLabel
                            htmlFor={`pm-${value}`}
                            className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-3 transition-all sm:px-4 ${field.value === value
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                              }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 text-left text-sm font-medium leading-snug">{label}</span>
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>{/* end payment card */}

          {form.formState.errors.root && (
            <p className="text-sm text-destructive px-1">
              {form.formState.errors.root.message}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={createOrderMutation.isPending || createOrderFromCartMutation.isPending || paymentLoading}
          >
            {paymentLoading
              ? "Opening payment gateway…"
              : createOrderFromCartMutation.isPending || createOrderMutation.isPending
                ? "Placing order…"
                : "Confirm & Place Order"}
          </Button>
        </form>
      </>
    </Form>
  );
}
