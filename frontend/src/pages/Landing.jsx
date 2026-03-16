import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Mail, Lock, User, ArrowRight, Zap, Code2, GitBranch, Sparkles, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import Lottie from 'lottie-react'
import heroAnim from '../animations/hero-ai.json'
import codeGenAnim from '../animations/code-gen.json'
import celebrationAnim from '../animations/celebration.json'
import Button from '../components/Button'

export default function Landing() {
  const { loginWithGitHub, loginWithEmail, signupWithEmail, error: authError } = useAuth()
  const navigate = useNavigate()
  const [authMode, setAuthMode] = useState(null) // null | 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLocalError(null)
    setLoading(true)
    try {
      if (authMode === 'signup') {
        await signupWithEmail(email, password, name || email.split('@')[0])
      } else {
        await loginWithEmail(email, password)
      }
      navigate('/')
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || authError

  const features = [
    {
      icon: <Zap className="text-amber-400" size={24} />,
      title: '7 AI Agents',
      desc: 'Analyst, architect, frontend, backend, business, integrator, and validator — working in parallel.'
    },
    {
      icon: <Code2 className="text-blue-400" size={24} />,
      title: 'Full-Stack Code',
      desc: 'Complete React + FastAPI projects with tests, docs, and deployment configs.'
    },
    {
      icon: <GitBranch className="text-green-400" size={24} />,
      title: 'Auto GitHub Push',
      desc: 'Code is pushed to your GitHub repo automatically. Download ZIP or clone.'
    },
    {
      icon: <Sparkles className="text-purple-400" size={24} />,
      title: 'Pitch-Ready',
      desc: 'README, architecture diagram, and pitch slides — generated for judging.'
    },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] bg-green-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 lg:px-12 py-5 border-b border-white/[0.06]">
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            🌾 HackFarmer
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAuthMode('login')}
              className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
            >
              Log in
            </button>
            <Button onClick={() => setAuthMode('signup')} size="sm" variant="primary" className="gap-2">
              Get Started <ArrowRight size={14} />
            </Button>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
                  <Sparkles size={12} /> Powered by 7 AI Agents
                </span>
                <h1
                  className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Ship your hackathon
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
                    project in minutes
                  </span>
                </h1>
                <p className="text-lg text-white/40 max-w-lg mb-8">
                  Upload a spec or describe your idea. Seven AI agents analyze, architect, code, integrate,
                  validate, and push to GitHub — in minutes, not hours.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Button onClick={() => setAuthMode('signup')} size="lg" variant="primary" className="gap-2 px-8">
                    Start Building <ArrowRight size={18} />
                  </Button>
                  <Button onClick={loginWithGitHub} size="lg" variant="secondary" className="gap-2 px-8">
                    <Github size={18} /> Continue with GitHub
                  </Button>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-[280px] h-[280px] lg:w-[400px] lg:h-[400px] flex-shrink-0"
            >
              <Lottie animationData={heroAnim} loop autoplay style={{ width: '100%', height: '100%' }} />
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-4xl mx-auto px-6 pb-24">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-3xl font-bold text-center mb-12"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            How it works
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Describe or Upload', desc: 'Paste your hackathon brief or upload a PDF/DOCX spec.', anim: heroAnim },
              { step: '2', title: 'Agents Build', desc: '7 agents work in parallel: analyze, architect, code, integrate, validate.', anim: codeGenAnim },
              { step: '3', title: 'Ship It', desc: 'Code pushed to GitHub, ZIP ready, pitch slides generated.', anim: celebrationAnim },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.15 }}
                className="text-center"
              >
                <div className="w-24 h-24 mx-auto mb-4">
                  <Lottie animationData={s.anim} loop autoplay style={{ width: '100%', height: '100%' }} />
                </div>
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold mb-3">
                  {s.step}
                </div>
                <h4 className="font-bold mb-1">{s.title}</h4>
                <p className="text-sm text-white/40">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-white/20">
          Built for hackathons. Powered by LangGraph + Appwrite.
        </footer>
      </div>

      {/* Auth Modal */}
      <AnimatePresence>
        {authMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setAuthMode(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md p-8 rounded-2xl bg-[#111] border border-white/10"
            >
              <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {authMode === 'signup' ? 'Create account' : 'Welcome back'}
              </h2>
              <p className="text-sm text-white/40 mb-6">
                {authMode === 'signup' ? 'Start shipping hackathon projects in minutes.' : 'Log in to continue building.'}
              </p>

              {/* GitHub OAuth */}
              <Button onClick={() => { setAuthMode(null); loginWithGitHub() }} variant="secondary" className="w-full gap-2 mb-4">
                <Github size={18} /> Continue with GitHub
              </Button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/30">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {authMode === 'signup' && (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-blue-500/50 outline-none"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-blue-500/50 outline-none"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 8 characters)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:border-blue-500/50 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <AnimatePresence>
                  {displayError && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-sm text-red-400 pt-1"
                    >
                      {displayError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <Button type="submit" variant="primary" className="w-full" loading={loading}>
                  {authMode === 'signup' ? 'Create Account' : 'Log In'}
                </Button>
              </form>

              <p className="text-xs text-white/30 text-center mt-4">
                {authMode === 'signup' ? (
                  <>Already have an account?{' '}<button onClick={() => { setAuthMode('login'); setLocalError(null) }} className="text-blue-400 hover:underline">Log in</button></>
                ) : (
                  <>Don&apos;t have an account?{' '}<button onClick={() => { setAuthMode('signup'); setLocalError(null) }} className="text-blue-400 hover:underline">Sign up</button></>
                )}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
