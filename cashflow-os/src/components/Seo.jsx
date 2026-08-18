import { useEffect } from 'react'

// Head manager for SEO: title, description, canonical, Open Graph, Twitter
// cards, robots directives, and JSON-LD structured data. Google renders the
// JavaScript, so crawlers see every page's real metadata - including pages
// for products created later from the admin panel.

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const escapeJsonLd = (value) => String(value ?? '')
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')

function upsertMeta(attribute, key, content) {
  let node = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attribute, key)
    document.head.appendChild(node)
  }
  node.setAttribute('content', String(content ?? ''))
}

function upsertLink(rel, href) {
  let node = document.head.querySelector(`link[rel="${rel}"]`)
  if (!node) {
    node = document.createElement('link')
    node.setAttribute('rel', rel)
    document.head.appendChild(node)
  }
  node.setAttribute('href', String(href ?? ''))
}

function upsertJsonLd(id, data) {
  const safe = escapeJsonLd(JSON.stringify(data))
  let script = document.getElementById(id)
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = safe
}

export default function Seo({
  title,
  description,
  canonicalPath = '',
  ogType = 'website',
  ogImage = '',
  noindex = false,
  jsonLd = [],
}) {
  useEffect(() => {
    const canonical = `${window.location.origin}${canonicalPath || window.location.pathname}`

    document.title = title
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', ogType)
    upsertMeta('property', 'og:site_name', 'Runway Systems')
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:locale', 'en_US')
    if (ogImage) {
      upsertMeta('property', 'og:image', ogImage)
      upsertMeta('name', 'twitter:card', 'summary_large_image')
      upsertMeta('name', 'twitter:image', ogImage)
    } else {
      upsertMeta('name', 'twitter:card', 'summary')
    }
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertLink('canonical', canonical)

    for (const { id, data } of jsonLd) upsertJsonLd(id, data)

    return () => {
      for (const { id } of jsonLd) document.getElementById(id)?.remove()
    }
  }, [title, description, canonicalPath, ogType, ogImage, noindex, JSON.stringify(jsonLd)])

  return null
}

export { escapeXml }
