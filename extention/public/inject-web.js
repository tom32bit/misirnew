;(function () {
  'use strict'

  // ── ChatGPT — patch fetch, steal Authorization + oai-*/chatgpt-* headers ──

  const ChatGPTAuth = { authorization: null, extraHeaders: {} }

  function hookChatGPT() {
    const orig = window.fetch
    window.fetch = function (input, init) {
      try {
        const url = input instanceof Request ? input.url : String(input)
        if (url.includes('/backend-api/')) {
          const headers =
            init?.headers ??
            (input instanceof Request ? input.headers : null)
          if (headers) {
            const get = (h) =>
              headers instanceof Headers
                ? headers.get(h)
                : Array.isArray(headers)
                  ? (headers.find(([k]) => k.toLowerCase() === h.toLowerCase()) || [])[1]
                  : headers[h] ?? headers[h.toLowerCase()]

            const auth = get('Authorization') || get('authorization')
            if (auth) {
              ChatGPTAuth.authorization = auth
              console.log('[MISIR] ChatGPT auth captured:', auth.slice(0, 20) + '...')
            }

            const extra = {}
            const entries =
              headers instanceof Headers
                ? [...headers.entries()]
                : Array.isArray(headers)
                  ? headers
                  : Object.entries(headers)
            for (const [k, v] of entries) {
              const lower = k.toLowerCase()
              if (lower.startsWith('chatgpt-') || lower.startsWith('oai-')) {
                extra[k] = v
              }
            }
            if (Object.keys(extra).length) {
              ChatGPTAuth.extraHeaders = extra
              console.log('[MISIR] ChatGPT extra headers:', Object.keys(extra))
            }
          }
        }
      } catch (_) {}
      return orig.apply(this, arguments)
    }
  }

  // ── Kimi — patch fetch, steal Authorization + x-msh-* headers ────────────

  const KimiAuth = { authorization: null, extraHeaders: {} }

  function hookKimi() {
    const orig = window.fetch
    window.fetch = function (input, init) {
      try {
        const url = input instanceof Request ? input.url : String(input)
        if (url.includes('kimi.com/apiv2/')) {
          const headers =
            init?.headers ??
            (input instanceof Request ? input.headers : null)
          if (headers) {
            const get = (h) =>
              headers instanceof Headers
                ? headers.get(h)
                : Array.isArray(headers)
                  ? (headers.find(([k]) => k.toLowerCase() === h.toLowerCase()) || [])[1]
                  : headers[h] ?? headers[h.toLowerCase()]

            const auth = get('Authorization') || get('authorization')
            if (auth) {
              KimiAuth.authorization = auth
            }

            const extra = {}
            const entries =
              headers instanceof Headers
                ? [...headers.entries()]
                : Array.isArray(headers)
                  ? headers
                  : Object.entries(headers)
            for (const [k, v] of entries) {
              const lower = k.toLowerCase()
              if (lower.startsWith('x-msh-') || lower === 'x-language' || lower === 'connect-protocol-version') {
                extra[k] = v
              }
            }
            if (Object.keys(extra).length) KimiAuth.extraHeaders = extra
          }
        }
      } catch (_) {}
      return orig.apply(this, arguments)
    }
  }

  // ── Message bridge ────────────────────────────────────────────────────────

  window.addEventListener('message', function (event) {
    if (event.source !== window) return
    if (event.data?.type !== 'MISIR_GET_AUTH') return

    const { platform, requestId } = event.data
    let data = null

    if (platform === 'chatgpt') {
      data = { ...ChatGPTAuth }
    }

    if (platform === 'kimi') {
      data = { ...KimiAuth }
    }

    window.postMessage({ type: 'MISIR_AUTH_RESPONSE', platform, requestId, data }, '*')
  })

  // ── Auto-start ────────────────────────────────────────────────────────────

  if (location.hostname === 'chatgpt.com') hookChatGPT()
  if (location.hostname === 'www.kimi.com') hookKimi()
})()
