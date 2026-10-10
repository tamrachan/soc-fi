import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../data/api.js'
import { useAction, useApi, useSession } from '../state/AppState.jsx'
import { ROLE_LABELS } from '../data/schema.js'
import { UNION_NAME } from '../config.js'
import { ErrorText, Loading, Notice, PageHead } from '../components/ui.jsx'

export default function Societies() {
  const session = useSession()
  const { data: societies } = useApi(() => api.listSocieties())
  const [q, setQ] = useState('')
  const [invite, setInvite] = useState('')
  const [joined, setJoined] = useState(null)
  const [join, joinState] = useAction((code) => api.joinWithInvite(code))
  const [request, requestState] = useAction((id) => api.requestMembership(id))

  const mine = Object.fromEntries(session.memberships.map((m) => [m.societyId, m]))
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (societies ?? []).filter((s) => !term || s.name.toLowerCase().includes(term) || s.category.toLowerCase().includes(term))
  }, [societies, q])

  return (
    <>
      <PageHead
        eyebrow="Society directory"
        title="Find your society."
        lede={`Imported from ${UNION_NAME}'s directory. Reimbursement is off until a verified treasurer sets it up.`}
      />

      <div className="split-r">
        <section>
          <input className="input" placeholder="Search by name or type…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search societies" style={{ marginBottom: 20 }} />
          {!societies ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table className="table responsive">
                <thead>
                  <tr>
                    <th>Society</th>
                    <th className="num">Members</th>
                    <th>Reimbursement</th>
                    <th className="right">You</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const m = mine[s.id]
                    const pill =
                      s.unionStatus !== 'active' ? (
                        <span className="pill tone-rose">Suspended by Union</span>
                      ) : s.reimbursement.status === 'enabled' ? (
                        <span className="pill tone-sage">USDC enabled</span>
                      ) : (
                        <span className="pill tone-neutral">Not enabled</span>
                      )
                    return (
                      <tr key={s.id}>
                        <td>
                          {s.name}
                          <span className="sub">
                            {s.category} · <span className="mono">{s.unionId}</span>
                          </span>
                          <span className="only-mobile" style={{ marginTop: 6 }}>
                            {pill}
                          </span>
                        </td>
                        <td className="num faint hide-sm">{s.memberCount}</td>
                        <td className="hide-sm">{pill}</td>
                        <td className="right end">
                          {m?.status === 'active' ? (
                            <span className="faint" style={{ fontSize: 13 }}>{ROLE_LABELS[m.role]}</span>
                          ) : m?.status === 'pending' ? (
                            <span className="faint" style={{ fontSize: 13 }}>Requested</span>
                          ) : (
                            <button className="btn btn-ghost btn-sm" disabled={s.unionStatus !== 'active' || requestState.pending} onClick={() => request(s.id)}>
                              Request to join
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <ErrorText error={requestState.error} />
            </div>
          )}
        </section>

        <aside className="stack sticky" style={{ '--stack': '16px' }}>
          <form
            className="card card-pad stack"
            style={{ '--stack': '12px' }}
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await join(invite)
              if (res.ok) {
                setJoined(res.data)
                setInvite('')
              }
            }}
          >
            <span className="eyebrow">Invitation</span>
            <p className="muted" style={{ fontSize: 14 }}>
              Got a code from your committee? Join straight away.
            </p>
            <div className="input-group">
              <input className="input mono" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="CHESS-2026" aria-label="Invite code" />
              <button className="btn btn-primary btn-sm" disabled={!invite.trim() || joinState.pending}>
                Join
              </button>
            </div>
            <ErrorText error={joinState.error} />
            {joined && <Notice tone="sage" title={`Joined ${joined.name}`} />}
          </form>

          <div className="card card-pad stack" style={{ '--stack': '12px' }}>
            <span className="eyebrow">On the committee?</span>
            <p className="muted" style={{ fontSize: 14 }}>
              Treasurers and logistics coordinators get extra permissions after we match you against the Union's records.
            </p>
            <Link to="/committee" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }}>
              Request committee access
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}
