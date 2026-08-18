import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Seo from '../components/Seo'
import { Navbar, Footer } from '../components/StorefrontShell'
import { useSiteCopy } from '../lib/siteCopy'

// A distinct 404 instead of silently serving the homepage, so crawlers never
// index duplicate content for unknown URLs.
export default function NotFound({ theme, onToggleTheme, palette, onPaletteChange }) {
  const copy = useSiteCopy().notFound
  return (
    <div className="legal-page">
      <Seo
        title="Page not found | Runway Systems"
        description="The page you were looking for does not exist. Browse the Runway Systems suite of Google Sheets products."
        canonicalPath={window.location.pathname}
        noindex
      />
      <Navbar theme={theme} onToggleTheme={onToggleTheme} palette={palette} onPaletteChange={onPaletteChange} />
      <main className="product-not-found">
        <div className="shell">
          <p className="eyebrow">404 · PAGE NOT FOUND</p>
          <h1>{copy.title}</h1>
          <p>{copy.copy}</p>
          <Link className="button primary" to="/"><ArrowLeft size={15} /> Back to Runway Systems</Link>
        </div>
      </main>
      <Footer products={[]} />
    </div>
  )
}
