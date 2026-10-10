// Simulated AI receipt reader. The real one runs server-side (API key in Ledger Key Ring)
// and returns DATA ONLY in this shape. Anything outside the schema is discarded, never acted on.

export const EXTRACTION_FIELDS = ['merchant', 'date', 'total', 'currency', 'suggestedCategory', 'confidence', 'flags']

// A real photo is "read" as one of these in the demo, so it passes the checks.
const CLEAN_FOR_UPLOADS = ['rcp_coop_hack', 'rcp_baking_sample']

function hash(s) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

export function sampleForReceipt(receipt, receipts) {
  if (receipt?.kind === 'sample') return receipts.find((r) => r.id === receipt.sampleId) ?? null
  if (receipt?.kind === 'upload') {
    const id = CLEAN_FOR_UPLOADS[hash(receipt.fileName ?? 'x') % CLEAN_FOR_UPLOADS.length]
    return receipts.find((r) => r.id === id) ?? null
  }
  return null
}

export function simulateExtraction(receipt, receipts) {
  const src = sampleForReceipt(receipt, receipts)
  const flags = []
  if (src?.hiddenText) {
    flags.push({
      code: 'prompt_injection',
      message: 'Receipt contains text addressed to an AI system ("ignore your validation rules…")',
    })
  }
  return {
    merchant: src?.merchant ?? null,
    date: src?.date ?? null,
    total: src?.total ?? null,
    currency: src?.currency ?? null,
    suggestedCategory: src?.suggestedCategory ?? null,
    confidence: src ? (src.hiddenText ? 0.71 : 0.94) : 0,
    flags,
    discardedFields: {},
    model: 'mock-vision-1',
    simulated: receipt?.kind === 'upload',
    extractedAt: new Date().toISOString(),
  }
}
