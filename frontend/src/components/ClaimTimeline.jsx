import { fmtDateTime, fmtMoney } from '../lib/format.js'

const DECISION = { approve: 'Approved', return: 'Edits requested', reject: 'Denied' }
const RESOLUTION = { edit_existing: 'edit this claim', start_new: 'start a new claim' }
const PAY = {
  awaiting_device: 'Sent to treasurer’s Ledger',
  cancelled: 'Rejected on Ledger. Nothing signed',
  pending: 'Signed on Ledger and broadcast',
  confirmed: 'Confirmed on-chain',
  needs_reconciliation: 'Outcome unknown, reconciling',
}

export function claimEvents(claim, names = {}) {
  const ev = []
  for (const v of claim.versions) {
    ev.push({
      at: v.submittedAt,
      title: v.version === 1 ? 'Submitted' : `Resubmitted as version ${v.version}`,
      sub: `${fmtMoney(v.fields.amount, v.fields.currency)} · ${v.validation.passed ? 'all checks passed' : 'checks failed'}`,
    })
  }
  for (const r of claim.reviews) {
    ev.push({
      at: r.at,
      title: `${DECISION[r.decision]} (v${r.version})`,
      sub: [names[r.reviewerId], r.resolution && `member to ${RESOLUTION[r.resolution]}`].filter(Boolean).join(' · '),
      quote: r.reason,
    })
  }
  for (const h of claim.payment?.history ?? []) {
    ev.push({ at: h.at, title: PAY[h.status], sub: h.status === 'confirmed' ? fmtMoney(claim.payment.amount, 'USDC') : '' })
  }
  return ev.sort((a, b) => a.at.localeCompare(b.at))
}

export default function ClaimTimeline({ claim, names }) {
  const events = claimEvents(claim, names)
  return (
    <ol className="timeline">
      {events.map((e, i) => (
        <li key={i}>
          <span className={`dot ${i === events.length - 1 ? 'on' : ''}`} />
          <div>
            <div className="t">{e.title}</div>
            <div className="when">
              {fmtDateTime(e.at)}
              {e.sub && ` · ${e.sub}`}
            </div>
            {e.quote && <div className="quote">“{e.quote}”</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}
