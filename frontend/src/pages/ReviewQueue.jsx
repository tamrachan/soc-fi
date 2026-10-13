import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { isReviewer } from '../domain/permissions.js'
import { fmtMoney, relTime } from '../lib/format.js'
import { checksSummary, Empty, Loading, PageHead, StatusPill } from '../components/ui.jsx'
import { AGENT_NAME, AGENT_ROLE } from '../config.js'

const TABS = [
  { id: 'pending', label: 'Appeals to decide', match: (s) => s === 'pending_review' },
  { id: 'ledger', label: 'Upheld, with the Union', match: (s) => ['approved', 'awaiting_ledger', 'payment_pending', 'needs_reconciliation'].includes(s) },
  { id: 'done', label: 'Closed', match: (s) => ['paid', 'rejected', 'returned', 'withdrawn', 'superseded'].includes(s) },
]

export default function ReviewQueue() {
  const session = useSession()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const { data: claims } = useApi(() => api.listReviewClaims(), [session.user.id])

  if (!isReviewer(session)) return <Empty title="Society treasurer access needed">Only society treasurers decide appeals.</Empty>

  const active = TABS.find((t) => t.id === tab)
  const rows = (claims ?? []).filter((c) => active.match(c.status))
  if (tab === 'done') rows.reverse()

  return (
    <>
      <PageHead
        eyebrow="Society treasurer"
        title="Appeals."
        lede={`${AGENT_NAME}, the ${AGENT_ROLE}, approves and declines claims on his own. You only see a claim when a member appeals a decline. Upholding an appeal sends the payment to the Union treasurer, who signs it on the Ledger.`}
      />

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            <span className="count">{(claims ?? []).filter((c) => t.match(c.status)).length}</span>
          </button>
        ))}
      </div>

      {!claims ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty title={tab === 'pending' ? 'No appeals' : 'Nothing here'}>
          <p>{tab === 'pending' ? `A claim appears here when a member appeals ${AGENT_NAME}’s decision.` : ''}</p>
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table responsive">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Submitted by</th>
                <th>Society</th>
                <th className="num">Amount</th>
                <th>Checks</th>
                <th>Age</th>
                <th className="right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const f = c.latest.fields
                const own = c.claimantId === session.user.id
                return (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/review/${c.id}`)}>
                    <td>
                      {f.merchant}
                      <span className="sub mono">
                        {c.reference}
                        {c.currentVersion > 1 && ` · v${c.currentVersion}`}
                        <span className="only-mobile">
                          {' '}
                          · {c.claimant.displayName} · {checksSummary(c.latest.validation)} checks · {relTime(c.latest.submittedAt)}
                        </span>
                      </span>
                    </td>
                    <td className="hide-sm">
                      {c.claimant.displayName}
                      {own && <span className="sub">Your claim, another treasurer decides it</span>}
                    </td>
                    <td className="faint hide-sm">{c.society.name}</td>
                    <td className="num">{fmtMoney(f.amount, f.currency)}</td>
                    <td className="mono faint hide-sm">{checksSummary(c.latest.validation)}</td>
                    <td className="faint nowrap hide-sm">{relTime(c.latest.submittedAt)}</td>
                    <td className="right">
                      <StatusPill status={c.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
