import { Link, useNavigate } from 'react-router-dom'
import { api, isMock } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { claimableSocieties, isReviewer, societiesWithPerm } from '../domain/permissions.js'
import { fmtMoney, relTime } from '../lib/format.js'
import { UNION_NAME } from '../config.js'
import { Icon, StatusPill } from '../components/ui.jsx'

function Boundary() {
  return (
    <section className="section">
      <div className="section-head">
        <div className="stack" style={{ '--stack': '10px' }}>
          <span className="eyebrow ruled">The boundary</span>
          <h2>
            What the agent does, and what <em>only a person</em> can do.
          </h2>
        </div>
      </div>
      <div className="boundary">
        <div>
          <h3>The agent, on its own</h3>
          <ol>
            <li>Reads the receipt and suggests merchant, date, total and category</li>
            <li>Flags anything suspicious, like text written to trick an AI</li>
            <li>Has no payment tools and never sees a wallet key</li>
            <li>Its suggestions are checked by the member, then by seven plain-code rules</li>
          </ol>
        </div>
        <div>
          <h3>Only the treasurer, on a Ledger</h3>
          <ol>
            <li>Approves one exact version of a claim</li>
            <li>Sees the real amount and recipient on the device's own screen</li>
            <li>Holds to sign, or rejects. Nothing moves without it</li>
            <li>Money goes only to the member's saved wallet, never an address from a receipt</li>
          </ol>
        </div>
      </div>
    </section>
  )
}

function Landing() {
  const navigate = useNavigate()
  return (
    <>
      <section className="hero" style={{ marginTop: -40 }}>
        <div className="hero-grid">
          <div className="stack" style={{ '--stack': '24px' }}>
            <span className="eyebrow">{UNION_NAME} · USDC pilot</span>
            <h1 className="display">
              Snap the receipt. <em>The treasurer signs.</em>
            </h1>
            <p className="lede">
              Bought the pizza for the Blockchain hackathon, or the flour for Baking Society? Photograph the receipt and an
              AI checks it in seconds. It can't pay anyone, though. Only your society treasurer's Ledger can release the money.
            </p>
            <div className="row" style={{ gap: 12 }}>
              <Link to="/signup" className="btn btn-primary">
                Create account <Icon name="arrow" />
              </Link>
              <button type="button" className="btn btn-ghost" onClick={() => document.getElementById('personas')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore the demo
              </button>
            </div>
          </div>
          <div className="card card-pad stack" style={{ '--stack': '0px' }}>
            <div className="eyebrow quiet" style={{ marginBottom: 14 }}>
              Claim lifecycle
            </div>
            {[
              ['01', 'Member snaps receipt', 'AI suggests the fields'],
              ['02', 'Member checks every field', 'and confirms'],
              ['03', 'Seven rules run', 'amount, duplicate, budget, category, date, limit, flags'],
              ['04', 'Treasurer approves on Ledger', 'the only step that moves money'],
              ['05', 'USDC lands in saved wallet', 'marked paid on confirmation'],
            ].map(([n, t, s]) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '2px 0', padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                <span className="mono faint">{n}</span>
                <span style={{ color: n === '04' ? 'var(--copper)' : 'var(--white)' }}>{t}</span>
                <span className="faint" style={{ fontSize: 13, gridColumn: 2 }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ marginTop: 56 }}>
        <Boundary />
      </div>

      {isMock && api.demo && (
        <section className="section" id="personas">
          <div className="section-head">
            <div className="stack" style={{ '--stack': '10px' }}>
              <span className="eyebrow ruled">Demo personas</span>
              <h2>Step into a role.</h2>
            </div>
          </div>
          <div className="grid grid-4">
            {api.demo.personas.map((p) => (
              <button
                key={p.id}
                className="persona"
                onClick={() => {
                  api.demo.switchUser(p.id)
                  navigate('/')
                }}
              >
                <span className="who">{p.label}</span>
                <span className="what">{p.hint}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

function Dashboard({ session }) {
  const { user } = session
  const reviewer = isReviewer(session)
  const claimable = claimableSocieties(session)
  const { data: mine = [] } = useApi(() => api.listMyClaims(), [user.id])
  const { data: queue = [] } = useApi(() => (reviewer ? api.listReviewClaims() : Promise.resolve([])), [reviewer, user.id])
  const reviewSocieties = societiesWithPerm(session, 'claims.review')
  const pendingMembership = session.memberships.filter((m) => m.status === 'pending')
  const first = user.displayName.split(' ')[0]

  const pending = queue.filter((c) => c.status === 'pending_review')
  const awaiting = queue.filter((c) => ['awaiting_ledger', 'approved', 'needs_reconciliation'].includes(c.status))
  const actionable = mine.filter((c) => ['returned', 'validation_failed'].includes(c.status))

  return (
    <>
      <header className="page-head">
        <div className="stack" style={{ '--stack': '12px' }}>
          <span className="eyebrow ruled">Overview</span>
          <h1>
            Good to see you, <em>{first}</em>.
          </h1>
        </div>
        <div className="row">
          {claimable.length > 0 && (
            <Link to="/claims/new" className="btn btn-primary">
              New claim
            </Link>
          )}
        </div>
      </header>

      <div className="stack" style={{ '--stack': '12px' }}>
        {!user.walletAddress && (
          <div className="notice copper">
            <span className="notice-bar" />
            <div style={{ flex: 1 }}>
              <strong>Add a payout wallet</strong>
              Reimbursements are paid only to the wallet saved on your account. Never to an address on a receipt.
            </div>
            <Link to="/account" className="btn btn-ghost btn-sm">
              Add wallet
            </Link>
          </div>
        )}
        {actionable.map((c) => (
          <div key={c.id} className="notice copper">
            <span className="notice-bar" />
            <div style={{ flex: 1 }}>
              <strong>
                {c.reference} needs your attention · {c.society.name}
              </strong>
              {c.status === 'returned' ? c.latestReview?.reason : 'Some automated checks failed.'}
            </div>
            <Link to={`/claims/${c.id}`} className="btn btn-ghost btn-sm">
              Open
            </Link>
          </div>
        ))}
        {session.memberships.length === 0 && (
          <div className="notice ice">
            <span className="notice-bar" />
            <div style={{ flex: 1 }}>
              <strong>You're not in any societies yet</strong>
              Find your society to join it, or claim a committee role if you're on the committee.
            </div>
            <div className="row">
              <Link to="/societies" className="btn btn-ghost btn-sm">
                Find society
              </Link>
              <Link to="/committee" className="btn btn-quiet btn-sm">
                Committee access
              </Link>
            </div>
          </div>
        )}
        {pendingMembership.length > 0 && (
          <p className="faint" style={{ fontSize: 13 }}>
            Waiting for approval: {pendingMembership.map((m) => m.society.name).join(', ')}
          </p>
        )}
      </div>

      {reviewer && (
        <section className="section" style={{ marginTop: 32 }}>
          <div className="grid grid-3">
            <Link to="/review" className="card stat">
              <div className="k">Waiting for review</div>
              <div className="v">{pending.length}</div>
              <div className="s">
                {pending.length ? `Oldest ${relTime(pending[0].createdAt)}` : 'Queue is clear'}
              </div>
            </Link>
            <Link to="/payments" className="card stat">
              <div className="k">Awaiting your Ledger</div>
              <div className="v">{awaiting.length}</div>
              <div className="s">Approved, not yet signed</div>
            </Link>
            {reviewSocieties.map((s) => {
              const r = s.reimbursement
              const pct = r.termBudget ? Math.min(100, (r.spentThisTerm / r.termBudget) * 100) : 0
              return (
                <Link to={`/setup/${s.id}`} key={s.id} className="card stat">
                  <div className="k">{s.name} · term budget</div>
                  <div className="v">{r.termBudget ? fmtMoney(r.termBudget - r.spentThisTerm, r.currency) : '—'}</div>
                  <div className="s">
                    {r.status === 'enabled' ? `left of ${fmtMoney(r.termBudget, r.currency)}` : 'Reimbursement not enabled'}
                  </div>
                  <div className="budget">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="section" style={{ marginTop: 48 }}>
        <div className="section-head">
          <h2>Your recent claims</h2>
          <Link to="/claims" className="link" style={{ fontSize: 14 }}>
            All claims
          </Link>
        </div>
        {mine.length === 0 ? (
          <p className="muted">
            No claims yet.{' '}
            {claimable.length > 0 ? (
              <Link to="/claims/new" className="link">
                Start one
              </Link>
            ) : (
              'Join a society with reimbursement enabled to start one.'
            )}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {mine.slice(0, 4).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/claims/${c.id}`}>
                        {c.latest.fields.merchant}
                        <span className="sub">
                          {c.reference} · {c.society.name}
                        </span>
                      </Link>
                    </td>
                    <td className="num">{fmtMoney(c.latest.fields.amount, c.latest.fields.currency)}</td>
                    <td className="right">
                      <StatusPill status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Boundary />
    </>
  )
}

export default function Home() {
  const session = useSession()
  return session?.user ? <Dashboard session={session} /> : <Landing />
}
