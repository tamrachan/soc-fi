import { fmtDate, relTime } from '../lib/format.js'
import { Icon, Notice } from './ui.jsx'

const DAY_MS = 86_400_000
const RECENT_CHANGE_DAYS = 14

/**
 * What the Union treasurer checks the recipient against before signing. The device proves which
 * address is being paid; this says whether that address is the claimant's, and how long it has been.
 */
export default function RecipientCheck({ payment, claimant }) {
  const k = payment.recipientCheck
  if (!k) return null
  const first = claimant.displayName.split(' ')[0]
  const payouts = k.earlierPayouts === 0 ? 'No earlier payout has gone to it' : `${k.earlierPayouts} earlier payout${k.earlierPayouts === 1 ? '' : 's'} went to it`

  if (!k.matchesSavedWallet)
    return (
      <div className="notice rose notice-alert" role="alert">
        <span className="notice-bar" />
        <div style={{ flex: 1 }}>
          <strong>
            <Icon name="x" size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 8 }} />
            This is not {first}’s saved wallet. Reject it on the device.
          </strong>
          <p>
            This transfer pays
            <span className="addr">{payment.recipientAddress}</span>
            {first}’s saved wallet is
            <span className="addr">{k.savedWallet ?? 'not set'}</span>
          </p>
          <p>
            {k.printedOnReceipt && 'The address being paid is printed on the receipt itself. '}
            {payouts}.
          </p>
        </div>
      </div>
    )

  const recentChange = k.walletChangedAt && Date.now() - new Date(k.walletChangedAt).getTime() < RECENT_CHANGE_DAYS * DAY_MS
  if (recentChange)
    return (
      <Notice tone="copper" title={`${first} changed their wallet ${relTime(k.walletChangedAt)}`}>
        <p>
          {payouts}. Confirm the change with {first} in person before signing; a stolen account looks exactly like this.
        </p>
      </Notice>
    )

  return (
    <p className="hint">
      {first}’s saved wallet, {k.walletChangedAt ? 'changed' : 'unchanged since sign-up'} on {fmtDate(k.walletSince)}. {payouts}.
    </p>
  )
}
