import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { isReviewer } from '../domain/permissions.js'
import { fmtMoney, relTime } from '../lib/format.js'
import { checksSummary, Empty, Loading, PageHead, StatusPill } from '../components/ui.jsx'

const TABS = [
  { id: 'pending', label: 'To review', match: (s) => s === 'pending_review' },
  { id: 'ledger', label: 'Payment in progress', match: (s) => ['approved', 'awaiting_ledger', 'payment_pending', 'needs_reconciliation'].includes(s) },
  { id: 'done', label: 'Closed', match: (s) => ['paid', 'rejected', 'returned', 'withdrawn', 'superseded'].includes(s) },
]

export default function ReviewQueue() {
  const session = useSession()
  const navigate = useNavigate()
  const [tab, setTab] = useState('pending')
  const { data: claims } = useApi(() => api.listReviewClaims(), [session.user.id])

  if (!isReviewer(session)) return <Empty title="Treasurer access needed">Only treasurers can review claims.</Empty>

  const active = TABS.find((t) => t.id === tab)
  const rows = (claims ?? []).filter((c) => active.match(c.status))
  if (tab === 'done') rows.reverse()

  return (
    <>
      <PageHead
        eyebrow="Treasurer"
        title="Review queue."
        lede="Each claim was confirmed by the member and passed all seven checks. Check the receipt yourself. Approving sends it to your Ledger, and nothing is paid until you sign there."
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
        <Empty title={tab === 'pending' ? 'Queue is clear' : 'Nothing here'}>
          <p>{tab === 'pending' ? 'New claims appear here once they pass the automated checks.' : ''}</p>
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
                      {own && <span className="sub">Your claim, another treasurer reviews it</span>}
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
