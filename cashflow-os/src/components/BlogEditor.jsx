import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { Bold, Code2, Heading2, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Redo2, Table2, Undo2 } from 'lucide-react'
import BlogMarkdown from './BlogMarkdown'

function ToolbarButton({ active, label, children, onClick }) {
  return <button type="button" className={active ? 'is-active' : ''} aria-label={label} title={label} onClick={onClick}>{children}</button>
}

export default function BlogEditor({ value = '', onChange, onOpenMedia, onDropMedia }) {
  const [mode, setMode] = useState('visual')
  const onDropMediaRef = useRef(onDropMedia)
  useEffect(() => { onDropMediaRef.current = onDropMedia }, [onDropMedia])
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, protocols: ['https', 'mailto'] }),
      Image.configure({ allowBase64: false }),
      TableKit.configure({ table: { resizable: true } }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: { class: 'journal-visual-editor', 'aria-label': 'Article body' },
      handleDrop: (_view, event) => {
        const encoded = event.dataTransfer?.getData('application/x-runway-blog-media')
        if (!encoded) return false
        try {
          const item = JSON.parse(encoded)
          if (!/^\/blog-media\/[a-f0-9-]{36}\/[a-f0-9]{8}\.(?:png|jpe?g|webp)$/i.test(String(item.path || ''))) return true
          event.preventDefault()
          onDropMediaRef.current?.(item)
        } catch { /* Ignore malformed drag data from outside the media library. */ }
        return true
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getMarkdown()),
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getMarkdown() !== value) editor.commands.setContent(value || '', { contentType: 'markdown' })
  }, [editor, value])

  const setLink = () => {
    const previous = editor?.getAttributes('link').href || ''
    const href = window.prompt('HTTPS link', previous)
    if (href === null) return
    if (!href) editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    else if (/^(https:\/\/|mailto:|\/|#)/i.test(href)) editor?.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  return (
    <div className="journal-editor">
      <div className="journal-editor__tabs" role="tablist">
        {['visual', 'markdown', 'preview'].map((item) => <button type="button" role="tab" aria-selected={mode === item} className={mode === item ? 'is-active' : ''} onClick={() => setMode(item)} key={item}>{item === 'visual' ? 'Visual editor' : item === 'markdown' ? 'Markdown source' : 'Preview'}</button>)}
      </div>
      {mode === 'visual' && editor && (
        <>
          <div className="journal-editor__toolbar" aria-label="Formatting tools">
            <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 /></ToolbarButton>
            <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 /></ToolbarButton>
            <i />
            <ToolbarButton label="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></ToolbarButton>
            <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></ToolbarButton>
            <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></ToolbarButton>
            <ToolbarButton label="Link" active={editor.isActive('link')} onClick={setLink}><Link2 /></ToolbarButton>
            <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></ToolbarButton>
            <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></ToolbarButton>
            <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></ToolbarButton>
            <ToolbarButton label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 /></ToolbarButton>
            <ToolbarButton label="Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 /></ToolbarButton>
            <ToolbarButton label="Insert media" onClick={onOpenMedia}><ImagePlus /></ToolbarButton>
          </div>
          <EditorContent editor={editor} />
        </>
      )}
      {mode === 'markdown' && <textarea className="journal-markdown-source" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Markdown source" spellCheck />}
      {mode === 'preview' && <div className="journal-editor__preview"><BlogMarkdown markdown={value} /></div>}
    </div>
  )
}
