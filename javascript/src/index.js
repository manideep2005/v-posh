'use strict'

// Legacy default host. Kept as the default when neither `environment` nor an
// explicit `baseUrl` is passed, so existing integrators aren't silently
// redirected to a different host.
const DEFAULT_BASE_URL = 'https://v1.quantanex.io'

// Named KratosID environment hosts, selected via the `environment` option.
const SANDBOX_BASE_URL = 'https://api-sandbox.kratosid.com'
const PRODUCTION_BASE_URL = 'https://api.kratosid.com'

const DEFAULT_TIMEOUT = 55000       // ms
const DEFAULT_POLL_INTERVAL = 2000  // ms
// QR login has two phases server-side: waiting for a scan, then waiting for
// approval on the scanning device - so its default timeout is longer than
// the plain push flow's.
const DEFAULT_QR_TIMEOUT = 90000    // ms

class KratosIDError extends Error {
  // Structured error codes (existing `message`/`statusCode` keep working
  // unchanged; `code` is an optional field consumers can check instead of
  // string-matching `message`).
  static USER_NOT_FOUND = 'USER_NOT_FOUND'         // "0000" sentinel: email not registered on KratosID
  static NO_PRODUCT_ACCESS = 'NO_PRODUCT_ACCESS'   // HTTP 403: user not associated with this product
  static REQUEST_FAILED = 'REQUEST_FAILED'         // any other non-2xx HTTP status

  constructor(message, statusCode = 0, code = null) {
    super(message)
    this.name = 'KratosIDError'
    this.statusCode = statusCode
    this.code = code
  }
}

class KratosIDClient {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey      - Your API key from the KratosID dashboard
   * @param {string} opts.productId   - Your product ID from the KratosID dashboard
   * @param {string} [opts.appName]   - Label shown on the user's mobile notification
   * @param {string} [opts.baseUrl]   - Override API base URL (default: https://v1.quantanex.io)
   * @param {number} [opts.timeout]   - Max wait in ms before giving up (default: 55000)
   * @param {number} [opts.pollInterval] - Poll interval in ms (default: 2000)
   */
  constructor({ apiKey, productId, appName = 'KratosID', baseUrl, environment, timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL }) {
    if (!apiKey) throw new Error('apiKey is required')
    if (!productId) throw new Error('productId is required')
    this.apiKey = apiKey
    this.productId = productId
    this.appName = appName
    this.baseUrl = KratosIDClient._resolveBaseUrl(baseUrl, environment).replace(/\/$/, '')
    this.timeout = timeout
    this.pollInterval = pollInterval
  }

  /**
   * @param {string} [baseUrl] - Explicit override. Takes priority over `environment`.
   * @param {string} [environment] - "sandbox" or "production". Ignored if baseUrl is set.
   *   Falls back to DEFAULT_BASE_URL if neither is given.
   */
  static _resolveBaseUrl(baseUrl, environment) {
    if (baseUrl) return baseUrl
    if (environment === 'sandbox') return SANDBOX_BASE_URL
    if (environment === 'production') return PRODUCTION_BASE_URL
    return DEFAULT_BASE_URL
  }

  get _headers() {
    return {
      'x-api-key': this.apiKey,
      'x-product-id': this.productId,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  }

  async _post(path, body) {
    const url = `${this.baseUrl}${path}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: this._headers,
      body: new URLSearchParams(body).toString(),
    })
    return resp
  }

  async _get(path, params) {
    const url = `${this.baseUrl}${path}?${new URLSearchParams(params).toString()}`
    const resp = await fetch(url, { method: 'GET', headers: this._headers })
    return resp
  }

  /**
   * Send a push auth request to the user's mobile device.
   * Resolves when the user approves, denies, or the request times out.
   *
   * @param {string} email
   * @param {string} [requester] - Overrides appName for this request
   * @returns {Promise<{approved: boolean, reason?: string, raw?: string}>}
   */
  async verifyUser(email, requester) {
    const label = requester || this.appName
    const resp = await this._post('/add_request', { email, data: '0000', requester: label })

    if (!resp.ok) {
      const text = await resp.text()
      const code = resp.status === 403 ? KratosIDError.NO_PRODUCT_ACCESS : KratosIDError.REQUEST_FAILED
      throw new KratosIDError(`Failed to create auth request: ${text}`, resp.status, code)
    }

    const token = (await resp.text()).trim()
    if (token.startsWith('0000')) {
      throw new KratosIDError('User not found or not registered on KratosID', 0, KratosIDError.USER_NOT_FOUND)
    }

    return this._poll(token.slice(0, 36))
  }

  async _poll(requestToken) {
    const deadline = Date.now() + this.timeout

    while (Date.now() < deadline) {
      await this._sleep(this.pollInterval)

      const resp = await this._post('/get_data', { token: requestToken })
      const status = (await resp.text()).trim()

      if (status.startsWith('pending')) continue
      if (status.startsWith('expired') || status === 'Authorization denied') {
        return { approved: false, reason: 'denied_by_user', raw: status }
      }
      if (status.startsWith('Authorization timeout')) {
        return { approved: false, reason: 'timeout', raw: status }
      }

      try {
        const data = JSON.parse(status)
        if (Array.isArray(data) && data.length > 0) return { approved: true, raw: status }
        if (data && data.Verification) return { approved: true, raw: status }
      } catch (_) {}

      return { approved: false, reason: 'unexpected_response', raw: status }
    }

    return { approved: false, reason: 'timeout', raw: '' }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Start a QR-based login session - same underlying flow as the
   * KratosID web dashboard's QR sign-in. Render `qrPayload` as a QR code
   * in your own UI; the user scans it with their KratosID mobile app and
   * approves/denies from there. Call waitForQrLogin(token) right after
   * displaying the code.
   *
   * @returns {Promise<{token: string, qrPayload: string, expiresAt: number, expiresIn: number}>}
   */
  async startQrLogin() {
    const resp = await this._post('/auth/qr/start', {})

    if (!resp.ok) {
      const text = await resp.text()
      const code = resp.status === 403 ? KratosIDError.NO_PRODUCT_ACCESS : KratosIDError.REQUEST_FAILED
      throw new KratosIDError(`Failed to start QR login: ${text}`, resp.status, code)
    }

    const data = await resp.json()
    if (data.status !== 'pending') {
      throw new KratosIDError(data.message || 'Could not start QR login')
    }

    return {
      token: data.token,
      qrPayload: data.qr_payload,
      expiresAt: data.expires_at,
      expiresIn: data.expires_in,
    }
  }

  /**
   * Poll until the QR code is scanned and approved/denied, or it expires.
   * Resolves after startQrLogin() once the QR code is on screen.
   *
   * @param {string} token
   * @param {object} [opts]
   * @param {number} [opts.timeout] - Max wait in ms before giving up (default: 90000)
   * @param {number} [opts.pollInterval] - Poll interval in ms (default: this.pollInterval)
   * @returns {Promise<{approved: boolean, reason?: string, raw?: string}>}
   */
  async waitForQrLogin(token, { timeout = DEFAULT_QR_TIMEOUT, pollInterval = this.pollInterval } = {}) {
    const deadline = Date.now() + timeout

    while (Date.now() < deadline) {
      const resp = await this._get('/auth/qr/status', { token })
      if (!resp.ok) {
        const text = await resp.text()
        const code = resp.status === 403 ? KratosIDError.NO_PRODUCT_ACCESS : KratosIDError.REQUEST_FAILED
        throw new KratosIDError(`QR status check failed: ${text}`, resp.status, code)
      }

      const data = await resp.json()
      const status = data.status

      if (status === 'approved') return { approved: true, raw: JSON.stringify(data) }
      if (status === 'denied') return { approved: false, reason: 'denied_by_user', raw: JSON.stringify(data) }
      if (status === 'expired') return { approved: false, reason: 'timeout', raw: JSON.stringify(data) }
      // "pending" (unscanned) / "claiming" / "claimed" (scanned, still
      // verifying on the phone) - keep waiting

      await this._sleep(pollInterval)
    }

    return { approved: false, reason: 'timeout', raw: '' }
  }
}

module.exports = {
  KratosIDClient,
  KratosIDError,
  DEFAULT_BASE_URL,
  SANDBOX_BASE_URL,
  PRODUCTION_BASE_URL,
}
