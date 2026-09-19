import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArrowUpRight, Bot, CalendarClock, Check, Clock3, Download, Eye, FileUp, History, ImagePlus, LoaderCircle, Plus, RefreshCw, Save, Search, Send, Trash2, Undo2, X } from 'lucide-react'
import {
  changeAdminBlogSlug, createAdminBlogCategory, createAdminBlogPost, getActiveAdminChallenge, getAdminBlogCategories, getAdminBlogMedia, getAdminBlogPost,
  getAdminBlogPosts, getAdminBlogRevisions, importAdminBlogPost, permanentlyDeleteAdminBlogPost, restoreAdminBlogRevision, transitionAdminBlogPost,
  updateAdminBlogCategory, updateAdminBlogMedia, updateAdminBlogPost, uploadAdminBlogMedia, deleteAdminBlogMedia, resolveBlogMedia,
} from '../api/platformApi'
import BlogEditor from '../components/BlogEditor'
import BlogMarkdown from '../components/BlogMarkdown'
import BlogMediaLibrary from '../components/BlogMediaLibrary'
import AdminTotpPrompt from '../components/AdminTotpPrompt'

const blank = () => ({ id: '', title: '', slug: '', excerpt: '', bodyMarkdown: '', categoryId: '', tags: '', authorName: 'Runway Systems', coverMediaId: '', seoTitle: '', seoDescription: '', featured: false, layout: 'editorial', status: 'draft', version: 0, scheduledAt: '', deletedAt: '' })
const toDraft = (post) => ({ ...blank(), ...post, categoryId: post.category?.id || '', coverMediaId: post.cover?.id || post.coverMediaId || '', tags: (post.tags || []).join(', ') })
const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const localKey = (id) => `runway-journal-recovery:${id || 'new'}`
const recoverLocalDraft = (id = '') => {
  try { return JSON.parse(localStorage.getItem(localKey(id)) || 'null') || blank() } catch { return blank() }
}

export default function AdminBlogPanel({ authOptions, notify }) {
  const [posts, setPosts] = useState([])
  const [statusCounts, setStatusCounts] = useState({ draft: 0, scheduled: 0, published: 0, archived: 0, trash: 0 })
  const [categories, setCategories] = useState([])
  const [media, setMedia] = useState([])
  const [revisions, setRevisions] = useState([])
  const [draft, setDraft] = useState(() => recoverLocalDraft())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [savedState, setSavedState] = useState(() => recoverLocalDraft().title ? 'unsaved' : 'saved')
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showMedia, setShowMedia] = useState(false)
  const [mediaPurpose, setMediaPurpose] = useState('cover')
  const [showImport, setShowImport] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showPagePreview, setShowPagePreview] = useState(false)
  const [mobilePanel, setMobilePanel] = useState('editor')
  const [importContent, setImportContent] = useState('')
  const [importFormat, setImportFormat] = useState('markdown')
  const [scheduleAt, setScheduleAt] = useState('')
  const saveTimer = useRef(null)
  const currentId = useRef('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [postResult, allResult, trashResult, categoryResult, mediaResult] = await Promise.all([
        getAdminBlogPosts({ ...authOptions, status: filter === 'trash' ? '' : filter, search, trashed: filter === 'trash' }),
        getAdminBlogPosts({ ...authOptions }), getAdminBlogPosts({ ...authOptions, trashed: true }),
        getAdminBlogCategories(authOptions), getAdminBlogMedia(authOptions),
      ])
      const allPosts = allResult.posts || []
      setPosts(postResult.posts || [])
      setStatusCounts({
        draft: allPosts.filter((post) => post.status === 'draft').length,
        scheduled: allPosts.filter((post) => post.status === 'scheduled').length,
        published: allPosts.filter((post) => post.status === 'published').length,
        archived: allPosts.filter((post) => post.status === 'archived').length,
        trash: (trashResult.posts || []).length,
      })
      setCategories(categoryResult.categories || []); setMedia(mediaResult.media || [])
    } catch (loadError) { setError(loadError.message || 'The Blog workspace could not be loaded.') }
    finally { setLoading(false) }
  }, [authOptions, filter, search])
  useEffect(() => { load() }, [load])
  useEffect(() => () => window.clearTimeout(saveTimer.current), [])

  const update = (key, value) => {
    setDraft((current) => {
      const next = { ...current, [key]: value }
      if (key === 'title' && !current.id && (!current.slug || current.slug === slugify(current.title))) next.slug = slugify(value)
      try { localStorage.setItem(localKey(current.id), JSON.stringify(next)) } catch { /* local recovery is best effort */ }
      return next
    })
    setSavedState('unsaved')
  }

  const replacePost = (post) => {
    setDraft(toDraft(post)); currentId.current = post.id
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
    try { localStorage.removeItem(localKey(post.id)); localStorage.removeItem(localKey('')) } catch { /* ignored */ }
    setSavedState('saved')
  }

  const payload = (source = draft) => ({
    title: source.title || 'Untitled article', slug: source.slug || slugify(source.title || 'untitled-article'), excerpt: source.excerpt,
    bodyMarkdown: source.bodyMarkdown, categoryId: source.categoryId, tags: String(source.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    authorName: source.authorName, coverMediaId: source.coverMediaId, seoTitle: source.seoTitle, seoDescription: source.seoDescription,
    featured: source.featured, layout: source.layout, version: source.version,
  })

  const save = useCallback(async ({ silent = false } = {}) => {
    if (!draft.title.trim()) return null
    if (!silent) setBusy('save')
    setSavedState('saving'); setError('')
    try {
      const result = draft.id ? await updateAdminBlogPost(draft.id, payload(), authOptions) : await createAdminBlogPost(payload(), authOptions)
      replacePost(result.post)
      if (!silent) notify?.('Blog draft saved.')
      return result.post
    } catch (saveError) {
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || /network|fetch|offline/i.test(String(saveError?.message || ''))
      setSavedState(offline ? 'offline' : 'conflict')
      setError(offline ? 'You appear to be offline. This draft remains in local recovery storage.' : (saveError.message || 'The draft could not be saved.'))
      return null
    }
    finally { if (!silent) setBusy('') }
  }, [draft, authOptions, notify])

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    if (draft.title.trim().length < 3 || savedState !== 'unsaved' || !getActiveAdminChallenge()) return
    saveTimer.current = window.setTimeout(() => save({ silent: true }), 2500)
    return () => window.clearTimeout(saveTimer.current)
  }, [draft, savedState, save])

  const open = async (id) => {
    setBusy('open'); setError('')
    try {
      const [postResult, revisionResult] = await Promise.all([getAdminBlogPost(id, authOptions), getAdminBlogRevisions(id, authOptions)])
      let next = toDraft(postResult.post)
      try { const recovery = localStorage.getItem(localKey(id)); if (recovery && window.confirm('A newer browser recovery draft exists. Restore it?')) next = JSON.parse(recovery) } catch { /* ignored */ }
      setDraft(next); currentId.current = id; setRevisions(revisionResult.revisions || []); setSavedState('saved'); setMobilePanel('editor')
    } catch (openError) { setError(openError.message || 'The article could not be opened.') }
    finally { setBusy('') }
  }

  const act = async (action, extra = {}) => {
    let post = draft.id ? draft : await save()
    if (!post) return
    setBusy(action); setError('')
    try {
      const result = await transitionAdminBlogPost(post.id, action, { version: post.version, ...extra }, authOptions)
      replacePost(result.post); await load(); notify?.(`Article ${action.replace('-', ' ')} complete.`)
    } catch (actionError) { setError(actionError.message || `The article could not ${action}.`) }
    finally { setBusy('') }
  }

  const exportMarkdown = () => {
    const content = `# ${draft.title || 'Untitled article'}\n\n${draft.excerpt ? `${draft.excerpt}\n\n` : ''}${draft.bodyMarkdown || ''}`
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `${draft.slug || 'runway-journal-draft'}.md`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const addCategory = async () => {
    const name = window.prompt('New Blog category name')?.trim()
    if (!name) return
    setBusy('category'); setError('')
    try {
      const result = await createAdminBlogCategory({ name, slug: slugify(name), description: '' }, authOptions)
      setCategories(result.categories || []); notify?.(`${name} added to Blog categories.`)
    } catch (categoryError) { setError(categoryError.message || 'The category could not be added.') }
    finally { setBusy('') }
  }

  const patchCategory = async (category, patch) => {
    setBusy(`category:${category.id}`); setError('')
    try {
      const result = await updateAdminBlogCategory(category.id, {
        name: patch.name ?? category.name,
        slug: slugify(patch.slug ?? category.slug),
        description: patch.description ?? category.description,
        active: patch.active ?? category.active,
      }, authOptions)
      setCategories(result.categories || [])
    } catch (categoryError) { setError(categoryError.message || 'The category could not be updated.') }
    finally { setBusy('') }
  }

  const changeUrl = async () => {
    const requested = window.prompt('New article URL slug', draft.slug)
    if (requested === null || slugify(requested) === draft.slug) return
    const nextSlug = slugify(requested)
    if (!nextSlug || !window.confirm(`Change the public URL to /blog/${nextSlug}? The old URL will redirect permanently.`)) return
    setBusy('url'); setError('')
    try {
      const result = await changeAdminBlogSlug(draft.id, { version: draft.version, slug: nextSlug, reason: 'Owner-approved canonical URL change' }, authOptions)
      replacePost(result.post); notify?.('Article URL changed. The previous URL now redirects permanently.')
    } catch (changeError) { setError(changeError.message || 'The article URL could not be changed.') }
    finally { setBusy('') }
  }

  const deletePermanently = async () => {
    if (!draft.id || !draft.deletedAt || !window.confirm('Permanently delete this trashed article and its revisions? This cannot be undone.')) return
    setBusy('permanent'); setError('')
    try {
      await permanentlyDeleteAdminBlogPost(draft.id, authOptions)
      setDraft(blank()); setRevisions([]); await load(); notify?.('Trashed article permanently deleted.')
    } catch (deleteError) { setError(deleteError.message || 'The article could not be permanently deleted.') }
    finally { setBusy('') }
  }

  const importArticle = async () => {
    if (!importContent.trim()) return
    setBusy('import'); setError('')
    try {
      const result = await importAdminBlogPost({ content: importContent, format: importFormat, layout: 'editorial' }, authOptions)
      replacePost(result.post); setImportContent(''); setShowImport(false)
      notify?.(`AI content imported as a private draft. ${(result.warnings || []).join(' ') || 'Review it before publishing.'}`)
    } catch (importError) { setError(importError.message || 'The content could not be imported.') }
    finally { setBusy('') }
  }

  const readImportFile = async (file) => {
    if (!file) return
    if (file.size > 120000) { setError('Article files must be 120 KB or smaller.'); return }
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['md', 'txt', 'html', 'htm'].includes(extension)) { setError('Upload a Markdown (.md), plain text (.txt), or HTML (.html) article file.'); return }
    const content = await file.text()
    if (content.includes('\uFFFD')) { setError('The article must use UTF-8 text encoding.'); return }
    setImportFormat(extension === 'html' || extension === 'htm' ? 'html' : extension === 'md' ? 'markdown' : 'text')
    setImportContent(content); setShowImport(true)
  }

  const uploadMedia = async (input) => {
    const result = await uploadAdminBlogMedia(input, authOptions)
    setMedia((current) => [result.media, ...current.filter((item) => item.id !== result.media.id)])
    notify?.(result.duplicate ? 'Existing identical image reused.' : 'Image added to the Blog media library.')
  }
  const patchMedia = async (id, input) => { const result = await updateAdminBlogMedia(id, input, authOptions); setMedia((current) => current.map((item) => item.id === id ? { ...result.media, usageCount: item.usageCount } : item)) }
  const removeMedia = async (id) => { if (!window.confirm('Move this unused image to trash?')) return; await deleteAdminBlogMedia(id, authOptions); setMedia((current) => current.filter((item) => item.id !== id)) }
  const insertInlineMedia = (item) => update('bodyMarkdown', `${draft.bodyMarkdown}${draft.bodyMarkdown ? '\n\n' : ''}![${String(item.altText || '').replace(/[\[\]]/g, '')}](${item.path})${item.caption ? `\n*${item.caption}*` : ''}\n`)
  const selectMedia = (item) => {
    if (mediaPurpose === 'cover') update('coverMediaId', item.id)
    else insertInlineMedia(item)
    setShowMedia(false)
  }

  const stats = useMemo(() => ['draft', 'scheduled', 'published', 'archived', 'trash'].map((status) => ({ status, total: statusCounts[status] || 0 })), [statusCounts])
  const selectedCover = media.find((item) => item.id === draft.coverMediaId) || draft.cover
  const readiness = useMemo(() => {
    const inlineImages = [...String(draft.bodyMarkdown || '').matchAll(/!\[([^\]]*)\]\(\s*<?([^\s)>]+)/g)]
    return [
      { label: 'Title is at least 8 characters', ready: draft.title.trim().length >= 8 },
      { label: 'Excerpt is at least 40 characters', ready: draft.excerpt.trim().length >= 40 },
      { label: 'Article body is complete', ready: draft.bodyMarkdown.trim().length >= 150 },
      { label: 'An active category is selected', ready: categories.some((item) => item.id === draft.categoryId && item.active) },
      { label: 'Images are validated and have alt text', ready: inlineImages.every((match) => match[1].trim() && /^\/blog-media\/[a-f0-9-]{36}\/[a-f0-9]{8}\.(?:png|jpe?g|webp)$/i.test(match[2])) && (!draft.coverMediaId || Boolean(selectedCover?.altText?.trim())) },
    ]
  }, [categories, draft.bodyMarkdown, draft.categoryId, draft.coverMediaId, draft.excerpt, draft.title, selectedCover?.altText])

  return (
    <section className="admin-panel journal-admin" id="blog">
      <header className="admin-panel-heading journal-admin__heading"><div><span className="admin-kicker">PUBLISHING STUDIO</span><h2>Runway Systems Blog</h2><p>Write, import, preview, schedule, and publish responsive editorial pages without a deployment.</p></div><div><button className="button" type="button" onClick={() => setShowImport(true)}><Bot /> Import AI article</button><button className="button primary" type="button" onClick={() => { const recovered = recoverLocalDraft(); setDraft(recovered); currentId.current = ''; setRevisions([]); setSavedState(recovered.title ? 'unsaved' : 'saved'); setMobilePanel('editor') }}><Plus /> New article</button></div></header>
      <div className="journal-admin__security"><AdminTotpPrompt /></div>
      <div className="journal-admin__stats">{stats.map((item) => <button type="button" className={filter === item.status ? 'is-active' : ''} onClick={() => setFilter(filter === item.status ? '' : item.status)} key={item.status}><span>{item.status}</span><b>{item.total}</b></button>)}</div>
      {error && <div className="journal-admin__error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
      {showImport && <div className="journal-import"><header><div><Bot /><span>AI CONTENT IMPORT</span><h3>Bring the writing. Runway builds the page.</h3></div><button onClick={() => setShowImport(false)}>×</button></header><p>Paste content from any AI tool or upload Markdown, text, or HTML. It always becomes a private draft; scripts and page styling are never executed.</p><div className="journal-import__controls"><select value={importFormat} onChange={(event) => setImportFormat(event.target.value)}><option value="markdown">Markdown</option><option value="text">Plain text</option><option value="html">HTML content</option></select><label className="button"><FileUp /> Upload document<input hidden type="file" accept=".md,.txt,.html,.htm,text/plain,text/markdown,text/html" onChange={(event) => readImportFile(event.target.files?.[0])} /></label></div><textarea value={importContent} onChange={(event) => setImportContent(event.target.value)} placeholder="Paste the AI-written article here…" /><footer><span>Owner review is required before publishing.</span><button className="button primary" disabled={!importContent.trim() || busy === 'import'} onClick={importArticle}>{busy === 'import' ? <LoaderCircle className="spin" /> : <Bot />} Import as private draft</button></footer></div>}
      {showCategories && <div className="journal-category-manager" role="dialog" aria-modal="true" aria-labelledby="journal-category-title"><header><div><span>TAXONOMY</span><h3 id="journal-category-title">Manage categories</h3></div><button type="button" onClick={() => setShowCategories(false)} aria-label="Close category manager"><X /></button></header><p>Rename, describe, or retire a category. Retired categories remain attached to existing articles but cannot be selected for new work.</p><div className="journal-category-manager__list">{categories.map((category) => <article key={category.id}><label>Name<input value={category.name} maxLength={60} onChange={(event) => setCategories((current) => current.map((item) => item.id === category.id ? { ...item, name: event.target.value } : item))} onBlur={() => patchCategory(category, {})} /></label><label>Slug<input value={category.slug} maxLength={80} onChange={(event) => setCategories((current) => current.map((item) => item.id === category.id ? { ...item, slug: slugify(event.target.value) } : item))} onBlur={() => patchCategory(category, {})} /></label><label className="journal-category-manager__description">Description<input value={category.description || ''} maxLength={240} onChange={(event) => setCategories((current) => current.map((item) => item.id === category.id ? { ...item, description: event.target.value } : item))} onBlur={() => patchCategory(category, {})} /></label><label className="journal-check"><input type="checkbox" checked={category.active} onChange={(event) => patchCategory(category, { active: event.target.checked })} /> Active</label><small>{category.publishedCount || 0} published</small></article>)}</div><footer><button className="button" type="button" onClick={addCategory}><Plus /> Add category</button><button className="button primary" type="button" onClick={() => setShowCategories(false)}>Done</button></footer></div>}

      <nav className="journal-mobile-nav" aria-label="Blog workspace"><button type="button" className={mobilePanel === 'library' ? 'is-active' : ''} onClick={() => setMobilePanel('library')}>Library</button><button type="button" className={mobilePanel === 'editor' ? 'is-active' : ''} onClick={() => setMobilePanel('editor')}>Write</button><button type="button" className={mobilePanel === 'publish' ? 'is-active' : ''} onClick={() => setMobilePanel('publish')}>Publish</button><button type="button" onClick={() => setShowPagePreview(true)}>Preview</button></nav>
      <div className="journal-workspace">
        <aside className={`journal-library journal-mobile-panel ${mobilePanel === 'library' ? 'is-mobile-active' : ''}`}><header><div><span>ARTICLE LIBRARY</span><b>{posts.length}</b></div><form onSubmit={(event) => { event.preventDefault(); load() }}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search articles" /></form></header><div className="journal-library__list">{loading ? <div className="journal-admin-loading"><RefreshCw className="spin" /> Loading…</div> : posts.map((post) => <button type="button" className={draft.id === post.id ? 'is-active' : ''} onClick={() => open(post.id)} key={post.id}><div><span className={`status-${post.status}`}>{post.status}</span><time>{new Date(post.updatedAt).toLocaleDateString()}</time></div><strong>{post.title}</strong><small>/{post.slug}</small></button>)}{!loading && !posts.length && <p className="journal-library__empty">No articles in this view.</p>}</div></aside>

        <div className={`journal-compose journal-mobile-panel ${mobilePanel === 'editor' ? 'is-mobile-active' : ''}`}>
          <header className="journal-compose__bar"><div><span className={`journal-save-state is-${savedState}`}>{savedState === 'saving' ? <LoaderCircle className="spin" /> : savedState === 'saved' ? <Check /> : <Clock3 />} {savedState}</span><span>{draft.status}</span></div><div>{draft.status === 'published' && <a href={`/blog/${draft.slug}`} target="_blank" rel="noreferrer">View live <ArrowUpRight /></a>}<button className="button" type="button" onClick={exportMarkdown}><Download /> Export .md</button><button className="button" type="button" onClick={() => setShowPagePreview(true)}><Eye /> Page preview</button><button className="button" disabled={busy === 'save'} onClick={() => save()}>{busy === 'save' ? <LoaderCircle className="spin" /> : <Save />} Save</button></div></header>
          <div className="journal-compose__title"><input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Article title" aria-label="Article title" /><textarea value={draft.excerpt} onChange={(event) => update('excerpt', event.target.value)} placeholder="Write a concise editorial deck or excerpt…" maxLength={360} /><div><span>{draft.excerpt.length}/360</span><span>{Math.max(1, Math.ceil(String(draft.bodyMarkdown).split(/\s+/).filter(Boolean).length / 220))} min read</span></div></div>
          <BlogEditor value={draft.bodyMarkdown} onChange={(value) => update('bodyMarkdown', value)} onOpenMedia={() => { setMediaPurpose('inline'); setShowMedia(true) }} onDropMedia={(item) => { insertInlineMedia(item); setShowMedia(false) }} />
        </div>

        <aside className={`journal-settings journal-mobile-panel ${mobilePanel === 'publish' ? 'is-mobile-active' : ''}`}><div className="journal-settings__section"><span>PUBLICATION</span><label>Status<input value={draft.status} disabled /></label><label>Layout<select value={draft.layout} onChange={(event) => update('layout', event.target.value)}><option value="editorial">Editorial</option><option value="tutorial">Tutorial</option><option value="field-note">Field note</option><option value="case-study">Case study</option></select></label><label>Category<select value={draft.categoryId} onChange={(event) => update('categoryId', event.target.value)}><option value="">Choose category</option>{categories.filter((item) => item.active).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="journal-category-actions"><button className="button text" type="button" disabled={busy === 'category'} onClick={addCategory}><Plus /> Add category</button><button className="button text" type="button" onClick={() => setShowCategories(true)}>Manage</button></div><label>Tags<input value={draft.tags} onChange={(event) => update('tags', event.target.value)} placeholder="Cash flow, Planning" /></label><label className="journal-check"><input type="checkbox" checked={draft.featured} onChange={(event) => update('featured', event.target.checked)} /> Feature on Blog index</label></div>
          <div className="journal-settings__section"><span>CANONICAL URL</span><label>Slug<div className="journal-slug"><small>/blog/</small><input value={draft.slug} disabled={Boolean(draft.firstPublishedAt)} onChange={(event) => update('slug', slugify(event.target.value))} /></div></label>{draft.firstPublishedAt && <><p>Published URLs are protected. Changing one creates a permanent redirect from the previous URL.</p><button className="button" disabled={Boolean(busy)} onClick={changeUrl}><ArrowUpRight /> Change public URL</button></>}</div>
          <div className="journal-settings__section"><span>COVER</span>{selectedCover?.path && <img className="journal-cover-preview" src={resolveBlogMedia(selectedCover.path)} alt={selectedCover.altText || ''} />}<button className="button" onClick={() => { setMediaPurpose('cover'); setShowMedia(true) }}><ImagePlus /> Choose from media</button>{draft.coverMediaId && <button className="button text" onClick={() => update('coverMediaId', '')}>Remove cover</button>}</div>
          <div className="journal-settings__section"><span>SEARCH & SOCIAL</span><label>SEO title<input value={draft.seoTitle} maxLength={75} onChange={(event) => update('seoTitle', event.target.value)} placeholder={draft.title || 'Article title'} /><small>{draft.seoTitle.length}/75</small></label><label>SEO description<textarea value={draft.seoDescription} maxLength={180} onChange={(event) => update('seoDescription', event.target.value)} placeholder={draft.excerpt || 'Article description'} /><small>{draft.seoDescription.length}/180</small></label><div className="journal-search-preview"><small>runwaysystems.cloud › blog › {draft.slug || 'article'}</small><b>{draft.seoTitle || draft.title || 'Article title'}</b><p>{draft.seoDescription || draft.excerpt || 'Article description will appear here.'}</p></div></div>
          <div className="journal-settings__section"><span>PUBLISH READINESS</span><div className="journal-readiness">{readiness.map((item) => <div className={item.ready ? 'is-ready' : ''} key={item.label}>{item.ready ? <Check /> : <Clock3 />}<span>{item.label}</span></div>)}</div>{draft.status === 'draft' && <><button className="button primary" disabled={!draft.id || busy} onClick={() => act('publish')}><Send /> Publish now</button><div className="journal-schedule"><input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /><button className="button" disabled={!draft.id || !scheduleAt} onClick={() => act('schedule', { scheduledAt: new Date(scheduleAt).toISOString() })}><CalendarClock /> Schedule</button></div></>}{draft.status === 'scheduled' && <button className="button" onClick={() => act('cancel-schedule')}><Undo2 /> Cancel schedule</button>}{draft.status === 'published' && <><button className="button" onClick={() => act('unpublish')}><Undo2 /> Unpublish</button><button className="button" onClick={() => act('archive')}><Archive /> Archive</button></>}{draft.status === 'archived' && !draft.deletedAt && <button className="button" onClick={() => act('restore')}><Undo2 /> Restore draft</button>}{draft.id && !draft.deletedAt && <button className="button danger" onClick={() => window.confirm('Move this article to recoverable trash?') && act('trash')}><Trash2 /> Move to trash</button>}{draft.deletedAt && <><button className="button" onClick={() => act('restore')}><Undo2 /> Restore from trash</button><button className="button danger" disabled={busy === 'permanent'} onClick={deletePermanently}><Trash2 /> Delete permanently</button></>}</div>
          {draft.id && <div className="journal-settings__section"><span>REVISION HISTORY</span>{revisions.slice(0, 6).map((revision) => <div className="journal-revision" key={revision.id}><History /><div><b>Version {revision.version}</b><small>{revision.reason} · {new Date(revision.created_at).toLocaleString()}</small></div><button onClick={async () => { if (!window.confirm('Restore this revision as a new version?')) return; const result = await restoreAdminBlogRevision(draft.id, revision.id, { version: draft.version }, authOptions); replacePost(result.post) }}>Restore</button></div>)}{!revisions.length && <p>No publication checkpoints yet.</p>}</div>}
        </aside>
      </div>
      <BlogMediaLibrary media={media} open={showMedia} onClose={() => setShowMedia(false)} onUpload={uploadMedia} onUpdate={patchMedia} onDelete={removeMedia} onSelect={selectMedia} selectedId={mediaPurpose === 'cover' ? draft.coverMediaId : ''} />
      {showPagePreview && <div className={`journal-page-preview layout-${draft.layout}`} role="dialog" aria-modal="true" aria-label="Article page preview"><header><span>PRIVATE RESPONSIVE PREVIEW · {draft.layout.replace('-', ' ')}</span><button type="button" onClick={() => setShowPagePreview(false)} aria-label="Close article preview"><X /></button></header><div className="journal-page-preview__viewport"><article><div className="article-hero"><div className="article-hero__grid" /><div className="shell article-hero__inner"><div className="article-kicker"><span>{categories.find((item) => item.id === draft.categoryId)?.name || 'Runway Systems Blog'}</span><i />{draft.layout.replace('-', ' ')}</div><h1>{draft.title || 'Untitled field note'}</h1><p className="article-deck">{draft.excerpt || 'The editorial deck will appear here.'}</p><div className="article-byline"><span className="article-author-mark">RS</span><div><strong>{draft.authorName}</strong><span><Clock3 /> {Math.max(1, Math.ceil(String(draft.bodyMarkdown).split(/\s+/).filter(Boolean).length / 220))} min read</span></div></div></div></div>{selectedCover?.path && <figure className="article-cover shell"><img src={resolveBlogMedia(selectedCover.path)} alt={selectedCover.altText || ''} /><figcaption>{selectedCover.caption || ''}</figcaption></figure>}<div className="article-reading shell"><BlogMarkdown markdown={draft.bodyMarkdown} className="article-body" /></div></article></div></div>}
    </section>
  )
}
