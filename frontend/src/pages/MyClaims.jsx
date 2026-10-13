import { useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../data/api.js'
import { dismissSubmission, getSubmissions, retrySubmission, subscribeSubmissions } from '../data/submissions.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { claimableSocieties } from '../domain/permissions.js'
import { CLAIM_STATUS_META } from '../data/schema.js'
import { fmtDate, fmtMoney } from '../lib/format.js'
import { Empty, Loading, PageHead, StatusPill } from '../components/ui.jsx'
import { AGENT_NAME } from '../config.js'

function NextStep({ claim }) {
  const r = claim.latestReview
  if (claim.status === 'returned' && r?.resolution === 'edit_existing')
    return <Link to={`/claims/${claim.id}/edit`} className="btn btn-ghost btn-sm">Edit claim</Link>
  if (claim.status === 'returned' && r?.resolution === 'start_new')
    return <Link to={`/claims/new?from=${claim.id}`} className="btn btn-ghost btn-sm">Start new claim</Link>
  if (claim.status === 'validation_failed')
    return <Link to={`/claims/${claim.id}/edit`} className="btn btn-ghost btn-sm">Fix and resubmit</Link>
  return <span className="faint" style={{ fontSize: 13 }}>{CLAIM_STATUS_META[claim.status]?.member}</span>
}

/** Claims still with the agent, or whose check could not run. They are not saved claims yet. */
function InFlight({ userId }) {
  const mine = useSyncExternalStore(subscribeSubmissions, getSubmissions).filter((s) => s.userId === userId)
  if (mine.length === 0) return null
  return (
    <div className="stack" style={{ '--stack': '10px', marginBottom: 24 }}>
      {mine.map((s) => {
        const f = s.payload.fields
        return (
          <div key={s.id} className="card card-pad row between" style={{ gap: 16 }}>
            <div>
              <div>
                {f.merchant} · {fmtMoney(f.amount, f.currency)}
              </div>
              <span className="hint">{s.societyName}</span>
            </div>
            {s.status === 'checking' ? (
              <div className="reading">
                <span className="spinner dark" /> {AGENT_NAME} is checking this claim…
              </div>
            ) : (
              <div className="row" style={{ gap: 10 }}>
                <span className="error-text">Not submitted: {s.error?.message ?? 'something went wrong.'}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => retrySubmission(s.id)}>
                  Try again
                </button>
                <button type="button" className="text-btn" onClick={() => dismissSubmission(s.id)}>
                  Discard
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function MyClaims() {
  const session = useSession()
  const navigate = useNavigate()
  const { data: claims } = useApi(() => api.listMyClaims(), [session.user.id])
  const canClaim = claimableSocieties(session).length > 0

  return (
    <>
      <PageHead eyebrow="Member" title="My claims." lede="Everything you've claimed, and what happens next.">
        {canClaim && (
          <Link to="/claims/new" className="btn btn-primary">
            New claim
          </Link>
        )}
      </PageHead>
      <InFlight userId={session.user.id} />
      {!claims ? (
        <Loading />
      ) : claims.length === 0 ? (
        <Empty title="No claims yet">
          {canClaim ? (
            <Link to="/claims/new" className="link">Start your first claim</Link>
          ) : (
            <p>
              You need to be a member of a society with reimbursement enabled. <Link to="/societies" className="link">Find yours</Link>
            </p>
          )}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table responsive">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Society</th>
                <th>Receipt date</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th className="right">Next</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id} className="clickable" onClick={(e) => !e.target.closest('a,button') && navigate(`/claims/${c.id}`)}>
                  <td>
                    <Link to={`/claims/${c.id}`}>{c.latest.fields.merchant}</Link>
                    <span className="sub mono">
                      {c.reference}
                      {c.currentVersion > 1 && ` · v${c.currentVersion}`}
                      <span className="only-mobile"> · {c.society.name}</span>
                    </span>
                  </td>
                  <td className="faint hide-sm">{c.society.name}</td>
                  <td className="faint nowrap hide-sm">{fmtDate(c.latest.fields.date)}</td>
                  <td className="num">{fmtMoney(c.latest.fields.amount, c.latest.fields.currency)}</td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                  <td className="right end">
                    <NextStep claim={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
