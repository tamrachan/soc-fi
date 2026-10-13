import { api } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { fmtDateTime } from '../lib/format.js'
import { Empty, Loading, PageHead } from '../components/ui.jsx'
import { AGENT_NAME } from '../config.js'

const LABELS = {
  'user.signed_up': 'Signed up',
  'user.email_verified': 'Verified university email',
  'user.wallet_changed': 'Changed payout wallet',
  'membership.requested': 'Requested membership',
  'membership.joined_by_invite': 'Joined with invite code',
  'membership.approved': 'Approved membership',
  'membership.declined': 'Declined membership',
  'committee.matched': 'Committee role matched, permissions granted',
  'committee.manual_review': 'Committee role sent for manual review',
  'committee.denied': 'Committee role request denied',
  'society.setup_updated': 'Updated reimbursement setup',
  'society.ledger_paired': 'Paired Ledger signer',
  'society.union_approval_requested': 'Requested Union approval',
  'society.union_approved': 'Union finance approved setup',
  'society.reimbursement_enabled': 'Enabled reimbursement',
  'claim.submitted': 'Submitted claim',
  'claim.withdrawn': 'Withdrew claim',
  'claim.agent_approved': 'Approved claim',
  'claim.agent_declined': 'Declined claim',
  'claim.appealed': `Appealed ${AGENT_NAME}’s decision`,
  'claim.approved': 'Upheld appeal',
  'claim.returned': 'Requested edits',
  'claim.rejected': 'Denied appeal',
  'payment.device_confirmed': 'Signed payment on Ledger',
  'payment.device_rejected': 'Rejected payment on Ledger',
  'payment.unconfirmed': 'Payment unconfirmed, needs reconciliation',
  'payment.reconciled': 'Reconciled payment with chain',
  'payment.confirmed': 'Payment confirmed on-chain',
}

const tone = (action) =>
  /denied|rejected|unconfirmed/.test(action) ? 'var(--rose)' : /confirmed|matched|enabled|approved/.test(action) ? 'var(--sage)' : 'var(--line-3)'

export default function AuditLog() {
  const session = useSession()
  const { data: entries } = useApi(() => api.listAuditLog(), [session.user.id])

  return (
    <>
      <PageHead
        eyebrow="Audit log"
        title="Every decision, attributed."
        lede="Role claims, permission changes, approvals and payments, newest first. You see your own actions and those in societies you help run."
      />
      {!entries ? (
        <Loading />
      ) : entries.length === 0 ? (
        <Empty title="Nothing logged yet" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Society</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((a) => (
                <tr key={a.id}>
                  <td className="faint nowrap mono" style={{ fontSize: 12 }}>
                    {fmtDateTime(a.at)}
                  </td>
                  <td className="nowrap">{a.actorName}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 6, background: tone(a.action), marginRight: 10, verticalAlign: 'middle' }} />
                    {LABELS[a.action] ?? a.action}
                  </td>
                  <td className="faint">{a.societyName ?? '—'}</td>
                  <td className="mono faint" style={{ fontSize: 11.5 }}>
                    {Object.entries(a.details ?? {})
                      .filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))
                      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length + ' perms' : v}`)
                      .join(' ')}
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
