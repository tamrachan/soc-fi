import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../data/api.js'
import { useAction, useApi, useSession } from '../state/AppState.jsx'
import { hasPerm } from '../domain/permissions.js'
import { CATEGORIES } from '../data/schema.js'
import { fmtDate, fmtMoney, shortAddr, toUsdc } from '../lib/format.js'
import { FX_TO_USDC, NETWORKS } from '../config.js'
import Receipt from '../components/Receipt.jsx'
import ClaimTimeline from '../components/ClaimTimeline.jsx'
import LedgerSignModal from '../components/LedgerSignModal.jsx'
import { Checks, Empty, ErrorText, Icon, Loading, Notice, PageHead, StatusPill } from '../components/ui.jsx'

function Comparison({ fields, ai }) {
  const rows = [
    ['Merchant', fields.merchant, ai?.merchant],
    ['Date', fmtDate(fields.date), ai?.date && fmtDate(ai.date)],
    ['Amount', fmtMoney(fields.amount, fields.currency), ai?.total != null && fmtMoney(ai.total, ai.currency ?? fields.currency)],
    ['Category', CATEGORIES[fields.category], ai?.suggestedCategory && CATEGORIES[ai.suggestedCategory]],
  ]
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Field</th>
          <th>Member confirmed</th>
          <th>AI read</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, mine, theirs]) => {
          const same = !theirs || mine === theirs
          return (
            <tr key={k}>
              <td className="faint">{k}</td>
              <td style={{ color: 'var(--white)' }}>{mine}</td>
              <td className="faint">{theirs || '—'}</td>
              <td className="right">
                <Icon name={same ? 'check' : 'alert'} style={{ color: same ? 'var(--sage)' : 'var(--copper)' }} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function DecisionPanel({ claim, onApproved }) {
  const [decision, setDecision] = useState('approve')
  const [reason, setReason] = useState('')
  const [resolution, setResolution] = useState('edit_existing')
  const [review, { pending, error }] = useAction((args) => api.reviewClaim(claim.id, args))
  const f = claim.latest.fields
  const usdc = toUsdc(f.amount, f.currency)
  const r = claim.society.reimbursement

  const submit = async (e) => {
    e.preventDefault()
    const res = await review({ decision, reason, resolution: decision === 'return' ? resolution : null, version: claim.currentVersion })
    if (res.ok && decision === 'approve') onApproved(res.data)
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-head">
        <h3>Your decision</h3>
        <span className="mono faint" style={{ fontSize: 12 }}>
          on version {claim.currentVersion}
        </span>
      </div>
      <div className="card-pad stack" style={{ '--stack': '20px' }}>
        <div className="seg" role="group" aria-label="Decision">
          {[
            ['approve', 'Approve'],
            ['return', 'Return for edits'],
            ['reject', 'Reject'],
          ].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={decision === k} onClick={() => setDecision(k)}>
              {l}
            </button>
          ))}
        </div>

        {decision === 'approve' && (
          <>
            <p className="muted" style={{ fontSize: 14 }}>
              Your approval covers exactly these values. If the member changes anything, it comes back for review.
            </p>
            <dl className="kv">
              <dt>Pay</dt>
              <dd className="tnum" style={{ color: 'var(--white)' }}>
                {fmtMoney(usdc, 'USDC')} <span className="faint">= {fmtMoney(f.amount, f.currency)} @ {FX_TO_USDC[f.currency]}</span>
              </dd>
              <dt>To</dt>
              <dd>
                <span className="addr">{claim.claimant.walletAddress}</span>
                <span className="hint" style={{ display: 'block' }}>
                  {claim.claimant.displayName}'s saved wallet
                </span>
              </dd>
              <dt>From</dt>
              <dd>
                <span className="addr">{shortAddr(r.treasuryWallet)}</span> <span className="faint">· {claim.society.name} treasury</span>
              </dd>
              <dt>Network</dt>
              <dd>
                {r.token} on {NETWORKS[r.network]?.label ?? r.network}
              </dd>
            </dl>
          </>
        )}

        {decision === 'return' && (
          <>
            <div className="field">
              <span className="label">What should the member do?</span>
              <label className="check">
                <input type="radio" name="res" checked={resolution === 'edit_existing'} onChange={() => setResolution('edit_existing')} />
                <span>
                  Edit this claim <span className="hint" style={{ display: 'block' }}>Keeps the history. Their changes become a new version you review again.</span>
                </span>
              </label>
              <label className="check">
                <input type="radio" name="res" checked={resolution === 'start_new'} onChange={() => setResolution('start_new')} />
                <span>
                  Start a new claim <span className="hint" style={{ display: 'block' }}>For a different receipt or a substantially different claim.</span>
                </span>
              </label>
            </div>
            <div className="field">
              <label htmlFor="reason">Instructions for the member</label>
              <textarea id="reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Remove the shampoo (£4.50). It's a personal item, not baking ingredients." />
            </div>
          </>
        )}

        {decision === 'reject' && (
          <div className="field">
            <label htmlFor="reason">Reason (shared with the member)</label>
            <textarea id="reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Personal expense, not linked to a society event." />
          </div>
        )}

        <ErrorText error={error} />
        <button
          className={`btn ${decision === 'reject' ? 'btn-danger' : 'btn-primary'} btn-block`}
          disabled={pending || (decision !== 'approve' && !reason.trim())}
        >
          {pending ? 'Saving…' : decision === 'approve' ? 'Approve and sign on Ledger' : decision === 'return' ? 'Return to member' : 'Reject claim'}
        </button>
        {decision === 'approve' && <p className="hint" style={{ textAlign: 'center' }}>Nothing is paid until you sign on the device.</p>}
      </div>
    </form>
  )
}

function PaymentPanel({ claim, onOpenLedger }) {
  const p = claim.payment
  const [retry, retryState] = useAction(() => api.retryPayment(p.id))
  const [reconcile, recState] = useAction(() => api.reconcilePayment(p.id))
  const explorer = NETWORKS[p.network]?.explorer

  return (
    <div className="card card-pad stack" style={{ '--stack': '16px' }}>
      <div className="row between">
        <span className="eyebrow">Payment</span>
        <span className="mono faint" style={{ fontSize: 12 }}>
          attempt {Math.max(p.attempts, 1)}
        </span>
      </div>
      {claim.status === 'awaiting_ledger' && (
        <>
          <h2>Waiting for your Ledger.</h2>
          <p className="muted" style={{ fontSize: 14 }}>Approved. Connect your device and check the amount and recipient on its screen.</p>
          <button className="btn btn-primary" onClick={onOpenLedger}>
            Open Ledger prompt
          </button>
        </>
      )}
      {claim.status === 'approved' && (
        <>
          <h2>Rejected on device.</h2>
          <p className="muted" style={{ fontSize: 14 }}>No transaction was signed. The approval still stands, so you can send it to the Ledger again.</p>
          <button
            className="btn btn-ghost"
            disabled={retryState.pending}
            onClick={async () => {
              const res = await retry()
              if (res.ok) onOpenLedger()
            }}
          >
            Send to Ledger again
          </button>
        </>
      )}
      {claim.status === 'payment_pending' && (
        <>
          <div className="reading">
            <span className="spinner dark" /> Waiting for on-chain confirmation…
          </div>
          <p className="hint">Not marked paid until it's confirmed.</p>
        </>
      )}
      {claim.status === 'needs_reconciliation' && (
        <>
          <Notice tone="rose" title="Outcome unknown">
            The network didn't confirm in time. Don't pay again. Look the transaction up first so the member isn't paid twice.
          </Notice>
          <button className="btn btn-ghost" disabled={recState.pending} onClick={() => reconcile()}>
            {recState.pending ? 'Looking up transaction…' : 'Reconcile with chain'}
          </button>
        </>
      )}
      {claim.status === 'paid' && (
        <Notice tone="sage" title={`Paid ${fmtMoney(p.amount, 'USDC')}`}>
          Confirmed on {NETWORKS[p.network]?.label}.
        </Notice>
      )}
      {p.txHash && (
        <dl className="kv">
          <dt>Transaction</dt>
          <dd>
            <a className="link addr" href={`${explorer}${p.txHash}`} target="_blank" rel="noreferrer">
              {shortAddr(p.txHash)}
            </a>
          </dd>
        </dl>
      )}
      <ErrorText error={retryState.error || recState.error} />
    </div>
  )
}

export default function ReviewDetail() {
  const { id } = useParams()
  const session = useSession()
  const { data: claim, error } = useApi(() => api.getClaim(id), [id])
  const { data: sample } = useApi(
    () => (claim?.latest.receipt.kind === 'sample' ? api.getReceipt(claim.latest.receipt.sampleId) : Promise.resolve(null)),
    [claim?.latest.receipt.sampleId],
  )
  const [reveal, setReveal] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)

  if (error) return <Empty title="Couldn't open claim">{error.message}</Empty>
  if (!claim) return <Loading />
  if (!hasPerm(session, claim.societyId, 'claims.review')) return <Empty title="Treasurer access needed">You can't review claims for this society.</Empty>

  const v = claim.latest
  const x = v.aiExtraction
  const discarded = Object.entries(x?.discardedFields ?? {})
  const own = claim.claimantId === session.user.id
  const canDecide = claim.status === 'pending_review' && !own && hasPerm(session, claim.societyId, 'claims.approve')

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Link to="/review" className="btn btn-quiet btn-sm" style={{ paddingLeft: 0 }}>
          <Icon name="back" /> Review queue
        </Link>
      </div>
      <PageHead
        eyebrow={`${claim.reference} · ${claim.society.name} · v${claim.currentVersion}`}
        title={
          <>
            {fmtMoney(v.fields.amount, v.fields.currency)} <em>at {v.fields.merchant}</em>
          </>
        }
        lede={`Submitted by ${claim.claimant.displayName} · “${v.fields.description}”`}
      >
        <StatusPill status={claim.status} />
      </PageHead>

      <div className="split">
        <div className="stack sticky" style={{ '--stack': '12px' }}>
          <Receipt receipt={v.receipt} revealHidden={reveal} />
          {sample?.hiddenText && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReveal((r) => !r)}>
              {reveal ? 'Hide' : 'Reveal'} near-invisible text on receipt
            </button>
          )}
        </div>

        <div className="stack" style={{ '--stack': '40px' }}>
          {discarded.length > 0 && (
            <div className="card card-pad stack" style={{ '--stack': '12px', borderColor: 'rgba(214,143,134,0.4)' }}>
              <span className="eyebrow" style={{ color: 'var(--rose)' }}>
                Prompt injection contained
              </span>
              <h2>The AI was tricked. It made no difference.</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Hidden text on this receipt told the reader to change the payee and amount. Its reply included fields outside
                the extraction schema. They were discarded before the rules ran and can't reach the payment:
              </p>
              <table className="table">
                <tbody>
                  {discarded.map(([k, val]) => (
                    <tr key={k}>
                      <td className="mono faint">{k}</td>
                      <td className="mono" style={{ color: 'var(--rose)', textDecoration: 'line-through' }}>
                        {String(val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 14 }}>
                If approved, payment goes to <span className="addr">{shortAddr(claim.claimant.walletAddress)}</span>,{' '}
                {claim.claimant.displayName}'s saved wallet. Your Ledger will show that address.
              </p>
            </div>
          )}

          {claim.payment && <PaymentPanel claim={claim} onOpenLedger={() => setLedgerOpen(true)} />}

          <section>
            <div className="section-head">
              <h2>Claim vs. receipt</h2>
              <span className="faint" style={{ fontSize: 13 }}>
                AI shown for context only
              </span>
            </div>
            <Comparison fields={v.fields} ai={x} />
            <p className="hint" style={{ marginTop: 10 }}>
              You can't edit the member's values. If something's wrong, return the claim.
            </p>
          </section>

          <section>
            <div className="section-head">
              <h2>Automated checks</h2>
              <span className="mono faint">{v.validation.checks.filter((c) => c.passed).length}/7</span>
            </div>
            <Checks validation={v.validation} />
          </section>

          <section>
            <div className="section-head">
              <h2>Claimant</h2>
            </div>
            <dl className="kv">
              <dt>Name</dt>
              <dd>{claim.claimant.displayName}</dd>
              <dt>Email</dt>
              <dd>{claim.claimant.email}</dd>
              <dt>Saved wallet</dt>
              <dd className="addr">{claim.claimant.walletAddress}</dd>
            </dl>
          </section>

          {own && claim.status === 'pending_review' && (
            <Notice tone="ice" title="This is your own claim">
              Another authorised reviewer has to decide on it.
            </Notice>
          )}
          {canDecide && <DecisionPanel claim={claim} onApproved={() => setLedgerOpen(true)} />}

          <section>
            <div className="section-head">
              <h2>History</h2>
            </div>
            <ClaimTimeline claim={claim} names={{ [session.user.id]: session.user.displayName }} />
          </section>
        </div>
      </div>

      {ledgerOpen && claim.payment && <LedgerSignModal payment={claim.payment} claim={claim} onClose={() => setLedgerOpen(false)} />}
    </>
  )
}
