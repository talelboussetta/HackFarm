import React from 'react'

export default class InitErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown startup error' }
  }

  componentDidCatch(error) {
    console.error('Initialization error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05070f] text-white flex items-center justify-center p-6">
          <div className="max-w-2xl w-full rounded-xl border border-red-500/30 bg-red-500/10 p-6 space-y-3">
            <h1 className="text-xl font-semibold text-red-300">App initialization failed</h1>
            <p className="text-sm text-white/80 break-words">{this.state.message}</p>
            <p className="text-xs text-white/60">Check that all VITE_ environment variables are configured.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
