import { Link, useNavigate } from 'react-router-dom'
import { api } from '../data/api.js'
import { useApi, useSession } from '../state/AppState.jsx'
import { fmtDateTime, fmtMoney, shortAddr } from '../lib/format.js'
import { NETWORKS } from '../config.js'
import { Empty, Loading, PageHead, PaymentPill } from '../components/ui.jsx'

export default function Payments() {
  const session = useSession()
  const navigate = useNavigate()
  const { data: payments } = useApi(() => api.listPayments(), [session.user.id])

  return (
    <>
      <PageHead
        eyebrow="Treasurer"
        title="Payments."
        lede="Every payment was approved for one exact claim version and signed on a Ledger. Claims are marked paid only after on-chain confirmation."
      />
      {!payments ? (
        <Loading />
      ) : payments.length === 0 ? (
        <Empty title="No payments yet">
          <Link to="/review" className="link">
            Go to the review queue
          </Link>
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table responsive">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Recipient</th>
                <th className="num">Amount</th>
                <th>Network</th>
                <th>Transaction</th>
                <th>Approved</th>
                <th className="right">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="clickable" onClick={(e) => !e.target.closest('a') && navigate(`/review/${p.claimId}`)}>
                  <td>
                    <span className="mono">{p.claimReference}</span>
                    <span className="sub">
                      {p.society.name} · v{p.claimVersion}
                      <span className="only-mobile"> · {p.recipient.displayName}</span>
                    </span>
                  </td>
                  <td className="hide-sm">
                    {p.recipient.displayName}
                    <span className="sub addr">{shortAddr(p.recipientAddress)}</span>
                  </td>
                  <td className="num">
                    {fmtMoney(p.amount, 'USDC')}
                    <span className="sub">{fmtMoney(p.fiatAmount, p.fiatCurrency)}</span>
                  </td>
                  <td className="faint hide-sm">{NETWORKS[p.network]?.label}</td>
                  <td className="hide-sm">
                    {p.txHash ? (
                      <a className="link addr" href={`${NETWORKS[p.network]?.explorer}${p.txHash}`} target="_blank" rel="noreferrer">
                        {shortAddr(p.txHash)}
                      </a>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td className="faint nowrap hide-sm">{fmtDateTime(p.approvedAt)}</td>
                  <td className="right">
                    <PaymentPill status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
