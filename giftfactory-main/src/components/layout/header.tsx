"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Menu, MapPin, Home, ShoppingBag, Heart, User, Package, Settings, HelpCircle, Store, LogIn, ChevronRight, Bell, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserProfileDropdown } from "../card";
import { SearchForm } from "../form";
import { useAuthModal } from "@/provider/auth-modal-provider";
import { CustomIcon } from "../ui/custom-icon";
import { fetchCart, fetchCategories, fetchAddresses, fetchWishlistIds, updateAddress } from "@/lib/api";
import { guestCartCount } from "@/lib/guest-cart";
import { useNotifications } from "@/store/notification-store";
import { NotificationDropdown } from "./notification-dropdown";
import type { ApiCategory, ApiAddress, ApiWishlistItem } from "@/types/api";
import { apiAddressPostalCode, apiAddressStreet } from "@/types/api";
import { toast } from "sonner";

const QUICK_LINKS = [
  { label: "Best Sellers", href: "/products?sortBy=createdAt&order=desc" },
  { label: "Today's Deals", href: "/products?deals=1" },
];

export const Header = () => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [settingDefaultAddressId, setSettingDefaultAddressId] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const { status, data: sessionData } = useSession();
  const { openAuthModal } = useAuthModal();
  const { data: cartRes } = useQuery({
    queryKey: ["customer", "cart"],
    queryFn: () => fetchCart(),
    enabled: status === "authenticated",
  });
  const { data: catRes } = useQuery({
    queryKey: ["web", "categories"],
    queryFn: fetchCategories,
  });
  const { data: addressesRes, refetch: refetchAddresses } = useQuery({
    queryKey: ["customer", "addresses"],
    queryFn: fetchAddresses,
    enabled: status === "authenticated",
  });
  const addresses = (addressesRes?.data ?? []) as ApiAddress[];
  const defaultAddress = addresses.find((a) => a.is_default) ?? addresses[0];
  const defaultAddressText = defaultAddress
    ? `${apiAddressStreet(defaultAddress)}, ${defaultAddress.city}`
    : "";
  const mobileHeaderAddressLabel = defaultAddressText
    ? defaultAddressText.length > 15
      ? defaultAddressText.slice(0, 15) + "…"
      : defaultAddressText
    : "Your address";
  const headerAddressLabel = defaultAddressText
    ? defaultAddressText.length > 25
      ? defaultAddressText.slice(0, 24) + "…"
      : defaultAddressText
    : "Your address";

  const categories = (catRes?.data ?? []) as ApiCategory[];
  const mobileProfileInitial =
    sessionData?.user?.name?.trim()?.charAt(0)?.toUpperCase() ||
    sessionData?.user?.email?.trim()?.charAt(0)?.toUpperCase() ||
    "U";
  const carts = (cartRes?.data ?? []) as { itemsCount?: number; items?: unknown[] }[];
  const cartCount = carts.reduce((sum, c) => sum + (c.itemsCount ?? c.items?.length ?? 0), 0);
  const displayCartCount = status === "authenticated" ? cartCount : guestCount;

  const customerId = sessionData?.userId;
  const { data: wishlistIdsRes } = useQuery({
    queryKey: ["customer", "wishlist", "ids", customerId],
    queryFn: () => fetchWishlistIds(customerId as string),
    enabled: status === "authenticated" && !!customerId,
  });
  const wishlistCount = (wishlistIdsRes?.data ?? []).length;

  const { data: notifications = [] } = useNotifications({
    enabled: status === "authenticated",
  });
  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  const openAddressSelector = () => {
    if (status !== "authenticated") {
      openAuthModal({ message: "Sign in to manage your address", callbackUrl: "/profile/addresses" });
      return;
    }
    setAddressDialogOpen(true);
  };

  const handleSetDefaultAddress = async (address: ApiAddress) => {
    if (!address?._id) return;
    if (address.is_default) {
      setAddressDialogOpen(false);
      return;
    }

    try {
      setSettingDefaultAddressId(address._id);
      await updateAddress(address._id, { isDefault: true });
      await refetchAddresses();
      toast.success("Default address updated");
      setAddressDialogOpen(false);
    } catch {
      toast.error("Failed to update default address");
    } finally {
      setSettingDefaultAddressId(null);
    }
  };

  useEffect(() => {
    const syncGuestCount = () => setGuestCount(guestCartCount());
    const onStorage = (event: StorageEvent) => {
      if (event.key === "gf_guest_cart") {
        syncGuestCount();
      }
    };

    syncGuestCount();
    window.addEventListener("guest-cart-updated", syncGuestCount);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("guest-cart-updated", syncGuestCount);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <header className="bg-background border-b border-border/20 sticky top-0 z-50 shadow-sm">
      {/* Top promo bar */}
      <div className="bg-[#cc176b] text-white">
        <div className="container mx-auto px-4 flex items-center justify-between py-2 text-xs">
          <span>Free worldwide shipping</span>
          <div className="flex items-center gap-4">
            <Link href="/orders" className="hover:text-white/80 transition-colors">30-Day Return</Link>
            <Link href="/help" className="hover:text-white/80 transition-colors flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Help & Support
            </Link>

          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo & Deliver-to */}
          <div className="flex items-center gap-4 min-w-0 shrink-0">
            <Link href="/" className="flex items-center shrink-0">
              <img src="/favicon.png" alt="Logo" width={150} height={150} />
            </Link>

            {/* Deliver to - desktop */}
            <button
              type="button"
              onClick={openAddressSelector}
              className="hidden lg:flex group flex-col items-start text-foreground hover:text-primary shrink-0 min-w-0 text-left cursor-pointer"
            >
              <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider flex items-center gap-0.5 group-hover:text-primary transition-colors">
                <MapPin className="h-3 w-3 shrink-0" /> Deliver to
              </span>
              <span className="text-xs font-semibold truncate max-w-[120px]" title={defaultAddress ? `${apiAddressStreet(defaultAddress)}, ${defaultAddress.city}, ${defaultAddress.state} ${apiAddressPostalCode(defaultAddress)}` : undefined}>
                {headerAddressLabel}
              </span>
            </button>
          </div>

          {/* Search - desktop */}
          <div className="hidden lg:flex flex-1 min-w-0 mx-6">
            <SearchForm />
          </div>

          {/* Right: Account, Wishlist, Cart, Mobile Menu */}
          <div className="flex items-center gap-4 md:gap-6 shrink-0">
            {/* Account dropdown */}
            <UserProfileDropdown />

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="relative hidden md:flex flex-col items-center justify-center text-gray-700 hover:text-primary transition-colors cursor-pointer"
              aria-label="Wishlist"
            >
              <div className="relative">
                <Heart className="h-6 w-6 stroke-[1.8]" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#cc176b] text-white text-[9px] font-black rounded-full h-4.5 w-4.5 flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 font-medium">Wishlist</span>
            </Link>

            {/* Cart */}
            <Link
              href="/cart"
              className="relative flex flex-col items-center justify-center text-gray-700 hover:text-primary transition-colors cursor-pointer"
              aria-label="Cart"
            >
              <div className="relative">
                <ShoppingBag className="h-6 w-6 stroke-[1.8]" />
                {displayCartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#cc176b] text-white text-[9px] font-black rounded-full h-4.5 w-4.5 flex items-center justify-center">
                    {displayCartCount > 99 ? "99+" : displayCartCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 font-medium">Cart</span>
            </Link>

            <NotificationDropdown />

            {/* Mobile menu sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-80 p-0 flex flex-col">
                <SheetHeader className="px-4 pt-5 pb-4 border-b border-border bg-muted/30">
                  <SheetTitle className="flex items-center gap-2">
                    <Link href="/" onClick={() => setSheetOpen(false)}>
                      <span className="text-xl font-black italic text-[#cc176b]">EA</span>
                      <span className="text-xl font-bold text-gray-900 ml-0.5">SHOP</span>
                    </Link>
                  </SheetTitle>
                  {status === "authenticated" ? (
                    <p className="text-xs text-muted-foreground mt-1">Welcome back!</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSheetOpen(false);
                        openAuthModal();
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#cc176b] px-3 py-2 text-sm font-medium text-white hover:bg-[#cc176b]/95 transition-colors cursor-pointer"
                    >
                      <LogIn className="h-4 w-4" />
                      Sign in / Register
                    </button>
                  )}
                </SheetHeader>

                <nav className="flex-1 overflow-y-auto scrollbar-hide">
                  {/* Account Section */}
                  {status === "authenticated" && (
                    <div className="px-3 pt-4 pb-2">
                      <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">My Account</p>
                      {[
                        { href: "/profile", label: "Profile", icon: User },
                        { href: "/orders", label: "My Orders", icon: Package },
                        { href: "/wishlist", label: "Wishlist", icon: Heart, badge: wishlistCount },
                        { href: "/notification", label: "Notifications", icon: Bell, badge: unreadNotificationsCount },
                        { href: "/settings", label: "Settings", icon: Settings },
                      ].map(({ href, label, icon: Icon, badge }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setSheetOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1">{label}</span>
                          {badge != null && badge > 0 && (
                            <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                              {badge}
                            </span>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Quick Links */}
                  <div className="px-3 pt-3 pb-2">
                    <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explore</p>
                    {[
                      { href: "/", label: "Home", icon: Home },
                      { href: "/products", label: "All Products", icon: ShoppingBag },
                      ...QUICK_LINKS.map((l) => ({ href: l.href, label: l.label, icon: ShoppingBag })),
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={`${href}-${label}`}
                        href={href}
                        onClick={() => setSheetOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        {label}
                      </Link>
                    ))}
                  </div>

                  {/* Categories */}
                  {categories.length > 0 && (
                    <div className="px-3 pt-3 pb-2">
                      <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categories</p>
                      {categories.map((c) => (
                        <Link
                          key={c._id}
                          href={`/products?categoryId=${c._id}`}
                          onClick={() => setSheetOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="flex-1 truncate">{c.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Sell & Help */}
                  <div className="px-3 pt-3 pb-5 border-t border-border mt-2">
                    <Link
                      href="/sell"
                      onClick={() => setSheetOpen(false)}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-primary transition-colors"
                    >
                      <Store className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      Become a Supplier
                    </Link>
                    <Link
                      href="/help"
                      onClick={() => setSheetOpen(false)}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-primary transition-colors"
                    >
                      <HelpCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      Help Center
                    </Link>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Search - mobile */}
      <div className="lg:hidden px-4 pb-3">
        <SearchForm />
      </div>

      {/* Single sub-header: All Categories + Nav links */}
      <div className="hidden lg:block border-t border-gray-100 bg-[#fbfbfb]">
        <div className="container mx-auto px-4 flex items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide min-w-0">
            {/* All Categories trigger */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="rounded-full bg-pink-50 hover:bg-pink-100/60 border border-pink-100/50 text-[#cc176b] font-bold text-xs px-5 py-2 flex items-center gap-2 transition-all cursor-pointer shadow-sm select-none"
                >
                  <Menu className="h-3.5 w-3.5" /> All Categories
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 sm:w-96 p-0 flex flex-col">
                <SheetHeader className="px-5 pt-6 pb-4 border-b border-border">
                  <SheetTitle className="text-lg font-semibold text-foreground">
                    All Categories
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Browse products by category
                  </p>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
                  {categories.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No categories available
                    </div>
                  ) : (
                    <ul className="space-y-0.5 px-3">
                      {categories.map((c) => (
                        <li key={c._id}>
                          <Link
                            href={`/products?categoryId=${c._id}`}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                            onClick={() => setSheetOpen(false)}
                          >
                            <span className="flex-1 truncate">{c.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              <Link
                href="/"
                className="relative px-3.5 py-1.5 text-sm font-bold text-[#cc176b] hover:text-[#cc176b] transition-colors"
              >
                Home
                <span className="absolute bottom-[-10px] left-3.5 right-3.5 h-[3px] bg-[#cc176b] rounded-full" />
              </Link>
              <Link
                href="/products"
                className="px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:text-[#cc176b] transition-colors flex items-center gap-1"
              >
                Products <ChevronDown className="h-3 w-3" />
              </Link>
              <Link
                href="/products?sortBy=brand"
                className="px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:text-[#cc176b] transition-colors"
              >
                Brands
              </Link>
              <Link
                href="/products?deals=1"
                className="px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:text-[#cc176b] transition-colors"
              >
                Deals
              </Link>
              <Link
                href="/products?sortBy=createdAt"
                className="px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:text-[#cc176b] transition-colors"
              >
                New Arrivals
              </Link>
              <Link
                href="/blog"
                className="px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:text-[#cc176b] transition-colors"
              >
                Blog
              </Link>
              <Link
                href="/help"
                className="px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:text-[#cc176b] transition-colors"
              >
                Contact
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 shrink-0">
            <Link href="/sell" className="hover:text-primary whitespace-nowrap transition-colors">Become a Supplier</Link>
            <Link href="/help" className="hover:text-primary whitespace-nowrap transition-colors">Help Center</Link>
          </div>
        </div>
      </div>

      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Delivery Address</DialogTitle>
            <DialogDescription>
              Choose one address to set as your default delivery address.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {addresses.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No saved addresses found. Please add an address from your profile.
              </div>
            ) : (
              addresses.map((address) => {
                const isCurrentDefault = !!address.is_default;
                const isSubmitting = settingDefaultAddressId === address._id;
                return (
                  <button
                    key={address._id}
                    type="button"
                    onClick={() => handleSetDefaultAddress(address)}
                    disabled={isSubmitting}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${isCurrentDefault
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                      } ${isSubmitting ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground break-words">
                          {apiAddressStreet(address)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {address.city}, {address.state} {apiAddressPostalCode(address)}, {address.country}
                        </p>
                      </div>
                      {isCurrentDefault && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Default
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2">
            <Link
              href="/profile/addresses"
              onClick={() => setAddressDialogOpen(false)}
              className="text-sm text-primary hover:underline"
            >
              Manage addresses
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};
