// utils/cache.js
const cache = new Map();

function setCache(key, value, ttlMs = 10 * 60 * 1000) {
  // 10 minutes
  const expires = Date.now() + ttlMs;
  cache.set(key, { value, expires });
}

function getCache(key) {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (Date.now() > cached.expires) {
    cache.delete(key);
    return undefined;
  }
  return cached.value;
}

module.exports = { getCache, setCache };
