const db = require('../db');
const config = require('../config');

// Simple fixed-window rate limiter keyed by IP + route bucket.
// Prevents credential stuffing and brute-force attempts on auth endpoints.
const attempts = new Map(); // key -> { count, windowStart }

function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, key } = {}) {
  // periodic cleanup so the Map does not grow unbounded
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of attempts) {
      if (now - v.windowStart > windowMs) attempts.delete(k);
    }
  }, windowMs).unref();

  return function rateLimitMiddleware(req, res, next) {
    const bucket = key || req.path;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const mapKey = `${ip}:${bucket}`;
    const now = Date.now();

    let entry = attempts.get(mapKey);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { count: 0, windowStart: now };
      attempts.set(mapKey, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please wait a few minutes before trying again.',
        retryAfter: retryAfterSec
      });
    }

    next();
  };
}

module.exports = { rateLimit };
