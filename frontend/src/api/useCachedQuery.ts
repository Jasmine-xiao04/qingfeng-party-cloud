import { useCallback, useEffect, useState } from "react";
import { getApiCache, refreshApiCache, setApiCache } from "./client";

export function useCachedQuery<T>(url: string | null) {
  const [data, setDataState] = useState<T | undefined>(() => (url ? getApiCache<T>(url) : undefined));
  const [loading, setLoading] = useState(() => Boolean(url && !getApiCache<T>(url)));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const setData = useCallback((next: T | undefined) => {
    setDataState(next);
    if (url && next !== undefined) setApiCache(url, next);
  }, [url]);

  const reload = useCallback(async () => {
    if (!url) return undefined;
    const cached = getApiCache<T>(url);
    if (cached !== undefined) {
      setDataState(cached);
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const fresh = await refreshApiCache<T>(url);
      setDataState(fresh);
      setError("");
      return fresh;
    } catch (error) {
      setError(error instanceof Error ? error.message : "数据加载失败");
      return cached;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, loading, refreshing, error, reload };
}
