import { Link, Navigate } from 'react-router-dom'
import { useSession } from '../state/AppState.jsx'
import { societiesWithPerm } from '../domain/permissions.js'
import { SETUP_STEPS } from '../data/schema.js'
import { Empty, PageHead } from '../components/ui.jsx'

const done = (setup, id) => (id === 'unionApproval' ? setup.unionApproval === 'approved' : setup[id])

export default function SetupList() {
  const session = useSession()
  const societies = societiesWithPerm(session, 'society.configure_reimbursement')
  if (societies.length === 1) return <Navigate to={`/setup/${societies[0].id}`} replace />

  return (
    <>
      <PageHead eyebrow="Treasury setup" title="Your societies." />
      {societies.length === 0 ? (
        <Empty title="No treasurer roles">
          <Link to="/committee" className="link">
            Claim a committee role
          </Link>
        </Empty>
      ) : (
        <table className="table">
          <tbody>
            {societies.map((s) => {
              const n = SETUP_STEPS.filter((st) => done(s.reimbursement.setup, st.id)).length
              return (
                <tr key={s.id}>
                  <td>
                    <Link to={`/setup/${s.id}`}>{s.name}</Link>
                  </td>
                  <td className="faint">
                    {n}/{SETUP_STEPS.length} checks
                  </td>
                  <td className="right">
                    <span className={`pill ${s.reimbursement.status === 'enabled' ? 'tone-sage' : 'tone-neutral'}`}>
                      {s.reimbursement.status === 'enabled' ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
