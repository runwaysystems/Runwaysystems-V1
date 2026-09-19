import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveBlogMedia } from '../api/platformApi'

const safeHref = (href = '') => {
  const value = String(href).trim()
  if ((value.startsWith('/') && !value.startsWith('//')) || value.startsWith('#') || /^https:\/\//i.test(value) || /^mailto:/i.test(value)) return value
  return '#'
}

const headingId = (children) => String(children ?? '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')

export default function BlogMarkdown({ markdown = '', className = '' }) {
  const components = {
    a: ({ href, children, ...props }) => {
      const safe = safeHref(href)
      const external = /^https:\/\//i.test(safe)
      return <a href={safe} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...props}>{children}</a>
    },
    img: ({ src, alt = '', ...props }) => {
      const value = String(src || '')
      const trusted = /^\/blog-media\/[a-f0-9-]{36}\/[a-f0-9]{8}\.(?:png|jpe?g|webp)$/i.test(value)
        || /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value)
      return trusted ? <img src={resolveBlogMedia(value)} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" {...props} /> : null
    },
    h2: ({ children, ...props }) => <h2 id={headingId(children)} {...props}>{children}</h2>,
    h3: ({ children, ...props }) => <h3 id={headingId(children)} {...props}>{children}</h3>,
  }
  return <div className={`blog-prose ${className}`.trim()}><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>{markdown}</ReactMarkdown></div>
}
