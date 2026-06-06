"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useAuthModal } from "@/provider/auth-modal-provider";
import { useQuery } from "@tanstack/react-query";
import { fetchWishlistIds } from "@/lib/api";
import { useState } from "react";
import { User } from "lucide-react";

export const UserProfileDropdown = () => {
  const [open, setOpen] = useState(false);
  const session = useSession();
  const { openAuthModal } = useAuthModal();

  const customerId = session.data?.userId;
  const { data: wishlistIdsRes } = useQuery({
    queryKey: ["customer", "wishlist", "ids", customerId],
    queryFn: () => fetchWishlistIds(customerId as string),
    enabled: session.status === "authenticated" && !!customerId,
  });

  const wishlistCount = (wishlistIdsRes?.data ?? []).length;

  return (
    <div className="hidden md:flex items-center">
      {session.status === "authenticated" ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="flex flex-col items-center text-foreground hover:text-primary transition-colors cursor-pointer">
              <Avatar className="h-6 w-6 ring-1 ring-border/50">
                <AvatarImage
                  src={session.data?.user?.image || "/default-avatar.png"}
                  alt={session.data?.user?.name || "User"}
                />
                <AvatarFallback className="text-[10px] font-semibold bg-muted">
                  {session.data?.user?.name?.charAt(0)?.toUpperCase() || "S"}
                </AvatarFallback>
              </Avatar>
              <span className="text-[11px] mt-1.5 font-medium text-gray-700">Account</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="end">
            <div className="flex flex-col space-y-0.5">
              {/* Greeting Section */}
              <div className="px-3 py-3 bg-muted/50 rounded-md mb-1">
                <p className="text-sm font-semibold text-foreground">
                  Hi {session.data?.user?.name || session.data?.user?.email || "User"}
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-border my-1" />

              {/* Menu Items */}
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                My Profile
              </Link>
              <Link
                href="/orders"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                Orders
              </Link>
              <Link
                href="/wishlist"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between"
              >
                <span>Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <Link
                href="/profile/addresses"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                Address
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                Settings
              </Link>
              <div className="border-t border-border my-1" />
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2 text-sm rounded-md hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  signOut({ redirectTo: "/" });
                }}
              >
                Sign out
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <button
          type="button"
          onClick={() => openAuthModal()}
          className="flex flex-col items-center text-gray-700 hover:text-primary transition-colors text-center cursor-pointer"
        >
          <User className="h-6 w-6 stroke-[1.8]" />
          <span className="text-[11px] mt-1.5 font-medium">Account</span>
        </button>
      )}
    </div>
  );
};
