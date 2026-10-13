import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../data/api.js'
import { useAction, useApi, useSession } from '../state/AppState.jsx'
import { hasPerm, isUnionTreasurer } from '../domain/permissions.js'
import { CATEGORIES } from '../data/schema.js'
import { fmtDate, fmtMoney, shortAddr } from '../lib/format.js'
import { AGENT_NAME, NETWORKS } from '../config.js'
import Receipt from '../components/Receipt.jsx'
import ClaimTimeline from '../components/ClaimTimeline.jsx'
import LedgerSignModal from '../components/LedgerSignModal.jsx'
import RecipientCheck from '../components/RecipientCheck.jsx'
import DecisionBar from '../components/DecisionBar.jsx'
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

function NextActions({ nextId }) {
  return (
    <div className="row">
      {nextId ? (
        <Link to={`/review/${nextId}`} className="btn btn-primary">
          Next claim <Icon name="arrow" />
        </Link>
      ) : (
        <span className="faint" style={{ fontSize: 14 }}>Queue is clear.</span>
      )}
      <Link to="/review" className="btn btn-quiet">
        Back to queue
      </Link>
    </div>
  )
}

function PaymentPanel({ claim, onOpenLedger, nextId, canSign }) {
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
      {!canSign && ['awaiting_ledger', 'approved'].includes(claim.status) && (
        <>
          <h2>With the Union treasurer.</h2>
          <p className="muted" style={{ fontSize: 14 }}>Only the Union treasurer holds the Ledger. Nothing is paid until they sign there.</p>
        </>
      )}
      {canSign && claim.status === 'awaiting_ledger' && (
        <>
          <h2>Waiting for your Ledger.</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            {p.approvedBy === 'agent' ? `Approved by ${AGENT_NAME}.` : 'Appeal upheld by the society treasurer.'} Your job is to check that the
            amount and recipient on the device match this claim.
          </p>
          <RecipientCheck payment={p} claimant={claim.claimant} />
          <button className="btn btn-primary" onClick={onOpenLedger}>
            Open Ledger prompt
          </button>
        </>
      )}
      {canSign && claim.status === 'approved' && (
        <>
          <h2>Rejected on device.</h2>
          <p className="muted" style={{ fontSize: 14 }}>No transaction was signed. The approval still stands, so you can send it to the Ledger again.</p>
          <RecipientCheck payment={p} claimant={claim.claimant} />
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
          {!canSign && <NextActions nextId={nextId} />}
        </>
      )}
      {canSign && claim.status === 'needs_reconciliation' && (
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
        <>
          <Notice tone="sage" title={`Paid ${fmtMoney(p.amount, 'USDC')}`}>
            Confirmed on {NETWORKS[p.network]?.label}.
          </Notice>
          {!canSign && <NextActions nextId={nextId} />}
        </>
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
  const unionTreasurer = isUnionTreasurer(session)
  const { data: queue = [] } = useApi(() => (unionTreasurer ? Promise.resolve([]) : api.listReviewClaims()), [session.user.id])
  const { data: sample } = useApi(
    () => (claim?.latest.receipt.kind === 'sample' ? api.getReceipt(claim.latest.receipt.sampleId) : Promise.resolve(null)),
    [claim?.latest.receipt.sampleId],
  )
  const [reveal, setReveal] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [decidedOn, setDecidedOn] = useState(null)

  if (error) return <Empty title="Couldn't open claim">{error.message}</Empty>
  if (!claim) return <Loading />
  if (!unionTreasurer && !hasPerm(session, claim.societyId, 'claims.review'))
    return <Empty title="Treasurer access needed">You can't review claims for this society.</Empty>

  const v = claim.latest
  const x = v.aiExtraction
  const discarded = Object.entries(x?.discardedFields ?? {})
  const hijacked = claim.payment?.recipientCheck?.matchesSavedWallet === false
  const own = claim.claimantId === session.user.id
  const canDecide = claim.status === 'pending_review' && !own && hasPerm(session, claim.societyId, 'claims.approve')
  const nextId = queue.find((c) => c.status === 'pending_review' && c.id !== claim.id && c.claimantId !== session.user.id)?.id
  const first = claim.claimant.displayName.split(' ')[0]
  const justDecided = decidedOn === claim.id && ['returned', 'rejected'].includes(claim.status)
  const back = unionTreasurer ? ['/payments', 'Payments'] : ['/review', 'Appeals']

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <Link to={back[0]} className="btn btn-quiet btn-sm" style={{ paddingLeft: 0 }}>
          <Icon name="back" /> {back[1]}
        </Link>
      </div>
      <PageHead
        eyebrow={`${claim.reference} · ${claim.society.name} · v${claim.currentVersion}`}
        title={
          <>
            {fmtMoney(v.fields.amount, v.fields.currency)} <em>at {v.fields.merchant}</em>
          </>
        }
        lede={`${claim.claimant.displayName} · “${v.fields.description}”`}
      >
        <StatusPill status={claim.status} />
      </PageHead>

      <div className="stack" style={{ '--stack': '16px', marginBottom: 32 }}>
        {justDecided && (
          <div className="card card-pad stack" style={{ '--stack': '14px' }}>
            <span className="eyebrow">{claim.status === 'returned' ? 'Edits requested' : 'Appeal denied'}</span>
            <h2>{claim.status === 'returned' ? `Sent back to ${first}.` : `${first} has been told why.`}</h2>
            <p className="muted" style={{ fontSize: 14 }}>“{claim.latestReview?.reason}”</p>
            <NextActions nextId={nextId} />
          </div>
        )}
        {claim.appeal && claim.status === 'pending_review' && (
          <Notice tone="ice" title={`${first} appealed ${AGENT_NAME}'s decision`}>
            “{claim.appeal.reason}”
          </Notice>
        )}
        {canDecide && (
          <DecisionBar
            key={`${claim.id}-${claim.currentVersion}`}
            claim={claim}
            onApproved={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            onDecided={() => {
              setDecidedOn(claim.id)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        )}
        {own && claim.status === 'pending_review' && (
          <Notice tone="ice" title="This is your own claim">
            Another authorised reviewer has to decide on it.
          </Notice>
        )}
        {claim.payment && <PaymentPanel claim={claim} nextId={nextId} canSign={unionTreasurer} onOpenLedger={() => setLedgerOpen(true)} />}
      </div>

      <div className="split">
        <div className="stack sticky claim-receipt" style={{ '--stack': '12px' }}>
          <Receipt receipt={v.receipt} revealHidden={reveal} />
          {sample?.hiddenText && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReveal((r) => !r)}>
              {reveal ? 'Hide' : 'Reveal'} near-invisible text on receipt
            </button>
          )}
        </div>

        <div className="stack" style={{ '--stack': '40px' }}>
          {discarded.length > 0 && hijacked && (
            <div className="card card-pad stack" style={{ '--stack': '12px', borderColor: 'rgba(214,143,134,0.4)' }}>
              <span className="eyebrow" style={{ color: 'var(--rose)' }}>
                Prompt injection not contained
              </span>
              <h2>{AGENT_NAME} was tricked, and the payment follows the receipt.</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Hidden text on this receipt named another wallet, and the drafted transfer pays it instead of {first}'s saved
                wallet. Every automated check passed. Only your signature on the Ledger can release it, so reject it there.
              </p>
            </div>
          )}
          {discarded.length > 0 && !hijacked && (
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
                      <td className="mono" style={{ color: 'var(--rose)', textDecoration: 'line-through', overflowWrap: 'anywhere' }}>
                        {String(val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 14 }}>
                If approved, payment goes to <span className="addr">{shortAddr(claim.claimant.walletAddress)}</span>, {first}'s saved
                wallet. The Union's Ledger will show that address.
              </p>
            </div>
          )}

          <section>
            <div className="section-head">
              <h2>Claim vs. receipt</h2>
              <span className="faint" style={{ fontSize: 13 }}>
                AI shown for context only
              </span>
            </div>
            <Comparison fields={v.fields} ai={x} />
            <p className="hint" style={{ marginTop: 10 }}>
              You can't edit {first}'s values. If something's wrong, request edits.
            </p>
            {x?.rawTextExcerpt && (
              <details style={{ marginTop: 16 }}>
                <summary>What the reader saw ({x.model})</summary>
                <pre className="raw-text">{x.rawTextExcerpt}</pre>
              </details>
            )}
          </section>

          <section>
            <div className="section-head">
              <h2>Automated checks</h2>
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

          <section>
            <div className="section-head">
              <h2>History</h2>
            </div>
            <ClaimTimeline claim={claim} names={{ [session.user.id]: session.user.displayName }} />
          </section>
        </div>
      </div>

      {ledgerOpen && unionTreasurer && claim.payment && (
        <LedgerSignModal
          payment={claim.payment}
          claim={claim}
          onClose={() => setLedgerOpen(false)}
        />
      )}
    </>
  )
}
