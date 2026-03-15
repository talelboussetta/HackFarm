import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Layers, Monitor, Server, FileText, GitMerge, CheckCircle,
  ChevronDown, ChevronRight, Github, Download, Copy, Check, X,
  Loader2, AlertCircle, ExternalLink
} from 'lucide-react'
import { useJobStream } from '../hooks/useJobStream'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import Button from '../components/Button'

const AGENTS = [
  { key: 'analyst', label: 'Analyst', icon: Search },
  { key: 'architect', label: 'Architect', icon: Layers },
  { key: 'frontend_agent', label: 'Frontend', icon: Monitor },
  { key: 'backend_agent', label: 'Backend', icon: Server },
  { key: 'business_agent', label: 'Business', icon: FileText },
  { key: 'integrator', label: 'Integrator', icon: GitMerge },
  { key: 'validator', label: 'Validator', icon: CheckCircle },
]

function AgentCard({ agent, state }) {
  const [expanded, setExpanded] = useState(false)
  const status = state?.status || 'idle'
  const Icon = agent.icon

  const borderColor = {
    idle: 'border-white/10',
    running: 'border-blue-500',
    done: 'border-green-500',
    failed: 'border-red-500',
  }[status]

  return (
    <motion.div
      layout
      className={`border-l-4 ${borderColor} rounded-r-lg bg-white/5 transition-all`}
    >
      <button
        onClick={() => status === 'done' && setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${status === 'done' ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
      >
        <Icon size={18} className={status === 'idle' ? 'text-white/20' : status === 'running' ? 'text-blue-400' : status === 'done' ? 'text-green-400' : 'text-red-400'} />
        <span className={`text-sm font-medium flex-1 ${status === 'idle' ? 'text-white/30' : 'text-white'}`}>
          {agent.label}
        </span>

        {status === 'idle' && <span className="text-xs text-white/20">Waiting...</span>}
        {status === 'running' && (
          <span className="flex items-center gap-1 text-xs text-blue-400">
            <Loader2 size={12} className="animate-spin" />
            {state.message || 'Processing...'}
          </span>
        )}
        {status === 'done' && (
          <span className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle size={12} />
            {state.files?.length ? `${state.files.length} files` : 'Done'}
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </span>
        )}
        {status === 'failed' && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <X size={12} /> Failed
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && status === 'done' && state.files?.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1">
              {state.files.map(f => (
                <div key={f} className="text-xs text-white/40 font-mono pl-7">📄 {f}</div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
        if (!cancelled) setSvg(svg)
      }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [chart])

  if (!svg) return <div className="text-white/20 text-sm text-center py-8">Rendering diagram...</div>
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} className="w-full overflow-x-auto [&_svg]:mx-auto" />
}

function MarkdownRenderer({ content }) {
  const [ReactMarkdown, setRM] = useState(null)
  useEffect(() => {
    import('react-markdown').then(mod => setRM(() => mod.default))
  }, [])
  if (!ReactMarkdown) return <div className="text-white/20">Loading...</div>
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

export default function Job() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { agentStates, jobStatus, result, businessContent } = useJobStream(id)
  const [rightTab, setRightTab] = useState('code')
  const [selectedFile, setSelectedFile] = useState(null)
  const [copied, setCopied] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startTime = useRef(Date.now())

  useEffect(() => {
    if (jobStatus === 'complete' || jobStatus === 'failed') return
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [jobStatus])

  const agentsDone = AGENTS.filter(a => agentStates[a.key]?.status === 'done').length
  const progress = (agentsDone / 7) * 100

  // Collect all generated files across agents
  const allFiles = {}
  AGENTS.forEach(a => {
    const st = agentStates[a.key]
    if (st?.files) st.files.forEach(f => { allFiles[f] = st })
  })
  const fileList = Object.keys(allFiles).sort()

  // Derived data from result and businessContent
  const mermaidChart = businessContent?.architecture_mermaid || null
  const readmeContent = businessContent?.readme_content || null
  const pitchSlides = businessContent?.pitch_slides || []
  const githubUrl = result?.github_url || null
  const zipFileId = result?.zip_file_id || null

  const formatTime = (s) => `${Math.floor(s / 60)}m ${s % 60}s`

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    window.open(`/api/downloads/${id}`, '_blank')
  }

  if (jobStatus === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-6">
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 max-w-md text-center space-y-4">
          <AlertCircle size={48} className="text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-red-400">Pipeline Failed</h2>
          <p className="text-sm text-white/60">{result?.error || 'An unexpected error occurred during generation.'}</p>
          <Button onClick={() => navigate('/')} variant="secondary">Try Again</Button>
        </div>
      </div>
    )
  }

  const rightTabs = [
    { id: 'code', label: 'Code' },
    { id: 'architecture', label: 'Architecture', ready: !!mermaidChart },
    { id: 'readme', label: 'README', ready: !!readmeContent },
    { id: 'pitch', label: 'Pitch', ready: pitchSlides.length > 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Two-panel layout */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left panel — Agent Timeline (55%) */}
        <div className="md:w-[55%] space-y-4">
          {/* Progress bar */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">{agentsDone} of 7 agents complete</span>
              <span className="text-white/40 tabular-nums">{formatTime(elapsed)}</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', bounce: 0.2 }}
              />
            </div>
          </div>

          {/* Agent cards */}
          <div className="space-y-2">
            {AGENTS.map(agent => (
              <AgentCard key={agent.key} agent={agent} state={agentStates[agent.key]} />
            ))}
          </div>
        </div>

        {/* Right panel — Live Output (45%) */}
        <div className="md:w-[45%] space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
            {rightTabs.map(t => (
              <button
                key={t.id}
                onClick={() => setRightTab(t.id)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  rightTab === t.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden min-h-[500px] flex flex-col">
            {rightTab === 'architecture' && (
              <div className="p-4 overflow-auto flex-1">
                {mermaidChart ? <MermaidDiagram chart={mermaidChart} /> : (
                  <div className="flex items-center justify-center h-full text-white/20 text-sm">
                    <Loader2 size={16} className="animate-spin mr-2" /> Waiting for Business agent...
                  </div>
                )}
              </div>
            )}

            {rightTab === 'code' && (
              <div className="flex flex-1 overflow-hidden">
                {/* File tree */}
                <div className="w-[35%] border-r border-white/10 overflow-y-auto p-2 space-y-0.5">
                  {fileList.length === 0 ? (
                    <div className="text-xs text-white/20 p-2">No files yet...</div>
                  ) : fileList.map(f => (
                    <button
                      key={f}
                      onClick={() => setSelectedFile(f)}
                      className={`w-full text-left text-xs font-mono px-2 py-1 rounded truncate transition-colors ${
                        selectedFile === f ? 'bg-blue-500/20 text-blue-400' : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {/* Code viewer */}
                <div className="w-[65%] overflow-auto text-xs">
                  {selectedFile ? (
                    <SyntaxHighlighter
                      language={selectedFile.endsWith('.py') ? 'python' : selectedFile.endsWith('.jsx') || selectedFile.endsWith('.js') ? 'jsx' : selectedFile.endsWith('.json') ? 'json' : 'text'}
                      style={oneDark}
                      customStyle={{ margin: 0, background: 'transparent', fontSize: '11px' }}
                    >
                      {/* File content from agent events — we show the path as placeholder */}
                      {`// File: ${selectedFile}\n// Content will be available after download`}
                    </SyntaxHighlighter>
                  ) : (
                    <div className="flex items-center justify-center h-full text-white/20 text-sm p-4">
                      Select a file to view
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === 'readme' && (
              <div className="p-6 overflow-auto flex-1">
                {readmeContent ? <MarkdownRenderer content={readmeContent} /> : (
                  <div className="flex items-center justify-center h-full text-white/20 text-sm">
                    <Loader2 size={16} className="animate-spin mr-2" /> Waiting for Business agent...
                  </div>
                )}
              </div>
            )}

            {rightTab === 'pitch' && (
              <PitchCarousel slides={pitchSlides} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom result panel */}
      <AnimatePresence>
        {jobStatus === 'complete' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-white/10 flex flex-col sm:flex-row items-center gap-4"
          >
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-bold">🎉 Project Generated!</h3>
              <p className="text-sm text-white/60">Your code is ready to go.</p>
            </div>
            <div className="flex items-center gap-3">
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-lg font-medium text-sm hover:bg-white/90 transition-colors"
                >
                  <Github size={16} /> Open GitHub Repo
                </a>
              )}
              {zipFileId && (
                <Button onClick={handleDownload} variant="secondary" className="gap-2">
                  <Download size={16} /> Download ZIP
                </Button>
              )}
              <button
                onClick={handleCopyUrl}
                className="p-2.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Copy link"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PitchCarousel({ slides }) {
  const [idx, setIdx] = useState(0)
  if (!slides || slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/20 text-sm p-4">
        <Loader2 size={16} className="animate-spin mr-2" /> Waiting for Business agent...
      </div>
    )
  }
  const slide = slides[idx]
  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex-1 space-y-4">
        <h3 className="text-xl font-bold">{slide.title}</h3>
        <div className="text-white/80 text-sm whitespace-pre-wrap">{slide.content}</div>
        {slide.notes && <p className="text-xs text-white/30 mt-4 italic">{slide.notes}</p>}
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <button
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
          className="px-3 py-1 text-sm text-white/40 hover:text-white disabled:opacity-20"
        >
          ← Prev
        </button>
        <span className="text-xs text-white/30">{idx + 1} / {slides.length}</span>
        <button
          onClick={() => setIdx(Math.min(slides.length - 1, idx + 1))}
          disabled={idx === slides.length - 1}
          className="px-3 py-1 text-sm text-white/40 hover:text-white disabled:opacity-20"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
