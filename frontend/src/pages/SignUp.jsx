import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../data/api.js'
import { useAction, useSession } from '../state/AppState.jsx'
import { EMAIL_PLACEHOLDER, UNI_EMAIL_SUFFIX, UNION_NAME } from '../config.js'
import { ErrorText } from '../components/ui.jsx'

export default function SignUp() {
  const session = useSession()
  const navigate = useNavigate()
  const [form, setForm] = useState({ displayName: '', email: '', walletAddress: '' })
  const [signUp, { pending, error }] = useAction((f) => api.signUp(f))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  if (session?.user) return <Navigate to={session.user.emailVerified ? '/' : '/verify'} replace />

  const submit = async (e) => {
    e.preventDefault()
    const res = await signUp(form)
    if (res.ok) navigate('/verify')
  }

  return (
    <div className="split-r" style={{ maxWidth: 980, margin: '24px auto 0' }}>
      <form className="stack" style={{ '--stack': '28px' }} onSubmit={submit}>
        <div className="stack" style={{ '--stack': '12px' }}>
          <span className="eyebrow ruled">Create account · step 1 of 2</span>
          <h1>Start with your university email.</h1>
          <p className="lede">We'll send a code to prove the address is yours. Typing it isn't enough.</p>
        </div>

        <div className="stack" style={{ '--stack': '18px' }}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" className="input" value={form.displayName} onChange={set('displayName')} autoComplete="name" placeholder="As it appears in Union records" required />
            <span className="hint">Used to match committee records, so use the name the Union has on file.</span>
          </div>
          <div className="field">
            <label htmlFor="email">University email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" placeholder={EMAIL_PLACEHOLDER} required />
            <span className="hint">Must end in {UNI_EMAIL_SUFFIX}</span>
          </div>
          <div className="field">
            <label htmlFor="wallet">
              Payout wallet <span className="faint">(optional now, needed before you claim)</span>
            </label>
            <input id="wallet" className="input mono" value={form.walletAddress} onChange={set('walletAddress')} placeholder="0x…" spellCheck={false} />
            <span className="hint">USDC reimbursements go only to this address.</span>
          </div>
        </div>

        <ErrorText error={error} />
        <div className="row">
          <button className="btn btn-primary" disabled={pending}>
            {pending ? 'Sending code…' : 'Send verification code'}
          </button>
        </div>
      </form>

      <aside className="card card-pad stack" style={{ '--stack': '14px', marginTop: 8 }}>
        <span className="eyebrow quiet">What happens next</span>
        <ol className="timeline">
          <li>
            <span className="dot on" />
            <div>
              <div className="t">Verify your email</div>
              <div className="when">Your account stays restricted until you do</div>
            </div>
          </li>
          <li>
            <span className="dot" />
            <div>
              <div className="t">Join your society</div>
              <div className="when">Request membership or use an invite code</div>
            </div>
          </li>
          <li>
            <span className="dot" />
            <div>
              <div className="t">On the committee?</div>
              <div className="when">Claim your role. We check it against {UNION_NAME}'s records</div>
            </div>
          </li>
        </ol>
      </aside>
    </div>
  )
}
