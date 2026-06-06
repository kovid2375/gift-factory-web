"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Home, Search, ShoppingCart, User, Heart } from "lucide-react";
import { fetchCart, fetchWishlistIds } from "@/lib/api";
import { guestCartCount } from "@/lib/guest-cart";
import { useAuthModal } from "@/provider/auth-modal-provider";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { status, data: sessionData } = useSession();
  const { openAuthModal } = useAuthModal();
  const isAuthed = status === "authenticated";
  const [guestCount, setGuestCount] = useState(0);

  const { data: cartRes } = useQuery({
    queryKey: ["customer", "cart"],
    queryFn: () => fetchCart(),
    enabled: isAuthed,
  });

  const customerId = sessionData?.userId;
  const { data: wishlistIdsRes } = useQuery({
    queryKey: ["customer", "wishlist", "ids", customerId],
    queryFn: () => fetchWishlistIds(customerId as string),
    enabled: isAuthed && !!customerId,
  });
  
  const wishlistCount = (wishlistIdsRes?.data ?? []).length;

  const carts = (cartRes?.data ?? []) as { itemsCount?: number; items?: unknown[]; status?: string }[];
  const cartCount = carts
    .filter((c) => !c.status || c.status.toLowerCase() === "active")
    .reduce((sum, c) => sum + (c.itemsCount ?? c.items?.length ?? 0), 0);
  const displayCartCount = isAuthed ? cartCount : guestCount;

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

  const navItems: {
    label: string;
    href: string;
    icon: typeof Home;
    exact: boolean;
    guestOpensAuth?: boolean;
  }[] = [
    { label: "Home", href: "/", icon: Home, exact: true },
    { label: "Shop", href: "/products", icon: Search, exact: false },
    { label: "Cart", href: "/cart", icon: ShoppingCart, exact: false },
    { label: "Wishlist", href: "/wishlist", icon: Heart, exact: false },
    { label: "Account", href: "/profile", icon: User, exact: false, guestOpensAuth: true },
  ];

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-background/95 backdrop-blur-sm border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid grid-cols-5 h-14">
        {navItems.map(({ label, href, icon: Icon, exact, guestOpensAuth }) => {
          const active = isActive(href, exact);
          const isCart = label === "Cart";
          const isWishlist = label === "Wishlist";
          const isAccount = label === "Account";

          if (isAccount && !isAuthed && guestOpensAuth) {
            return (
              <button
                key={label}
                type="button"
                onClick={() => openAuthModal({ message: "Sign in to your account", callbackUrl: "/profile" })}
                className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={label}
              >
                <div className="relative">
                  <Icon
                    className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                </div>
                <span className={`text-[10px] font-medium leading-none ${active ? "text-primary" : ""}`}>
                  {label}
                </span>
                {active && (
                  <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          }

          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={label}
            >
              <div className="relative">
                <Icon
                  className={`h-5 w-5 transition-transform ${active ? "scale-110" : ""}`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {isCart && displayCartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                    {displayCartCount > 9 ? "9+" : displayCartCount}
                  </span>
                )}
                {isWishlist && wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#cc176b] text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center leading-none">
                    {wishlistCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium leading-none ${active ? "text-primary" : ""}`}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
