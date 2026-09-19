import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Mail, RefreshCw, Search, Sparkles } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import BlogCard from '../components/BlogCard'
import Seo from '../components/Seo'
import { Footer, Navbar } from '../components/StorefrontShell'
import { getPublicBlogCategories, getPublicBlogPosts } from '../api/platformApi'
import { usePublicProducts } from '../hooks/usePublicProducts'

export default function BlogIndexPage({ theme, onToggleTheme, palette, onPaletteChange }) {
  const config = usePublicProducts()
  const [searchParams] = useSearchParams()
  const tag = searchParams.get('tag') || ''
  const [posts, setPosts] = useState([])
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async ({ append = false, nextCursor = '' } = {}) => {
    setLoading(true); setError('')
    try {
      const [postResult, categoryResult] = await Promise.all([
        getPublicBlogPosts({ limit: 12, category, tag, search: query, cursor: nextCursor }),
        categories.length ? Promise.resolve({ categories }) : getPublicBlogCategories(),
      ])
      setPosts((current) => append ? [...current, ...(postResult.posts || [])] : (postResult.posts || []))
      setCategories(categoryResult.categories || [])
      setCursor(postResult.nextCursor || '')
      setHasMore(Boolean(postResult.hasMore))
    } catch (loadError) { setError(loadError.message || 'The Blog could not be opened.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [category, query, tag])
  const featured = posts.find((post) => post.featured) || posts[0]
  const rest = useMemo(() => posts.filter((post) => post.id !== featured?.id), [posts, featured])
  const products = (config?.products || []).map(({ key, name }) => ({ key, name }))

  return (
    <div className="journal-page">
      <Seo title="Runway Systems Blog | Finance and operations for independent businesses" description="Practical articles on cash flow, clients, projects, invoicing, and building calmer systems for independent business." canonicalPath="/blog" feedPath="/blog/feed.xml" jsonLd={[{ id: 'blog-jsonld', data: { '@context': 'https://schema.org', '@type': 'Blog', name: 'Runway Systems Blog', url: `${window.location.origin}/blog`, publisher: { '@type': 'Organization', name: 'Runway Systems' } } }]} />
      <Navbar theme={theme} onToggleTheme={onToggleTheme} palette={palette} onPaletteChange={onPaletteChange} />
      <main>
        <section className="journal-hero">
          <div className="journal-hero__grid" aria-hidden="true" />
          <div className="journal-hero__glow" aria-hidden="true" />
          <div className="shell journal-hero__inner">
            <div><p className="eyebrow"><Sparkles /> RUNWAY SYSTEMS BLOG</p><h1>Clearer thinking for<br /><em>independent business.</em></h1></div>
            <div className="journal-hero__intro"><span>ARTICLES · GUIDES · SYSTEMS</span><p>Practical ideas for calmer finances, stronger client work, and operating with less friction.</p><a href="#blog-newsletter"><Mail /> Get the next article</a></div>
          </div>
        </section>

        <section className="journal-discovery shell" id="topics">
          <div className="journal-topics" aria-label="Blog topics">
            <button className={!category ? 'is-active' : ''} onClick={() => setCategory('')}>All notes</button>
            {categories.filter((item) => item.publishedCount > 0).map((item) => <button className={category === item.slug ? 'is-active' : ''} onClick={() => setCategory(item.slug)} key={item.id}>{item.name}<small>{item.publishedCount}</small></button>)}
          </div>
          <form className="journal-search" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()) }}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the Blog" aria-label="Search Blog" /><button type="submit">Search</button></form>
        </section>

        {loading && !posts.length ? <div className="journal-state shell" role="status"><RefreshCw className="spin" /><p>Opening the Blog…</p></div>
          : error ? <div className="journal-state shell is-error"><BookOpen /><h2>The Blog is temporarily unavailable.</h2><p>{error}</p><button className="button" onClick={() => load()}>Try again</button></div>
            : !posts.length ? <div className="journal-state shell"><BookOpen /><h2>No articles match this view.</h2><p>Try another topic or clear the search.</p></div>
              : <>
                <section className="journal-feature shell"><div className="journal-section-label"><span>01</span><p>FEATURED ARTICLE</p><i /></div><BlogCard post={featured} featured /></section>
                {!!rest.length && <section className="journal-latest shell" id="latest"><div className="journal-section-heading"><div><span>02</span><p>LATEST FROM THE BLOG</p></div><h2>Useful ideas.<br /><em>Built to be applied.</em></h2></div><div className="journal-card-grid">{rest.map((post) => <BlogCard post={post} key={post.id} />)}</div>{hasMore && <button className="button journal-load-more" disabled={loading} onClick={() => load({ append: true, nextCursor: cursor })}>{loading ? <RefreshCw className="spin" /> : <ArrowRight />} Load more articles</button>}</section>}
              </>}
      </main>
      <Footer products={products} supportEmail={config?.supportEmail} newsletter={!error} />
    </div>
  )
}
