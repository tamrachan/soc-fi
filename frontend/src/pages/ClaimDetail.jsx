import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../data/api.js'
import { useAction, useApi, useSession } from '../state/AppState.jsx'
import { CATEGORIES, CLAIM_STATUS_META } from '../data/schema.js'
import { fmtDate, fmtMoney, shortAddr } from '../lib/format.js'
import { AGENT_NAME, AGENT_ROLE, NETWORKS } from '../config.js'
import Receipt from '../components/Receipt.jsx'
import ClaimTimeline from '../components/ClaimTimeline.jsx'
import { Checks, Empty, ErrorText, Loading, Notice, PageHead, StatusPill } from '../components/ui.jsx'

// The agent's decision stands unless the member appeals it to their society treasurer.
function Appeal({ claim }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [appeal, { pending, error }] = useAction(() => api.appealClaim(claim.id, reason))
  const tampered = claim.latest.validation.checks.some((c) => c.id === 'not_flagged' && !c.passed)

  return (
    <div className="card card-pad stack" style={{ '--stack': '12px', borderColor: 'rgba(214,143,134,0.35)' }}>
      <span className="eyebrow" style={{ color: 'var(--rose)' }}>Declined by {AGENT_NAME}</span>
      <p className="hint">{AGENT_NAME} is the Union's {AGENT_ROLE}, an AI agent. He can get things wrong, so a person hears any appeal.</p>
      <Checks validation={claim.latest.validation} only={['fail']} />
      {open ? (
        <form
          className="stack"
          style={{ '--stack': '10px' }}
          onSubmit={(e) => {
            e.preventDefault()
            appeal()
          }}
        >
          <label className="label" htmlFor="appeal-reason">Why did {AGENT_NAME} get it wrong? Your society treasurer will read this.</label>
          <textarea id="appeal-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
          <ErrorText error={error} />
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={pending || !reason.trim()}>
              {pending ? 'Sending…' : 'Send appeal'}
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="row">
          <Link to={`/claims/${claim.id}/edit`} className="btn btn-primary btn-sm">
            Fix and resubmit
          </Link>
          {!tampered && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
              Appeal to your society treasurer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClaimDetail() {
  const { id } = useParams()
  const { state } = useLocation()
  const { user } = useSession()
  const { data: claim, error } = useApi(() => api.getClaim(id), [id])

  if (error) return <Empty title="Couldn't open claim">{error.message}</Empty>
  if (!claim) return <Loading />

  const v = claim.latest
  const f = v.fields
  const review = claim.latestReview
  const mine = claim.claimantId === user.id
  const p = claim.payment

  return (
    <>
      <PageHead
        eyebrow={`${claim.reference} · ${claim.society.name}${claim.currentVersion > 1 ? ` · v${claim.currentVersion}` : ''}`}
        title={f.merchant}
        lede={CLAIM_STATUS_META[claim.status]?.member}
      >
        <StatusPill status={claim.status} />
      </PageHead>

      <div className="stack" style={{ '--stack': '12px', marginBottom: 28 }}>
        {state?.submitted && claim.status === 'awaiting_ledger' && (
          <Notice tone="sage" title={`Approved by ${AGENT_NAME}, the Union's ${AGENT_ROLE}.`}>
            No society treasurer needs to review it. It's waiting for the Union treasurer to sign the payment on the Ledger.
          </Notice>
        )}
        {claim.status === 'pending_review' && claim.appeal && (
          <Notice tone="ice" title="Appeal sent to your society treasurer">
            “{claim.appeal.reason}”
          </Notice>
        )}
        {mine && claim.status === 'returned' && review && (
          <Notice
            tone="copper"
            title={review.resolution === 'edit_existing' ? 'Edit this claim and resubmit' : 'Start a new claim'}
            action={
              review.resolution === 'edit_existing' ? (
                <Link to={`/claims/${claim.id}/edit`} className="btn btn-primary btn-sm">
                  Edit claim
                </Link>
              ) : (
                <Link to={`/claims/new?from=${claim.id}`} className="btn btn-primary btn-sm">
                  Start new claim
                </Link>
              )
            }
          >
            “{review.reason}”
          </Notice>
        )}
        {mine && claim.status === 'validation_failed' && <Appeal claim={claim} />}
        {claim.status === 'rejected' && review && (
          <Notice tone="rose" title="Appeal denied by your society treasurer">
            “{review.reason}”
          </Notice>
        )}
      </div>

      <div className="split">
        <div className="sticky">
          <Receipt receipt={v.receipt} />
        </div>

        <div className="stack" style={{ '--stack': '40px' }}>
          <section>
            <div className="section-head">
              <h2>What you claimed</h2>
              <span className="faint" style={{ fontSize: 13 }}>
                {v.entryMode === 'ai_prefill' ? 'AI pre-filled, confirmed by you' : 'Entered by you'}
              </span>
            </div>
            <dl className="kv">
              <dt>Amount</dt>
              <dd className="tnum" style={{ fontSize: 16, color: 'var(--white)' }}>
                {fmtMoney(f.amount, f.currency)}
              </dd>
              <dt>Merchant</dt>
              <dd>{f.merchant}</dd>
              <dt>Receipt date</dt>
              <dd>{fmtDate(f.date)}</dd>
              <dt>Category</dt>
              <dd>{CATEGORIES[f.category]}</dd>
              <dt>For</dt>
              <dd>{f.description}</dd>
              <dt>Paid to</dt>
              <dd>
                <span className="addr">{shortAddr(claim.claimant.walletAddress)}</span> <span className="faint">· saved wallet</span>
              </dd>
            </dl>
          </section>

          {p && (
            <section>
              <div className="section-head">
                <h2>Payment</h2>
              </div>
              <dl className="kv">
                <dt>Amount</dt>
                <dd className="tnum">
                  {fmtMoney(p.amount, 'USDC')} <span className="faint">({fmtMoney(p.fiatAmount, p.fiatCurrency)} @ {p.fxRate})</span>
                </dd>
                <dt>Network</dt>
                <dd>{NETWORKS[p.network]?.label ?? p.network}</dd>
                <dt>Transaction</dt>
                <dd>
                  {p.txHash ? (
                    <a className="link addr" href={`${NETWORKS[p.network]?.explorer}${p.txHash}`} target="_blank" rel="noreferrer">
                      {shortAddr(p.txHash)}
                    </a>
                  ) : (
                    <span className="faint">Not signed yet</span>
                  )}
                </dd>
              </dl>
            </section>
          )}

          <section>
            <div className="section-head">
              <h2>Automated checks</h2>
            </div>
            <Checks validation={v.validation} />
          </section>

          <section>
            <div className="section-head">
              <h2>History</h2>
            </div>
            <ClaimTimeline claim={claim} />
          </section>
        </div>
      </div>
    </>
  )
}
