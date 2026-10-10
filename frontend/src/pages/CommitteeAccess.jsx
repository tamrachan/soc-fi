import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../data/api.js'
import { useAction, useApi, useSession } from '../state/AppState.jsx'
import { ROLE_LABELS } from '../data/schema.js'
import { UNION_CONTACT, UNION_NAME } from '../config.js'
import { ErrorText, Notice, PageHead } from '../components/ui.jsx'

function Outcome({ result, society }) {
  if (result.outcome === 'matched') {
    const isTreasurer = result.requestedRole === 'treasurer'
    const enabled = society?.reimbursement.status === 'enabled'
    return (
      <div className="stack" style={{ '--stack': '14px' }}>
        <Notice tone="sage" title={`Matched. You're ${ROLE_LABELS[result.requestedRole]} of ${society?.name}.`}>
          {result.reason}
        </Notice>
        <dl className="kv">
          <dt>Granted</dt>
          <dd className="mono" style={{ fontSize: 12 }}>
            {result.permissionsGranted.join(', ')}
          </dd>
          <dt>Not granted</dt>
          <dd className="faint" style={{ fontSize: 13 }}>
            {isTreasurer ? 'Nothing. Reimbursement still needs society setup.' : 'Approving claims, signing payments and changing treasury settings'}
          </dd>
        </dl>
        {isTreasurer && !enabled && (
          <Link to={`/setup/${result.societyId}`} className="btn btn-primary" style={{ justifySelf: 'start' }}>
            Set up reimbursement
          </Link>
        )}
      </div>
    )
  }
  if (result.outcome === 'manual_review')
    return (
      <Notice tone="copper" title="We need to confirm this by hand">
        {result.reason} No extra access has been granted. {UNION_CONTACT[0].toUpperCase() + UNION_CONTACT.slice(1)} will confirm
        with your committee.
      </Notice>
    )
  return (
    <Notice tone="rose" title="No matching committee record">
      {result.reason} Check that your name matches the Union's records exactly, or ask {UNION_CONTACT} to update them.
    </Notice>
  )
}

export default function CommitteeAccess() {
  const { user } = useSession()
  const { data: societies = [] } = useApi(() => api.listSocieties())
  const [societyId, setSocietyId] = useState('')
  const [role, setRole] = useState('')
  const [name, setName] = useState(user.displayName)
  const { data: roles = [] } = useApi(() => (societyId ? api.listCommitteeRoles(societyId) : Promise.resolve([])), [societyId])
  const [submit, { pending, error, }, clear] = useAction((args) => api.requestCommitteeAccess(args))
  const [result, setResult] = useState(null)

  const society = societies.find((s) => s.id === (result?.societyId ?? societyId))

  return (
    <>
      <PageHead
        eyebrow="Committee access"
        title="Claim your committee role."
        lede={`We match your verified account, name, society and role against ${UNION_NAME}'s committee records. You only get the permissions that role needs.`}
      />

      <div className="split-r">
        <form
          className="stack"
          style={{ '--stack': '20px', maxWidth: 560 }}
          onSubmit={async (e) => {
            e.preventDefault()
            setResult(null)
            const res = await submit({ societyId, role, submittedName: name })
            if (res.ok) setResult(res.data)
          }}
        >
          <div className="field">
            <label htmlFor="soc">Society</label>
            <select
              id="soc"
              className="select"
              value={societyId}
              onChange={(e) => {
                setSocietyId(e.target.value)
                setRole('')
                setResult(null)
                clear()
              }}
              required
            >
              <option value="">Choose a society…</option>
              {societies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" className="select" value={role} onChange={(e) => setRole(e.target.value)} disabled={!societyId} required>
              <option value="">{societyId && roles.length === 0 ? 'No eligible roles on record' : 'Choose a role…'}</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <span className="hint">Only roles that need this system are listed. You can't type a role name.</span>
          </div>
          <div className="field">
            <label htmlFor="cname">Your name, as the Union records it</label>
            <input id="cname" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <span className="label">Verified email</span>
            <span className="mono faint">{user.email}</span>
          </div>
          <ErrorText error={error} />
          <div>
            <button className="btn btn-primary" disabled={!societyId || !role || !name.trim() || pending}>
              {pending ? 'Checking committee records…' : 'Check my role'}
            </button>
          </div>
          {result && <Outcome result={result} society={society} />}
        </form>

        <aside className="card card-pad stack" style={{ '--stack': '12px' }}>
          <span className="eyebrow quiet">How matching works</span>
          <ul className="checks">
            <li>
              <span className="mono faint">01</span>
              <span>Exact match on an unclaimed record: permissions for that role are granted.</span>
            </li>
            <li>
              <span className="mono faint">02</span>
              <span>Close but not exact, or already claimed: sent to the Union to confirm by hand.</span>
            </li>
            <li>
              <span className="mono faint">03</span>
              <span>No match: no privileged access.</span>
            </li>
          </ul>
          <p className="hint">A name match alone isn't proof of identity. It's combined with your verified university email, and everything is written to the audit log.</p>
        </aside>
      </div>
    </>
  )
}
