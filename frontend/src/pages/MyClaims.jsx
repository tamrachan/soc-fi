import { Link, useNavigate } from 'react-router-dom'
import { api } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { claimableSocieties } from '../domain/permissions.js'
import { CLAIM_STATUS_META } from '../data/schema.js'
import { fmtDate, fmtMoney } from '../lib/format.js'
import { Empty, Loading, PageHead, StatusPill } from '../components/ui.jsx'

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
