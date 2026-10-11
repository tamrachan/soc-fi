// Demo-only reader settings, kept in this browser's localStorage and never in the claim data.
// In production the reader runs on the server and its API key is held in Ledger Key Ring.

const KEY = 'socfi.reader'

export const READER_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most accurate)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (cheapest, fastest)' },
]

const DEFAULTS = { engine: 'ocr', apiKey: '', model: 'claude-opus-5-5' }

export function getReaderSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveReaderSettings(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getReaderSettings(), ...next }))
  } catch {}
}

export const readerLabel = (s = getReaderSettings()) =>
  s.engine === 'claude' && s.apiKey ? `Claude · ${s.model}` : 'Free on-device OCR'
