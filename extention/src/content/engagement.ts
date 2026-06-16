import type { EngagementLevel } from '@/types'

const READING_WPM = 250 // average reading speed
const DEEP_DWELL_MS = 120_000 // 2 min
const ACTIVE_DWELL_MS = 30_000 // 30 s
const SCROLL_THROTTLE_MS = 150

export class EngagementTracker {
  private activeStart: number | null = null
  private totalActiveMs = 0
  private maxScrollDepth = 0
  private readonly wordCount: number
  private scrollTimer: ReturnType<typeof setTimeout> | null = null

  // Stored as named references so destroy() can remove them
  private readonly onVisibilityChange = () => {
    document.visibilityState === 'visible' ? this.resume() : this.pause()
  }

  private readonly onScroll = () => {
    if (this.scrollTimer) return
    this.scrollTimer = setTimeout(() => {
      this.tickScroll()
      this.scrollTimer = null
    }, SCROLL_THROTTLE_MS)
  }

  constructor(wordCount: number) {
    this.wordCount = wordCount
    this.init()
  }

  private init(): void {
    if (document.visibilityState === 'visible') this.resume()
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('scroll', this.onScroll, { passive: true })
  }

  private resume(): void {
    if (this.activeStart === null) this.activeStart = Date.now()
  }

  private pause(): void {
    if (this.activeStart !== null) {
      this.totalActiveMs += Date.now() - this.activeStart
      this.activeStart = null
    }
  }

  private tickScroll(): void {
    const docH = document.documentElement.scrollHeight
    const viewH = window.innerHeight
    const maxScroll = docH - viewH
    if (maxScroll <= 0) return
    const depth = Math.min(window.scrollY / maxScroll, 1.0)
    if (depth > this.maxScrollDepth) this.maxScrollDepth = depth
  }

  get dwellTimeMs(): number {
    const current = this.activeStart !== null ? Date.now() - this.activeStart : 0
    return this.totalActiveMs + current
  }

  get scrollDepth(): number {
    return Math.round(this.maxScrollDepth * 1000) / 1000
  }

  // reading_depth: fraction of content actually read, weighted by pace.
  // Can exceed 1.0 (up to 1.5) when user re-reads or reads very carefully.
  get readingDepth(): number {
    if (this.wordCount === 0 || this.maxScrollDepth === 0) return 0
    const estimatedReadMs = (this.wordCount / READING_WPM) * 60_000
    const pace = Math.min(this.dwellTimeMs / estimatedReadMs, 1.5)
    return Math.min(parseFloat((pace * this.maxScrollDepth).toFixed(3)), 1.5)
  }

  get engagementLevel(): EngagementLevel {
    if (this.dwellTimeMs >= DEEP_DWELL_MS && this.maxScrollDepth >= 0.7) return 'deep'
    if (this.dwellTimeMs >= ACTIVE_DWELL_MS) return 'active'
    if (this.maxScrollDepth > 0) return 'passive'
    return 'latent'
  }

  // Compute the allowed base_weight upgrade based on engagement
  get baseWeight(): 0.2 | 1.0 | 2.0 {
    const level = this.engagementLevel
    if (level === 'deep') return 2.0
    if (level === 'active') return 1.0
    return 0.2
  }

  snapshot() {
    return {
      dwellTimeMs: this.dwellTimeMs,
      scrollDepth: this.scrollDepth,
      readingDepth: this.readingDepth,
      engagementLevel: this.engagementLevel,
      baseWeight: this.baseWeight,
    }
  }

  destroy(): void {
    this.pause()
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('scroll', this.onScroll)
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer)
      this.scrollTimer = null
    }
  }
}
