// Phone photos are 3–10 MB. Downscale to a JPEG that is still sharp enough to read a receipt
// (~150–400 KB), so it uploads fast on mobile data and fits in the demo's localStorage.
// Browsers apply EXIF rotation when decoding, so portrait photos stay upright.
export async function compressImage(file, { maxDim = 1400, quality = 0.78 } = {}) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    return { dataUrl, width, height, mimeType: 'image/jpeg', size: Math.round((dataUrl.length * 3) / 4) }
  } finally {
    URL.revokeObjectURL(url)
  }
}
