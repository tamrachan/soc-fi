import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, isMock } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { claimableSocieties, isReviewer, societiesWithPerm } from '../domain/permissions.js'
import { initials } from '../lib/format.js'
import { readerLabel } from '../lib/readerSettings.js'
import { APP_NAME, TAGLINE, UNION_NAME } from '../config.js'
import { Icon, Loading } from './ui.jsx'

const PUBLIC_PATHS = ['/', '/signup', '/demo/receipts', '/how-it-works']

function DemoStrip({ user }) {
  const navigate = useNavigate()
  const personas = api.demo.personas
  const known = personas.some((p) => p.id === user?.id)

  const onSwitch = (e) => {
    const id = e.target.value
    api.demo.switchUser(id || null)
    navigate(id ? '/' : '/signup')
  }

  return (
    <div className="demo-strip">
      <div className="container">
        <span className="demo-dot" aria-hidden="true" />
        <span className="hide-sm">Demo · mock data in this browser</span>
        <span className="spacer hide-sm" />
        <label htmlFor="persona" className="hide-sm">Viewing as</label>
        <select id="persona" value={user?.id ?? ''} onChange={onSwitch}>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.hint}
            </option>
          ))}
          {user && !known && <option value={user.id}>{user.displayName} — new account</option>}
          <option value="">Signed out — new student</option>
        </select>
        <Link to="/demo/receipts" className="hide-sm" style={{ color: 'var(--fog)' }}>
          Test receipts
        </Link>
        <Link to="/account" className="hide-sm" style={{ color: 'var(--fog)' }}>
          Reader: {readerLabel().startsWith('Claude') ? 'Claude' : 'OCR'}
        </Link>
        <button
          onClick={() => {
            api.demo.reset()
            navigate('/')
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function TabBar({ reviewer, pending, canClaim }) {
  const { pathname } = useLocation()
  const on = (test) => (test ? 'active' : undefined)
  const scanning = pathname === '/claims/new'
  return (
    <nav className="tabbar" aria-label="App">
      <Link to="/" className={on(pathname === '/')}>
        <Icon name="home" size={20} />
        Home
      </Link>
      <Link to="/claims" className={on(pathname.startsWith('/claims') && !scanning)}>
        <Icon name="list" size={20} />
        Claims
      </Link>
      {canClaim && (
        <Link to="/claims/new?scan=1" className={`scan ${scanning ? 'active' : ''}`} aria-label="Scan a receipt">
          <span className="scan-ring">
            <Icon name="camera" size={24} />
          </span>
          Scan
        </Link>
      )}
      {reviewer ? (
        <Link to="/review" className={on(pathname.startsWith('/review') || pathname.startsWith('/payments'))}>
          <Icon name="inbox" size={20} />
          Review
          {pending > 0 && <span className="badge">{pending}</span>}
        </Link>
      ) : (
        <Link to="/societies" className={on(pathname.startsWith('/societies') || pathname === '/committee')}>
          <Icon name="users" size={20} />
          Societies
        </Link>
      )}
      <Link to="/account" className={on(['/account', '/setup', '/audit'].some((p) => pathname.startsWith(p)) || (reviewer && pathname.startsWith('/societies')))}>
        <Icon name="user" size={20} />
        Me
      </Link>
    </nav>
  )
}

export default function Layout() {
  const session = useSession()
  const { pathname } = useLocation()
  const user = session?.user
  const reviewer = isReviewer(session)
  const { data: queue } = useApi(() => (reviewer ? api.listReviewClaims() : Promise.resolve([])), [reviewer, user?.id])
  const pending = (queue ?? []).filter((c) => c.status === 'pending_review').length
  const canPay = societiesWithPerm(session, 'payments.initiate').length > 0
  const canConfigure = societiesWithPerm(session, 'society.configure_reimbursement').length > 0

  if (session === undefined) return <Loading />
  if (!user && !PUBLIC_PATHS.includes(pathname)) return <Navigate to="/" replace />
  if (user && !user.emailVerified && pathname !== '/verify') return <Navigate to="/verify" replace />

  const verified = user?.emailVerified

  return (
    <div className="shell">
      {isMock && api.demo && <DemoStrip user={user} />}
      <header className="topbar">
        <div className="container">
          <NavLink to="/" className="brand" aria-label={`${APP_NAME} home`}>
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-word">{APP_NAME}</span>
            <span className="brand-tag">{TAGLINE}</span>
          </NavLink>
          {verified && (
            <nav className="nav" aria-label="Main">
              <NavLink to="/" end>
                Overview
              </NavLink>
              <NavLink to="/claims">My claims</NavLink>
              <NavLink to="/societies">Societies</NavLink>
              {reviewer && (
                <NavLink to="/review">
                  Review{pending > 0 && <span className="count">{pending}</span>}
                </NavLink>
              )}
              {canPay && <NavLink to="/payments">Payments</NavLink>}
              {canConfigure && <NavLink to="/setup">Setup</NavLink>}
              <NavLink to="/audit">Audit log</NavLink>
            </nav>
          )}
          {user ? (
            <NavLink to={verified ? '/account' : '/verify'} className="me">
              <span className="nowrap">{user.displayName}</span>
              <span className="avatar">{initials(user.displayName)}</span>
            </NavLink>
          ) : (
            <div className="me">
              <NavLink to="/signup" className="btn btn-ghost btn-sm">
                Create account
              </NavLink>
            </div>
          )}
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      {verified && <TabBar reviewer={reviewer} pending={pending} canClaim={claimableSocieties(session).length > 0} />}
      <footer className="footer">
        <div className="container">
          <span>
            {APP_NAME} · {TAGLINE} A pilot for {UNION_NAME}
          </span>
          <Link to="/how-it-works" className="link">
            How it works
          </Link>
          <span className="mono">The agent reads receipts. Only the Union's Ledger can release money.</span>
        </div>
      </footer>
    </div>
  )
}
