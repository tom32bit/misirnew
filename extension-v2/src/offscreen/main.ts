/**
 * Offscreen document — owns the on-device embedding model.
 *
 * The service worker can't hold a ~140 MB model or run sustained WASM, so all
 * embedding happens here. Messages are tagged `target: 'offscreen'` so this and
 * the service worker don't process each other's traffic.
 */
import { loadEmbedder, embedQuery, embedDocument, resetEmbedder } from '@/lib/embedder'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return false

  if (msg.type === 'SEMANTIC_LOAD') {
    // A reload forces a fresh pipeline (recover from a wedged/evicted model).
    if (msg.reload) resetEmbedder()
    loadEmbedder((p) => {
      // Broadcast download/init progress for the onboarding UI.
      chrome.runtime.sendMessage({ type: 'SEMANTIC_PROGRESS', progress: p }).catch(() => {})
    })
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }))
    return true
  }

  if (msg.type === 'SEMANTIC_EMBED') {
    const fn = msg.kind === 'document' ? embedDocument : embedQuery
    fn(String(msg.text ?? ''))
      .then((vector) => sendResponse({ ok: true, vector }))
      .catch((e) => {
        // A failed embed can leave the WASM session wedged — drop the pipeline so
        // the next attempt reloads it cleanly rather than failing forever.
        resetEmbedder()
        sendResponse({ ok: false, error: e?.message || String(e) })
      })
    return true
  }

  return false
})
