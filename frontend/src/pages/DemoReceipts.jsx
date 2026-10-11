import { Link } from 'react-router-dom'
import { api } from '../data/api.js'
import { useApi } from '../state/AppState.jsx'
import Receipt from '../components/Receipt.jsx'
import { Loading, PageHead } from '../components/ui.jsx'

// Real receipts to photograph during a live demo: open this on a laptop, then tap Scan on a phone.
export default function DemoReceipts() {
  const { data: receipts } = useApi(() => api.listSampleReceipts())
  return (
    <>
      <PageHead
        eyebrow="Demo kit"
        title={
          <>
            Test receipts. <em>Point your phone at one.</em>
          </>
        }
        lede="Open this page on a laptop or print it. On the phone, tap Scan, then Take photo, and the reader works on the real photo. The fraudulent ones are labelled so you know what to expect."
      >
        <Link to="/claims/new?scan=1" className="btn btn-ghost">
          Open Scan
        </Link>
      </PageHead>
      {!receipts ? (
        <Loading />
      ) : (
        <div className="grid grid-3" style={{ alignItems: 'start', gap: 28 }}>
          {receipts.map((r) => (
            <figure key={r.id} style={{ margin: 0 }} className="stack">
              <figcaption style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
                <span className={`eyebrow ${r.hiddenText || r.id === 'rcp_altered' ? '' : 'quiet'}`} style={r.hiddenText || r.id === 'rcp_altered' ? { color: 'var(--rose)' } : undefined}>
                  {r.hiddenText ? 'Fraud: hidden instructions' : r.id === 'rcp_altered' ? 'Fraud: altered total' : 'Genuine'}
                </span>
                <span className="hint">{r.demoNote}</span>
              </figcaption>
              <Receipt receipt={{ kind: 'sample', sampleId: r.id }} printable />
            </figure>
          ))}
        </div>
      )}
    </>
  )
}
