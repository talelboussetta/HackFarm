import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Download, Copy, Check, Loader2, AlertCircle, ChevronRight, Trash2, XCircle } from 'lucide-react'
import { useJobStream } from '../hooks/useJobStream'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import AgentPipelineGraph from '../components/AgentPipelineGraph'
import AgentDrawer from '../components/AgentDrawer'
import Lottie from 'lottie-react'
import celebrationAnim from '../animations/celebration.json'
import confetti from 'canvas-confetti'
import Button from '../components/Button'
import DOMPurify from 'dompurify'
import { log } from '../lib/logger'

const AGENT_KEYS = ['analyst','architect','frontend_agent','backend_agent','business_agent','integrator','validator','github_agent']

function Skeleton({ lines = 4 }) {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-white/5 animate-pulse" style={{ width: `${65 + Math.random() * 30}%` }} />
      ))}
    </div>
  )
}

function MermaidDiagram({ chart }) {
  const ref = useRef(null)
  const [svg, setSvg] = useState('')
  useEffect(() => {
    if (!chart) return
    let cancelled = false
    import('mermaid').then(mod => {
      const mermaid = mod.default
      mermaid.initialize({ startOnLoad: false, theme: 'dark', themeVariables: { darkMode: true } })
      mermaid.render('mermaid-' + Date.now(), chart).then(({ svg }) => {
        if (!cancelled) setSvg(DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }))
      }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [chart])
  if (!svg) return <Skeleton lines={5} />
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} ref={ref}
      dangerouslySetInnerHTML={{ __html: svg }} className="w-full overflow-x-auto [&_svg]:mx-auto" />
  )
}

function MarkdownRenderer({ content }) {
  const [ReactMarkdown, setRM] = useState(null)
  useEffect(() => { import('react-markdown').then(mod => setRM(() => mod.default)) }, [])
  if (!ReactMarkdown) return <Skeleton lines={6} />
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-hackfarmer">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

function PitchCarousel({ slides }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') setIdx(i => Math.min(slides.length - 1, i + 1))
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [slides.length])

  if (!slides || slides.length === 0) return <Skeleton lines={4} />

  const slide = slides[idx]
  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex-1 space-y-4">
        <h3 className="text-[28px] font-bold font-heading">{slide.title}</h3>
        <div className="text-white/80 text-base whitespace-pre-wrap">{slide.content}</div>
        {slide.notes && <p className="text-xs text-white/30 mt-4 italic">{slide.notes}</p>}
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}
          className="px-3 py-1 text-sm text-white/40 hover:text-white disabled:opacity-20">← Prev</button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-blue-500 scale-125' : 'bg-white/20'}`} />
          ))}
        </div>
        <button onClick={() => setIdx(Math.min(slides.length - 1, idx + 1))} disabled={idx === slides.length - 1}
          className="px-3 py-1 text-sm text-white/40 hover:text-white disabled:opacity-20">Next →</button>
      </div>
    </div>
  )
}

export default function Job() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { agentStates, jobStatus, result, businessContent } = useJobStream(id)
  const { getJWT } = useAuth()

  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [rightTab, setRightTab] = useState('code')
  const [confettiFired, setConfettiFired] = useState(false)
  const [copied, setCopied] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const startTime = useRef(Date.now())

  // Elapsed timer
  useEffect(() => {
    if (jobStatus === 'complete' || jobStatus === 'failed') return
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [jobStatus])

  // Confetti on completion
  useEffect(() => {
    if (jobStatus === 'complete' && !confettiFired) {
      setConfettiFired(true)
      const fire = (ratio, opts) => confetti({ ...opts, origin: { y: 0.7 }, particleCount: Math.floor(200 * ratio) })
      fire(0.25, { spread: 26, startVelocity: 55, colors: ['#3b82f6', '#8b5cf6'] })
      fire(0.2,  { spread: 60, colors: ['#22c55e', '#06b6d4'] })
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#f59e0b', '#ec4899'] })
      fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
      fire(0.1,  { spread: 120, startVelocity: 45 })
    }
  }, [jobStatus])

  const agentsDone = AGENT_KEYS.filter(k => agentStates[k]?.status === 'done').length
  const totalFiles = AGENT_KEYS.reduce((n, k) => n + (agentStates[k]?.files?.length || 0), 0)
  const validationScore = agentStates.validator?.status === 'done' ? (result?.validation_score || '—') : '—'

  // Collect all generated file paths
  const fileList = useMemo(() => {
    const files = []
    AGENT_KEYS.forEach(k => { agentStates[k]?.files?.forEach(f => { if (!files.includes(f)) files.push(f) }) })
    return files.sort()
  }, [agentStates])

  const groupedFiles = useMemo(() => {
    const groups = { frontend: [], backend: [], config: [] }
    fileList.forEach(f => {
      if (f.startsWith('frontend/')) groups.frontend.push(f)
      else if (f.startsWith('backend/')) groups.backend.push(f)
      else groups.config.push(f)
    })
    return groups
  }, [fileList])

  const mermaidChart = businessContent?.architecture_mermaid || null
  const readmeContent = businessContent?.readme_content || null
  const pitchSlides = businessContent?.pitch_slides || []
  const githubUrl = result?.github_url || null
  const zipFileId = result?.zip_file_id || null
  const repoName = result?.repo_name || id

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const handleCopyUrl = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const handleDownload = () => { window.open(`/api/downloads/${id}`, '_blank') }

  const handleDelete = async () => {
    const label = jobStatus === 'running' || jobStatus === 'queued' ? 'Cancel this running job' : 'Delete this project'
    if (!confirm(`${label}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const jwt = await getJWT()
      await api(`/api/jobs/${id}`, { method: 'DELETE' }, jwt)
      navigate('/history')
    } catch (e) {
      log.error('Delete failed:', e)
      setDeleting(false)
    }
  }

  const handleNodeClick = (agentKey) => {
    if (window.innerWidth < 768) {
      setSelectedNode(agentKey)
    } else {
      navigate(`/job/${id}/agent/${agentKey}`)
    }
  }
  if (jobStatus === 'failed') {
    const failedAgents = AGENT_KEYS.filter(k => agentStates[k]?.status === 'failed')
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 max-w-lg text-center space-y-4">
          <AlertCircle size={48} className="text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-red-400">Pipeline Failed</h2>
          <p className="text-sm text-white/60">{result?.error || 'An unexpected error occurred during generation.'}</p>
          {failedAgents.length > 0 && (
            <div className="text-left space-y-2 pt-2 border-t border-white/10">
              <p className="text-xs text-white/40 uppercase tracking-wider">Failed agents:</p>
              {failedAgents.map(k => (
                <div key={k} className="text-xs text-red-300/70 font-mono bg-red-500/5 rounded px-3 py-2">
                  <span className="text-red-400 font-semibold">{k}</span>: {agentStates[k]?.message || 'Unknown error'}
                </div>
              ))}
            </div>
          )}
          <Button onClick={() => navigate('/')} variant="secondary">Try Again</Button>
        </div>
      </div>
    )
  }

  const rightTabs = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'code', label: 'Code' },
    { id: 'readme', label: 'README' },
    { id: 'pitch', label: 'Pitch' },
  ]

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 6rem)', margin: '0 -1rem' }}>
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10 flex-shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-white/40">
          <button onClick={() => navigate('/history')} className="hover:text-white/60 transition-colors">Projects</button>
          <ChevronRight size={14} />
          <span className="text-white font-medium truncate max-w-[120px]">{repoName}</span>
        </div>

        {/* Agent status pills */}
        <div className="flex-1 flex items-center justify-center gap-1">
          {AGENT_KEYS.map(k => {
            const s = agentStates[k]?.status || 'idle'
            return (
              <div key={k} className={`h-1.5 rounded-full transition-all duration-500 ${
                s === 'done' ? 'w-6 bg-green-500' : s === 'running' ? 'w-6 bg-blue-500 animate-pulse' : s === 'failed' ? 'w-6 bg-red-500' : 'w-3 bg-white/10'
              }`} title={k} />
            )
          })}
        </div>

        {/* Timer + status + delete */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/40 tabular-nums font-mono text-xs">{formatTime(elapsed)}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
            jobStatus === 'complete' ? 'bg-green-500/20 text-green-400' : jobStatus === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
          }`}>
            {jobStatus === 'complete' ? 'Complete' : jobStatus === 'failed' ? 'Failed' : 'Running'}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
            title={jobStatus === 'running' ? 'Cancel job' : 'Delete project'}
          >
            {deleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : jobStatus === 'running' || jobStatus === 'queued' ? (
              <><XCircle size={12} /> Cancel</>
            ) : (
              <><Trash2 size={12} /> Delete</>
            )}
          </button>
        </div>
      </div>

      {/* Main body - two columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column — Pipeline (42%) */}
        <div className="w-[42%] border-r border-white/10 flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-xs font-heading text-white/30 uppercase tracking-widest">Pipeline</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <AgentPipelineGraph agentStates={agentStates} onNodeClick={handleNodeClick} />
          </div>
          {/* Mini stats bar */}
          <div className="flex items-center gap-6 px-4 py-3 border-t border-white/10 text-xs text-white/40">
            <div>Agents: <span className="text-white/80 font-medium">{agentsDone}/8</span></div>
            <div>Files: <span className="text-white/80 font-medium">{totalFiles}</span></div>
            <div>Score: <span className="text-white/80 font-medium">{validationScore}</span></div>
          </div>
        </div>

        {/* Right column — Output (58%) */}
        <div className="w-[58%] flex flex-col overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center gap-3">
            <h2 className="text-xs font-heading text-white/30 uppercase tracking-widest mr-3">Output</h2>
            <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 border border-white/10">
              {rightTabs.map(t => (
                <button key={t.id} onClick={() => setRightTab(t.id)}
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    rightTab === t.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-hidden border-t border-white/10">
            {/* Architecture tab */}
            {rightTab === 'architecture' && (
              <div className="p-4 overflow-auto h-full">
                {mermaidChart ? <MermaidDiagram chart={mermaidChart} /> : <Skeleton lines={5} />}
              </div>
            )}

            {/* Code tab */}
            {rightTab === 'code' && (
              <div className="flex h-full overflow-hidden">
                {/* File tree */}
                <div className="w-[30%] border-r border-white/10 overflow-y-auto p-2 space-y-2">
                  {fileList.length === 0 ? (
                    <Skeleton lines={3} />
                  ) : (
                    <>
                      {groupedFiles.frontend.length > 0 && (
                        <FileGroup label="Frontend" color="text-cyan-400" files={groupedFiles.frontend}
                          selectedFile={selectedFile} onSelect={setSelectedFile} />
                      )}
                      {groupedFiles.backend.length > 0 && (
                        <FileGroup label="Backend" color="text-amber-400" files={groupedFiles.backend}
                          selectedFile={selectedFile} onSelect={setSelectedFile} />
                      )}
                      {groupedFiles.config.length > 0 && (
                        <FileGroup label="Config" color="text-white/40" files={groupedFiles.config}
                          selectedFile={selectedFile} onSelect={setSelectedFile} />
                      )}
                    </>
                  )}
                </div>
                {/* Code viewer */}
                <div className="w-[70%] overflow-auto">
                  {selectedFile ? (
                    jobStatus === 'complete' ? (
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
                        <div className="text-white/30 text-sm">
                          <p className="text-white/50 font-medium mb-1">{selectedFile.split('/').pop()}</p>
                          <p>File preview available after download</p>
                        </div>
                        {zipFileId && (
                          <button onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30 transition-colors">
                            <Download size={14} /> Download ZIP
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
                        <Loader2 size={20} className="text-blue-400 animate-spin" />
                        <p className="text-white/30 text-sm">Generating files...</p>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full text-white/20 text-sm">
                      Select a file to view
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* README tab */}
            {rightTab === 'readme' && (
              <div className="p-6 overflow-auto h-full">
                {readmeContent ? <MarkdownRenderer content={readmeContent} /> : <Skeleton lines={6} />}
              </div>
            )}

            {/* Pitch tab */}
            {rightTab === 'pitch' && (
              <div className="h-full overflow-auto">
                <PitchCarousel slides={pitchSlides} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom result bar — slides up on completion */}
      <AnimatePresence>
        {jobStatus === 'complete' && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="flex-shrink-0 px-6 py-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-t border-white/10 flex items-center gap-4"
          >
            <div className="w-12 h-12 flex-shrink-0">
              <Lottie animationData={celebrationAnim} loop={false} autoplay={true} style={{ width: 48, height: 48 }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold font-heading">🎉 {repoName} is ready!</h3>
              <p className="text-sm text-white/50">Your project has been generated and pushed.</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {githubUrl && (
                <a href={githubUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 transition-colors">
                  <Github size={16} /> Open on GitHub
                </a>
              )}
              {zipFileId && (
                <Button onClick={handleDownload} variant="secondary" className="gap-2">
                  <Download size={16} /> Download ZIP
                </Button>
              )}
              <button onClick={handleCopyUrl}
                className="p-2.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition-colors" title="Copy link">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Drawer */}
      <AgentDrawer
        agentKey={selectedNode}
        agentState={selectedNode ? agentStates[selectedNode] : null}
        allEvents={[]}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  )
}

function FileGroup({ label, color, files, selectedFile, onSelect }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button onClick={() => setOpen(!open)} className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider w-full px-1 py-1 ${color}`}>
        <ChevronRight size={10} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        📁 {label} ({files.length})
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden">
            {files.map(f => (
              <button key={f} onClick={() => onSelect(f)}
                className={`w-full text-left text-[11px] font-mono px-3 py-0.5 rounded truncate transition-colors ${
                  selectedFile === f ? 'bg-blue-500/20 text-blue-400' : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}>
                {f.split('/').pop()}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
