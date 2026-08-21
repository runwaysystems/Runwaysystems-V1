import { Component } from 'react'
import { reportClientError } from '../lib/errorReporting'

// Root error boundary. Without it, any render-time crash unmounts the whole
// React tree and the visitor sees a blank white page with no explanation.
// This paints the failure visibly so it can be reported and fixed - and it
// also reports the crash to the platform Worker so the owner actually finds
// out it happened (see the Operations section of the dashboard).
const redactPii = (value) => String(value ?? '')
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED]')
  .slice(0, 400)

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Storefront render failed', redactPii(error?.message), info?.componentStack)
    reportClientError({
      kind: 'render',
      message: error?.message,
      stack: error?.stack || info?.componentStack || '',
    })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="app-crash-screen">
        <div className="app-crash-card">
          <p className="eyebrow">RUNWAY SYSTEMS</p>
          <h1>The storefront hit a problem while loading.</h1>
          <p>Reloading usually fixes it. If it keeps happening, share the details below with support.</p>
          <pre>{redactPii(error?.message || error)}</pre>
          <button className="button button--lime button--large" type="button" onClick={() => window.location.reload()}>
            Reload the storefront
          </button>
        </div>
      </main>
    )
  }
}
