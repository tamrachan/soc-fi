import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, isMock } from '../data/api.js'
import { useAction, useSession } from '../state/AppState.jsx'
import { ErrorText, Notice } from '../components/ui.jsx'

export default function VerifyEmail() {
  const session = useSession()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [verify, verifyState] = useAction((c) => api.verifyEmail({ code: c }))
  const [resend, resendState] = useAction(() => api.resendVerification())
  const [signOut] = useAction(() => api.signOut())

  const user = session?.user
  if (!user) return <Navigate to="/signup" replace />
  if (user.emailVerified)
    return (
      <div className="stack" style={{ '--stack': '24px', maxWidth: 620, margin: '24px auto 0' }}>
        <span className="eyebrow ruled">Account active</span>
        <h1>You're verified.</h1>
        <p className="lede">What do you need to do first?</p>
        <div className="grid grid-2">
          <Link to="/societies" className="option">
            <span className="num">A</span>
            <h3>Join a society</h3>
            <p>Find your society and request membership, or join with an invite code.</p>
          </Link>
          <Link to="/committee" className="option">
            <span className="num">B</span>
            <h3>Committee access</h3>
            <p>Treasurer or logistics? We'll match you against the Union's committee records.</p>
          </Link>
        </div>
      </div>
    )

  const submit = async (e) => {
    e.preventDefault()
    const res = await verify(code.trim())
    if (res.ok) navigate('/verify', { replace: true })
  }

  return (
    <form className="stack" style={{ '--stack': '24px', maxWidth: 520, margin: '24px auto 0' }} onSubmit={submit}>
      <span className="eyebrow ruled">Create account · step 2 of 2</span>
      <h1>Check your inbox.</h1>
      <p className="lede">
        We sent a six-digit code to <span style={{ color: 'var(--white)' }}>{user.email}</span>.
      </p>
      {isMock && (
        <Notice tone="ice" title="Demo mode">
          No email is sent. Your code is <span className="mono" style={{ color: 'var(--white)' }}>{api.demo.code}</span>.
        </Notice>
      )}
      <div className="field">
        <label htmlFor="code">Verification code</label>
        <input
          id="code"
          className="input mono"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ fontSize: 22, letterSpacing: '0.4em', padding: '14px 16px' }}
          placeholder="••••••"
        />
      </div>
      <ErrorText error={verifyState.error || resendState.error} />
      <div className="row">
        <button className="btn btn-primary" disabled={code.length !== 6 || verifyState.pending}>
          {verifyState.pending ? 'Checking…' : 'Verify email'}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={resendState.pending}
          onClick={async () => {
            const res = await resend()
            if (res.ok) setSent(true)
          }}
        >
          {sent ? 'Code sent again' : 'Resend code'}
        </button>
        <span className="spacer" />
        <button
          type="button"
          className="btn btn-quiet"
          onClick={async () => {
            await signOut()
            navigate('/')
          }}
        >
          Sign out
        </button>
      </div>
      <p className="hint">Until you verify, you can't join societies, claim roles or submit claims.</p>
    </form>
  )
}
