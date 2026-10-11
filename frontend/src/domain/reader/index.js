// Receipt reader pipeline: read (sample / OCR / Claude) → sanitize to the extraction schema →
// deterministic fraud checks on everything that was read. The output is DATA ONLY. It has no
// payment fields, and anything outside the schema is moved to `discardedFields`.
import { CATEGORIES, CURRENCIES } from '../../data/schema.js'
import { getReaderSettings } from '../../lib/readerSettings.js'
import { round2 } from '../../lib/format.js'
import { scanForInjection } from './injection.js'
import { readWithOcr } from './ocrReader.js'

export const EXTRACTION_FIELDS = ['merchant', 'date', 'total', 'currency', 'suggestedCategory', 'items', 'rawText', 'suspiciousText', 'confidence']

function sanitize(raw) {
  const discardedFields = {}
  for (const [k, v] of Object.entries(raw)) if (!EXTRACTION_FIELDS.includes(k) && k !== 'unreadable') discardedFields[k] = v
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? round2(v) : null)
  return {
    clean: {
      merchant: typeof raw.merchant === 'string' && raw.merchant.trim() ? raw.merchant.trim().slice(0, 80) : null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date ?? '') ? raw.date : null,
      total: num(raw.total),
      currency: CURRENCIES.includes(raw.currency) ? raw.currency : null,
      suggestedCategory: raw.suggestedCategory in CATEGORIES ? raw.suggestedCategory : null,
      items: Array.isArray(raw.items)
        ? raw.items.filter((i) => i && typeof i.desc === 'string' && num(i.amount) != null).map((i) => ({ desc: i.desc.slice(0, 80), amount: num(i.amount) })).slice(0, 60)
        : [],
      confidence: typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0,
    },
    discardedFields,
  }
}

/** engineKind: 'model' (Claude, or the demo's simulated model) or 'ocr'. OCR misses lines, so its arithmetic flag only warns. */
function finalize(raw, engine, engineKind) {
  const { clean, discardedFields } = sanitize(raw)
  const rawText = typeof raw.rawText === 'string' ? raw.rawText : ''
  const suspicious = Array.isArray(raw.suspiciousText) ? raw.suspiciousText.filter((s) => typeof s === 'string' && s.trim()) : []
  const { flags, wallets } = scanForInjection([rawText, ...suspicious].join('\n'))

  if (suspicious.length && !flags.some((f) => f.code === 'prompt_injection')) {
    flags.push({ code: 'prompt_injection', severity: 'block', message: 'The reader found instruction-like text on the receipt.', evidence: suspicious[0].slice(0, 160) })
  }
  if (wallets.length) discardedFields.walletAddressInText = wallets[0]

  // Doctored receipts: the printed total doesn't equal the sum of the lines
  if (clean.total != null && clean.items.length) {
    const sum = round2(clean.items.reduce((s, i) => s + i.amount, 0))
    if (Math.abs(sum - clean.total) > 0.02) {
      const sym = { GBP: '£', EUR: '€', USD: '$' }[clean.currency] ?? ''
      flags.push({
        code: 'total_mismatch',
        severity: engineKind === 'ocr' ? 'warn' : 'block',
        message: `Line items add up to ${sym}${sum.toFixed(2)} but the printed total is ${sym}${clean.total.toFixed(2)}. The receipt may have been altered.`,
      })
    }
  }

  return {
    ...clean,
    flags,
    discardedFields,
    rawTextExcerpt: rawText.slice(0, 2000),
    unreadable: raw.unreadable ?? null,
    model: engine,
    engineKind,
    extractedAt: new Date().toISOString(),
  }
}

/** Demo samples are "read" from their known contents, then go through the same checks as real photos. */
export function readSample(sample) {
  const lines = [sample.merchant, sample.address, `${sample.date} ${sample.time}`]
  for (const it of sample.items) lines.push(`${it.desc}  ${it.qty} x ${it.price.toFixed(2)}  ${(it.qty * it.price).toFixed(2)}`)
  lines.push(`TOTAL ${sample.total.toFixed(2)}`, sample.paymentMethod)
  if (sample.hiddenText) lines.push(sample.hiddenText)
  return finalize(
    {
      merchant: sample.merchant,
      date: sample.date,
      total: sample.total,
      currency: sample.currency,
      suggestedCategory: sample.suggestedCategory,
      items: sample.items.map((i) => ({ desc: i.desc, amount: round2(i.qty * i.price) })),
      rawText: lines.join('\n'),
      suspiciousText: [],
      confidence: sample.hiddenText ? 0.71 : 0.94,
    },
    'mock-vision-1',
    'model',
  )
}

/**
 * @param receipt { kind: 'sample', sampleId } | { kind: 'upload', dataUrl, mimeType, fileName }
 * @param opts.samples sample receipt records (demo)
 * @param opts.onProgress ({ stage, progress }) => void
 */
export async function readReceipt(receipt, { samples = [], onProgress } = {}) {
  if (receipt?.kind === 'sample') {
    const sample = samples.find((s) => s.id === receipt.sampleId)
    if (!sample) throw new Error('Unknown sample receipt.')
    return readSample(sample)
  }

  const settings = getReaderSettings()
  let fallbackNote = null
  if (settings.engine === 'claude' && settings.apiKey) {
    onProgress?.({ stage: `Sending to ${settings.model}`, progress: 0.3 })
    try {
      const { readWithClaude } = await import('./claudeReader.js')
      return finalize(await readWithClaude(receipt, settings), settings.model, 'model')
    } catch (error) {
      // Fall back to the free reader rather than leave the member stuck.
      fallbackNote = `${error.message} Used the free on-device reader instead.`
    }
  }
  const result = finalize(await readWithOcr(receipt, onProgress), 'tesseract-ocr', 'ocr')
  return fallbackNote ? { ...result, note: fallbackNote } : result
}
