// Browser-side image processing for admin uploads. Every upload is decoded,
// normalized to a sharp high-resolution WebP (long edge between 2000 and
// 2560 px, gentle saturation and contrast lift where the canvas supports
// filters), and returned as a data URL for the Worker to store.

const MAX_DIMENSION = 2560
const TARGET_DIMENSION = 2000
const MAX_UPSCALE_FACTOR = 2
const WEBP_QUALITY = 0.86
const MAX_SOURCE_BYTES = 12 * 1024 * 1024

function fileToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(blob)
  })
}

export async function processImageFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Source image must be 12 MB or smaller.')
  }

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This image format could not be opened. Use PNG, JPEG, or WebP.')
  }

  const natural = Math.max(bitmap.width, bitmap.height)
  let target = Math.min(Math.max(natural, TARGET_DIMENSION), MAX_DIMENSION)
  if (natural < TARGET_DIMENSION) {
    target = Math.min(TARGET_DIMENSION, Math.round(natural * MAX_UPSCALE_FACTOR))
  }
  const scale = target / natural
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  try {
    context.filter = 'saturate(1.05) contrast(1.04)'
  } catch {
    // Canvas filters are unsupported in some browsers; draw without them.
  }
  context.drawImage(bitmap, 0, 0, width, height)
  context.filter = 'none'
  if (typeof bitmap.close === 'function') bitmap.close()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
  if (!blob) throw new Error('The image could not be processed.')
  return fileToDataUrl(blob)
}
