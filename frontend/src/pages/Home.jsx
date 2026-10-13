import { Link } from 'react-router-dom'
import { api } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { claimableSocieties, isReviewer, isUnionTreasurer, societiesWithPerm } from '../domain/permissions.js'
import { fmtMoney, relTime } from '../lib/format.js'
import { Icon, StatusPill } from '../components/ui.jsx'
import HowItWorksStory from '../components/story/HowItWorksStory.jsx'

function ScrollCue() {
  return (
    <div className="scroll-cue" aria-hidden="true">
      <span className="mono">Scroll to see how it works</span>
      <span className="scroll-cue-line" />
    </div>
  )
}

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
            <li>Runs eight checks on every claim: receipt total, duplicates, budget, category, date, limit, tampering, and whether it's a reasonable expense</li>
            <li>Declines a claim with a plain reason. The member fixes it or appeals to their society treasurer</li>
            <li>Approves claims that pass, but has no payment tools and never sees a wallet key</li>
          </ol>
        </div>
        <div>
          <h3>Only a person</h3>
          <ol>
            <li>The society treasurer decides appeals: approve, request edits or deny</li>
            <li>The Union treasurer sees the real amount and recipient on the Ledger's own screen</li>
            <li>They hold the button to sign, or reject. Nothing moves without it</li>
            <li>Money goes only to the member's saved wallet, never an address from a receipt</li>
          </ol>
        </div>
      </div>
    </section>
  )
}

const HERO_POINTS = [
  ['Snap the receipt', 'Your phone reads it and fills in the claim. You check it and submit.'],
  ['Checked in seconds', 'An agent checks it against your society’s rules and tells you exactly why if it can’t pass.'],
  ['Paid in minutes', 'USDC goes straight to the wallet on your account. No forms, no week-long wait.'],
  ['Secured by hardware', 'The AI can’t pay anyone. Only the Union treasurer’s Ledger can release money.'],
]

function Landing() {
  return (
    <>
      <section className="hero" style={{ marginTop: -40 }}>
        <div className="hero-grid">
          <div className="stack" style={{ '--stack': '28px' }}>
            <h1 className="display">
              Society Finance, <em>secured.</em>
            </h1>
            <ul className="hero-points">
              {HERO_POINTS.map(([title, body]) => (
                <li key={title}>
                  <Icon name="check" className="hero-tick" />
                  <span>
                    <b>{title}.</b> {body}
                  </span>
                </li>
              ))}
            </ul>
            <div className="row" style={{ gap: 12 }}>
              <Link to="/signup" className="btn btn-primary">
                Create account <Icon name="arrow" />
              </Link>
              <button type="button" className="btn btn-ghost" onClick={() => document.querySelector('.how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                See how it works
              </button>
            </div>
          </div>
          <ScrollCue />
        </div>
      </section>

      <HowItWorksStory />

      <section className="cta-band">
        <div className="stack" style={{ '--stack': '20px' }}>
          <span className="eyebrow ruled">Your turn</span>
          <h2 className="cta-title">
            Spent money on a society event? <em>Get it back.</em>
          </h2>
          <p className="lede">Create an account with your university email, join your society, and submit your first receipt in under a minute.</p>
          <div className="row" style={{ gap: 12 }}>
            <Link to="/signup" className="btn btn-primary">
              Create account <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

      <Boundary />
    </>
  )
}

function Dashboard({ session }) {
  const { user } = session
  const reviewer = isReviewer(session)
  const claimable = claimableSocieties(session)
  const { data: mine = [] } = useApi(() => api.listMyClaims(), [user.id])
  const { data: queue = [] } = useApi(() => (reviewer ? api.listReviewClaims() : Promise.resolve([])), [reviewer, user.id])
  const unionTreasurer = isUnionTreasurer(session)
  const { data: payments = [] } = useApi(() => (unionTreasurer ? api.listPayments() : Promise.resolve([])), [unionTreasurer, user.id])
  const toSign = payments.filter((p) => p.status === 'awaiting_device')
  const reviewSocieties = societiesWithPerm(session, 'claims.review')
  const pendingMembership = session.memberships.filter((m) => m.status === 'pending')
  const first = user.displayName.split(' ')[0]

  const pending = queue.filter((c) => c.status === 'pending_review')
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
              {c.status === 'returned' ? c.latestReview?.reason : 'The agent declined it. Fix it or appeal.'}
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

      {unionTreasurer && (
        <section className="section" style={{ marginTop: 32 }}>
          <div className="grid grid-3">
            <Link to="/payments" className="card stat">
              <div className="k">Awaiting your Ledger</div>
              <div className="v">{toSign.length}</div>
              <div className="s">Approved, not yet signed</div>
            </Link>
          </div>
        </section>
      )}

      {reviewer && (
        <section className="section" style={{ marginTop: 32 }}>
          <div className="grid grid-3">
            <Link to="/review" className="card stat">
              <div className="k">Appeals to decide</div>
              <div className="v">{pending.length}</div>
              <div className="s">
                {pending.length ? `Oldest ${relTime(pending[0].createdAt)}` : 'No appeals waiting'}
              </div>
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
