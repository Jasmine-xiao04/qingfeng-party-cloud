import axios from "axios";

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const CACHE_TTL = 60_000;
const getCache = new Map<string, CacheEntry>();

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api",
  timeout: 20000
});

function cacheKey(url?: string) {
  const token = localStorage.getItem("qingfeng_token") ?? "";
  return `${token.slice(-16)}:${url ?? ""}`;
}

export function getApiCache<T>(url: string): T | undefined {
  return getCache.get(cacheKey(url))?.data as T | undefined;
}

export function setApiCache<T>(url: string, data: T) {
  getCache.set(cacheKey(url), { data, expiresAt: Date.now() + CACHE_TTL });
}

export function clearApiCache(prefix?: string) {
  if (!prefix) {
    getCache.clear();
    return;
  }
  for (const key of getCache.keys()) {
    if (key.includes(`:${prefix}`)) getCache.delete(key);
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("qingfeng_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if ((config.method ?? "get").toLowerCase() !== "get") clearApiCache();
  return config;
});

api.interceptors.response.use(
  (response) => response.data.data,
  (error) => {
    const message = error.response?.data?.message ?? "请求失败，请稍后重试";
    return Promise.reject(new Error(message));
  }
);

const rawGet = api.get.bind(api);

export async function refreshApiCache<T>(url: string, config?: Parameters<typeof rawGet>[1]) {
  const data = await rawGet(url, config) as T;
  setApiCache(url, data);
  return data;
}

api.get = (async (url: string, config?: Parameters<typeof rawGet>[1]) => {
  const cached = getCache.get(cacheKey(url));
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  return refreshApiCache(url, config);
}) as typeof api.get;

export function warmApiCache(urls: string[]) {
  void (async () => {
    for (const url of urls) {
      if (!getApiCache(url)) {
        await api.get(url).catch(() => undefined);
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }
  })();
}
