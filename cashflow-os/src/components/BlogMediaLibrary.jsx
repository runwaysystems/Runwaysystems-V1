import { useEffect, useRef, useState } from 'react'
import { Check, ImagePlus, LoaderCircle, Trash2, X } from 'lucide-react'
import { processImageFile } from '../lib/imageProcessing'
import { resolveBlogMedia } from '../api/platformApi'

function MediaTile({ item, selected, onSelect, onUpdate, onDelete }) {
  const [altText, setAltText] = useState(item.altText || '')
  const [caption, setCaption] = useState(item.caption || '')
  useEffect(() => { setAltText(item.altText || ''); setCaption(item.caption || '') }, [item.altText, item.caption])
  const commit = () => {
    const nextAlt = altText.trim(); const nextCaption = caption.trim()
    if (nextAlt !== (item.altText || '') || nextCaption !== (item.caption || '')) onUpdate(item.id, { altText: nextAlt, caption: nextCaption })
  }
  return (
    <article className={selected ? 'is-selected' : ''}>
      <button type="button" className="journal-media-thumb" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-runway-blog-media', JSON.stringify({ id: item.id, path: item.path, altText: item.altText, caption: item.caption })) }} onClick={() => onSelect?.(item)}>
        <img src={resolveBlogMedia(item.path)} alt={item.altText} />{selected && <b><Check /></b>}
      </button>
      <input value={altText} onChange={(event) => setAltText(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} aria-label={`Alt text for ${item.originalName || 'image'}`} placeholder="Alt text" />
      <input value={caption} onChange={(event) => setCaption(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} aria-label={`Caption for ${item.originalName || 'image'}`} placeholder="Optional caption" />
      <footer><small>{item.width} × {item.height} · used {item.usageCount || 0}</small><button type="button" disabled={item.usageCount > 0} onClick={() => onDelete(item.id)} aria-label="Delete unused image"><Trash2 /></button></footer>
    </article>
  )
}

export default function BlogMediaLibrary({ media, onUpload, onUpdate, onDelete, onSelect, selectedId = '', open = true, onClose }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')
  const [error, setError] = useState('')
  const upload = async (file) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const image = await processImageFile(file)
      await onUpload({ image, altText: altText.trim(), caption: caption.trim(), originalName: file.name })
      setAltText(''); setCaption('')
    } catch (uploadError) { setError(uploadError.message || 'The image could not be uploaded.') }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }
  if (!open) return null
  return (
    <aside className="journal-media-library" aria-label="Blog media library">
      <header><div><span>MEDIA LIBRARY</span><h3>Reusable article images</h3></div>{onClose && <button type="button" onClick={onClose} aria-label="Close media library"><X /></button>}</header>
      <div className="journal-media-upload">
        <input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the image before upload" aria-label="Image alt text" />
        <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Optional visible caption" aria-label="Image caption" />
        <button type="button" className="button" disabled={busy || !altText.trim()} onClick={() => inputRef.current?.click()}>{busy ? <LoaderCircle className="spin" /> : <ImagePlus />} Upload image</button>
        <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => upload(event.target.files?.[0])} />
        {error && <p className="journal-media-error" role="alert">{error}</p>}
      </div>
      <div className="journal-media-grid">
        {media.map((item) => <MediaTile item={item} selected={selectedId === item.id} onSelect={onSelect} onUpdate={onUpdate} onDelete={onDelete} key={item.id} />)}
        {!media.length && <div className="journal-media-empty"><ImagePlus /><p>Upload the first cover or inline image.</p></div>}
      </div>
    </aside>
  )
}
