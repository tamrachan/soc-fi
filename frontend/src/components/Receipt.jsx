import { api } from '../data/api.js'
import { useApi } from '../state/AppState.jsx'
import { fmtDate, fmtMoney } from '../lib/format.js'

/** Renders a receipt reference: a sample as thermal paper, or an uploaded file preview. */
/** printable: render hidden text faint but legible, so a phone camera and the reader can pick it up. */
export default function Receipt({ receipt, revealHidden = false, printable = false }) {
  const { data: sample } = useApi(
    () => (receipt?.kind === 'sample' ? api.getReceipt(receipt.sampleId) : Promise.resolve(null)),
    [receipt?.kind, receipt?.sampleId],
  )

  if (!receipt) return <div className="receipt-wrap receipt-upload">No receipt attached</div>

  if (receipt.kind === 'upload') {
    return (
      <div className="receipt-wrap">
        <div className="receipt-upload stack" style={{ '--stack': '10px' }}>
          {receipt.dataUrl && receipt.mimeType?.startsWith('image/') ? (
            <img src={receipt.dataUrl} alt={`Uploaded receipt ${receipt.fileName}`} />
          ) : (
            <div className="mono" style={{ padding: 40 }}>{receipt.fileName}</div>
          )}
          <div className="mono faint">{receipt.fileName}</div>
        </div>
      </div>
    )
  }

  if (!sample) return <div className="receipt-wrap" style={{ minHeight: 360 }} />

  return (
    <div className="receipt-wrap">
      <article className="receipt" aria-label={`Receipt from ${sample.merchant}`}>
        <div className="r-head">
          <div className="r-merchant">{sample.merchant}</div>
          <div className="r-faint">{sample.address}</div>
          <div className="r-faint">
            {fmtDate(sample.date)} · {sample.time}
          </div>
        </div>
        <div className="r-rule" />
        {sample.items.map((it, i) => (
          <div key={i}>
            <div>{it.desc}</div>
            <div className="r-line r-faint">
              <span>
                {it.qty} × {it.price.toFixed(2)}
              </span>
              <span>{(it.qty * it.price).toFixed(2)}</span>
            </div>
          </div>
        ))}
        <div className="r-rule" />
        <div className="r-line r-total">
          <span>TOTAL</span>
          <span>{fmtMoney(sample.total, sample.currency)}</span>
        </div>
        <div className="r-line r-faint">
          <span>{sample.paymentMethod}</span>
          <span>APPROVED</span>
        </div>
        <div className="r-rule" />
        <div className="r-faint" style={{ textAlign: 'center' }}>Thank you — please keep this receipt</div>
        {sample.hiddenText && <p className={`r-hidden ${revealHidden ? 'revealed' : printable ? 'printable' : ''}`}>{sample.hiddenText}</p>}
      </article>
    </div>
  )
}
