"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfile } from "@/types/product";
import { useEffect, useState } from "react";
import { updateProfile, changePassword, fetchProfileStats } from "@/lib/api";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  ShoppingBag, Heart, Star, MapPin, Coins,
  BadgeCheck, AlertCircle, Lock, Eye, EyeOff
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { email } from "zod";

interface ProfileInfoProps {
  user?: UserProfile;
  isLoading?: boolean;
}

const GENDERS = ["male", "female", "other", "prefer_not_to_say"] as const;

const mapGenderToBackend = (gender: string) => {
  if (!gender) return undefined;
  const g = gender.toUpperCase();
  if (g === "MALE" || g === "FEMALE") return g;
  return "NOT_SPECIFIED";
};

const mapGenderToForm = (gender?: string) => {
  if (!gender) return "";
  const g = gender.toUpperCase();
  if (g === "MALE" || g === "FEMALE") return g.toLowerCase();
  return "prefer_not_to_say";
};

export function ProfileInfo({ user, isLoading }: ProfileInfoProps) {
  const queryClient = useQueryClient();
  const { data: session, update } = useSession();
  const [saving, setSaving] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ["customer", "profile-stats"],
    queryFn: () => fetchProfileStats(),
    enabled: !!session?.accessToken,
  });

  const stats = statsRes?.data ?? null;

  type FormValues = {
    name: string;
    email: string;
    avatar: string;
    phone: string;
    gender: string;
    dob: string;
    gstin: string;
  };

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      name: "",
      email: "",
      avatar: "",
      phone: "",
      gender: "",
      dob: "",
      gstin: "",
    },
  });

  useEffect(() => {
    if (!isLoading && user) {
      reset({
        name: user.name || "",
        email: user.email || "",
        avatar: user.avatar || "",
        phone: user.phone || "",
        gender: mapGenderToForm(user.gender),
        dob: user.dob ? user.dob.split("T")[0] : "",
        gstin: user.gstin || "",
      });
    }
  }, [user, isLoading, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!data.name.trim()) { toast.error("Name cannot be empty"); return; }
    if (!data.email.trim()) { toast.error("Email cannot be empty"); return; }
    
    if (data.gstin && data.gstin.trim()) {
      const formattedGstin = data.gstin.toUpperCase().trim();
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[A-Z]{1}[0-9A-Z]{1}$/;
      if (formattedGstin.length !== 15) {
        toast.error("GSTIN must be exactly 15 characters long.");
        return;
      }
      if (!gstinRegex.test(formattedGstin)) {
        toast.error("Invalid GSTIN format. Please enter a valid GST number (e.g., 22AAAAA0000A1Z5).");
        return;
      }
    }

    setSaving(true);
    try {
      await updateProfile({
        name: data.name.trim(),
        email: data.email.trim(),
        avatar: data.avatar.trim() || undefined,
        phone: data.phone || undefined,
        gender: mapGenderToBackend(data.gender),
        dob: data.dob || undefined,
        gstin: data.gstin ? data.gstin.toUpperCase() : undefined,
      });
      toast.success("Profile updated successfully");
      setIsEditing(false);
      if (update) {
        await update({
          ...session,
          user: {
            ...session?.user,
            name: data.name.trim(),
            image: data.avatar.trim() || undefined,
            email:data.email.trim(),
            phone: data.phone || undefined,
            gender: mapGenderToBackend(data.gender),
            dob: data.dob || undefined,
            gstin: data.gstin || undefined,

          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["customer", "profile", session?.user?.email] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (!newPassword) {
      toast.error("New password is required");
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 12) {
      toast.error("New password must be between 6 and 12 characters");
      return;
    }

    setUpdatingPassword(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setShowChangePassword(false);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message ?? err?.message ?? "Failed to change password";
      toast.error(errorMsg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const completion = user?.profileCompletion;

  return (
    <div className="space-y-7">
      {/* ── Avatar + name ── */}
      <div className="flex items-center gap-3 sm:gap-5">
        <Avatar className="h-14 w-14 sm:h-20 sm:w-20 ring-2 ring-border shrink-0">
          <AvatarImage src={user?.avatar} alt={user?.name} />
          <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl font-semibold">
            {user?.name?.charAt(0) ?? "U"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-xl font-semibold text-foreground truncate">{user?.name}</h2>
            {user?.isEmailVerified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <BadgeCheck className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm truncate mt-0.5">{user?.email}</p>
          {user?.bio && <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{user.bio}</p>}
        </div>
      </div>

      {/* ── Profile completion bar ── */}
      {completion && completion.score < 100 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-amber-800 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> Profile {completion.score}% complete
            </span>
            <span className="text-amber-600 text-xs">
              Fill in: {completion.missing.slice(0, 3).join(", ")}{completion.missing.length > 3 ? ` +${completion.missing.length - 3} more` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-amber-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${completion.score}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Stats strip ── */}
      {!statsLoading && stats && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShoppingBag, label: "Orders", value: stats.orderCount ?? 0, color: "text-blue-600 bg-blue-50", href: "/orders" },
            { icon: Heart, label: "Wishlist", value: stats.wishlistCount ?? 0, color: "text-rose-600 bg-rose-50", href: "/wishlist" },
            { icon: Star, label: "Reviews", value: stats.reviewCount ?? 0, color: "text-amber-600 bg-amber-50" },
            { icon: MapPin, label: "Addresses", value: stats.addressCount ?? 0, color: "text-purple-600 bg-purple-50", href: "/profile/addresses" },
          ].map(({ icon: Icon, label, value, color, href }) => {
            const cardClassName = "rounded-xl border border-border bg-card p-2.5 sm:p-3 flex flex-col items-center gap-1 sm:gap-1.5 text-center min-w-[72px] sm:min-w-0 shrink-0 sm:shrink transition-colors";
            const interactiveClassName = "hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

            const cardContent = (
              <>
                <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center ${color}`}>
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <span className="text-base sm:text-lg font-bold text-foreground">{value}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">{label}</span>
              </>
            );

            if (href) {
              return (
                <Link
                  key={label}
                  href={href}
                  aria-label={`Go to ${label}`}
                  className={`${cardClassName} ${interactiveClassName}`}
                >
                  {cardContent}
                </Link>
              );
            }

            return (
              <div key={label} className={cardClassName}>
                {cardContent}
              </div>
            );
          })}
        </div>
      )}
      {statsLoading && (
        <div className="flex gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/40 h-20 sm:h-24 min-w-[72px] sm:min-w-0 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Member since badge ── */}
      {stats?.memberSince && (
        <p className="text-xs text-muted-foreground">
          Member since {new Date(stats.memberSince).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
          {" · "}{stats.memberDays} days
        </p>
      )}

      {/* ── Edit form ── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5 max-w-2xl">
        {/* Personal info */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 pb-1 border-b border-border">Personal Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" required>
              <Input {...register("name")} placeholder="Your name" disabled={isLoading || !isEditing} />
            </Field>
            <Field label="Email" required>
              <Input {...register("email")} placeholder="Your email address" disabled={isLoading || !isEditing} />
            </Field>
            <Field label="Avatar URL">
              <Input {...register("avatar")} placeholder="https://example.com/avatar.png" disabled={isLoading || !isEditing} />
            </Field>
            <Field label="Phone">
              <Input {...register("phone")} placeholder="+91 98765 43210" disabled={isLoading || !isEditing} />
            </Field>
            <Field label="Gender">
              <select
                {...register("gender")}
                disabled={isLoading || !isEditing}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">Select gender</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </Field>
            <Field label="Date of Birth">
              <Input type="date" {...register("dob")} disabled={isLoading || !isEditing} />
            </Field>
          </div>
        </div>

        {/* Business info */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 pb-1 border-b border-border">Business / GST Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="GSTIN" hint="15-digit GST number">
              <Input {...register("gstin")} placeholder="22AAAAA0000A1Z5" maxLength={15} disabled={isLoading || !isEditing} className="uppercase" />
            </Field>
          </div>
        </div>

        {!isEditing ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              key="edit-btn"
              type="button"
              className="rounded-full px-8"
              onClick={(e) => {
                e.preventDefault();
                setIsEditing(true);
              }}
              disabled={isLoading}
            >
              Edit Profile
            </Button>
            <Button
              key="change-pwd-btn"
              type="button"
              variant="outline"
              className="rounded-full px-8"
              onClick={(e) => {
                e.preventDefault();
                setShowChangePassword(true);
              }}
              disabled={isLoading}
            >
              Change Password
            </Button>
          </div>
        ) : (
          <Button
            key="save-btn"
            type="submit"
            className="rounded-full px-8"
            disabled={saving || isLoading}
          >
            {saving ? "Saving…" : "Save Profile"}
          </Button>
        )}
        
      </form>

      {/* ── Dialog for Change Password ── */}
      <Dialog open={showChangePassword} onOpenChange={(open) => {
        setShowChangePassword(open);
        if (!open) {
          setCurrentPassword("");
          setNewPassword("");
          setShowCurrentPassword(false);
          setShowNewPassword(false);
        }
      }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl border border-border shadow-xl bg-background p-6">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Change Password
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update your password to keep your account secure.
            </p>
          </DialogHeader>
          <form onSubmit={handleUpdatePassword} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Current Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={updatingPassword}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                New Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password (6-12 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={updatingPassword}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowChangePassword(false)}
                disabled={updatingPassword}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updatingPassword}
                className="rounded-full px-6"
              >
                {updatingPassword ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, hint, required }: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
