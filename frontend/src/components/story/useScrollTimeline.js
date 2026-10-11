import { useEffect } from 'react'
import { createTimeline, onScroll } from 'animejs'

/**
 * Builds an anime.js timeline whose playhead follows the scroll position through `ref`
 * (a tall section with a sticky stage inside). `build(tl, $)` adds the tweens; `$` queries
 * inside the section only, so the two chapters can't animate each other's elements.
 */
export function useScrollTimeline(ref, build) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const $ = (sel) => root.querySelectorAll(sel)
    const tl = createTimeline({
      autoplay: onScroll({ target: root, enter: 'top top', leave: 'bottom bottom', sync: reduce ? true : 0.75 }), // 0.75 ≈ catch up 16% per frame: smooth but responsive
      defaults: { ease: 'inOutQuad', duration: 400 },
    })
    build(tl, $)
    return () => tl.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** Adds a caption that fades in for its step, and its index entry that lights up. */
export function captions(tl, $, steps, stepLen) {
  steps.forEach((_, i) => {
    const start = i * stepLen
    const last = i === steps.length - 1
    // Out before the next one comes in, so two captions never overlap
    tl.add($(`.cap-${i}`), { opacity: [0, 1], translateY: [12, 0], duration: 300 }, start)
    if (!last) tl.add($(`.cap-${i}`), { opacity: [1, 0], translateY: [0, -12], duration: 200 }, start + stepLen - 220)
    tl.add($(`.idx-${i}`), { opacity: [0.35, 1], duration: 200 }, Math.max(0, start - 50))
    if (!last) tl.add($(`.idx-${i}`), { opacity: [1, 0.35], duration: 200 }, start + stepLen - 50)
  })
  tl.add($('.rail-fill'), { scaleY: [0, 1], ease: 'linear', duration: steps.length * stepLen }, 0)
}

/** A finger tap: the dot appears, presses, and fades. */
export function tap(tl, el, at) {
  tl.add(el, { opacity: [0, 1, 1, 0], scale: [1.6, 1, 0.85, 1.2], duration: 450 }, at)
}
