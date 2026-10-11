import { useEffect, useRef, useState } from 'react'
import { api, isMock } from '../data/api.js'
import { useAction } from '../state/AppState.jsx'
import { fmtMoney, shortAddr } from '../lib/format.js'
import { NETWORKS } from '../config.js'
import { ErrorText, Icon } from './ui.jsx'

function HoldToSign({ onDone, disabled, duration = 1300 }) {
  const [p, setP] = useState(0)
  const raf = useRef(0)
  const start = useRef(0)
  const done = useRef(false)

  const tick = (t) => {
    if (!start.current) start.current = t
    const next = Math.min(1, (t - start.current) / duration)
    setP(next)
    if (next >= 1) {
      done.current = true
      onDone()
      return
    }
    raf.current = requestAnimationFrame(tick)
  }
  const down = () => {
    if (disabled || done.current) return
    start.current = 0
    raf.current = requestAnimationFrame(tick)
  }
  const up = () => {
    cancelAnimationFrame(raf.current)
    if (!done.current) setP(0)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <button
      type="button"
      className="hold"
      disabled={disabled}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && down()}
      onKeyUp={up}
    >
      <span className="fill" style={{ transform: `scaleX(${p})` }} />
      <span>{p >= 1 ? 'Signed' : 'Hold to sign'}</span>
    </button>
  )
}

/**
 * Simulates the treasurer's Ledger prompt. In production the backend builds the transaction from the
 * trusted payment record and the physical device shows these values (ERC-7730 clear signing).
 */
export default function LedgerSignModal({ payment, claim, onClose }) {
  const [stage, setStage] = useState('connecting')
  const [outcome, setOutcome] = useState('confirm')
  const [confirm, confirmState] = useAction((id, o) => api.confirmOnDevice(id, o))
  const [cancel, cancelState] = useAction((id) => api.cancelOnDevice(id))
  const net = NETWORKS[payment.network]?.label ?? payment.network

  useEffect(() => {
    const t = setTimeout(() => setStage('review'), 1100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && stage !== 'signing' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stage, onClose])

  const sign = async () => {
    setStage('signing')
    const res = await confirm(payment.id, { demoOutcome: outcome })
    setStage(res.ok ? 'sent' : 'review')
  }
  const reject = async () => {
    const res = await cancel(payment.id)
    if (res.ok) setStage('rejected')
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ledger-title">
      <div className="modal">
        <div className="modal-head">
          <div className="row" style={{ gap: 14 }}>
            <span className="eyebrow">Human approval</span>
            <h3 id="ledger-title">Sign {claim.reference} on your Ledger</h3>
          </div>
          <button className="btn btn-quiet btn-sm" onClick={onClose} disabled={stage === 'signing'}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="ledger-grid">
            <div>
              <div className="device">
                <div className="device-screen">
                  {stage === 'connecting' && (
                    <div className="device-center">
                      <div className="spinner" />
                      <div style={{ fontSize: 13 }}>Waiting for device…</div>
                    </div>
                  )}
                  {(stage === 'review' || stage === 'signing') && (
                    <>
                      <div className="ds-title">Reimburse claim</div>
                      <div className="ds-sub">
                        {claim.society.name} · {claim.reference} v{payment.claimVersion}
                      </div>
                      <div className="ds-rows">
                        <div className="ds-row">
                          <div className="ds-k">Amount</div>
                          <div className="ds-v">{fmtMoney(payment.amount, 'USDC')}</div>
                        </div>
                        <div className="ds-row">
                          <div className="ds-k">To</div>
                          <div className="ds-v addr">{payment.recipientAddress}</div>
                        </div>
                        <div className="ds-row">
                          <div className="ds-k">Network</div>
                          <div className="ds-v">{net}</div>
                        </div>
                      </div>
                      <div className="ds-actions">
                        <HoldToSign onDone={sign} disabled={stage === 'signing' || cancelState.pending} />
                        <button className="ds-reject" onClick={reject} disabled={stage === 'signing' || cancelState.pending}>
                          Reject
                        </button>
                      </div>
                    </>
                  )}
                  {stage === 'sent' && (
                    <div className="device-center">
                      <Icon name="check" size={36} style={{ color: '#3c7a54' }} />
                      <div className="ds-title">Transaction signed</div>
                      <div className="ds-sub">Broadcasting from SocFi</div>
                    </div>
                  )}
                  {stage === 'rejected' && (
                    <div className="device-center">
                      <Icon name="x" size={36} />
                      <div className="ds-title">Transaction rejected</div>
                      <div className="ds-sub">Nothing was signed</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="device-label">Ledger Flex · {isMock ? 'simulated' : 'connected'}</div>
            </div>

            <div className="stack" style={{ '--stack': '22px' }}>
              {stage === 'sent' ? (
                <>
                  <h2>Signed. Waiting for the network.</h2>
                  <p className="muted">
                    The claim shows <em>Payment pending</em> until the transaction is confirmed on-chain. It is only marked paid
                    after confirmation.
                  </p>
                  <button className="btn btn-primary" onClick={onClose}>
                    Back to claim
                  </button>
                </>
              ) : stage === 'rejected' ? (
                <>
                  <h2>Rejected on device.</h2>
                  <p className="muted">
                    No transaction was signed or sent. The claim stays approved, so you can send it to the Ledger again or
                    leave it.
                  </p>
                  <button className="btn btn-primary" onClick={onClose}>
                    Back to claim
                  </button>
                </>
              ) : (
                <>
                  <div className="stack" style={{ '--stack': '8px' }}>
                    <h2>Check the screen, not this page.</h2>
                    <p className="muted">
                      Your computer could be compromised. Compare the amount and recipient shown on the device with the claim
                      you approved. If anything differs, reject.
                    </p>
                  </div>
                  <dl className="kv">
                    <dt>Approved claim</dt>
                    <dd>
                      {claim.reference} · version {payment.claimVersion}
                    </dd>
                    <dt>Claimed</dt>
                    <dd className="tnum">
                      {fmtMoney(payment.fiatAmount, payment.fiatCurrency)}{' '}
                      <span className="faint">
                        @ {payment.fxRate} → {fmtMoney(payment.amount, 'USDC')}
                      </span>
                    </dd>
                    <dt>Recipient</dt>
                    <dd>
                      {claim.claimant.displayName}
                      <span className="faint"> · saved wallet {shortAddr(payment.recipientAddress)}</span>
                    </dd>
                    <dt>From</dt>
                    <dd className="addr">Treasury {shortAddr(payment.sourceAddress)}</dd>
                  </dl>
                  {isMock && (
                    <div className="field">
                      <label htmlFor="outcome">Demo: what the network does next</label>
                      <select id="outcome" className="select" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                        <option value="confirm">Confirms normally (~4s)</option>
                        <option value="uncertain">RPC times out — outcome unknown</option>
                      </select>
                    </div>
                  )}
                  <ErrorText error={confirmState.error || cancelState.error} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
