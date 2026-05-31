import type { NextFunction, Request, Response } from "express";

type CacheEntry = {
  expiresAt: number;
  body: unknown;
};

const responseCache = new Map<string, CacheEntry>();

export function clearResponseCache() {
  responseCache.clear();
}

export function clearCacheOnMutation(req: Request, _res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD" && !req.path.startsWith("/api/auth/login")) {
    clearResponseCache();
    _res.on("finish", () => {
      if (_res.statusCode >= 200 && _res.statusCode < 300) clearResponseCache();
    });
  }
  next();
}

export function cacheGet(ttl = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET") return next();

    const userId = (req as Request & { user?: { id?: string } }).user?.id ?? "anonymous";
    const key = `${userId}:${req.originalUrl}`;
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.body);

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responseCache.set(key, { body, expiresAt: Date.now() + ttl });
      }
      return originalJson(body);
    };

    return next();
  };
}
