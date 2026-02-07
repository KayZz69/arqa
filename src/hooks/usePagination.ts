import { useState, useMemo, useCallback } from "react";

interface UsePaginationResult<T> {
  paginatedItems: T[];
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  resetPage: () => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function usePagination<T>(items: T[], pageSize = 25): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const paginatedItems = useMemo(() => {
    const start = currentPage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [totalPages]);

  const resetPage = useCallback(() => {
    setCurrentPage(0);
  }, []);

  return {
    paginatedItems,
    currentPage,
    totalPages,
    goToPage,
    resetPage,
    hasNextPage: currentPage < totalPages - 1,
    hasPrevPage: currentPage > 0,
  };
}
