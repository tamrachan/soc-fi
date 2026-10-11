// Receipt photos have grey thermal print on off-white paper, and OCR drops the faint lines
// (dates, item rows, small print). Before reading: greyscale → stretch levels between ink and
// paper → gamma, so grey text turns near-black and the paper turns white.

/** Pure pixel transform on RGBA data (Uint8ClampedArray), in place. Exported for tests. */
export function enhancePixels(data) {
  const n = data.length / 4
  const lum = new Uint8Array(n)
  const hist = new Uint32Array(256)
  for (let i = 0; i < n; i++) {
    const v = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000
    lum[i] = v
    hist[lum[i]]++
  }
  const pct = (p) => {
    let acc = 0
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= n * p) return v
    return 255
  }
  const ink = pct(0.01)
  const paper = Math.max(ink + 1, pct(0.6)) // most of a receipt photo is paper
  const lut = new Uint8Array(256)
  for (let v = 0; v < 256; v++) {
    const t = Math.min(1, Math.max(0, (v - ink) / (paper - ink)))
    lut[v] = Math.round(255 * t ** 2.2)
  }
  for (let i = 0; i < n; i++) {
    const v = lut[lum[i]]
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
  }
  return data
}

/** Browser: returns an enhanced PNG data URL, upscaled so small print is at least OCR size. */
export async function enhanceForOcr(dataUrl) {
  if (typeof document === 'undefined') return dataUrl
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  const scale = Math.min(2, Math.max(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  enhancePixels(frame.data)
  ctx.putImageData(frame, 0, 0)
  return canvas.toDataURL('image/png')
}
