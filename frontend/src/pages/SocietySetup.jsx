import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, isMock } from '../data/api.js'
import { useAction, useApi, useSession } from '../state/AppState.jsx'
import { hasPerm } from '../domain/permissions.js'
import { CATEGORIES, SETUP_STEPS } from '../data/schema.js'
import { fmtDate, fmtMoney, isEvmAddress } from '../lib/format.js'
import { NETWORKS } from '../config.js'
import { Empty, ErrorText, Icon, Loading, Notice, PageHead } from '../components/ui.jsx'

const stepDone = (setup, id) => (id === 'unionApproval' ? setup.unionApproval === 'approved' : !!setup[id])

function Step({ n, title, done, children }) {
  return (
    <section className="card" style={{ borderColor: done ? 'var(--line)' : 'var(--line-2)' }}>
      <div className="card-head">
        <div className="row" style={{ gap: 14 }}>
          <span className="mono faint">{String(n).padStart(2, '0')}</span>
          <h3>{title}</h3>
        </div>
        {done ? <span className="pill tone-sage">Done</span> : <span className="pill tone-neutral">To do</span>}
      </div>
      {children && <div className="card-pad stack" style={{ '--stack': '14px' }}>{children}</div>}
    </section>
  )
}

function MembershipRequests({ societyId }) {
  const { data: requests = [] } = useApi(() => api.listMembershipRequests(societyId), [societyId])
  const [decide, { error }] = useAction((id, ok) => api.decideMembership(id, ok))
  if (!requests.length) return null
  return (
    <section className="section">
      <div className="section-head">
        <h2>Membership requests</h2>
      </div>
      <table className="table">
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>
                {r.user.displayName}
                <span className="sub">{r.user.email}</span>
              </td>
              <td className="right">
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn btn-quiet btn-sm" onClick={() => decide(r.id, false)}>
                    Decline
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => decide(r.id, true)}>
                    Approve
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorText error={error} />
    </section>
  )
}

export default function SocietySetup() {
  const { societyId } = useParams()
  const session = useSession()
  const { data: society, error: loadError } = useApi(() => api.getSociety(societyId), [societyId])
  const [wallet, setWallet] = useState('')
  const [policy, setPolicy] = useState({ perClaimLimit: '', termBudget: '', allowedCategories: [] })
  const [saveWallet, walletState] = useAction((w) => api.updateReimbursementSetup(societyId, { treasuryWallet: w }))
  const [savePolicy, policyState] = useAction((p) => api.updateReimbursementSetup(societyId, p))
  const [pair, pairState] = useAction(() => api.pairLedger(societyId))
  const [requestApproval, approvalState] = useAction(() => api.requestUnionApproval(societyId))
  const [unionApprove] = useAction(() => api.demoUnionApprove(societyId))
  const [enable, enableState] = useAction(() => api.enableReimbursement(societyId))

  useEffect(() => {
    if (!society) return
    const r = society.reimbursement
    setWallet(r.treasuryWallet ?? '')
    setPolicy({ perClaimLimit: r.perClaimLimit ?? '', termBudget: r.termBudget ?? '', allowedCategories: r.allowedCategories ?? [] })
  }, [society?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasPerm(session, societyId, 'society.configure_reimbursement'))
    return <Empty title="Treasurer access needed">Only a verified treasurer can configure reimbursement.</Empty>
  if (loadError) return <Empty title="Couldn't load society">{loadError.message}</Empty>
  if (!society) return <Loading />

  const r = society.reimbursement
  const s = r.setup
  const enabled = r.status === 'enabled'
  const allDone = SETUP_STEPS.every((st) => stepDone(s, st.id))
  const toggleCat = (c) =>
    setPolicy((p) => ({
      ...p,
      allowedCategories: p.allowedCategories.includes(c) ? p.allowedCategories.filter((x) => x !== c) : [...p.allowedCategories, c],
    }))

  return (
    <>
      <PageHead
        eyebrow={`Treasury setup · ${society.unionId}`}
        title={society.name}
        lede={
          enabled
            ? `Reimbursement has been enabled since ${fmtDate(r.enabledAt)}. Members are paid in ${r.token} on ${NETWORKS[r.network]?.label}.`
            : 'Reimbursement stays off until every check below passes. Being matched as treasurer is not enough on its own.'
        }
      >
        <span className={`pill ${enabled ? 'tone-sage' : 'tone-neutral'}`}>{enabled ? 'Reimbursement enabled' : 'Reimbursement disabled'}</span>
      </PageHead>

      <div className="split-r">
        <div className="stack" style={{ '--stack': '16px' }}>
          <Step n={1} title={SETUP_STEPS[0].label} done={s.committeeVerified}>
            <p className="muted" style={{ fontSize: 14 }}>
              {s.committeeVerified ? 'Your committee-record match is on the audit log.' : 'Claim the treasurer role on the Committee access page first.'}
            </p>
          </Step>

          <Step n={2} title={SETUP_STEPS[1].label} done={s.treasuryWalletSet}>
            <p className="muted" style={{ fontSize: 14 }}>
              The society's USDC treasury. Payments are signed from here by the paired Ledger, never by the server or the agent.
            </p>
            <div className="input-group">
              <input className="input mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…" spellCheck={false} disabled={enabled} aria-label="Treasury wallet" />
              {!enabled && (
                <button className="btn btn-ghost btn-sm" disabled={!isEvmAddress(wallet) || wallet === r.treasuryWallet || walletState.pending} onClick={() => saveWallet(wallet)}>
                  Save
                </button>
              )}
            </div>
            <ErrorText error={walletState.error} />
          </Step>

          <Step n={3} title={SETUP_STEPS[2].label} done={s.ledgerPaired}>
            {r.ledgerDevice ? (
              <p style={{ fontSize: 14 }}>
                {r.ledgerDevice.model} <span className="faint">· genuine check passed {fmtDate(r.ledgerDevice.genuineCheckAt)}</span>
              </p>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 14 }}>
                  Connect the treasurer's Ledger. We run a genuine check so payments can only be approved on real hardware.
                </p>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => pair()} disabled={pairState.pending}>
                    {pairState.pending ? (
                      <>
                        <span className="spinner dark" style={{ width: 14, height: 14 }} /> Running genuine check…
                      </>
                    ) : (
                      `Pair Ledger${isMock ? ' (simulated)' : ''}`
                    )}
                  </button>
                </div>
              </>
            )}
            <ErrorText error={pairState.error} />
          </Step>

          <Step n={4} title={SETUP_STEPS[3].label} done={s.policySet}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="limit">Per-claim limit (£)</label>
                <input id="limit" type="number" min="1" className="input tnum" value={policy.perClaimLimit} onChange={(e) => setPolicy((p) => ({ ...p, perClaimLimit: e.target.value }))} disabled={enabled} />
              </div>
              <div className="field">
                <label htmlFor="budget">Term budget (£)</label>
                <input id="budget" type="number" min="1" className="input tnum" value={policy.termBudget} onChange={(e) => setPolicy((p) => ({ ...p, termBudget: e.target.value }))} disabled={enabled} />
              </div>
              <div className="field full">
                <span className="label">Allowed categories</span>
                <div className="row" style={{ gap: 8 }}>
                  {Object.entries(CATEGORIES).map(([k, label]) => (
                    <button key={k} type="button" className="chip" aria-pressed={policy.allowedCategories.includes(k)} onClick={() => toggleCat(k)} disabled={enabled}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {!enabled && (
              <div>
                <button className="btn btn-ghost btn-sm" disabled={policyState.pending} onClick={() => savePolicy(policy)}>
                  Save policy
                </button>
              </div>
            )}
            <ErrorText error={policyState.error} />
          </Step>

          <Step n={5} title={SETUP_STEPS[4].label} done={s.unionApproval === 'approved'}>
            {s.unionApproval === 'approved' ? (
              <p className="muted" style={{ fontSize: 14 }}>Approved by the Union finance office.</p>
            ) : s.unionApproval === 'requested' ? (
              <div className="row">
                <span className="pill tone-copper">Waiting for Union finance</span>
                {isMock && (
                  <button className="btn btn-quiet btn-sm" onClick={() => unionApprove()}>
                    Demo: approve as Union finance
                  </button>
                )}
              </div>
            ) : (
              <div className="row">
                <button className="btn btn-ghost btn-sm" onClick={() => requestApproval()} disabled={approvalState.pending}>
                  Request approval
                </button>
                <span className="hint">The other checks need to be done first.</span>
              </div>
            )}
            <ErrorText error={approvalState.error} />
          </Step>
        </div>

        <aside className="stack sticky" style={{ '--stack': '16px' }}>
          <div className="card card-pad stack" style={{ '--stack': '14px' }}>
            <span className="eyebrow">Status</span>
            <ul className="checks">
              {SETUP_STEPS.map((st) => {
                const ok = stepDone(s, st.id)
                return (
                  <li key={st.id} className={ok ? 'pass' : ''}>
                    <Icon name={ok ? 'check' : 'x'} className="mark" style={{ color: ok ? 'var(--sage)' : 'var(--line-3)' }} />
                    <span style={{ color: ok ? 'var(--bone)' : 'var(--fog)' }}>{st.label}</span>
                  </li>
                )
              })}
            </ul>
            {enabled ? (
              <dl className="kv">
                <dt>Spent this term</dt>
                <dd className="tnum">
                  {fmtMoney(r.spentThisTerm, r.currency)} of {fmtMoney(r.termBudget, r.currency)}
                </dd>
              </dl>
            ) : (
              <>
                <button className="btn btn-primary btn-block" disabled={!allDone || enableState.pending} onClick={() => enable()}>
                  Enable reimbursement
                </button>
                <ErrorText error={enableState.error} />
              </>
            )}
          </div>
          {!enabled && (
            <Notice tone="ice">
              Changing the wallet or policy after Union approval sends it back for approval again.
            </Notice>
          )}
        </aside>
      </div>

      <MembershipRequests societyId={societyId} />
    </>
  )
}
