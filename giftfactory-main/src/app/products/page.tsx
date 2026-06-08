"use client";

import { ProductCard } from "@/components/card/main-product-card";
import { ProductCardSkeleton } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProductFilterSidebar, type ProductFiltersState } from "@/components/sections/product-filter-sidebar";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FilterIcon } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchProducts, fetchCategories, fetchBrands, fetchSubCategories } from "@/lib/api";
import { flatMapApiProductsToCards } from "@/types/api";
import type { ApiProduct, ApiCategory, ApiBrand } from "@/types/api";

const LIMIT = 12;

function getFiltersFromSearchParams(searchParams: URLSearchParams): Partial<ProductFiltersState> {
  return {
    categoryId: searchParams.get("categoryId") || "all",
    brandId: searchParams.get("brandId") || "all",
    sortBy: searchParams.get("sortBy") || "createdAt",
    order: (searchParams.get("order") as "asc" | "desc") || "desc",
    minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
    maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    minRating: searchParams.get("minRating") ? Number(searchParams.get("minRating")) : undefined,
    discountMin: searchParams.get("discountMin") ? Number(searchParams.get("discountMin")) : undefined,
  };
}

function buildSearchParams(f: ProductFiltersState & { search?: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (f.categoryId && f.categoryId !== "all") p.set("categoryId", f.categoryId);
  if (f.brandId && f.brandId !== "all") p.set("brandId", f.brandId);
  if (f.search) p.set("search", f.search);
  if (f.sortBy) p.set("sortBy", f.sortBy);
  if (f.order) p.set("order", f.order);
  if (f.minPrice != null) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice != null) p.set("maxPrice", String(f.maxPrice));
  if (f.minRating != null) p.set("minRating", String(f.minRating));
  if (f.discountMin != null) p.set("discountMin", String(f.discountMin));
  return p;
}

function ProductListPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [filters, setFilters] = useState<ProductFiltersState>(() => ({
    categoryId: "all",
    brandId: "all",
    sortBy: "createdAt",
    order: "desc",
    ...getFiltersFromSearchParams(searchParams),
  }));
  const [search, setSearch] = useState(searchParams.get("search") || "");

  // Sync from URL on mount / when URL changes (e.g. back button)
  useEffect(() => {
    const fromUrl = getFiltersFromSearchParams(searchParams);
    setFilters((prev) => ({ ...prev, ...fromUrl }));
    setSearch(searchParams.get("search") || "");
  }, [searchParams]);

  const updateFilters = useCallback(
    (updates: Partial<ProductFiltersState>) => {
      const next = { ...filters, ...updates };
      setFilters(next);
      const params = buildSearchParams({ ...next, search });
      const q = params.toString();
      router.replace(q ? `?${q}` : "/products", { scroll: false });
    },
    [filters, search, router]
  );


  const clearFilters = useCallback(() => {
    setFilters({
      categoryId: "all",
      brandId: "all",
      sortBy: "createdAt",
      order: "desc",
    });
    router.replace(search ? `/products?search=${encodeURIComponent(search)}` : "/products", { scroll: false });
  }, [router, search]);

  const hasActiveFilters =
    filters.categoryId !== "all" ||
    filters.brandId !== "all" ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    filters.minRating != null ||
    filters.discountMin != null;

  const { data: categoriesRes } = useQuery({
    queryKey: ["web", "categories"],
    queryFn: fetchCategories,
    staleTime: 10 * 60_000, // categories rarely change
  });
  const categories = (categoriesRes?.data ?? []) as ApiCategory[];
  const rootCategoryId = useMemo(() => {
    if (filters.categoryId === "all") return null;
    const cat = categories.find((c) => c._id === filters.categoryId);
    if (cat?.parentId) return cat.parentId as string;
    const isRoot = categories.some((c) => c._id === filters.categoryId && !c.parentId);
    return isRoot ? filters.categoryId : null;
  }, [filters.categoryId, categories]);

  const { data: subcategoriesRes } = useQuery({
    queryKey: ["web", "categories", "sub", rootCategoryId],
    queryFn: () => fetchSubCategories(rootCategoryId!),
    enabled: !!rootCategoryId,
  });
  const subcategories = (subcategoriesRes?.data ?? []) as ApiCategory[];

  const { data: brandsRes } = useQuery({
    queryKey: ["web", "brands"],
    queryFn: fetchBrands,
    staleTime: 10 * 60_000, // brands rarely change
  });
  const brands = (brandsRes?.data ?? []) as ApiBrand[];

  const onCategorySelect = useCallback(
    (categoryId: string) => {
      updateFilters({ categoryId });
    },
    [updateFilters]
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: [
      "web",
      "products",
      filters.sortBy,
      filters.order,
      filters.categoryId,
      filters.brandId,
      search,
      filters.minPrice,
      filters.maxPrice,
      filters.minRating,
      filters.discountMin,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetchProducts({
        page: pageParam,
        limit: LIMIT,
        sortBy: filters.sortBy,
        order: filters.order,
        categoryId: filters.categoryId === "all" ? undefined : filters.categoryId,
        brandId: filters.brandId === "all" ? undefined : filters.brandId,
        search: search || undefined,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minRating: filters.minRating,
        discountMin: filters.discountMin,
      });
      return { data: (res.data ?? []) as ApiProduct[], meta: res.meta };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage.meta;
      if (!meta || meta.page >= meta.totalPages) return undefined;
      return meta.page + 1;
    },
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allProducts = data?.pages.flatMap((p) => p.data) ?? [];

  const fallbackCategoryName = useMemo(() => {
    if (filters.categoryId === "all") return null;
    const prod = allProducts.find((p) => {
      const cat = p.categoryId;
      if (typeof cat === "object" && cat !== null && "_id" in cat) {
        return cat._id === filters.categoryId;
      }
      return false;
    });
    if (prod && typeof prod.categoryId === "object" && prod.categoryId !== null && "name" in prod.categoryId) {
      return prod.categoryId.name;
    }
    return null;
  }, [allProducts, filters.categoryId]);

  const displayProducts = useMemo(() => {
    let mapped = flatMapApiProductsToCards(allProducts as ApiProduct[], true);
    if (filters.minPrice != null) mapped = mapped.filter((p) => p.price >= filters.minPrice!);
    if (filters.maxPrice != null) mapped = mapped.filter((p) => p.price <= filters.maxPrice!);
    if (filters.minRating != null) {
      mapped = mapped.filter((p) => p.rating >= filters.minRating!);
    }
    if (filters.discountMin != null) {
      mapped = mapped.filter((p) => p.discountPercentage >= filters.discountMin!);
    }

    // Preserve correct ordering after variant flattening: sort by final card price.
    if (filters.sortBy === "defaultPrice") {
      mapped = [...mapped].sort((a, b) => {
        const ap = Number(a.price ?? 0);
        const bp = Number(b.price ?? 0);
        return filters.order === "asc" ? ap - bp : bp - ap;
      });
    }

    return mapped;
  }, [allProducts, filters.minPrice, filters.maxPrice, filters.minRating, filters.discountMin, filters.sortBy, filters.order]);

  const filterSidebar = (
    <ProductFilterSidebar
      filters={filters}
      onFiltersChange={updateFilters}
      onCategorySelect={onCategorySelect}
      onSubcategorySelect={() => setFilterSheetOpen(false)}
      selectedCategoryId={filters.categoryId}
      rootCategoryId={rootCategoryId}
      onClearFilters={clearFilters}
    />
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden lg:block w-72 shrink-0 border-r border-border bg-muted/30 p-4">
        {filterSidebar}
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            {filters.categoryId !== "all"
              ? categories.find((c) => c._id === filters.categoryId)?.name ||
              subcategories.find((c) => c._id === filters.categoryId)?.name ||
              fallbackCategoryName ||
              "Products"
              : "All Products"}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
            <Select
              value={`${filters.sortBy}-${filters.order}`}
              onValueChange={(value) => {
                const [sortBy, order] = value.split("-") as [string, "asc" | "desc"];
                updateFilters({ sortBy, order });
              }}
            >
              <SelectTrigger className="w-[200px] bg-background border-border">
                <SelectValue placeholder="Sort by" />
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
              <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button 
                  size="icon" 
                  variant="outline"
                >
                  <FilterIcon className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[320px] overflow-y-auto">
                <SheetTitle className="sr-only">Filters</SheetTitle>
                {filterSidebar}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Mobile Filter Pills */}
        <div className="lg:hidden mb-4 flex flex-wrap gap-2 items-center">
          {filters.categoryId !== "all" && (
            (() => {
              const rootCat = categories.find((c) => c._id === filters.categoryId);
              const subCat = subcategories.find((c) => c._id === filters.categoryId);
              const parentCatId = rootCat?.parentId || rootCat?._id;
              const parentCat = categories.find((c) => c._id === parentCatId);
              const displayName = subCat 
                ? `${parentCat?.name || ""} > ${subCat.name}`.trim()
                : rootCat?.name || fallbackCategoryName || "Category";
              return (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => updateFilters({ categoryId: "all" })}
            >
              {displayName}
              <span className="text-xs">×</span>
            </Button>
              );
            })()
          )}
          {filters.brandId !== "all" && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => updateFilters({ brandId: "all" })}
            >
              {brands.find((b) => b._id === filters.brandId)?.name || "Brand"}
              <span className="text-xs">×</span>
            </Button>
          )}
          {filters.minPrice != null && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => updateFilters({ minPrice: undefined })}
            >
              Min: ₹{filters.minPrice}
              <span className="text-xs">×</span>
            </Button>
          )}
          {filters.maxPrice != null && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => updateFilters({ maxPrice: undefined })}
            >
              Max: ₹{filters.maxPrice}
              <span className="text-xs">×</span>
            </Button>
          )}
          {filters.minRating != null && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => updateFilters({ minRating: undefined })}
            >
              Rating: {filters.minRating}★+
              <span className="text-xs">×</span>
            </Button>
          )}
          {filters.discountMin != null && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-3 text-xs gap-1.5"
              onClick={() => updateFilters({ discountMin: undefined })}
            >
              Discount: {filters.discountMin}%+
              <span className="text-xs">×</span>
            </Button>
          )}
          {!hasActiveFilters && (
            <div className="text-xs text-muted-foreground">
              Filters (tap + icon to add)
            </div>
          )}
        </div>


        {isError && (
          <div className="text-center text-destructive py-8">
            Error loading products: {(error as Error).message}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
              {displayProducts.map((product) => (
                <ProductCard key={product.preVariantId ? `${product.id}-${product.preVariantId}` : product.id} product={product} className="w-full" />
              ))}
            </div>

            <div ref={loadMoreRef} className="h-12 my-4 flex items-center justify-center">
              {isFetchingNextPage && (
                <span className="text-sm text-muted-foreground">Loading more...</span>
              )}
            </div>

            {!hasNextPage && displayProducts.length > 0 && (
              <p className="text-center text-muted-foreground mt-4 pb-8">
                You&apos;ve reached the end of products
              </p>
            )}

            {displayProducts.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">No products found.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      categoryId: "all",
                      brandId: "all",
                      minPrice: undefined,
                      maxPrice: undefined,
                      minRating: undefined,
                      discountMin: undefined,
                    }));
                    router.replace("/products");
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function ProductListPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-background">
          <main className="flex-1 p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </main>
        </div>
      }
    >
      <ProductListPageContent />
    </Suspense>
  );
}
