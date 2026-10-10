import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../data/api.js'
import { useAction, useSession } from '../state/AppState.jsx'
import { ROLE_LABELS } from '../data/schema.js'
import { fmtDate } from '../lib/format.js'
import { societiesWithPerm } from '../domain/permissions.js'
import { ErrorText, Icon, PageHead } from '../components/ui.jsx'

export default function Account() {
  const session = useSession()
  const { user, memberships } = session
  const navigate = useNavigate()
  const [wallet, setWallet] = useState(user.walletAddress ?? '')
  const [saved, setSaved] = useState(false)
  const [save, { pending, error }] = useAction((w) => api.updateProfile({ walletAddress: w }))
  const [signOut] = useAction(() => api.signOut())

  return (
    <>
      <PageHead eyebrow="Account" title={user.displayName}>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await signOut()
            navigate('/')
          }}
        >
          Sign out
        </button>
      </PageHead>

      {/* On phones the top nav is replaced by the tab bar; everything else lives here. */}
      <nav className="only-mobile" aria-label="More" style={{ marginBottom: 32 }}>
        <table className="table">
          <tbody>
            {[
              ['/societies', 'Societies', true],
              ['/committee', 'Committee access', true],
              ['/payments', 'Payments', societiesWithPerm(session, 'payments.initiate').length > 0],
              ['/setup', 'Treasury setup', societiesWithPerm(session, 'society.configure_reimbursement').length > 0],
              ['/audit', 'Audit log', true],
            ]
              .filter(([, , show]) => show)
              .map(([to, label]) => (
                <tr key={to}>
                  <td>
                    <Link to={to} className="row between" style={{ width: '100%' }}>
                      {label} <Icon name="arrow" />
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </nav>

      <div className="grid grid-2" style={{ alignItems: 'start', gap: 40 }}>
        <section className="stack" style={{ '--stack': '20px' }}>
          <dl className="kv">
            <dt>Email</dt>
            <dd>
              {user.email} <span className="pill tone-sage" style={{ marginLeft: 8 }}>Verified</span>
            </dd>
            <dt>Member since</dt>
            <dd>{fmtDate(user.createdAt)}</dd>
          </dl>

          <form
            className="card card-pad stack"
            style={{ '--stack': '14px' }}
            onSubmit={async (e) => {
              e.preventDefault()
              setSaved(false)
              const res = await save(wallet.trim())
              if (res.ok) setSaved(true)
            }}
          >
            <span className="eyebrow">Payout wallet</span>
            <p className="muted" style={{ fontSize: 14 }}>
              Every reimbursement is sent here, in USDC. Payments are never sent to an address found on a
              receipt, and you can't change this while a payment is in progress.
            </p>
            <input className="input mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…" spellCheck={false} aria-label="Payout wallet address" />
            <ErrorText error={error} />
            <div className="row">
              <button className="btn btn-primary btn-sm" disabled={pending || wallet.trim() === (user.walletAddress ?? '')}>
                {pending ? 'Saving…' : 'Save wallet'}
              </button>
              {saved && <span className="faint" style={{ fontSize: 13 }}>Saved</span>}
            </div>
          </form>
        </section>

        <section>
          <div className="section-head">
            <h2>Memberships</h2>
            <Link to="/committee" className="link" style={{ fontSize: 14 }}>
              Claim a committee role
            </Link>
          </div>
          {memberships.length === 0 ? (
            <p className="muted">
              None yet. <Link to="/societies" className="link">Find your society</Link>
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Society</th>
                  <th>Role</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr key={m.id}>
                    <td>{m.society.name}</td>
                    <td>{m.status === 'pending' ? <span className="pill tone-neutral">Pending</span> : ROLE_LABELS[m.role]}</td>
                    <td className="mono faint" style={{ fontSize: 11.5 }}>
                      {m.permissions.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  )
}
