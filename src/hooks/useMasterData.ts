'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MasterDataType } from '@/types/master-data';

export interface MasterDataItemOption {
  _id: string;
  type: MasterDataType;
  key: string;
  label: string;
  description?: string;
  parentId?: { _id: string; label: string; key: string } | string;
  sortOrder: number;
  isActive: boolean;
  isSystemDefault: boolean;
}

// In-memory module cache to avoid repeat fetches within the same page session
const cache: Record<string, { data: MasterDataItemOption[]; timestamp: number }> = {};
const CACHE_TTL_MS = 60 * 1000; // 1 minute client cache

export function useMasterData(type: MasterDataType, options?: { parentId?: string; includeInactive?: boolean }) {
  const [items, setItems] = useState<MasterDataItemOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async (forceRefresh = false) => {
    const cacheKey = `${type}:${options?.parentId || 'all'}:${options?.includeInactive ? 'all' : 'active'}`;

    if (!forceRefresh && cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL_MS) {
      setItems(cache[cacheKey].data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const url = new URL('/api/master-data', window.location.origin);
      url.searchParams.set('type', type);
      if (options?.parentId) url.searchParams.set('parentId', options.parentId);
      if (options?.includeInactive) url.searchParams.set('includeInactive', 'true');

      const res = await fetch(url.toString());
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        cache[cacheKey] = { data: json.data, timestamp: Date.now() };
        setItems(json.data);
      } else {
        setError(json.error?.message || 'Failed to load master data');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  }, [type, options?.parentId, options?.includeInactive]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getLabel = useCallback(
    (keyOrValue: string, fallback?: string): string => {
      if (!keyOrValue) return fallback || '';
      const found = items.find(
        (i) => i.key.toLowerCase() === keyOrValue.toLowerCase() || i.label.toLowerCase() === keyOrValue.toLowerCase()
      );
      return found ? found.label : fallback || keyOrValue;
    },
    [items]
  );

  return { items, loading, error, refresh: () => fetchItems(true), getLabel };
}
