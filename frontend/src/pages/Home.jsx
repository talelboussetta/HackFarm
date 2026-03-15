import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, MessageSquare, Zap, X, Github, Lock, Globe, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useJobSubmit } from '../hooks/useJobSubmit'
import Button from '../components/Button'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { submit, loading, error: submitError } = useJobSubmit()

  const [tab, setTab] = useState('upload')
  const [prompt, setPrompt] = useState('')
  const [file, setFile] = useState(null)
  const [repoName, setRepoName] = useState('')
  const [repoPrivate, setRepoPrivate] = useState(false)
  const [retentionDays, setRetentionDays] = useState(30)
  const [localError, setLocalError] = useState(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    onDrop: (accepted) => {
      if (accepted.length) {
        setFile(accepted[0])
        if (!repoName) {
          const base = accepted[0].name.replace(/\.(pdf|docx)$/i, '').replace(/[^a-zA-Z0-9_.-]/g, '-')
          setRepoName(base)
        }
      }
    }
  })

  const hasInput = tab === 'upload' ? !!file : prompt.trim().length > 0
  const canSubmit = hasInput && repoName.trim() && user

  const handleSubmit = async () => {
    setLocalError(null)
    try {
      const result = await submit({
        file: tab === 'upload' ? file : null,
        prompt: tab === 'describe' ? prompt.trim() : null,
        repoName: repoName.trim(),
        repoPrivate,
        retentionDays,
      })
      navigate(`/job/${result.job_id}`)
    } catch (err) {
      setLocalError(err.message)
    }
  }

  const displayError = localError || submitError

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      {/* Hero */}
      <section className="text-center space-y-4 pt-8">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold tracking-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Ship your hackathon project in minutes
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-white/40"
        >
          Upload a spec or describe your idea. AI builds the rest.
        </motion.p>
      </section>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="relative flex bg-white/5 rounded-lg p-1 border border-white/10">
          {[{ id: 'upload', label: 'Upload spec', icon: Upload }, { id: 'describe', label: 'Describe it', icon: MessageSquare }].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${tab === t.id ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
          <motion.div
            layoutId="tab-indicator"
            className="absolute inset-y-1 w-[calc(50%-4px)] bg-white/10 rounded-md"
            animate={{ x: tab === 'upload' ? 4 : 'calc(100% + 4px)' }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          />
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {tab === 'upload' ? (
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                  isDragActive ? 'border-blue-500 bg-blue-500/5' : file ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="space-y-2">
                    <p className="text-blue-400 font-medium">{file.name}</p>
                    <p className="text-xs text-white/40">{(file.size / 1024).toFixed(1)} KB</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null) }}
                      className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-red-400 mt-2"
                    >
                      <X size={12} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center">
                      <Upload className="text-white/40" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-white/80">Drop your PDF or DOCX here</p>
                      <p className="text-sm text-white/40">or click to browse</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="describe" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value)
                    if (!repoName && e.target.value.length > 10) {
                      const slug = e.target.value.slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
                      setRepoName(slug)
                    }
                  }}
                  placeholder="Describe what you're building — the problem, users, and tech you want"
                  className="w-full min-h-[160px] bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                />
                <div className="absolute bottom-3 right-3">
                  <span className="text-[10px] text-white/20 bg-white/5 px-2 py-1 rounded cursor-default" title="Coming soon">
                    ✨ Enhance with AI
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Project Settings — slides in when input present */}
      <AnimatePresence>
        {hasInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Repository name</label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                  placeholder="my-awesome-project"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-blue-500/50 outline-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Visibility</span>
                <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
                  <button
                    onClick={() => setRepoPrivate(false)}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${!repoPrivate ? 'bg-white/10 text-white' : 'text-white/40'}`}
                  >
                    <Globe size={12} /> Public
                  </button>
                  <button
                    onClick={() => setRepoPrivate(true)}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors ${repoPrivate ? 'bg-white/10 text-white' : 'text-white/40'}`}
                  >
                    <Lock size={12} /> Private
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">File retention</span>
                <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
                  {[{ v: 7, l: '7 days' }, { v: 30, l: '30 days' }, { v: 0, l: 'Forever' }].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setRetentionDays(opt.v)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${retentionDays === opt.v ? 'bg-white/10 text-white' : 'text-white/40'}`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* GitHub status */}
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm">
              {user ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <Github size={14} className="text-white/40" />
                  <span className="text-white/60">Connected as <span className="text-white font-medium">@{user.name}</span></span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span className="text-amber-400">Connect GitHub in Settings first</span>
                  <Link to="/settings" className="text-blue-400 hover:underline ml-1">→ Settings</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <div className="flex flex-col items-center gap-4">
        <Button
          onClick={handleSubmit}
          variant="primary"
          size="lg"
          className="w-full max-w-md gap-2 py-5 text-lg rounded-2xl shadow-xl shadow-blue-600/20"
          loading={loading}
          disabled={!canSubmit}
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Zap size={20} />
          )}
          Generate Project
        </Button>

        <AnimatePresence>
          {displayError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-400"
            >
              {displayError}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
