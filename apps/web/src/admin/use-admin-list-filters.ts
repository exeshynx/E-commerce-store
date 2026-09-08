import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useAdminListFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedPage = Number(searchParams.get('page') ?? 1);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const query = searchParams.get('q') || undefined;
  const [search, setSearch] = useState(query ?? '');

  const updateFilters = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  return { page, query, search, searchParams, setSearch, updateFilters };
};
