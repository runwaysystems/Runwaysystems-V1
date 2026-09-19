import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check, Clock3, Copy, Mail, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BlogCard from '../components/BlogCard'
import BlogMarkdown from '../components/BlogMarkdown'
import Seo from '../components/Seo'
import { Footer, Navbar } from '../components/StorefrontShell'
import { getPublicBlogPost, resolveBlogMedia } from '../api/platformApi'
import { usePublicProducts } from '../hooks/usePublicProducts'

const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)) : ''
const idFor = (title) => title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
const CATEGORY_PRODUCT = { finance: 'cashflow-os', clients: 'client-crm-os', projects: 'project-os', invoicing: 'invoice-os', operations: 'cashflow-os' }

export default function BlogPostPage({ theme, onToggleTheme, palette, onPaletteChange }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const config = usePublicProducts()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true); setError(''); setResult(null)
    getPublicBlogPost(slug).then((payload) => {
      if (!alive) return
      if (payload.redirectTo) { navigate(payload.redirectTo, { replace: true }); return }
      setResult(payload)
    }).catch((loadError) => alive && setError(loadError.message || 'Article not found')).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [slug, navigate])

  useEffect(() => {
    const update = () => {
      const root = document.documentElement
      const max = root.scrollHeight - window.innerHeight
      root.style.setProperty('--article-progress', `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`)
    }
    window.addEventListener('scroll', update, { passive: true }); update()
    return () => { window.removeEventListener('scroll', update); document.documentElement.style.removeProperty('--article-progress') }
  }, [result])

  const post = result?.post
  const headings = useMemo(() => [...String(post?.bodyMarkdown || '').matchAll(/^##\s+(.+)$/gm)].map((match) => ({ title: match[1].replace(/[*_`]/g, ''), id: idFor(match[1]) })).slice(0, 12), [post?.bodyMarkdown])
  const canonicalPath = `/blog/${post?.slug || slug}`
  const canonicalUrl = typeof window === 'undefined' ? canonicalPath : `${window.location.origin}${canonicalPath}`
  const cover = post?.cover?.path ? resolveBlogMedia(post.cover.path) : ''
  const products = (config?.products || []).map(({ key, name }) => ({ key, name }))
  const connectedProduct = (config?.products || []).find((item) => item.key === CATEGORY_PRODUCT[post?.category?.slug])
  const copyLink = async () => { await navigator.clipboard?.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }

  return (
    <div className={`journal-page journal-article-page layout-${post?.layout || 'editorial'}`}>
      {post ? <Seo title={post.seoTitle || `${post.title} | Runway Systems Blog`} description={post.seoDescription || post.excerpt} canonicalPath={canonicalPath} feedPath="/blog/feed.xml" ogType="article" ogImage={cover || undefined} ogImageAlt={post.cover?.altText || post.title} jsonLd={[{ id: 'blog-post-jsonld', data: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.seoDescription || post.excerpt, ...(cover ? { image: [cover] } : {}), datePublished: post.publishedAt, dateModified: post.updatedAt, mainEntityOfPage: canonicalUrl, author: { '@type': 'Organization', name: post.authorName }, publisher: { '@type': 'Organization', name: 'Runway Systems', url: window.location.origin }, keywords: post.tags.join(', ') } }, { id: 'blog-breadcrumb-jsonld', data: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Runway Systems', item: window.location.origin }, { '@type': 'ListItem', position: 2, name: 'Runway Systems Blog', item: `${window.location.origin}/blog` }, { '@type': 'ListItem', position: 3, name: post.title, item: canonicalUrl }] } }]} /> : !loading ? <Seo title="Article not found | Runway Systems Blog" description="This Runway Systems Blog article is not publicly available." canonicalPath={`/blog/${slug}`} noindex /> : null}
      <div className="article-progress" aria-hidden="true" />
      <Navbar theme={theme} onToggleTheme={onToggleTheme} palette={palette} onPaletteChange={onPaletteChange} />
      <main>
        {loading ? <div className="journal-state article-state shell" role="status"><RefreshCw className="spin" /><p>Opening article…</p></div>
          : error || !post ? <section className="journal-state article-state shell is-error"><h1>That article is not available.</h1><p>{error || 'It may be a draft, archived, or removed.'}</p><Link className="button" to="/blog"><ArrowLeft /> Browse the Blog</Link></section>
            : <>
              <article className="journal-article">
                <header className="article-hero">
                  <div className="article-hero__grid" aria-hidden="true" />
                  <div className="shell article-hero__inner">
                    <nav className="article-breadcrumb" aria-label="Breadcrumb"><Link to="/">Runway Systems</Link><span>/</span><Link to="/blog">Blog</Link><span>/</span><span>{post.category?.name || 'Field note'}</span></nav>
                    <div className="article-kicker"><span>{post.category?.name || 'Blog'}</span><i />{post.layout.replace('-', ' ')}</div>
                    <h1>{post.title}</h1><p className="article-deck">{post.excerpt}</p>
                    <div className="article-byline"><span className="article-author-mark">RS</span><div><strong>{post.authorName}</strong><span><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time><i /> <Clock3 /> {post.readingMinutes} min read</span></div></div>
                  </div>
                </header>
                <div className={`article-cover shell ${cover ? '' : 'article-cover--generated'}`}>{cover ? <figure><img src={cover} alt={post.cover.altText} width={post.cover.width || undefined} height={post.cover.height || undefined} /><figcaption>{post.cover.caption}</figcaption></figure> : <div><span>RUNWAY SYSTEMS BLOG · {post.category?.name || 'FIELD NOTE'}</span><b>Ideas for calmer<br />independent business.</b><i /></div>}</div>
                <div className="article-reading shell">
                  <aside className="article-toc">{headings.length > 2 && <details><summary>ON THIS PAGE</summary><nav>{headings.map((heading) => <a href={`#${heading.id}`} key={heading.id}>{heading.title}</a>)}</nav></details>}<a className="article-rss-link" href="#blog-newsletter"><Mail /> Get the next article</a></aside>
                  <div className="article-content">
                    <BlogMarkdown markdown={post.bodyMarkdown} className="article-body" />
                    {connectedProduct && <aside className="article-product-connection"><div><span>PUT THIS INTO PRACTICE</span><h2>A calmer way to manage {post.category?.name?.toLowerCase()}.</h2><p>{connectedProduct.tagline || `${connectedProduct.name} turns the ideas in this field note into a practical Google Sheets workflow.`}</p></div><Link className="button" to={`/products/${connectedProduct.key}`}>Explore {connectedProduct.name} <ArrowUpRight /></Link></aside>}
                  </div>
                  <aside className="article-share"><span>SHARE</span><button type="button" onClick={copyLink}>{copied ? <Check /> : <Copy />}<small>{copied ? 'Copied' : 'Copy link'}</small></button></aside>
                </div>
                <footer className="article-end shell"><div className="article-tags">{post.tags.map((tag) => <Link to={`/blog?tag=${encodeURIComponent(tag.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`} key={tag}>{tag}</Link>)}</div><div className="article-end__rule" /><div><span>END OF FIELD NOTE</span><Link to="/blog">Return to the Blog <ArrowUpRight /></Link></div></footer>
              </article>
              {!!result.relatedPosts?.length && <section className="article-related"><div className="shell"><div className="journal-section-heading"><div><span>03</span><p>CONTINUE READING</p></div><h2>Related<br /><em>articles.</em></h2></div><div className="journal-card-grid">{result.relatedPosts.map((item) => <BlogCard post={item} key={item.id} />)}</div></div></section>}
            </>}
      </main>
      <Footer products={products} supportEmail={config?.supportEmail} newsletter={loading || Boolean(post)} />
    </div>
  )
}
