/**
 * Shared motion language — iOS-style.
 *
 * ONE curve family: critically damped springs (zero overshoot), pure
 * deceleration into place. Elements differ only in SPEED, never in
 * character — nothing wobbles, nothing bounces, so the whole app settles
 * the same way and motion reads as one system. Exits are plain fast fades
 * (dismissal is always quicker than presentation, like iOS).
 *
 * Accessibility: `<MotionConfig reducedMotion="user">` (in providers.tsx)
 * disables transform/layout animations globally for reduced-motion users.
 * Non-transform animations (background sweeps, height, count-ups) are NOT
 * covered by that flag — components animating those must check
 * `useReducedMotion()` themselves and jump straight to the final value.
 */

export const SPRING = {
  /** Standard transition — views, sections, text, modals. */
  smooth: { type: "spring", duration: 0.45, bounce: 0 },
  /** Micro-interactions — hover, press, the sidebar pill. Same character, faster. */
  snap: { type: "spring", duration: 0.3, bounce: 0 },
  /** Data coming alive — ring arcs, count-ups. Same character, longer glide. */
  sweep: { type: "spring", duration: 0.8, bounce: 0 },
} as const

/** Standard entrance for a content block: fade + small rise, decelerating in. */
export const reveal = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: SPRING.smooth,
} as const

/** House ease for the few remaining tweens (scrims, exits). */
export const EASE_OUT: [number, number, number, number] = [0.2, 0.7, 0.2, 1]

export const DUR = {
  /** Scrims, pure fades, exits. */
  fast: 0.16,
} as const
