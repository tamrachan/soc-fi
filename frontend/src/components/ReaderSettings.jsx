import { useState } from 'react'
import { getReaderSettings, READER_MODELS, saveReaderSettings } from '../lib/readerSettings.js'
import { Notice } from './ui.jsx'

/** Demo setting: which AI reads receipt photos. Saved on this device only. */
export default function ReaderSettings() {
  const [s, setS] = useState(getReaderSettings)
  const [saved, setSaved] = useState(false)
  const update = (patch) => {
    setS((cur) => ({ ...cur, ...patch }))
    setSaved(false)
  }

  return (
    <form
      className="card card-pad stack"
      style={{ '--stack': '16px' }}
      onSubmit={(e) => {
        e.preventDefault()
        saveReaderSettings({ ...s, apiKey: s.apiKey.trim() })
        setSaved(true)
      }}
    >
      <span className="eyebrow">Receipt reader · demo setting</span>
      <div className="stack" style={{ '--stack': '10px' }}>
        <label className="check">
          <input type="radio" name="engine" checked={s.engine === 'ocr'} onChange={() => update({ engine: 'ocr' })} />
          <span>
            Free on-device OCR
            <span className="hint" style={{ display: 'block' }}>
              Tesseract runs in your browser. No key and no cost, and the photo never leaves the phone. Works best on clear, flat receipts.
            </span>
          </span>
        </label>
        <label className="check">
          <input type="radio" name="engine" checked={s.engine === 'claude'} onChange={() => update({ engine: 'claude' })} />
          <span>
            Claude vision
            <span className="hint" style={{ display: 'block' }}>
              Reads crumpled or angled photos and PDFs, and spots instructions hidden in the text. Needs an Anthropic API key and is billed per receipt.
            </span>
          </span>
        </label>
      </div>

      {s.engine === 'claude' && (
        <>
          <div className="field">
            <label htmlFor="ak">Anthropic API key</label>
            <input id="ak" type="password" className="input mono" value={s.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} />
          </div>
          <div className="field">
            <label htmlFor="model">Model</label>
            <select id="model" className="select" value={s.model} onChange={(e) => update({ model: e.target.value })}>
              {READER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <Notice tone="rose" title="Demo only">
            The key is stored in this browser and sent from this device straight to Anthropic, so anyone using this device can read it.
            Use a key with a low spend limit and delete it after the demo. In production the reader runs on the server, with the key
            held in Ledger Key Ring.
          </Notice>
        </>
      )}

      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={s.engine === 'claude' && !s.apiKey.trim()}>
          Save reader
        </button>
        {s.apiKey && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => {
              saveReaderSettings({ apiKey: '', engine: 'ocr' })
              setS(getReaderSettings())
              setSaved(true)
            }}
          >
            Forget key
          </button>
        )}
        {saved && <span className="faint" style={{ fontSize: 13 }}>Saved on this device</span>}
      </div>
    </form>
  )
}
