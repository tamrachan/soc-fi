import { CHECKS, CLAIM_STATUS_META, PAYMENT_STATUS_META } from '../data/schema.js'

const ICONS = {
  check: 'M4 10.5l3.5 3.5L16 5.5',
  x: 'M5 5l10 10M15 5L5 15',
  arrow: 'M4 10h12M11 5l5 5-5 5',
  back: 'M16 10H4M9 5l-5 5 5 5',
  upload: 'M10 13V3M5.5 7.5L10 3l4.5 4.5M3.5 13v3.5h13V13',
  alert: 'M10 3l7.5 13h-15L10 3zM10 8.5v3.5M10 14.2v.3',
  external: 'M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8',
  home: 'M3 9.5L10 4l7 5.5V16h-5v-4H8v4H3z',
  list: 'M7 5.5h10M7 10h10M7 14.5h10M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01',
  camera: 'M2.5 7h3.2L7.3 4.8h5.4L14.3 7h3.2v9h-15zM10 13.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2z',
  inbox: 'M3 11l2-6h10l2 6v5H3zM3 11h4l1 2h4l1-2h4',
  user: 'M10 10a3 3 0 100-6 3 3 0 000 6zM4 17c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5',
  users: 'M7.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2.5 16c.6-2.5 2.6-3.8 5-3.8s4.4 1.3 5 3.8M13 4.2a2.5 2.5 0 010 4.6M14.6 12.4c1.5.5 2.5 1.7 2.9 3.6',
  image: 'M3 4h14v12H3zM3 13l4-4 3 3 2-2 5 5M13 8h.01',
}

export function Icon({ name, size = 16, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

export function StatusPill({ status }) {
  const meta = CLAIM_STATUS_META[status] ?? { label: status, tone: 'neutral' }
  return <span className={`pill tone-${meta.tone}`}>{meta.label}</span>
}

export function PaymentPill({ status }) {
  const meta = PAYMENT_STATUS_META[status] ?? { label: status, tone: 'neutral' }
  return <span className={`pill tone-${meta.tone}`}>{meta.label}</span>
}

export function PageHead({ eyebrow, title, lede, children }) {
  return (
    <header className="page-head">
      <div className="stack">
        {eyebrow && <div className="eyebrow ruled">{eyebrow}</div>}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </header>
  )
}

export function Notice({ tone = 'copper', title, children, action }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'rose' ? 'alert' : undefined}>
      <span className="notice-bar" />
      <div style={{ flex: 1 }}>
        {title && <strong>{title}</strong>}
        {children}
      </div>
      {action}
    </div>
  )
}

export function ErrorText({ error }) {
  if (!error) return null
  return <p className="error-text" role="alert">{error.message ?? String(error)}</p>
}

export function Checks({ validation }) {
  if (!validation) return null
  const byId = Object.fromEntries(validation.checks.map((c) => [c.id, c]))
  return (
    <ul className="checks">
      {CHECKS.map(({ id, label }) => {
        const c = byId[id]
        if (!c) return null
        return (
          <li key={id} className={c.passed ? 'pass' : 'fail'}>
            <Icon name={c.passed ? 'check' : 'x'} className="mark" style={{ color: c.passed ? 'var(--sage)' : 'var(--rose)' }} />
            <span className="label-t">{label}</span>
            <span className="detail">{c.detail}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function checksSummary(validation) {
  if (!validation) return '—'
  const passed = validation.checks.filter((c) => c.passed).length
  return `${passed}/${validation.checks.length}`
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <div className="stack" style={{ '--stack': '16px' }}>{children}</div>
    </div>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="reading" style={{ padding: '40px 0' }}>
      <span className="spinner dark" /> {label}
    </div>
  )
}
