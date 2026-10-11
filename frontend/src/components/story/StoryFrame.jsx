/** Shared layout for one scroll chapter: step index + caption on the left, sticky stage on the right. */
export default function StoryFrame({ sectionRef, eyebrow, title, steps, children, height }) {
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
        <div className="story-stage">{children}</div>
      </div>
    </section>
  )
}
