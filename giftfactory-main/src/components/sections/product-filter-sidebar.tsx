"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, IndianRupee, Tag, Star, Percent, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo, memo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchBrands, fetchSubCategories } from "@/lib/api";
import type { ApiBrand, ApiCategory } from "@/types/api";

const PRICE_MIN = 0;
const PRICE_MAX = 1000000; // ₹10 Lakh

function formatPrice(value: number): string {
  if (value >= 1000000) return "10 L";
  if (value >= 100000) return `${(value / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} L`;
  if (value >= 1000) return `${(value / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} K`;
  return value.toLocaleString("en-IN");
}

const RATINGS = [
  { label: "4 & Up", value: 4 },
  { label: "3 & Up", value: 3 },
  { label: "2 & Up", value: 2 },
] as const;

const DISCOUNTS = [
  { label: "10% off or more", value: 10 },
  { label: "25% off or more", value: 25 },
  { label: "50% off or more", value: 50 },
] as const;

export interface ProductFiltersState {
  categoryId: string;
  brandId: string;
  sortBy: string;
  order: "asc" | "desc";
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  discountMin?: number;
}

export interface ProductFilterSidebarProps {
  filters: ProductFiltersState;
  onFiltersChange: (f: Partial<ProductFiltersState>) => void;
  onCategorySelect: (id: string) => void;
  onSubcategorySelect?: () => void;
  selectedCategoryId: string;
  rootCategoryId: string | null;
  onClearFilters?: () => void;
}


function ProductFilterSidebarContent({
  filters,
  onFiltersChange,
  onCategorySelect,
  onSubcategorySelect,
  selectedCategoryId,
  rootCategoryId,
  onClearFilters,
}: ProductFilterSidebarProps) {
  // Local UI state - tracks which root category is expanded (persists even when rootCategoryId prop becomes null)
  const [expandedParentId, setExpandedParentId] = useState<string | null>(rootCategoryId);

  // Sync expandedParentId when rootCategoryId prop arrives with a real value
  // (e.g. on initial load from URL, or when user picks a root category)
  // Do NOT clear it when rootCategoryId becomes null (subcategory selected but page can't resolve parent)
  const prevRootCategoryIdRef = useRef(rootCategoryId);
  if (rootCategoryId !== null && rootCategoryId !== prevRootCategoryIdRef.current) {
    prevRootCategoryIdRef.current = rootCategoryId;
    if (rootCategoryId !== expandedParentId) {
      setExpandedParentId(rootCategoryId);
    }
  }

  // Fetch categories with React Query - cached and won't refetch frequently
  const { data: categoriesRes } = useQuery({
    queryKey: ["web", "categories"],
    queryFn: fetchCategories,
    staleTime: 10 * 60_000, // 10 minutes
  });
  const categories = (categoriesRes?.data ?? []) as ApiCategory[];

  // Use expandedParentId (local state) for subcategory fetching — NOT rootCategoryId prop.
  // This keeps subcategories visible when a sub is selected and the page temporarily loses rootCategoryId.
  const { data: subcategoriesRes } = useQuery({
    queryKey: ["web", "categories", "sub", expandedParentId],
    queryFn: () => fetchSubCategories(expandedParentId!),
    enabled: !!expandedParentId,
    staleTime: 10 * 60_000,
  });
  const subcategories = (subcategoriesRes?.data ?? []) as ApiCategory[];

  // Fetch brands with React Query - cached
  const { data: brandsRes } = useQuery({
    queryKey: ["web", "brands"],
    queryFn: fetchBrands,
    staleTime: 10 * 60_000,
  });
  const brandsList = (brandsRes?.data ?? []) as ApiBrand[];

  const rootCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  // Local slider state — tracks thumb position without firing API on every drag
  const [sliderValues, setSliderValues] = useState<[number, number]>([
    filters.minPrice ?? PRICE_MIN,
    filters.maxPrice ?? PRICE_MAX,
  ]);

  // Sync slider when filters are cleared externally
  useEffect(() => {
    setSliderValues([
      filters.minPrice ?? PRICE_MIN,
      filters.maxPrice ?? PRICE_MAX,
    ]);
  }, [filters.minPrice, filters.maxPrice]);

  // Debounce: only call onFiltersChange 400 ms after the user stops dragging
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSliderChange = useCallback(
    (values: number[]) => {
      const [min, max] = values as [number, number];
      setSliderValues([min, max]);
      if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
      priceDebounceRef.current = setTimeout(() => {
        onFiltersChange({
          minPrice: min === PRICE_MIN ? undefined : min,
          maxPrice: max === PRICE_MAX ? undefined : max,
        });
      }, 400);
    },
    [onFiltersChange],
  );

  const isPriceActive = filters.minPrice != null || filters.maxPrice != null;

  // Helper: Check if a root category should be highlighted
  const isRootCategoryActive = useCallback((rootId: string): boolean => {
    if (selectedCategoryId === rootId) return true;
    if (rootId && selectedCategoryId && selectedCategoryId !== "all") {
      const selectedCat = categories.find((c) => c._id === selectedCategoryId);
      return selectedCat?.parentId === rootId;
    }
    return false;
  }, [selectedCategoryId, categories]);

  // Memoized category buttons - only re-render when categories, subcategories, or selections change
  const categoryButtons = useMemo(() => {
    return rootCategories.map((cat) => {
      const isActive = isRootCategoryActive(cat._id);
      const isExpanded = expandedParentId === cat._id;
      const hasSubcategories = subcategories.length > 0 && isExpanded;

      return (
        <div key={cat._id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onCategorySelect(cat._id);
              setExpandedParentId(cat._id);
            }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {cat.name}
          </button>
          {isExpanded && subcategories.length > 0 && (
            <div className="ml-2 space-y-0.5 border-l-2 border-primary/20 pl-3">
              {subcategories.map((sub) => (
                <button
                  key={sub._id}
                  type="button"
                  onClick={() => {
                    onCategorySelect(sub._id);
                    onSubcategorySelect?.();
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selectedCategoryId === sub._id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    });
  }, [rootCategories, selectedCategoryId, expandedParentId, subcategories, isRootCategoryActive, onCategorySelect]);

  const activeCount = [
    filters.categoryId !== "all",
    filters.brandId !== "all",
    filters.minPrice != null,
    filters.maxPrice != null,
    filters.minRating != null,
    filters.discountMin != null,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5 py-1 pr-1 scrollbar-hide">
      {/* Header with reset button */}
      <div className="flex items-center justify-between pb-1 border-b border-border">
        <span className="text-sm font-semibold text-foreground flex items-center gap-2">
          Filters
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
              {activeCount}
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={activeCount === 0}
          onClick={onClearFilters}
          className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          Reset all
        </Button>
      </div>
      {/* Departments / Categories */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <LayoutGrid className="h-4 w-4 text-primary/80" />
          Categories
        </h3>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onCategorySelect("all")}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              selectedCategoryId === "all"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            All Categories
          </button>
          {categoryButtons}
        </div>
      </section>

      {/* Price */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IndianRupee className="h-4 w-4 text-primary/80" />
            Price Range
          </h3>
          {isPriceActive && (
            <button
              type="button"
              onClick={() => {
                setSliderValues([PRICE_MIN, PRICE_MAX]);
                onFiltersChange({ minPrice: undefined, maxPrice: undefined });
              }}
              className="text-xs text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <Slider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={5000}
          value={sliderValues}
          onValueChange={handleSliderChange}
          className="mt-2 mb-4"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className={isPriceActive && sliderValues[0] > PRICE_MIN ? "text-primary font-medium" : ""}>
            ₹{formatPrice(sliderValues[0])}
          </span>
          <span className={isPriceActive && sliderValues[1] < PRICE_MAX ? "text-primary font-medium" : ""}>
            ₹{formatPrice(sliderValues[1])}
          </span>
        </div>
      </section>

      {/* Brand */}
      {brandsList.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Tag className="h-4 w-4 text-primary/80" />
            Brand
          </h3>
          <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-hide">
            {brandsList.map((b) => {
              const isActive = filters.brandId === b._id;
              return (
                <div
                  key={b._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onFiltersChange({ brandId: isActive ? "all" : b._id })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onFiltersChange({ brandId: isActive ? "all" : b._id });
                    }
                  }}
                  className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Checkbox checked={isActive} className="pointer-events-none shrink-0" />
                  <span>{b.name}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Customer reviews */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Star className="h-4 w-4 text-primary/80" />
          Customer reviews
        </h3>
        <div className="space-y-1">
          {RATINGS.map((r) => {
            const isActive = filters.minRating === r.value;
            return (
              <div
                key={r.value}
                role="button"
                tabIndex={0}
                onClick={() =>
                  onFiltersChange({
                    minRating: isActive ? undefined : r.value,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFiltersChange({
                      minRating: isActive ? undefined : r.value,
                    });
                  }
                }}
                className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Checkbox checked={isActive} className="pointer-events-none shrink-0" />
                <span className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${
                        i <= r.value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50"
                      }`}
                    />
                  ))}
                </span>
                <span className="ml-1">& Up</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Discounts */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Percent className="h-4 w-4 text-primary/80" />
          Discounts
        </h3>
        <div className="space-y-1">
          {DISCOUNTS.map((d) => {
            const isActive = filters.discountMin === d.value;
            return (
              <div
                key={d.value}
                role="button"
                tabIndex={0}
                onClick={() =>
                  onFiltersChange({
                    discountMin: isActive ? undefined : d.value,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFiltersChange({
                      discountMin: isActive ? undefined : d.value,
                    });
                  }
                }}
                className={`flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Checkbox checked={isActive} className="pointer-events-none shrink-0" />
                <Label className="cursor-pointer font-normal">{d.label}</Label>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sort */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <ArrowUpDown className="h-4 w-4 text-primary/80" />
          Sort by
        </h3>
        <Select
          value={`${filters.sortBy}-${filters.order}`}
          onValueChange={(v) => {
            const [sortBy, order] = v.split("-") as [string, "asc" | "desc"];
            onFiltersChange({ sortBy, order });
          }}
        >
          <SelectTrigger className="w-full h-9 bg-muted/50 border-border rounded-lg">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">Newest first</SelectItem>
            <SelectItem value="createdAt-asc">Oldest first</SelectItem>
            <SelectItem value="popular-desc">Popularity</SelectItem>
            <SelectItem value="defaultPrice-asc">Price: Low to High</SelectItem>
            <SelectItem value="defaultPrice-desc">Price: High to Low</SelectItem>
            <SelectItem value="title-asc">Name A–Z</SelectItem>
            <SelectItem value="title-desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
      </section>
    </div>
  );
}

// Memoize the sidebar to prevent re-renders when parent component updates
export const ProductFilterSidebar = memo(ProductFilterSidebarContent);
