import { ArrowUpRight, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { resolveBlogMedia } from '../api/platformApi'

const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : ''

export default function BlogCard({ post, featured = false }) {
  const cover = post.cover?.path ? resolveBlogMedia(post.cover.path) : ''
  return (
    <article className={`journal-card ${featured ? 'journal-card--featured' : ''}`}>
      <Link className="journal-card__media" to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}>
        {cover ? <img src={cover} alt={post.cover?.altText || ''} loading={featured ? 'eager' : 'lazy'} /> : <div className="journal-card__art"><i /><span>RUNWAY<br />BLOG</span></div>}
      </Link>
      <div className="journal-card__body">
        <div className="journal-card__meta"><span>{post.category?.name || 'Field note'}</span><span><Clock3 size={13} /> {post.readingMinutes} min</span></div>
        <h2><Link to={`/blog/${post.slug}`}>{post.title}</Link></h2>
        <p>{post.excerpt}</p>
        <div className="journal-card__foot"><time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time><Link to={`/blog/${post.slug}`} aria-label={`Read ${post.title}`}><ArrowUpRight /></Link></div>
      </div>
    </article>
  )
}
