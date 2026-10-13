import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, isMock } from '../data/api.js'
import { dismissSubmission, startSubmission } from '../data/submissions.js'
import { useAction, useApi, useSession } from '../state/AppState.jsx'
import { claimableSocieties } from '../domain/permissions.js'
import { CATEGORIES, CURRENCIES } from '../data/schema.js'
import { fmtMoney, shortAddr } from '../lib/format.js'
import { compressImage } from '../lib/image.js'
import Receipt from '../components/Receipt.jsx'
import { Checks, Empty, ErrorText, Icon, Loading, Notice, PageHead } from '../components/ui.jsx'
import { AGENT_NAME } from '../config.js'

const EMPTY = { merchant: '', date: '', amount: '', currency: 'GBP', category: '', description: '' }
const VERIFY_KEYS = ['merchant', 'date', 'amount', 'currency', 'category']
const NONE_VERIFIED = Object.fromEntries(VERIFY_KEYS.map((k) => [k, false]))

// Per-device convenience: most people claim for the same society every time.
const LAST_SOCIETY_KEY = 'socfi.lastSociety'
const readLastSociety = () => {
  try {
    return localStorage.getItem(LAST_SOCIETY_KEY)
  } catch {
    return null
  }
}
const saveLastSociety = (id) => {
  try {
    localStorage.setItem(LAST_SOCIETY_KEY, id)
  } catch {}
}

const aiValue = (x, k) =>
  !x ? null : k === 'amount' ? x.total : k === 'category' ? x.suggestedCategory : x[k]

function VField({ id, label, verified, onVerify, aiFilled, aiHint, children, full }) {
  return (
    <div className={`vfield ${full ? 'full' : ''} ${verified ? '' : 'unverified'}`}>
      <div className="vfield-top">
        <label htmlFor={id} className="label">
          {label} {aiFilled && <span className="tag-ai">AI suggestion</span>}
        </label>
        <button type="button" className="vtick" aria-pressed={verified} onClick={onVerify} title="I checked this against the receipt">
          <span className="box">{verified && <Icon name="check" size={10} />}</span>
          Matches receipt
        </button>
      </div>
      {children}
      {aiHint && <span className="hint">{aiHint}</span>}
    </div>
  )
}

function progressLabel(p) {
  const stage = p?.stage ?? ''
  if (!stage) return 'Reading receipt…'
  if (/load|initiali/i.test(stage)) return 'Loading the on-device reader (first time takes a few seconds)…'
  if (/recogni/i.test(stage)) return 'Reading the text on your receipt…'
  return `${stage[0].toUpperCase()}${stage.slice(1)}…`
}

function ReaderResult({ extraction: x }) {
  const blocking = x.flags.filter((f) => (f.severity ?? 'block') === 'block')
  const soft = x.flags.filter((f) => f.severity === 'warn')
  const engine = x.engineKind === 'ocr' ? 'free on-device OCR' : x.model === 'mock-vision-1' ? 'demo reader (sample receipt)' : x.model
  const nothing = !x.unreadable && !x.merchant && x.total == null
  return (
    <div className="stack" style={{ '--stack': '10px' }}>
      {blocking.length > 0 && (
        <div className="card card-pad stack" style={{ '--stack': '10px', borderColor: 'rgba(214,143,134,0.45)' }}>
          <span className="eyebrow" style={{ color: 'var(--rose)' }}>
            {AGENT_NAME} will reject this
          </span>
          <h2>This receipt looks fraudulent.</h2>
          <ul className="checks">
            {blocking.map((f, i) => (
              <li key={i} className="fail">
                <Icon name="x" className="mark" style={{ color: 'var(--rose)' }} />
                <span className="label-t">{f.message}</span>
                {f.evidence && <span className="detail mono">“{f.evidence}”</span>}
              </li>
            ))}
          </ul>
          <p className="hint">
            Text on a receipt is treated as data, never as instructions. If you submit, the attempt is logged and the claim stops
            before it reaches a treasurer.
          </p>
        </div>
      )}
      {soft.length > 0 && (
        <Notice tone="copper" title="Your treasurer will be asked to check this">
          {soft.map((f) => f.message).join(' ')}
        </Notice>
      )}
      {x.note && <Notice tone="ice">{x.note}</Notice>}
      {x.unreadable && (
        <Notice tone="ice" title="Couldn’t read this receipt">
          {x.unreadable}
        </Notice>
      )}
      <p className="hint">
        Read by <span className="mono">{engine}</span>
        {x.confidence > 0 && ` · confidence ${Math.round(x.confidence * 100)}%`}
        {nothing && ' · nothing readable found, so type the details in'} ·{' '}
        <Link to="/account" className="link">
          change reader
        </Link>
      </p>
    </div>
  )
}

function ReceiptPicker({ onPick, samples, disabled }) {
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const readFile = async (file) => {
    if (!file) return
    const base = { kind: 'upload', fileName: file.name || 'receipt.jpg', mimeType: file.type, size: file.size }
    if (file.type === 'application/pdf') {
      if (file.size > 4_000_000) return onPick(base)
      const reader = new FileReader()
      reader.onload = () => onPick({ ...base, dataUrl: reader.result })
      return reader.readAsDataURL(file)
    }
    if (!file.type.startsWith('image/')) return onPick(base)
    setBusy(true)
    try {
      const img = await compressImage(file)
      onPick({ ...base, ...img, originalSize: file.size })
    } catch {
      // e.g. HEIC on a desktop browser that can't decode it: keep the file, skip the preview
      onPick(base)
    } finally {
      setBusy(false)
    }
  }
  const onInput = (e) => {
    readFile(e.target.files[0])
    e.target.value = ''
  }

  return (
    <div className="stack" style={{ '--stack': '20px' }}>
      <div className="capture only-mobile">
        <label className="capture-btn">
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled || busy} onChange={onInput} />
          <Icon name="camera" />
          {busy ? 'Processing photo…' : 'Take photo of receipt'}
        </label>
        <label className="capture-alt">
          <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={disabled || busy} onChange={onInput} />
          <Icon name="image" /> Choose from photos or files
        </label>
        <p className="hint" style={{ textAlign: 'center' }}>Lay it flat, fill the frame, avoid glare.</p>
      </div>

      <label
        className={`dropzone only-desktop ${over ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          readFile(e.dataTransfer.files[0])
        }}
      >
        <input type="file" accept="image/*,application/pdf" className="sr-only" disabled={disabled || busy} onChange={onInput} />
        <Icon name="upload" size={20} style={{ margin: '0 auto 10px' }} />
        <div style={{ color: 'var(--white)' }}>{busy ? 'Processing…' : 'Drop a receipt photo or PDF'}</div>
        <div className="hint">or click to choose a file</div>
      </label>

      {isMock && (
        <p className="hint">
          No receipt to hand? Open{' '}
          <Link to="/demo/receipts" className="link">
            test receipts
          </Link>{' '}
          on another screen and photograph one, or pick a sample below.
        </p>
      )}

      {samples.length > 0 && (
        <div>
          <div className="eyebrow quiet" style={{ marginBottom: 6 }}>
            {isMock ? 'Or use a demo receipt' : 'Sample receipts'}
          </div>
          <div className="sample-list">
            {samples.map((s) => (
              <button key={s.id} type="button" className="sample" disabled={disabled} onClick={() => onPick({ kind: 'sample', sampleId: s.id, fileName: `${s.id}.jpg` })}>
                <span className="sample-name">{s.merchant}</span>
                <span className="sample-note">{s.demoNote}</span>
                <span className="sample-amt">{fmtMoney(s.total, s.currency)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClaimForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const fromId = params.get('from')
  const navigate = useNavigate()
  const session = useSession()
  const societies = claimableSocieties(session)
  const wallet = session.user.walletAddress

  const { data: existing, error: loadError } = useApi(() => (id ? api.getClaim(id) : Promise.resolve(null)), [id])
  const { data: from } = useApi(() => (fromId ? api.getClaim(fromId) : Promise.resolve(null)), [fromId])
  const { data: samples = [] } = useApi(() => api.listSampleReceipts())

  const [societyId, setSocietyIdState] = useState(() => {
    if (societies.length === 1) return societies[0].id
    const last = readLastSociety()
    return societies.some((s) => s.id === last) ? last : ''
  })
  const setSocietyId = (sid) => {
    setSocietyIdState(sid)
    saveLastSociety(sid)
  }
  // ?scan=1 (the mobile Scan tab) skips straight to taking a photo
  const [mode, setMode] = useState(params.get('scan') ? 'ai_prefill' : null)
  const [receipt, setReceipt] = useState(null)
  const [extraction, setExtraction] = useState(null)
  const [fields, setFields] = useState(EMPTY)
  const [verified, setVerified] = useState(NONE_VERIFIED)
  const [aiFilled, setAiFilled] = useState({})
  const [confirmed, setConfirmed] = useState(false)
  const [failed, setFailed] = useState(null)
  const [progress, setProgress] = useState(null)
  const [extract, extractState] = useAction((r) => api.extractReceipt(r, { onProgress: setProgress }))
  const [submitState, setSubmitState] = useState({ pending: false, error: null })
  const initFor = useRef(null)
  // The submit keeps running if the member leaves; this page must not react to its result then.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Prefill when editing an existing claim (returned for edits, or failed validation).
  useEffect(() => {
    if (!existing || initFor.current === existing.id) return
    initFor.current = existing.id
    const v = existing.latest
    setSocietyId(existing.societyId)
    setMode(v.entryMode)
    setReceipt(v.receipt)
    setExtraction(v.aiExtraction)
    setFields({ ...v.fields, amount: String(v.fields.amount) })
    if (existing.status === 'validation_failed') setFailed(existing)
  }, [existing])

  useEffect(() => {
    if (from && !id) setSocietyId(from.societyId)
  }, [from, id])

  if (id && loadError) return <Empty title="Couldn't open claim">{loadError.message}</Empty>
  if (id && !existing) return <Loading />

  const society = societies.find((s) => s.id === societyId)
  const r = society?.reimbursement
  const editing = !!id
  const reading = extractState.pending

  const pickReceipt = async (rcp) => {
    setReceipt(rcp)
    setExtraction(null)
    setVerified(NONE_VERIFIED)
    setConfirmed(false)
    setProgress(null)
    if (mode !== 'ai_prefill') return
    const res = await extract(rcp)
    if (!res.ok) return
    const x = res.data
    setExtraction(x)
    setFields((f) => ({
      ...f,
      merchant: x.merchant ?? '',
      date: x.date ?? '',
      amount: x.total != null ? String(x.total) : '',
      currency: x.currency ?? 'GBP',
      category: x.suggestedCategory && r?.allowedCategories.includes(x.suggestedCategory) ? x.suggestedCategory : '',
    }))
    setAiFilled({ merchant: !!x.merchant, date: !!x.date, amount: x.total != null, currency: !!x.currency, category: !!x.suggestedCategory })
  }

  const set = (k) => (e) => {
    const v = e.target.value
    setFields((f) => ({ ...f, [k]: v }))
    if (k in NONE_VERIFIED) setVerified((s) => ({ ...s, [k]: true }))
    setAiFilled((a) => ({ ...a, [k]: false }))
    setConfirmed(false)
  }
  const toggle = (k) => () => setVerified((s) => ({ ...s, [k]: !s[k] }))

  const hintFor = (k) => {
    const ai = aiValue(extraction, k)
    if (ai == null || aiFilled[k]) return null
    const mine = k === 'amount' ? Number(fields.amount) : fields[k]
    if (mine === ai) return null
    const shown = k === 'amount' ? fmtMoney(ai, extraction.currency ?? fields.currency) : k === 'category' ? CATEGORIES[ai] : ai
    if (k === 'amount' && mine > ai) return `AI read ${shown}. If the AI misread it, keep your amount and it will be checked against the receipt.`
    return `AI read: ${shown}`
  }

  const allVerified = VERIFY_KEYS.every((k) => verified[k])
  const ready = society && receipt && allVerified && fields.description.trim() && confirmed && wallet && !reading

  const onSubmit = async (e) => {
    e.preventDefault()
    setSubmitState({ pending: true, error: null })
    const res = await startSubmission(
      {
        claimId: failed?.id ?? id,
        societyId,
        fields: { ...fields, amount: Number(fields.amount) },
        receipt,
        entryMode: mode ?? 'manual',
        aiExtraction: extraction,
        supersedesClaimId: fromId ?? undefined,
      },
      { userId: session.user.id, societyName: society.name },
    )
    // Gone elsewhere: My claims shows the result (or the error, with a retry).
    if (!mounted.current) return
    setSubmitState({ pending: false, error: res.error ?? null })
    if (!res.ok) return dismissSubmission(res.id)
    if (res.data.status !== 'validation_failed') {
      navigate(`/claims/${res.data.id}`, { state: { submitted: true } })
    } else {
      setFailed(res.data)
      setExtraction(res.data.latest.aiExtraction)
      setConfirmed(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!editing && societies.length === 0)
    return (
      <Empty title="No society to claim from">
        <p>You need to be a member of a society that has enabled reimbursement.</p>
        <Link to="/societies" className="link">
          Find your society
        </Link>
      </Empty>
    )

  const review = existing?.latestReview
  // If reading fails the member still gets the form and types the details in.
  const showForm = mode === 'manual' || (mode === 'ai_prefill' && receipt) || editing
  const agentRejected = failed?.latest.validation.checks.some((c) => c.id === 'not_flagged' && !c.passed)

  return (
    <>
      <PageHead
        eyebrow={editing ? `${existing.reference} · new version ${existing.status === 'returned' ? existing.currentVersion + 1 : existing.currentVersion}` : 'New claim'}
        title={editing ? 'Edit your claim.' : 'Claim back what you spent.'}
        lede="The AI only suggests values. You check every field against the receipt before submitting."
      />

      <div className="stack" style={{ '--stack': '12px', marginBottom: 28 }}>
        {editing && existing.status === 'returned' && review && (
          <Notice tone="copper" title="Your treasurer asked for changes">
            “{review.reason}”
          </Notice>
        )}
        {from?.latestReview && (
          <Notice tone="copper" title={`Starting fresh, replacing ${from.reference}`}>
            Treasurer's guidance: “{from.latestReview.reason}”
          </Notice>
        )}
        {failed && (
          <div className="card card-pad stack" style={{ '--stack': '10px', borderColor: 'rgba(214,143,134,0.35)' }}>
            <span className="eyebrow" style={{ color: 'var(--rose)' }}>
              {agentRejected ? `Rejected by ${AGENT_NAME}` : `Declined by ${AGENT_NAME}`}
            </span>
            {agentRejected && <h2>This receipt can’t be claimed.</h2>}
            <p className="muted" style={{ fontSize: 14 }}>
              {agentRejected
                ? 'The receipt shows signs of tampering or hidden instructions. Nothing was sent for payment, and the attempt is on the audit log.'
                : `Fix the fields below and resubmit. If you think ${AGENT_NAME} got it wrong, appeal to your society treasurer.`}
            </p>
            <Checks validation={failed.latest.validation} only={['fail']} />
            <div className="row">
              {!agentRejected && (
                <Link to={`/claims/${failed.id}`} className="btn btn-ghost btn-sm">
                  Appeal this decision
                </Link>
              )}
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  await api.withdrawClaim(failed.id)
                  navigate('/claims')
                }}
              >
                Withdraw claim
              </button>
            </div>
          </div>
        )}
        {!wallet && (
          <Notice tone="rose" title="No payout wallet" action={<Link to="/account" className="btn btn-ghost btn-sm">Add wallet</Link>}>
            You need a saved wallet before you can submit. Payments only ever go there.
          </Notice>
        )}
      </div>

      {!editing && (
        <div className="stack" style={{ '--stack': '24px', marginBottom: 36 }}>
          <div className="field">
            <span className="label" id="society-label">Which society is this for?</span>
            <div className="row" role="radiogroup" aria-labelledby="society-label" style={{ gap: 8 }}>
              {societies.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  className="chip"
                  aria-checked={societyId === s.id}
                  aria-pressed={societyId === s.id}
                  disabled={!!fromId && s.id !== societyId}
                  onClick={() => setSocietyId(s.id)}
                  style={{ padding: '10px 16px', fontSize: 14 }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          {society && !receipt && mode && (
            <div className="seg" role="group" aria-label="How to enter details" style={{ maxWidth: 420 }}>
              <button type="button" aria-pressed={mode === 'ai_prefill'} onClick={() => setMode('ai_prefill')}>
                Scan &amp; AI pre-fill
              </button>
              <button type="button" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>
                Enter manually
              </button>
            </div>
          )}
          {society && !receipt && !mode && (
            <div className="grid grid-2" style={{ maxWidth: 820 }}>
              <button type="button" className="option" aria-pressed={mode === 'ai_prefill'} onClick={() => setMode('ai_prefill')}>
                <span className="num">OPTION A</span>
                <h3>Snap the receipt first</h3>
                <p>Take a photo or upload it. The AI reads it and pre-fills the form, then you check each value.</p>
              </button>
              <button type="button" className="option" aria-pressed={mode === 'manual'} onClick={() => setMode('manual')}>
                <span className="num">OPTION B</span>
                <h3>Enter details myself</h3>
                <p>Type the details in and attach the receipt. It's still read and checked when you submit.</p>
              </button>
            </div>
          )}
        </div>
      )}

      {society && mode && (
        <div className="split">
          <div className="stack sticky claim-receipt" style={{ '--stack': '14px' }}>
            {receipt ? (
              <>
                <div style={{ position: 'relative' }}>
                  <Receipt receipt={receipt} />
                  {reading && (
                    <div style={{ position: 'absolute', left: 24, right: 24, top: '45%' }}>
                      <div className="scanline" />
                    </div>
                  )}
                </div>
                <div className="row between">
                  <span className="mono faint" style={{ fontSize: 12 }}>
                    {receipt.fileName}
                  </span>
                  <button type="button" className="text-btn" style={{ fontSize: 13 }} disabled={reading} onClick={() => setReceipt(null)}>
                    Replace receipt
                  </button>
                </div>
              </>
            ) : (
              <ReceiptPicker onPick={pickReceipt} samples={samples} disabled={reading} />
            )}
          </div>

          {!showForm ? (
            <div className="card card-pad" style={{ color: 'var(--fog)' }}>
              <span className="eyebrow quiet">Waiting for a receipt</span>
              <p style={{ marginTop: 12 }}>Add a receipt on the left. The AI suggests merchant, date, total, currency and category, and flags anything odd.</p>
            </div>
          ) : (
            <form className="stack" style={{ '--stack': '24px' }} onSubmit={onSubmit}>
              {reading ? (
                <div className="card card-pad stack" style={{ '--stack': '12px' }}>
                  <div className="reading">
                    <span className="spinner dark" /> {progressLabel(progress)}
                  </div>
                  {progress?.progress > 0 && (
                    <div className="budget" aria-hidden="true">
                      <span style={{ width: `${Math.round(progress.progress * 100)}%` }} />
                    </div>
                  )}
                  <p className="hint">The reader returns data only. It has no tools and can't approve or pay anything.</p>
                </div>
              ) : (
                extraction && <ReaderResult extraction={extraction} />
              )}

              <ErrorText error={extractState.error} />

              <div className="form-grid">
                <VField id="merchant" label="Merchant" full verified={verified.merchant} onVerify={toggle('merchant')} aiFilled={aiFilled.merchant} aiHint={hintFor('merchant')}>
                  <input id="merchant" className="input" value={fields.merchant} onChange={set('merchant')} disabled={reading} />
                </VField>
                <VField id="date" label="Receipt date" verified={verified.date} onVerify={toggle('date')} aiFilled={aiFilled.date} aiHint={hintFor('date')}>
                  <input id="date" type="date" className="input tnum" value={fields.date} onChange={set('date')} disabled={reading} />
                </VField>
                <VField id="category" label="Category" verified={verified.category} onVerify={toggle('category')} aiFilled={aiFilled.category} aiHint={hintFor('category')}>
                  <select id="category" className="select" value={fields.category} onChange={set('category')} disabled={reading}>
                    <option value="">Choose…</option>
                    {Object.entries(CATEGORIES).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                        {r && !r.allowedCategories.includes(k) ? ' (not allowed)' : ''}
                      </option>
                    ))}
                  </select>
                </VField>
                <VField id="amount" label="Amount" verified={verified.amount} onVerify={toggle('amount')} aiFilled={aiFilled.amount} aiHint={hintFor('amount')}>
                  <input id="amount" type="number" step="0.01" min="0" inputMode="decimal" className="input tnum" value={fields.amount} onChange={set('amount')} disabled={reading} />
                </VField>
                <VField id="currency" label="Currency" verified={verified.currency} onVerify={toggle('currency')} aiFilled={aiFilled.currency} aiHint={hintFor('currency')}>
                  <select id="currency" className="select" value={fields.currency} onChange={set('currency')} disabled={reading}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </VField>
                <div className="field full">
                  <label htmlFor="desc">What was it for?</label>
                  <textarea id="desc" className="textarea" value={fields.description} onChange={set('description')} placeholder="e.g. Pizza for 40 people at the Blockchain Society hackathon" disabled={reading} />
                </div>
              </div>

              {r && (
                <p className="hint">
                  {society.name} policy: up to {fmtMoney(r.perClaimLimit, r.currency)} per claim · receipts from the last 90 days ·{' '}
                  {r.allowedCategories.map((c) => CATEGORIES[c]).join(', ')}
                </p>
              )}

              <hr className="divider" style={{ margin: 0 }} />

              <dl className="kv">
                <dt>Paid to</dt>
                <dd>
                  {wallet ? (
                    <>
                      <span className="addr">{shortAddr(wallet)}</span> <span className="faint">· your saved wallet, in USDC</span>
                    </>
                  ) : (
                    <span className="error-text">No wallet saved</span>
                  )}
                </dd>
              </dl>

              <label className="check">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={!allVerified} />
                <span>
                  I've checked every field against the receipt, and this was spent on {society.name} business.
                  {!allVerified && (
                    <span className="hint" style={{ display: 'block' }}>
                      Tick “Matches receipt” on each field first ({VERIFY_KEYS.filter((k) => verified[k]).length}/{VERIFY_KEYS.length}).
                    </span>
                  )}
                </span>
              </label>

              <ErrorText error={submitState.error} />
              {submitState.pending && <p className="hint">You can leave this page. The result will be in My claims.</p>}
              <div className="row sticky-actions">
                <button className="btn btn-primary" disabled={!ready || submitState.pending}>
                  {submitState.pending ? (mode === 'manual' && !extraction ? 'Reading receipt and checking…' : 'Running checks…') : editing || failed ? 'Resubmit claim' : 'Submit claim'}
                </button>
                <Link to={editing ? `/claims/${id}` : '/claims'} className="btn btn-quiet">
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  )
}
