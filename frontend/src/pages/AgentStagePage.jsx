import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, FileCode2, Brain, Terminal } from 'lucide-react'
import { AGENT_THEMES } from '../config/agentThemes'
import { useJobStream } from '../hooks/useJobStream'
import ParticleField from '../components/ParticleField'
import Lottie from 'lottie-react'
import { databases } from '../lib/appwrite'
import { Query } from 'appwrite'

const AGENT_KEYS = [
  'analyst', 'architect', 'frontend_agent', 'backend_agent',
  'business_agent', 'integrator', 'validator', 'github_agent',
]

function FigurineOrb({ accentColor }) {
  return (
    <div className="figurine-fallback" style={{ '--accent': accentColor, width: 320, height: 320, position: 'relative' }}>
      <div className="orb-core" />
      <div className="orb-ring ring-1" />
      <div className="orb-ring ring-2" />
      <div className="orb-ring ring-3" />
    </div>
  )
}

/** Full-viewport background media layer */
function AgentBackgroundMedia({ theme }) {
  const [lottieData, setLottieData] = useState(null)

  useEffect(() => {
    if (theme.mediaType !== 'lottie') return
    fetch(theme.mediaFile)
      .then(r => r.json())
      .then(setLottieData)
      .catch(() => setLottieData(null))
  }, [theme.mediaFile, theme.mediaType])

  if (theme.mediaType === 'video') {
    return (
      <video
        key={theme.mediaFile}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.18,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        <source src={theme.mediaFile} type="video/webm" />
      </video>
    )
  }

  if (theme.mediaType === 'lottie' && lottieData) {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.18,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}>
        <Lottie
          animationData={lottieData}
          loop
          autoplay
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  return null
}

function fileTypeColor(filename) {
  if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) return '#a855f7'
  if (filename.endsWith('.js') || filename.endsWith('.ts')) return '#eab308'
  if (filename.endsWith('.py')) return '#f59e0b'
  if (filename.endsWith('.css')) return '#06b6d4'
  if (filename.endsWith('.html')) return '#f97316'
  if (filename.endsWith('.json')) return '#22c55e'
  if (filename.endsWith('.md')) return '#94a3b8'
  return '#64748b'
}

function fileTypeIcon(filename) {
  if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) return '⚛️'
  if (filename.endsWith('.js') || filename.endsWith('.ts')) return '📜'
  if (filename.endsWith('.py')) return '🐍'
  if (filename.endsWith('.css')) return '🎨'
  if (filename.endsWith('.html')) return '🌐'
  if (filename.endsWith('.json')) return '{ }'
  if (filename.endsWith('.md')) return '📝'
  return '📄'
}

function ScoreCounter({ score }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const target = parseFloat(score)
    if (!score || isNaN(target)) return
    let current = 0
    const step = target / 60
    const timer = setInterval(() => {
      current += step
      if (current >= target) { setDisplayed(target); clearInterval(timer) }
      else setDisplayed(Math.floor(current * 10) / 10)
    }, 16)
    return () => clearInterval(timer)
  }, [score])
  return <>{typeof displayed === 'number' ? displayed.toFixed(1) : '—'}</>
}

/** IDE-like output panel for the right side of the hero */
function IDEOutputPanel({ files, events, agentKey, theme, status, agentState }) {
  const [activeTab, setActiveTab] = useState('files')
  const logsEndRef = useRef(null)

  const knowledgeItems = useMemo(() => {
    return events
      .map(ev => {
        try {
          const p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload
          return {
            type: ev.eventType || ev.event_type || '',
            message: p.message || p.summary || p.error || null,
            time: ev.$createdAt ? new Date(ev.$createdAt).toLocaleTimeString() : '',
          }
        } catch { return null }
      })
      .filter(Boolean)
      .filter(k => k.message)
  }, [events])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [knowledgeItems])

  const tabs = [
    { id: 'files', label: 'Files', icon: FileCode2, count: files.length },
    { id: 'knowledge', label: 'Output', icon: Brain, count: knowledgeItems.length },
    { id: 'logs', label: 'Logs', icon: Terminal, count: events.length },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      style={{
        height: '100%',
        borderRadius: 16,
        background: 'rgba(13, 13, 20, 0.85)',
        border: `1px solid ${theme.accentColor}33`,
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
          {agentKey}.output
        </span>
        {status === 'running' && (
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: theme.accentColor }}
          />
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 1,
        padding: '0 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? theme.accentColor : 'rgba(255,255,255,0.35)',
              background: activeTab === t.id ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === t.id ? `2px solid ${theme.accentColor}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <t.icon size={12} />
            {t.label}
            {t.count > 0 && (
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 8,
                background: activeTab === t.id ? `${theme.accentColor}22` : 'rgba(255,255,255,0.08)',
                color: activeTab === t.id ? theme.accentColor : 'rgba(255,255,255,0.4)',
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
        {/* Files tab */}
        {activeTab === 'files' && (
          <div style={{ padding: '8px 0' }}>
            {files.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                {status === 'running' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={18} style={{ color: theme.accentColor, animation: 'spin 1s linear infinite' }} />
                    <span>Generating files...</span>
                  </div>
                ) : status === 'idle' ? 'Waiting for agent to start...' : 'No files generated'}
              </div>
            ) : (
              <AnimatePresence>
                {files.map((f, i) => {
                  const filename = f.split('/').pop()
                  const dir = f.split('/').slice(0, -1).join('/')
                  const color = fileTypeColor(filename)
                  const icon = fileTypeIcon(filename)
                  return (
                    <motion.div
                      key={f}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '6px 16px',
                        borderLeft: `2px solid transparent`,
                        cursor: 'default',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                        e.currentTarget.style.borderLeftColor = color
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderLeftColor = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {filename}
                        </div>
                        {dir && (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {dir}
                          </div>
                        )}
                      </div>
                      <div style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4,
                        background: `${color}15`, color: `${color}aa`,
                      }}>
                        {filename.split('.').pop()?.toUpperCase()}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        )}

        {/* Knowledge/Output tab */}
        {activeTab === 'knowledge' && (
          <div style={{ padding: '8px 0' }}>
            {knowledgeItems.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                No output captured yet
              </div>
            ) : (
              knowledgeItems.map((item, i) => {
                const isThinking = item.type === 'agent_thinking'
                const isDone = item.type === 'agent_done'
                const isFailed = item.type === 'agent_failed'
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    style={{
                      padding: '8px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex', gap: 10,
                    }}
                  >
                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      {isDone ? <CheckCircle2 size={12} color="#22c55e" /> :
                       isFailed ? <XCircle size={12} color="#ef4444" /> :
                       isThinking ? (
                         <motion.div
                           animate={{ rotate: 360 }}
                           transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                           style={{ width: 12, height: 12, border: `1.5px solid ${theme.accentColor}`, borderTopColor: 'transparent', borderRadius: '50%' }}
                         />
                       ) : (
                         <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accentColor, opacity: 0.5, marginTop: 3 }} />
                       )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11,
                        color: isDone ? '#22c55e' : isFailed ? '#ef4444' : 'rgba(255,255,255,0.6)',
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}>
                        {item.message}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>{item.time}</div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        )}

        {/* Logs tab */}
        {activeTab === 'logs' && (
          <div style={{
            padding: '12px 16px',
            fontSize: 11,
            lineHeight: 1.8,
            color: 'rgba(255,255,255,0.5)',
          }}>
            {events.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', paddingTop: 24 }}>
                No log entries yet
              </div>
            ) : (
              events.map((ev, i) => {
                let p = {}
                try { p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload } catch {}
                const evType = (ev.eventType || ev.event_type || '').replace('agent_', '')
                const msg = p.message || p.summary || p.error || ''
                const time = ev.$createdAt ? new Date(ev.$createdAt).toLocaleTimeString() : ''
                const typeColor = evType === 'done' ? '#22c55e' : evType === 'failed' ? '#ef4444' : evType === 'thinking' ? theme.accentColor : 'rgba(255,255,255,0.3)'
                return (
                  <div key={ev.$id || i} style={{ marginBottom: 2 }}>
                    <span style={{ color: 'rgba(255,255,255,0.15)', marginRight: 8 }}>{time}</span>
                    <span style={{ color: typeColor, fontWeight: 600, marginRight: 8 }}>[{evType}]</span>
                    <span>{msg}</span>
                  </div>
                )
              })
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 16px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.2)',
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'done' ? '#22c55e' : status === 'running' ? theme.accentColor : status === 'failed' ? '#ef4444' : 'rgba(255,255,255,0.2)' }} />
          {status}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <span>{files.length} files</span>
          <span>{events.length} events</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function AgentStagePage() {
  const { jobId, agentKey } = useParams()
  const navigate = useNavigate()
  const theme = AGENT_THEMES[agentKey] || AGENT_THEMES.analyst
  const { agentStates, result } = useJobStream(jobId)
  const agentState = agentStates[agentKey] || {}
  const status = agentState.status || 'idle'

  const [events, setEvents] = useState([])
  const heroRef = useRef(null)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroY = useTransform(scrollY, [0, 400], [0, -80])

  // Fetch events for this agent
  useEffect(() => {
    if (!jobId) return
    const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID
    databases.listDocuments(dbId, 'job-events', [
      Query.equal('jobId', jobId),
      Query.orderAsc('$createdAt'),
      Query.limit(200),
    ]).then(res => {
      const agentEvents = res.documents.filter(d => {
        try {
          const p = typeof d.payload === 'string' ? JSON.parse(d.payload) : d.payload
          return p.agent === agentKey
        } catch { return false }
      })
      setEvents(agentEvents)
    }).catch(() => {})
  }, [jobId, agentKey])

  // Keyboard navigation between agents
  useEffect(() => {
    const idx = AGENT_KEYS.indexOf(agentKey)
    const handler = (e) => {
      if (e.key === 'ArrowRight' && idx < AGENT_KEYS.length - 1) {
        navigate(`/job/${jobId}/agent/${AGENT_KEYS[idx + 1]}`)
      }
      if (e.key === 'ArrowLeft' && idx > 0) {
        navigate(`/job/${jobId}/agent/${AGENT_KEYS[idx - 1]}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [agentKey, jobId, navigate])

  const agentIndex = AGENT_KEYS.indexOf(agentKey)
  const files = agentState.files || []

  const tickerMessages = useMemo(() => {
    return events
      .map(ev => { try { const p = JSON.parse(ev.payload); return p.message || p.summary || null } catch { return null } })
      .filter(Boolean)
      .slice(-3)
  }, [events])

  const validatorScore = agentKey === 'validator' ? (result?.validation_score ?? null) : null
  const statusColor = status === 'done' ? '#22c55e' : status === 'failed' ? '#ef4444' : status === 'running' ? theme.accentColor : 'rgba(255,255,255,0.3)'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        minHeight: '100vh',
        background: `linear-gradient(to bottom, ${theme.bgFrom}, ${theme.bgTo})`,
        position: 'relative',
        fontFamily: "'DM Sans', sans-serif",
        color: '#fff',
      }}
    >
      {/* ── FULL-VIEWPORT BACKGROUND MEDIA (fixed, behind everything) ── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <AgentBackgroundMedia theme={theme} />
        {/* Theme gradient overlay ON TOP of video */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 30% 50%, ${theme.particleColor}33 0%, ${theme.bgFrom}cc 55%, ${theme.bgTo}f0 100%)`,
          zIndex: 1,
        }} />
      </div>

      {/* Sticky back button */}
      <div style={{ position: 'fixed', top: 24, left: 24, zIndex: 100 }}>
        <motion.button
          onClick={() => navigate(`/job/${jobId}`)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
            border: `1px solid ${theme.accentColor}66`,
            color: theme.accentColor, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', outline: 'none',
          }}
        >
          <ArrowLeft size={14} /> Back to pipeline
        </motion.button>
      </div>

      {/* All page content sits above the fixed background */}
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ── HERO SECTION ── */}
        <motion.section
          ref={heroRef}
          style={{
            height: '100vh', display: 'flex', alignItems: 'center',
            position: 'relative', overflow: 'hidden',
            opacity: heroOpacity, y: heroY,
          }}
        >
          <ParticleField color={theme.particleColor} count={40} />

          <div style={{
            display: 'flex', width: '100%', maxWidth: 1400,
            margin: '0 auto', padding: '0 64px', gap: 48,
            position: 'relative', zIndex: 1, alignItems: 'center',
          }}>
            {/* LEFT — 60% */}
            <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Agent pill badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 14px', borderRadius: 999, width: 'fit-content',
                  background: `${theme.accentColor}1a`, border: `1px solid ${theme.accentColor}44`,
                  color: theme.accentColor, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                }}
              >
                Agent #{agentIndex + 1} — {theme.label}
              </motion.div>

              {/* Character name */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                style={{
                  fontSize: 'clamp(40px, 5vw, 72px)', fontWeight: 800, color: '#ffffff',
                  lineHeight: 1.05, fontFamily: "'Space Grotesk', sans-serif", margin: 0,
                }}
              >
                {theme.character}
              </motion.h1>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                style={{ fontSize: 'clamp(16px, 2vw, 24px)', color: 'rgba(255,255,255,0.6)', margin: 0 }}
              >
                {theme.tagline}
              </motion.p>

              {/* Status badge */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
                  {status === 'running' && (
                    <motion.div
                      animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: theme.accentColor }}
                    />
                  )}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: statusColor,
                }}>
                  {status === 'done' ? 'Complete' : status === 'failed' ? 'Failed' : status === 'running' ? 'Running' : 'Waiting'}
                </span>
              </motion.div>

              {/* Live message ticker */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                style={{
                  background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: '12px 16px', minHeight: 88, overflow: 'hidden',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
                  Live Output
                </div>
                <AnimatePresence mode="popLayout">
                  {tickerMessages.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                      Waiting for agent output...
                    </motion.div>
                  ) : (
                    tickerMessages.map((msg, i) => (
                      <motion.div
                        key={`${msg}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: i === tickerMessages.length - 1 ? 1 : 0.35, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{ marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <span style={{ color: theme.accentColor, marginRight: 8 }}>›</span>{msg}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </motion.div>

              {/* File counter */}
              {status === 'running' && files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Loader2 size={14} style={{ color: theme.accentColor, animation: 'spin 1s linear infinite' }} />
                  Generating file {files.length}...
                </motion.div>
              )}
            </div>

            {/* RIGHT — 40%: IDE-like output panel */}
            <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', position: 'relative', maxHeight: '70vh' }}>
              <IDEOutputPanel
                files={files}
                events={events}
                agentKey={agentKey}
                theme={theme}
                status={status}
                agentState={agentState}
              />
            </div>
          </div>
        </motion.section>

        {/* ── SCROLL SECTION 1: Events Timeline ── */}
        <section style={{ padding: '80px 64px', maxWidth: 1000, margin: '0 auto' }}>
          <motion.h2
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ fontSize: 36, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 48 }}
          >
            What I&apos;m doing
          </motion.h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14, padding: '32px 0' }}>
                No events recorded yet for this agent.
              </div>
            ) : (
              events.map((ev, i) => {
                let p = {}
                try { p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload } catch {}
                const evType = ev.eventType || ev.event_type || ''
                const message = p.message || p.summary || p.error || '—'
                const isThinking = evType === 'agent_thinking'
                const isDone = evType === 'agent_done'

                return (
                  <motion.div
                    key={ev.$id || i}
                    initial={{ opacity: 0, x: 60 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), type: 'spring', damping: 22 }}
                    style={{
                      display: 'flex', gap: 16, padding: '16px 20px', borderRadius: 12,
                      background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
                      {isThinking ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          style={{ width: 14, height: 14, border: `2px solid ${theme.accentColor}`, borderTopColor: 'transparent', borderRadius: '50%' }}
                        />
                      ) : isDone ? (
                        <CheckCircle2 size={16} color="#22c55e" />
                      ) : (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accentColor, opacity: 0.6 }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                          background: `${theme.accentColor}22`, color: theme.accentColor,
                        }}>
                          {evType.replace('agent_', '')}
                        </span>
                        {ev.$createdAt && (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {new Date(ev.$createdAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.6, wordBreak: 'break-word' }}>
                        {message}
                      </p>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </section>

        {/* ── SCROLL SECTION 2: Files Generated ── */}
        {files.length > 0 && (
          <section style={{ padding: '80px 64px', maxWidth: 1000, margin: '0 auto' }}>
            <motion.h2
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              style={{ fontSize: 36, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 48 }}
            >
              Files generated
            </motion.h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {files.map((f, i) => {
                const filename = f.split('/').pop()
                const color = fileTypeColor(filename)
                const icon = fileTypeIcon(filename)
                return (
                  <motion.div
                    key={f}
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-20px' }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      padding: '16px', borderRadius: 12,
                      background: 'rgba(0,0,0,0.35)', border: `1px solid ${color}33`,
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4, wordBreak: 'break-all' }}>
                      {filename}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', wordBreak: 'break-all' }}>
                      {f}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── SCROLL SECTION 3: Score / Output ── */}
        <section style={{ padding: '80px 64px', maxWidth: 1000, margin: '0 auto' }}>
          {agentKey === 'validator' ? (
            <>
              <motion.h2
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                style={{ fontSize: 36, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 48 }}
              >
                Validation Score
              </motion.h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap' }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ textAlign: 'center', flexShrink: 0 }}
                >
                  <div style={{ fontSize: 'clamp(64px, 8vw, 96px)', fontWeight: 800, color: theme.accentColor, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
                    <ScoreCounter score={validatorScore} />
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Validation Score</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  style={{ flex: 1, minWidth: 240 }}
                >
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: 0 }}>
                    {agentState.message || 'Validation complete. All quality checks have been evaluated.'}
                  </p>
                </motion.div>
              </div>
            </>
          ) : (
            <>
              <motion.h2
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                style={{ fontSize: 36, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 48 }}
              >
                Output Summary
              </motion.h2>
              <motion.div
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                style={{
                  padding: 32, borderRadius: 16,
                  background: `rgba(0,0,0,0.4)`, border: `1px solid ${theme.accentColor}33`,
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  {status === 'done' ? (
                    <CheckCircle2 size={20} color={theme.accentColor} />
                  ) : status === 'failed' ? (
                    <XCircle size={20} color="#ef4444" />
                  ) : (
                    <Loader2 size={20} style={{ color: theme.accentColor, animation: 'spin 1s linear infinite' }} />
                  )}
                  <span style={{ fontWeight: 700, color: '#fff', fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>
                    {theme.character}
                  </span>
                  <span style={{
                    padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    background: `${theme.accentColor}22`, color: theme.accentColor,
                  }}>
                    {status}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, margin: 0 }}>
                  {agentState.message || `${theme.character} has ${status === 'done' ? 'completed its task successfully' : status === 'failed' ? 'encountered an error' : 'not started yet'}.`}
                </p>
                {files.length > 0 && (
                  <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    Generated {files.length} file{files.length !== 1 ? 's' : ''}.
                  </div>
                )}
              </motion.div>
            </>
          )}
        </section>

        <div style={{ height: 80 }} />
      </div>
    </motion.div>
  )
}

