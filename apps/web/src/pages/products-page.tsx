import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ProductCard, ProductCardSkeleton } from '../components/product-card';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { catalogApi } from '../lib/catalog-api';
import { discoveryApi, discoveryQueryKeys, type SearchParameters } from '../lib/discovery-api';

const numberParameter = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export const ProductsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const deferredSearch = useDeferredValue(search.trim());
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const minimumPrice = numberParameter(searchParams.get('minPrice'));
  const maximumPrice = numberParameter(searchParams.get('maxPrice'));
  const minimumRating = numberParameter(searchParams.get('rating'));
  const parameters: SearchParameters = {
    availability: (searchParams.get('availability') as SearchParameters['availability']) ?? 'all',
    page,
    pageSize: 12,
    sort: (searchParams.get('sort') as SearchParameters['sort']) ?? 'relevance',
    ...(searchParams.get('category') ? { category: searchParams.get('category')! } : {}),
    ...(minimumPrice !== undefined ? { minimumPrice } : {}),
    ...(maximumPrice !== undefined ? { maximumPrice } : {}),
    ...(minimumRating !== undefined ? { minimumRating } : {}),
    ...(searchParams.get('q') ? { q: searchParams.get('q')! } : {}),
  };
  const categories = useQuery({
    queryFn: catalogApi.getCategories,
    queryKey: ['catalog', 'categories'],
  });
  const products = useQuery({
    queryFn: () => discoveryApi.search(parameters),
    queryKey: discoveryQueryKeys.search(parameters),
  });
  const suggestions = useQuery({
    enabled: deferredSearch.length >= 2,
    queryFn: () => discoveryApi.autocomplete(deferredSearch),
    queryKey: discoveryQueryKeys.suggestions(deferredSearch),
    staleTime: 30_000,
  });
  const updateFilters = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    updateFilters({ q: search.trim() || undefined });
    setActiveSuggestion(-1);
  };
  const handleSearchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    const items = suggestions.data?.items ?? [];
    if (!items.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(items.length - 1, current + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(-1, current - 1));
    }
    if (event.key === 'Escape') setActiveSuggestion(-1);
    if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      void navigate(`/products/${items[activeSuggestion]!.slug}`);
    }
  };
  return (
    <>
      <Helmet>
        <title>Shop the collection — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-7xl">
          <SiteHeader />
          <section className="py-14 sm:py-20">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div>
                <p className="text-champagne text-xs font-semibold tracking-[0.24em] uppercase">
                  The collection
                </p>
                <h1 className="font-display mt-4 text-5xl sm:text-6xl">Find your next piece.</h1>
              </div>
              <form className="relative w-full max-w-lg" onSubmit={submitSearch} role="search">
                <label className="sr-only" htmlFor="catalog-search">
                  Search products
                </label>
                <div className="flex gap-2">
                  <input
                    aria-autocomplete="list"
                    aria-activedescendant={
                      activeSuggestion >= 0
                        ? `search-suggestion-${suggestions.data?.items[activeSuggestion]?.id}`
                        : undefined
                    }
                    aria-controls="search-suggestions"
                    aria-expanded={Boolean(suggestions.data?.items.length)}
                    className="border-ink/15 min-w-0 flex-1 rounded-full border bg-white px-5 py-3"
                    id="catalog-search"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setActiveSuggestion(-1);
                    }}
                    onKeyDown={handleSearchKeys}
                    placeholder="Search by name or SKU"
                    role="combobox"
                    value={search}
                  />
                  <button
                    className="bg-ink rounded-full px-6 text-xs font-semibold text-white uppercase"
                    type="submit"
                  >
                    Search
                  </button>
                </div>
                {deferredSearch.length >= 2 && suggestions.data?.items.length ? (
                  <ul
                    className="absolute top-full right-0 left-0 z-20 mt-2 overflow-hidden rounded-2xl border bg-white shadow-xl"
                    id="search-suggestions"
                    role="listbox"
                  >
                    {suggestions.data.items.map((item, index) => (
                      <li
                        aria-selected={index === activeSuggestion}
                        id={`search-suggestion-${item.id}`}
                        key={item.id}
                        role="option"
                      >
                        <Link
                          className={`block px-5 py-3 text-sm ${index === activeSuggestion ? 'bg-mist' : ''}`}
                          to={`/products/${item.slug}`}
                        >
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-ink/45 ml-2">{item.categoryName}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </form>
            </div>
            <div
              className="border-ink/10 mt-10 grid gap-4 rounded-2xl border bg-white/60 p-4 sm:grid-cols-2 lg:grid-cols-6"
              aria-label="Product filters"
            >
              <label className="text-xs font-semibold uppercase">
                Category
                <select
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal normal-case"
                  value={parameters.category ?? ''}
                  onChange={(event) => updateFilters({ category: event.target.value || undefined })}
                >
                  <option value="">All</option>
                  {categories.data?.items.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase">
                Min price
                <input
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
                  min="0"
                  type="number"
                  defaultValue={searchParams.get('minPrice') ?? ''}
                  onBlur={(event) => updateFilters({ minPrice: event.target.value || undefined })}
                />
              </label>
              <label className="text-xs font-semibold uppercase">
                Max price
                <input
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
                  min="0"
                  type="number"
                  defaultValue={searchParams.get('maxPrice') ?? ''}
                  onBlur={(event) => updateFilters({ maxPrice: event.target.value || undefined })}
                />
              </label>
              <label className="text-xs font-semibold uppercase">
                Rating
                <select
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal normal-case"
                  value={searchParams.get('rating') ?? ''}
                  onChange={(event) => updateFilters({ rating: event.target.value || undefined })}
                >
                  <option value="">Any</option>
                  {[4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}+ stars
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase">
                Availability
                <select
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal normal-case"
                  value={parameters.availability}
                  onChange={(event) =>
                    updateFilters({
                      availability: event.target.value === 'all' ? undefined : event.target.value,
                    })
                  }
                >
                  <option value="all">All</option>
                  <option value="in_stock">In stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase">
                Sort
                <select
                  className="mt-2 w-full rounded-lg border px-3 py-2 font-normal normal-case"
                  value={parameters.sort}
                  onChange={(event) => updateFilters({ sort: event.target.value })}
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                  <option value="best_selling">Best selling</option>
                  <option value="highest_rated">Highest rated</option>
                  <option value="price_low">Lowest price</option>
                  <option value="price_high">Highest price</option>
                </select>
              </label>
            </div>
            {products.isPending ? (
              <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <ProductCardSkeleton key={index} />
                ))}
              </div>
            ) : null}
            {products.isError ? (
              <div className="mt-12 rounded-2xl bg-red-50 p-6 text-red-800" role="alert">
                {getApiErrorMessage(products.error)}{' '}
                <button
                  className="ml-2 underline"
                  onClick={() => void products.refetch()}
                  type="button"
                >
                  Try again
                </button>
              </div>
            ) : null}
            {products.data?.items.length === 0 ? (
              <div className="border-ink/10 mt-12 rounded-3xl border p-12 text-center">
                <h2 className="font-display text-4xl">No pieces found.</h2>
                <Link className="mt-5 inline-block underline" to="/products">
                  Clear filters
                </Link>
              </div>
            ) : null}
            {products.data?.items.length ? (
              <>
                <p className="text-ink/45 mt-8 text-sm">
                  {products.data.pagination.totalItems} results
                </p>
                <div className="mt-7 grid gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                  {products.data.items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                <nav
                  className="mt-14 flex items-center justify-center gap-5"
                  aria-label="Product pagination"
                >
                  <button
                    className="rounded-full border px-5 py-2.5 disabled:opacity-30"
                    disabled={page <= 1}
                    onClick={() => updateFilters({ page: String(page - 1) })}
                    type="button"
                  >
                    Previous
                  </button>
                  <span aria-live="polite">
                    Page {page} of {Math.max(1, products.data.pagination.totalPages)}
                  </span>
                  <button
                    className="rounded-full border px-5 py-2.5 disabled:opacity-30"
                    disabled={page >= products.data.pagination.totalPages}
                    onClick={() => updateFilters({ page: String(page + 1) })}
                    type="button"
                  >
                    Next
                  </button>
                </nav>
              </>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
