'use strict';

// ---------------------------------------------------------------------------
// KratosID QR payload shaping
//
// KratosID's /auth/qr/start hands us the string we are meant to render as the
// QR code. The vendor SDK's own instruction is to render `qrPayload` verbatim,
// which is what we do by default ("asis").
//
// The mobile app is the only thing that reads this string, and it is the only
// component we cannot inspect: when it rejects a scan it shows a generic
// "invalid" and never reports why. These variants exist so that rejection can
// be narrowed down from our side without a code change — start a QR session
// with ?qrVariant=rebrand (or set KRATOSID_QR_VARIANT) and watch whether the
// app moves the token past "pending":
//
//   asis    - verbatim from Kratos (default, and what the SDK documents)
//   compact - same JSON, no insignificant whitespace
//   rebrand - JSON with the payload type renamed to kratosid.qr_login;
//             Kratos still brands it "quantanex", the app is "KratosID"
//   token   - the bare token string instead of a JSON envelope
//   url     - the claim endpoint as a URL containing the token
// ---------------------------------------------------------------------------

const ASCII_SAFE_VARIANTS = ['asis', 'compact', 'rebrand', 'token', 'url'];

function parsePayload(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

/**
 * @param {string} rawPayload - exactly what Kratos returned as `qr_payload`
 * @param {{variant?: string, token?: string, baseUrl?: string, type?: string}} [opts]
 * @returns {string} the string to render as a QR code
 */
function shapeQrPayload(rawPayload, opts = {}) {
  const { token = '', baseUrl = '', type = '' } = opts;
  const variant = ASCII_SAFE_VARIANTS.includes(opts.variant) ? opts.variant : 'asis';
  const parsed = parsePayload(rawPayload);
  const effectiveToken = (parsed && parsed.token) || token || '';

  // An explicit type only makes sense on a JSON envelope.
  const withType = (obj) => (type ? { ...obj, type } : obj);

  switch (variant) {
    case 'compact':
      return parsed ? JSON.stringify(withType(parsed)) : String(rawPayload);
    case 'rebrand':
      return parsed ? JSON.stringify(withType({ ...parsed, type: 'kratosid.qr_login' })) : String(rawPayload);
    case 'token':
      return effectiveToken || String(rawPayload);
    case 'url':
      return `${String(baseUrl).replace(/\/+$/, '')}/auth/qr/claim?token=${encodeURIComponent(effectiveToken)}`;
    default:
      // "asis": render verbatim, but still honour an explicit type override.
      if (parsed && type) return JSON.stringify(withType(parsed));
      return String(rawPayload);
  }
}

/** The `type` field inside a Kratos payload, for logging/diagnostics. */
function payloadType(rawPayload) {
  const parsed = parsePayload(rawPayload);
  return parsed && typeof parsed.type === 'string' ? parsed.type : null;
}

module.exports = { shapeQrPayload, payloadType, QR_PAYLOAD_VARIANTS: ASCII_SAFE_VARIANTS };
