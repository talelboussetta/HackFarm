import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('Boundary caught:', error, info)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0a0a',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column',
          gap: 16, color: 'white', fontFamily: 'DM Sans',
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ fontSize: 24, fontWeight: 600 }}>
            Something went wrong
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: '#3b82f6', color: 'white',
              border: 'none', cursor: 'pointer', fontSize: 14,
            }}
          >
            Refresh
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
