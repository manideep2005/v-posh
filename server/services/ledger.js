// Tamper-evident audit ledger.
//
// Every new audit entry stores `prevHash` (the hash of the entry before it)
// and `entryHash = sha256(prevHash + canonical payload)`. Any edit to an entry
// after the fact changes its recomputed hash, and any deletion breaks the
// prevHash link, so `verifyLedger()` can point at the first broken record.
//
// Entries written before this feature existed have no hashes — they are
// reported as `unchained` rather than as tampering.
//
// Serverless note: each lambda instance keeps the chain head in memory, so two
// concurrent instances can append siblings (a fork). Verification therefore
// reports forks explicitly instead of failing, because a fork is a deployment
// artifact, not evidence of tampering.

const crypto = require('crypto');
const db = require('../db');

const GENESIS = 'GENESIS';

let headCache = null; // { hash, createdAt, id }

/** The fields that make an entry unique — everything else is metadata. */
function canonicalPayload(entry) {
  return JSON.stringify({
    actorId: entry.actorId || null,
    actorName: entry.actorName || null,
    actorRole: entry.actorRole || null,
    action: entry.action || null,
    targetType: entry.targetType || null,
    targetId: entry.targetId || null,
    details: entry.details || null,
    createdAt: entry.createdAt || null,
  });
}

function hashOf(prevHash, entry) {
  return crypto.createHash('sha256').update(`${prevHash}|${canonicalPayload(entry)}`).digest('hex');
}

/** Short fingerprint used for display / watermarks. */
function shortHash(hash) {
  return hash ? hash.slice(0, 12) : null;
}

async function loadHeadFromDb() {
  const entries = await db.auditLogs.find();
  const chained = entries
    .filter(e => e.entryHash)
    .sort((a, b) => {
      const diff = new Date(b.createdAt) - new Date(a.createdAt);
      return diff !== 0 ? diff : String(b.id).localeCompare(String(a.id));
    });
  if (!chained.length) return { hash: GENESIS, createdAt: null, id: null };
  return { hash: chained[0].entryHash, createdAt: chained[0].createdAt, id: chained[0].id };
}

/**
 * Wrap an entry with its chain links. Safe to call on a cold start — the head
 * is loaded once and then advanced in memory.
 */
async function chainEntry(entry) {
  try {
    if (!headCache) headCache = await loadHeadFromDb();
    const prevHash = headCache.hash || GENESIS;
    const entryHash = hashOf(prevHash, entry);
    headCache = { hash: entryHash, createdAt: entry.createdAt, id: entry.id || null };
    return { ...entry, prevHash, entryHash };
  } catch (err) {
    console.error('[Ledger] chainEntry failed:', err.message);
    return entry; // never block the audit write
  }
}

/**
 * Recompute the chain. Returns counts plus any entry whose stored hash no
 * longer matches its contents (tampering) and any sibling forks.
 */
async function verifyLedger() {
  const entries = await db.auditLogs.find();
  const byHash = new Map();
  entries.forEach(e => { if (e.entryHash) byHash.set(e.entryHash, e); });

  const chained = entries.filter(e => e.entryHash);
  const legacy = entries.length - chained.length;
  const tampered = [];
  const forks = [];
  const parentCount = new Map();

  for (const entry of chained) {
    const recomputed = hashOf(entry.prevHash || GENESIS, entry);
    if (recomputed !== entry.entryHash) {
      tampered.push({
        id: entry.id,
        action: entry.action,
        createdAt: entry.createdAt,
        expected: entry.entryHash,
        recomputed,
      });
    }
    if (entry.prevHash && entry.prevHash !== GENESIS && !byHash.has(entry.prevHash)) {
      tampered.push({
        id: entry.id,
        action: entry.action,
        createdAt: entry.createdAt,
        expected: entry.prevHash,
        recomputed: null,
        reason: 'previous entry missing from the ledger',
      });
    }
    parentCount.set(entry.prevHash || GENESIS, (parentCount.get(entry.prevHash || GENESIS) || 0) + 1);
  }

  for (const [parent, count] of parentCount.entries()) {
    if (count > 1) forks.push({ parentHash: parent === GENESIS ? GENESIS : shortHash(parent), children: count });
  }

  const sorted = chained.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const head = headCache && headCache.hash ? headCache.hash : (sorted.length ? sorted[sorted.length - 1].entryHash : null);

  return {
    verified: tampered.length === 0,
    totalEntries: entries.length,
    chainedEntries: chained.length,
    unchainedEntries: legacy,
    headHash: head,
    headShort: shortHash(head),
    checkedAt: new Date().toISOString(),
    tampered,
    forks,
  };
}

/** Reset the in-memory head (used after a wipe/restore). */
function resetLedgerCache() {
  headCache = null;
}

module.exports = { chainEntry, verifyLedger, hashOf, canonicalPayload, shortHash, resetLedgerCache, GENESIS };
