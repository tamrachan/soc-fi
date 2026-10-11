// Free reader: Tesseract.js OCR running entirely on this device, no API key and nothing uploaded.
// The engine and English language data (~10 MB) download from a CDN on first use, then cache.
import { parseReceiptText } from './parseReceiptText.js'
import { enhanceForOcr } from './enhance.js'

let workerPromise = null
let progressListener = null

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1, {
        logger: (m) => progressListener?.({ stage: m.status, progress: m.progress ?? 0 }),
      }),
    )
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

export async function readWithOcr(receipt, onProgress) {
  if (!receipt.dataUrl || !receipt.mimeType?.startsWith('image/')) {
    return { unreadable: 'The free reader can only read photos. Enter the details yourself, or switch to the Claude reader for PDFs.' }
  }
  progressListener = onProgress
  try {
    const worker = await getWorker()
    const image = await enhanceForOcr(receipt.dataUrl).catch(() => receipt.dataUrl)
    const { data } = await worker.recognize(image)
    return { ...parseReceiptText(data.text ?? ''), confidence: Math.max(0, Math.min(1, (data.confidence ?? 0) / 100)) }
  } finally {
    progressListener = null
  }
}
