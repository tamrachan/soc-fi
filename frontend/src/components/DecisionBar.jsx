import { useEffect, useRef, useState } from 'react'
import { api } from '../data/api.js'
import { useAction } from '../state/AppState.jsx'
import { checkStatus } from '../domain/rules.js'
import { CHECKS } from '../data/schema.js'
import { fmtMoney, shortAddr, toUsdc } from '../lib/format.js'
import { FX_TO_USDC, NETWORKS } from '../config.js'
import { ErrorText, Icon } from './ui.jsx'

const QUICK_REASONS = {
  return: [
    'Remove a personal item from the amount',
    'Amount doesn’t match the receipt',
    'Photo is unreadable. Upload a clearer one',
    'Wrong category',
    'Say which event this was for',
  ],
  reject: ['Not a society expense', 'Personal purchase', 'Duplicate of another claim', 'Receipt looks altered', 'Outside the society’s spending policy'],
}

const OPTIONS = [
  { id: 'approve', key: 'A', icon: 'check', label: 'Approve', tone: 'sage' },
  { id: 'return', key: 'E', icon: 'arrow', label: 'Request edits', tone: 'copper' },
  { id: 'reject', key: 'D', icon: 'x', label: 'Deny', tone: 'rose' },
]

/** What the treasurer should look at before deciding: warnings from the checks, or an all-clear. */
function Attention({ claim }) {
  const warns = claim.latest.validation.checks.filter((c) => checkStatus(c) === 'warn')
  const label = (id) => CHECKS.find((c) => c.id === id)?.label
  if (!warns.length)
    return (
      <p className="row" style={{ gap: 8, fontSize: 14, color: 'var(--silver)' }}>
        <Icon name="check" style={{ color: 'var(--sage)' }} /> All 7 checks passed and the AI’s read matches what {claim.claimant.displayName.split(' ')[0]} claimed.
      </p>
    )
  return (
    <div className="stack" style={{ '--stack': '6px' }}>
      <span className="eyebrow">
        {warns.length} thing{warns.length > 1 ? 's' : ''} to check on the receipt
      </span>
      {warns.map((c) => (
        <p key={c.id} className="row" style={{ gap: 8, fontSize: 14, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <Icon name="alert" style={{ color: 'var(--copper)', flex: 'none', marginTop: 2 }} />
          <span>
            <span style={{ color: 'var(--white)' }}>{label(c.id)}.</span> <span className="muted">{c.detail}</span>
          </span>
        </p>
      ))}
    </div>
  )
}

export default function DecisionBar({ claim, onApproved, onDecided }) {
  const [choice, setChoice] = useState(null)
  const [reason, setReason] = useState('')
  const [resolution, setResolution] = useState('edit_existing')
  const [review, { pending, error }] = useAction((args) => api.reviewClaim(claim.id, args))
  const panelRef = useRef(null)
  const first = claim.claimant.displayName.split(' ')[0]
  const f = claim.latest.fields
  const r = claim.society.reimbursement
  const usdc = toUsdc(f.amount, f.currency)

  const choose = (id) => {
    setChoice(id)
    if (id !== choice) setReason('')
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  // Keyboard: A approve, E request edits, D deny (ignored while typing)
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select')) return
      const opt = OPTIONS.find((o) => o.key.toLowerCase() === e.key.toLowerCase())
      if (opt) {
        e.preventDefault()
        choose(opt.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const addReason = (text) => setReason((cur) => (!cur.trim() ? text : cur.includes(text) ? cur : `${cur.trim().replace(/\.$/, '')}. ${text}`))

  const submit = async (e) => {
    e.preventDefault()
    const res = await review({ decision: choice, reason, resolution: choice === 'return' ? resolution : null, version: claim.currentVersion })
    if (!res.ok) return
    if (choice === 'approve') onApproved()
    else onDecided(choice)
  }

  return (
    <>
      <section className="card decision" id="decide">
        <div className="card-head">
          <h3>Your decision</h3>
          <span className="mono faint hide-sm" style={{ fontSize: 11.5 }}>
            on version {claim.currentVersion} · keys A / E / D
          </span>
        </div>
        <div className="card-pad stack" style={{ '--stack': '18px' }}>
          <Attention claim={claim} />

          <div className="decide-btns" role="group" aria-label="Decision">
            {OPTIONS.map((o) => (
              <button key={o.id} type="button" className={`decide tone-${o.tone}`} aria-pressed={choice === o.id} onClick={() => choose(o.id)}>
                <Icon name={o.icon} size={18} />
                <span className="decide-label">{o.label}</span>
                <span className="decide-sub">
                  {o.id === 'approve' ? `Pay ${fmtMoney(usdc, 'USDC')}` : o.id === 'return' ? `Send back to ${first}` : 'Close the claim'}
                </span>
                <kbd className="hide-sm">{o.key}</kbd>
              </button>
            ))}
          </div>

          {choice && (
            <form ref={panelRef} className="stack" style={{ '--stack': '16px' }} onSubmit={submit}>
              {choice === 'approve' && (
                <>
                  <p className="muted" style={{ fontSize: 14 }}>
                    Your approval covers exactly these values. If {first} changes anything, it comes back to you.
                  </p>
                  <dl className="kv">
                    <dt>Pay</dt>
                    <dd className="tnum" style={{ color: 'var(--white)' }}>
                      {fmtMoney(usdc, 'USDC')} <span className="faint">= {fmtMoney(f.amount, f.currency)} @ {FX_TO_USDC[f.currency]}</span>
                    </dd>
                    <dt>To</dt>
                    <dd>
                      <span className="addr">{shortAddr(claim.claimant.walletAddress)}</span>{' '}
                      <span className="faint">· {first}’s saved wallet</span>
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

              {choice !== 'approve' && (
                <>
                  {choice === 'return' && (
                    <div className="seg" role="group" aria-label="What should the member do?">
                      <button type="button" aria-pressed={resolution === 'edit_existing'} onClick={() => setResolution('edit_existing')}>
                        Edit this claim
                      </button>
                      <button type="button" aria-pressed={resolution === 'start_new'} onClick={() => setResolution('start_new')}>
                        Start a new claim
                      </button>
                    </div>
                  )}
                  <div className="field">
                    <span className="label">{choice === 'return' ? `Tell ${first} what to change` : `Reason (${first} will see this)`}</span>
                    <div className="row" style={{ gap: 6 }}>
                      {QUICK_REASONS[choice].map((q) => (
                        <button key={q} type="button" className="chip" style={{ fontSize: 12.5, padding: '5px 10px' }} onClick={() => addReason(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                    <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" placeholder="Tap a reason above or type your own" />
                  </div>
                </>
              )}

              <ErrorText error={error} />
              <button className={`btn ${choice === 'reject' ? 'btn-danger' : 'btn-primary'} btn-block`} disabled={pending || (choice !== 'approve' && !reason.trim())}>
                {pending ? 'Saving…' : choice === 'approve' ? 'Approve and sign on Ledger' : choice === 'return' ? `Send back to ${first}` : 'Deny claim'}
              </button>
              {choice === 'approve' && <p className="hint" style={{ textAlign: 'center' }}>Nothing is paid until you sign on the device.</p>}
            </form>
          )}
        </div>
      </section>

      {/* Phones: the three choices stay under the thumb while scrolling the receipt */}
      {!choice && <div className="only-mobile" style={{ height: 64 }} aria-hidden="true" />}
      {!choice && (
        <div className="decide-sticky only-mobile">
          {OPTIONS.map((o) => (
            <button key={o.id} type="button" className={`decide-mini tone-${o.tone}`} onClick={() => choose(o.id)}>
              <Icon name={o.icon} size={16} /> {o.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
