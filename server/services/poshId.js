'use strict';

// ---------------------------------------------------------------------------
// V-POSH ID
//
// Every account carries one short, human-readable identifier that staff and
// students can quote over the phone or on a form. It is derived from the
// institutional email so it is stable and guessable-by-its-owner:
//
//   mani.23mis7006@vitapstudent.ac.in  ->  mani7006
//   a.sharma.23bce0042@vitapstudent.ac.in -> a0042
//   presiding.officer@vitap.ac.in      -> presiding
//
// i.e. the first dotted segment of the local part, followed by the last four
// digits of the roll / employee number.
// ---------------------------------------------------------------------------

/** Last run of digits in a value, e.g. '23mis7006' -> '7006'. */
function trailingDigits(value) {
  const match = String(value || '').match(/(\d+)(?!.*\d)/);
  return match ? match[1] : '';
}

/** Short, stable base-36 hash used only when no number exists anywhere. */
function hash4(input) {
  let h = 0;
  const str = String(input || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(4, '0').slice(-4);
}

/**
 * Derive the V-POSH ID for an account. Pure: no database access.
 *
 * @param {{email?: string, name?: string, studentId?: string, employeeId?: string}} account
 * @returns {string}
 */
function derivePoshId(account = {}) {
  const { email, name, studentId, employeeId } = account;
  const local = String(email || '').split('@')[0].toLowerCase();
  const segments = local.split('.').filter(Boolean);

  const nameSource = (segments[0] || local || String(name || '').trim().split(/\s+/)[0] || '').toLowerCase();
  const namePart = nameSource.replace(/[^a-z0-9]/g, '') || 'user';

  // Roll / employee number. Prefer the explicitly stored id, then the segment
  // after the dot in the email (mani.23mis7006 -> 23mis7006).
  const candidates = [studentId, employeeId, segments.slice(1).join('.'), local, name];
  for (const candidate of candidates) {
    const digits = trailingDigits(candidate);
    if (digits) return `${namePart}${digits.slice(-4)}`;
  }

  // No number to anchor on (staff, service accounts). Fall back to the whole
  // local part rather than a random suffix, so the id stays predictable —
  // presiding.officer@vitap.ac.in -> presidingofficer.
  const joined = segments.join('').replace(/[^a-z0-9]/g, '');
  return joined || namePart || 'user';
}

/**
 * Append -2, -3, … until the candidate is free.
 *
 * @param {string} base
 * @param {(candidate: string) => Promise<boolean>} isTaken
 * @param {number} [max]
 * @returns {Promise<string>}
 */
async function resolveUniquePoshId(base, isTaken, max = 50) {
  const rooted = base || 'user';
  let candidate = rooted;
  for (let n = 2; n <= max; n++) {
    if (!(await isTaken(candidate))) return candidate;
    candidate = `${rooted}-${n}`;
  }
  return `${rooted}-${hash4(`${base}:${Date.now()}`)}`;
}

module.exports = { derivePoshId, resolveUniquePoshId, trailingDigits };
