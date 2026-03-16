import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const AGENT_CONFIG = {
  analyst:        { label: 'Analyst',    icon: '🔍', accent: '#3b82f6' },
  architect:      { label: 'Architect',  icon: '🏗️', accent: '#8b5cf6' },
  frontend_agent: { label: 'Frontend',   icon: '🖥️', accent: '#06b6d4' },
  backend_agent:  { label: 'Backend',    icon: '⚙️', accent: '#f59e0b' },
  business_agent: { label: 'Business',   icon: '📄', accent: '#ec4899' },
  integrator:     { label: 'Integrator', icon: '🔗', accent: '#3b82f6' },
  validator:      { label: 'Validator',  icon: '✅', accent: '#22c55e' },
  github_agent:   { label: 'GitHub',     icon: '🐙', accent: '#ffffff' },
}

const EVENT_BADGE = {
  agent_start:    { label: 'Start',    color: 'bg-blue-500/20 text-blue-400' },
  agent_thinking: { label: 'Thinking', color: 'bg-purple-500/20 text-purple-400' },
  agent_done:     { label: 'Done',     color: 'bg-green-500/20 text-green-400' },
  agent_failed:   { label: 'Failed',   color: 'bg-red-500/20 text-red-400' },
}

const STATUS_PILL = {
  idle:    'bg-white/10 text-white/40',
  running: 'bg-blue-500/20 text-blue-400',
  done:    'bg-green-500/20 text-green-400',
  failed:  'bg-red-500/20 text-red-400',
}

function getFileIcon(path) {
  if (path.endsWith('.jsx') || path.endsWith('.js')) return '🖥️'
  if (path.endsWith('.py')) return '🐍'
  if (path.endsWith('.json')) return '{ }'
  if (path.endsWith('.md')) return '📝'
  return '📄'
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  return `${Math.floor(diff / 60)}m ${diff % 60}s ago`
}

export default function AgentDrawer({ agentKey, agentState, allEvents, onClose }) {
  const logRef = useRef(null)
  const isOpen = !!agentKey
  const cfg = AGENT_CONFIG[agentKey] || {}
  const status = agentState?.status || 'idle'

  // Filter events for this agent
  const agentEvents = (allEvents || []).filter(ev => {
    try {
      const p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload
      return p.agent === agentKey
    } catch { return false }
  })

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [agentEvents.length])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[360px] z-50 bg-[#0d0d0d] border-l border-white/10 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <span className="text-2xl">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold font-heading truncate">{cfg.label} Agent</h3>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1 ${STATUS_PILL[status] || STATUS_PILL.idle}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Stats row (when done) */}
            {status === 'done' && (
              <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10 text-xs text-white/50">
                <div>
                  <span className="text-white/80 font-medium">{agentState?.files?.length || 0}</span> files
                </div>
                <div>
                  <span className="text-white/80 font-medium">0</span> retries
                </div>
              </div>
            )}

            {/* Event log */}
            <div ref={logRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              <h4 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Event Log</h4>
              {agentEvents.length === 0 ? (
                <p className="text-xs text-white/20 text-center py-8">No events yet</p>
              ) : (
                agentEvents.map((ev, i) => {
                  let p
                  try { p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload } catch { p = {} }
                  const evType = ev.eventType || ev.event_type || ''
                  const badge = EVENT_BADGE[evType] || { label: evType, color: 'bg-white/10 text-white/40' }
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-[9px] text-white/20 tabular-nums whitespace-nowrap pt-0.5">
                        {ev.$createdAt ? timeAgo(ev.$createdAt) : ''}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-white/60 break-all">
                        {p.message || p.summary || p.error || '—'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            {/* Generated files (when done) */}
            {status === 'done' && agentState?.files?.length > 0 && (
              <div className="border-t border-white/10 p-4 max-h-[200px] overflow-y-auto">
                <h4 className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Generated Files</h4>
                <div className="space-y-1">
                  {agentState.files.map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-white/50 font-mono">
                      <span className="text-sm">{getFileIcon(f)}</span>
                      <span className="truncate">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error section (when failed) */}
            {status === 'failed' && (
              <div className="border-t border-white/10 p-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-red-400 font-medium">Error</p>
                  <p className="text-xs text-white/60">{agentState?.message || 'Unknown error'}</p>
                  <p className="text-[10px] text-white/30">
                    This agent failed — the pipeline may have retried or continued with partial results.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
