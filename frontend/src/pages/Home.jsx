import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { z } from 'zod'
import { Upload, MessageSquare, Zap, X, Github, Lock, Globe, AlertTriangle, Loader2, BarChart3, CheckCircle2, XCircle, Clock, Sparkles, LayoutTemplate } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useJobSubmit } from '../hooks/useJobSubmit'
import Button from '../components/Button'
import Lottie from 'lottie-react'
import submitAnim from '../animations/submit.json'

const jobSchema = z.object({
  repoName: z.string()
    .min(1, 'Repository name is required')
    .max(100, 'Repository name too long (max 100)')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, hyphens, dots, and underscores'),
  prompt: z.string().max(15000, 'Prompt too long (max 15,000 characters)').optional().nullable(),
})

const TEMPLATES = [
  {
    id: 'saas-dashboard',
    emoji: '📊',
    name: 'SaaS Dashboard',
    desc: 'Admin panel with charts, user management, and settings',
    prompt: `Build a modern SaaS admin dashboard with the following features:

1. **Dashboard Home**: Stats cards (total users, revenue, active sessions, growth %), a line chart showing weekly signups, and a bar chart for revenue by month.
2. **User Management**: A searchable, sortable table of users with name, email, role, status (active/inactive), and join date. Include actions to edit role, disable account, and delete.
3. **Settings Page**: Profile settings (name, email, avatar upload), notification preferences (toggle switches), and a danger zone with "Delete Account" confirmation.
4. **Authentication**: Login and signup pages with email/password. Protected routes that redirect to login if not authenticated.
5. **Sidebar Navigation**: Collapsible sidebar with Dashboard, Users, Settings, and Logout links. Active state highlighting.

Tech preferences: Use Tailwind CSS for styling, Recharts for charts, and React Router for navigation. Dark theme by default.`,
    repoName: 'saas-dashboard',
  },
  {
    id: 'ecommerce',
    emoji: '🛒',
    name: 'E-commerce Store',
    desc: 'Product catalog, cart, and checkout flow',
    prompt: `Build a modern e-commerce web application with:

1. **Product Catalog**: Grid of product cards showing image placeholder, name, price, rating (stars), and "Add to Cart" button. Filter sidebar with categories and price range slider. Search bar with instant results.
2. **Product Detail Page**: Large image area, title, description, price, quantity selector, "Add to Cart" button, and related products carousel.
3. **Shopping Cart**: Slide-out cart drawer showing items, quantities (adjustable), individual and total prices, remove button, and "Proceed to Checkout" CTA.
4. **Checkout Flow**: Multi-step form — shipping address, payment details (mock), order review, and confirmation page with order number.
5. **Backend API**: Products CRUD, cart management (add/remove/update), and order creation with validation.

Use a clean, minimal design. Include loading skeletons and empty states.`,
    repoName: 'ecommerce-store',
  },
  {
    id: 'chat-app',
    emoji: '💬',
    name: 'Real-time Chat',
    desc: 'Messaging app with rooms and user presence',
    prompt: `Build a real-time chat application with:

1. **Chat Rooms**: List of available rooms in a sidebar. Users can create new rooms with a name and description. Each room shows the last message preview and unread count.
2. **Message Thread**: Messages displayed with sender name, avatar (initials), timestamp, and content. Support for text messages. Auto-scroll to latest message.
3. **User Presence**: Show online/offline status with colored dots. Display "X users online" count per room.
4. **Message Input**: Text input with send button and Enter key support. Show "User is typing..." indicator.
5. **User Profile**: Display name, avatar initials, and status (online/away/busy). Settings to update display name.
6. **Backend**: REST API for rooms (CRUD), messages (create, list with pagination), and user management.

Modern dark theme with smooth animations. Mobile-responsive layout.`,
    repoName: 'chat-app',
  },
  {
    id: 'task-manager',
    emoji: '✅',
    name: 'Task Manager',
    desc: 'Kanban board with drag-and-drop task tracking',
    prompt: `Build a project task management app (like a mini Trello) with:

1. **Kanban Board**: Three columns — "To Do", "In Progress", "Done". Cards show task title, priority badge (low/medium/high with colors), assignee avatar, and due date.
2. **Task Creation**: Modal form with title, description (markdown), priority dropdown, assignee dropdown, due date picker, and tags input.
3. **Task Detail View**: Expandable card or modal showing full description, comments section, activity log, and edit/delete actions.
4. **Project Sidebar**: List of projects. Create new project with name and color. Switch between project boards.
5. **Filtering & Search**: Filter tasks by assignee, priority, or tag. Global search across all tasks.
6. **Backend API**: Projects CRUD, tasks CRUD with status updates, comments, and basic user management.

Clean UI with subtle animations. Support drag-and-drop between columns.`,
    repoName: 'task-manager',
  },
  {
    id: 'blog-platform',
    emoji: '📝',
    name: 'Blog Platform',
    desc: 'Content management with markdown editor',
    prompt: `Build a blog/content platform with:

1. **Public Blog Feed**: Card-based list of published posts with title, excerpt, author name, publish date, read time, and tags. Pagination or infinite scroll.
2. **Post Reader**: Clean article layout with title, author info, publish date, markdown-rendered content, and tag pills. Estimated read time. Share buttons.
3. **Admin Editor**: Markdown editor with live preview side-by-side. Title input, tag selector, featured image URL, and publish/draft toggle. Auto-save indicator.
4. **Author Dashboard**: List of your posts (published/draft), view count per post, and quick actions (edit, delete, toggle publish).
5. **Authentication**: Login/signup for authors. Public readers don't need accounts.
6. **Backend**: Posts CRUD with draft/published status, tags, search by title/content, and author management.

Typography-focused design. Light/dark mode toggle.`,
    repoName: 'blog-platform',
  },
  {
    id: 'ai-tool',
    emoji: '🤖',
    name: 'AI Wrapper Tool',
    desc: 'LLM-powered tool with prompt templates',
    prompt: `Build an AI-powered productivity tool with:

1. **Prompt Library**: Grid of pre-built prompt templates (e.g., "Summarize Text", "Write Email", "Explain Code", "Generate Ideas", "Translate"). Each card shows title, description, and icon.
2. **Workspace**: Select a template, fill in the input field(s), click "Generate". Show a loading animation, then display the AI response in a formatted output area with copy button.
3. **History**: List of past generations with input preview, output preview, template used, and timestamp. Click to expand full content. Delete individual entries.
4. **Custom Prompts**: Create your own prompt template with name, system prompt, and input field labels. Save to personal library.
5. **Settings**: API key configuration, default model selection, response length preference.
6. **Backend**: Prompt templates CRUD, generation history, and a proxy endpoint that calls OpenAI-compatible APIs.

Sleek dark UI. Markdown rendering for outputs. Responsive design.`,
    repoName: 'ai-tool',
  },
]

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
  const [fieldErrors, setFieldErrors] = useState({})
  const [stats, setStats] = useState(null)
  const [modelPref, setModelPref] = useState('')

  // Fetch user stats for dashboard
  useEffect(() => {
    fetch('/api/jobs-stats', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setStats(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) return
    const reminderKey = 'hackfarm_api_keys_notice_shown'
    if (sessionStorage.getItem(reminderKey)) return
    sessionStorage.setItem(reminderKey, '1')
    toast('make sure to plug in your api keys (Groq required)', {
      duration: 5000,
      action: {
        label: 'Settings',
        onClick: () => navigate('/settings'),
      },
    })
  }, [user, navigate])

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
    setFieldErrors({})

    // Client-side validation
    const validation = jobSchema.safeParse({
      repoName: repoName.trim(),
      prompt: tab === 'describe' ? prompt.trim() : null,
    })
    if (!validation.success) {
      const errors = {}
      validation.error.issues.forEach(issue => {
        errors[issue.path[0]] = issue.message
      })
      setFieldErrors(errors)
      toast.error(Object.values(errors)[0])
      return
    }

    try {
      const result = await submit({
        file: tab === 'upload' ? file : null,
        prompt: tab === 'describe' ? prompt.trim() : null,
        repoName: repoName.trim(),
        repoPrivate,
        retentionDays,
        modelPreference: modelPref || null,
      })
      toast.success('Project generation started!')
      navigate(`/job/${result.job_id}`)
    } catch (err) {
      setLocalError(err.message)
      toast.error(err.message || 'Failed to create project')
    }
  }

  const displayError = localError || submitError

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      {/* Hero — two-column */}
      <section className="flex flex-col md:flex-row items-center gap-6 pt-6 md:pt-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-[200px] h-[200px] md:w-[320px] md:h-[320px] flex-shrink-0"
        >
          <video
            src="/lottie/ELzh3x62E1s4936hL4.webm"
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </motion.div>
        <div className="text-center md:text-left flex-1">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-[52px] font-bold tracking-tight leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Ship your hackathon<br />project in minutes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-white/40 mt-4"
          >
            Upload a spec or describe your idea. Seven AI agents build the rest.
          </motion.p>
        </div>
      </section>

      {/* Dashboard Stats */}
      {stats && stats.total_projects > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {[
            { label: 'Projects', value: stats.total_projects, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10' },
            { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
            { label: 'Success Rate', value: `${stats.success_rate}%`, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon size={16} className={s.color} />
              </div>
              <div>
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-wider">{s.label}</div>
              </div>
            </div>
          ))}
        </motion.section>
      )}

      {/* Template Picker */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <LayoutTemplate size={14} />
          <span className="font-medium">Start from a template</span>
          <span className="text-white/20">or describe your own below</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {TEMPLATES.map(t => (
            <motion.button
              key={t.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setTab('describe')
                setPrompt(t.prompt)
                setRepoName(t.repoName)
                toast.success(`Template "${t.name}" loaded`)
              }}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/15 hover:bg-white/[0.06] transition-all text-left group"
            >
              <span className="text-xl mt-0.5">{t.emoji}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white/80 group-hover:text-white truncate">{t.name}</div>
                <div className="text-[11px] text-white/30 truncate">{t.desc}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="relative flex bg-white/5 rounded-lg p-1" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
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
                    setFieldErrors(prev => ({...prev, prompt: undefined}))
                    if (!repoName && e.target.value.length > 10) {
                      const slug = e.target.value.slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
                      setRepoName(slug)
                    }
                  }}
                  placeholder="Describe what you're building — the problem, users, and tech you want"
                  className={`w-full min-h-[160px] bg-black/20 border rounded-xl p-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y ${fieldErrors.prompt ? 'border-red-500/50' : 'border-white/10'}`}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-1 rounded tabular-nums ${prompt.length > 14000 ? 'text-red-400' : 'text-white/20'}`}>
                    {prompt.length.toLocaleString()}/15,000
                  </span>
                  <span className="text-[10px] text-white/20 bg-white/5 px-2 py-1 rounded cursor-default" title="Coming soon">
                    ✨ Enhance with AI
                  </span>
                </div>
                {fieldErrors.prompt && <p className="text-xs text-red-400 mt-1">{fieldErrors.prompt}</p>}
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
            <div className="p-6 rounded-2xl bg-[rgba(255,255,255,0.04)] backdrop-blur-xl border border-white/[0.08] space-y-5"
                 style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Repository name</label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => { setRepoName(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, '')); setFieldErrors(prev => ({...prev, repoName: undefined})) }}
                  placeholder="my-awesome-project"
                  className={`w-full bg-black/40 border rounded-lg px-4 py-2 text-sm focus:border-blue-500/50 outline-none ${fieldErrors.repoName ? 'border-red-500/50' : 'border-white/10'}`}
                />
                {fieldErrors.repoName && <p className="text-xs text-red-400 mt-1">{fieldErrors.repoName}</p>}
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

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">AI Model</span>
                <select
                  value={modelPref}
                  onChange={e => setModelPref(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 focus:border-blue-400/50 outline-none cursor-pointer appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '24px' }}
                >
                  <option value="">Auto (recommended)</option>
                  <option value="gemini">Gemini 2.0 Flash</option>
                  <option value="groq">Llama 3.3 70B (Groq)</option>
                  <option value="openrouter">Llama 3.3 70B (OpenRouter)</option>
                </select>
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
            <>
              <Lottie animationData={submitAnim} loop={true} style={{ width: 28, height: 28 }} />
              Generating...
            </>
          ) : (
            <>
              <Zap size={20} />
              Generate Project
            </>
          )}
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

        {/* Feature badges */}
        <motion.div
          className="flex items-center gap-3 mt-2"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          animate="visible"
        >
          {[
            { icon: '🔒', label: 'Encrypted keys' },
            { icon: '⚡', label: 'Real-time pipeline' },
            { icon: '🐙', label: 'Auto GitHub push' },
          ].map(b => (
            <motion.span
              key={b.label}
              variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/30"
            >
              <span>{b.icon}</span> {b.label}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
