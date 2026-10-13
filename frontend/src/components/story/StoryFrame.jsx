import { useEffect, useRef } from 'react'

/**
 * Scales the stage's mock-up (phone or window) to fit the space it has, so it never overflows
 * a small screen or runs under the caption. The mock-up keeps its design size; only the wrapper shrinks.
 */
function useFitStage(stageRef) {
  useEffect(() => {
    const stage = stageRef.current
    const wrap = stage?.firstElementChild
    const inner = wrap?.firstElementChild
    if (!inner) return
    const fit = () => {
      const w = inner.offsetWidth
      const h = inner.offsetHeight
      const s = Math.min(stage.clientWidth / w, stage.clientHeight / h, 1)
      wrap.style.width = `${w * s}px`
      wrap.style.height = `${h * s}px`
      inner.style.transform = s < 1 ? `scale(${s})` : ''
      inner.style.transformOrigin = 'top left'
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [stageRef])
}

/** Shared layout for one scroll chapter: step index + caption on the left, sticky stage on the right. */
export default function StoryFrame({ sectionRef, eyebrow, title, steps, children, height }) {
  const stageRef = useRef(null)
  useFitStage(stageRef)

  return (
    <section ref={sectionRef} className="story" style={{ height }}>
      <div className="story-sticky">
        <div className="story-text">
          <div className="stack" style={{ '--stack': '10px' }}>
            <span className="eyebrow ruled">{eyebrow}</span>
            <h2 className="story-title">{title}</h2>
          </div>

          <ol className="story-index" aria-label="Steps">
            <span className="rail" aria-hidden="true">
              <span className="rail-fill" />
            </span>
            {steps.map((s, i) => (
              <li key={s.title} className={`idx-${i}`}>
                <span className="mono">{String(i + 1).padStart(2, '0')}</span> {s.title}
              </li>
            ))}
          </ol>

          <div className="story-caps" aria-live="polite">
            {steps.map((s, i) => (
              <div key={s.title} className={`story-cap cap-${i}`}>
                <span className="mono copper">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="story-stage" ref={stageRef}>
          {children}
        </div>
      </div>
    </section>
  )
}
