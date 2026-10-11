import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { CATEGORIES, CLAIM_STATUS_META } from '../data/schema.js'
import { fmtDate, fmtMoney, shortAddr } from '../lib/format.js'
import { NETWORKS } from '../config.js'
import Receipt from '../components/Receipt.jsx'
import ClaimTimeline from '../components/ClaimTimeline.jsx'
import { Checks, Empty, Loading, Notice, PageHead, StatusPill } from '../components/ui.jsx'

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
        {state?.submitted && claim.status === 'pending_review' && (
          <Notice tone="sage" title="Submitted. All seven checks passed.">
            It's now in your treasurer's review queue. You'll see their decision here.
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
        {mine && claim.status === 'validation_failed' && (
          <Notice tone="rose" title="Automated checks failed" action={<Link to={`/claims/${claim.id}/edit`} className="btn btn-primary btn-sm">Fix and resubmit</Link>}>
            See which checks failed below.
          </Notice>
        )}
        {claim.status === 'rejected' && review && (
          <Notice tone="rose" title="Denied by the treasurer">
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
