import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion'
import { Github, Mail, Lock, User, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import Lenis from '@studio-freight/lenis'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
const signupSchema = loginSchema.extend({
  name: z.string().min(1, 'Name is required').max(100),
})

/* ─── design tokens ─── */
const gold = '#c9a84c'
const electric = '#4f8eff'
const plasma = '#9d4edd'
const lime = '#a8ff3e'
const syne = "'Syne', sans-serif"
const outfit = "'Outfit', sans-serif"
const mono = "'JetBrains Mono', monospace"

/* ─── agents data ─── */
const agents = [
  { emoji:'🔍', number:'01', tag:'SPECIFICATION ANALYSIS', character:'The Detective', accent:'#4f8eff', bg:'linear-gradient(135deg,#050d1a 0%,#0a1628 100%)', body:'Before a single line of code is written, the Analyst reads every word of your spec. It extracts your MVP features, identifies constraints, finds your target domain, and maps out judging criteria — so every downstream agent builds exactly what you described.', stat:'~8 sec · ~400 tokens', techPill:'Gemini 2.0 Flash' },
  { emoji:'🏗️', number:'02', tag:'SYSTEM DESIGN', character:'Blueprint Master', accent:'#22c55e', bg:'linear-gradient(135deg,#030d08 0%,#071a10 100%)', body:'The Architect designs your entire system before coding begins. It produces immutable API contracts that every downstream agent must follow — guaranteed endpoint consistency between frontend and backend. Database schema, component map, tech stack selection. All locked in before a single file is generated.', stat:'~12 sec · ~800 tokens', techPill:'Gemini 2.0 Flash' },
  { emoji:'🎨', number:'03', tag:'REACT FRONTEND GENERATION', character:'The Creative Designer', accent:'#a855f7', bg:'linear-gradient(135deg,#0d0518 0%,#180a2e 100%)', body:'Generates a complete React + Vite frontend from your component map. Every fetch() call uses only the API contracts defined by the Architect — zero invented endpoints. Runs in parallel with the Backend and Business agents so no time is wasted waiting.', stat:'~25 sec · ~2000 tokens', techPill:'Groq llama-3.3-70b' },
  { emoji:'⚙️', number:'04', tag:'FASTAPI BACKEND GENERATION', character:'The Machine Engineer', accent:'#f59e0b', bg:'linear-gradient(135deg,#0d0800 0%,#1a1000 100%)', body:'While your frontend is being written, the Backend Agent simultaneously generates a complete FastAPI backend — routes, models, error handling, CORS. It implements exactly the endpoints the Architect specified, so integration works on the first try. Runs on a separate LLM provider to avoid rate limit conflicts.', stat:'~25 sec · ~2000 tokens', techPill:'OpenRouter llama-3.3-70b' },
  { emoji:'📊', number:'05', tag:'PITCH & DOCUMENTATION', character:'The Pitch Strategist', accent:'#ec4899', bg:'linear-gradient(135deg,#0d0008 0%,#1a0014 100%)', body:'Your README, reveal.js pitch deck, and Mermaid architecture diagram — all generated in parallel with your code. The Business Agent understands judging criteria and writes narratives that win. 6-8 slides, speaker notes included. Ships the same moment your code does.', stat:'~20 sec · ~900 tokens', techPill:'Groq llama-3.1-8b-instant' },
  { emoji:'🔗', number:'06', tag:'DEPENDENCY RESOLUTION', character:'The Weaver', accent:'#14b8a6', bg:'linear-gradient(135deg,#001410 0%,#001a18 100%)', body:'After all three parallel agents finish, the Integrator merges every file. It generates requirements.txt by scanning your Python imports, package.json from your React dependencies, .gitignore, docker-compose.yml, and .env.example. It also checks that every API endpoint called in the frontend actually exists in the backend.', stat:'~10 sec · ~500 tokens', techPill:'Gemini 2.0 Flash' },
  { emoji:'🧑‍🏫', number:'07', tag:'QUALITY SCORING', character:'The Professor', accent:'#84cc16', bg:'linear-gradient(135deg,#080d03 0%,#0f1a06 100%)', body:'No LLM calls — pure Python static analysis. The Validator runs ast.parse() on every .py file, checks every JSX import references a real file, and verifies every frontend API call has a matching backend route. Scores 0-100. If below 70, the Integrator reruns up to 3 times until your code passes. You always get working code.', stat:'~3 sec · 0 tokens', techPill:'Pure Python AST' },
  { emoji:'🚀', number:'08', tag:'DEPLOYMENT', character:'The Astronaut', accent:'#e2e8f0', bg:'radial-gradient(ellipse at 50% 40%,#0a0a18 0%,#000000 60%)', body:'Creates your GitHub repo, commits all generated files in one atomic push using the Git Trees API, builds a ZIP archive, and uploads it to encrypted cloud storage. Then fires a webhook to n8n for completion notifications. Your project goes from spec to live GitHub repo in a single pipeline run.', stat:'~15 sec · 0 tokens', techPill:'GitHub REST API' },
]

const featureCards = [
  { emoji:'🎯', title:'Spec → Code', desc:'Upload a brief, get a full-stack project.' },
  { emoji:'📡', title:'Live Dashboard', desc:'Watch every agent work in real time.' },
  { emoji:'🔑', title:'BYOK', desc:'Bring your own API keys. We never store them.' },
  { emoji:'🐙', title:'Auto GitHub', desc:'Repo created and pushed automatically.' },
  { emoji:'📦', title:'ZIP Download', desc:'One-click archive of your entire project.' },
  { emoji:'♻️', title:'Auto-Retry', desc:'Failed validation? Agents re-run until it passes.' },
  { emoji:'📊', title:'Pitch Deck', desc:'reveal.js slides with speaker notes.' },
  { emoji:'🏗️', title:'Arch Diagram', desc:'Mermaid architecture diagram, auto-generated.' },
  { emoji:'📁', title:'History', desc:'Every project saved and accessible.' },
  { emoji:'🔀', title:'Multi-LLM', desc:'Gemini, Groq, OpenRouter — simultaneous.' },
  { emoji:'⌨️', title:'Keyboard Nav', desc:'Full keyboard navigation support.' },
  { emoji:'📱', title:'Mobile', desc:'Responsive design, works on any device.' },
]

const securityCards = [
  { emoji:'🔑', title:'Fernet Encryption', desc:'All API keys encrypted at rest with Fernet symmetric encryption. Decrypted only at execution time, in memory, then discarded.', accent: plasma },
  { emoji:'🚫', title:'Zero Key Logging', desc:'Your keys never touch our logs, database, or any analytics pipeline. They exist only for the duration of your pipeline run.', accent: electric },
  { emoji:'🍪', title:'Session Auth Only', desc:'Appwrite session cookies — no passwords stored, no JWTs in localStorage. OAuth tokens stay server-side.', accent: gold },
  { emoji:'📁', title:'Code Stays Yours', desc:'Generated code is pushed to YOUR GitHub account. We keep a temporary ZIP for download, encrypted, auto-deleted after 24 hours.', accent: lime },
]

/* ─── global keyframes (injected once) ─── */
const globalStyleId = 'hf-landing-styles'
const globalCSS = `
@keyframes hf-drift{0%{transform:translateY(0)}100%{transform:translateY(-100vh)}}
@keyframes hf-glow-cycle{0%,100%{opacity:.15}50%{opacity:.6}}
@keyframes hf-bounce-chevron{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}
@keyframes hf-dash{to{stroke-dashoffset:0}}
@keyframes hf-pipeline-glow{0%{left:-12.5%}100%{left:100%}}
@keyframes hf-pulse-ring{0%{transform:scale(1);opacity:.5}100%{transform:scale(1.5);opacity:0}}
.hf-star{position:absolute;width:1.5px;height:1.5px;background:#fff;border-radius:50%;animation:hf-drift linear infinite;will-change:transform}
.hf-snap-container{scroll-snap-type:y mandatory}
.hf-snap-section{scroll-snap-align:start}
@media(max-width:768px){.hf-snap-container{scroll-snap-type:none}.hf-snap-section{scroll-snap-align:none}}
`

/* ─── helper: starfield dots ─── */
function generateStars(count) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 200}%`,
      opacity: 0.15 + Math.random() * 0.5,
      size: 1 + Math.random() * 1.5,
      duration: 30 + Math.random() * 60,
      delay: Math.random() * -60,
    })
  }
  return out
}

/* ─── stagger helper ─── */
const stagger = (i, base = 0) => ({ initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: base + i * 0.12 } })
const inView = (i = 0) => ({ initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.3 }, transition: { duration: 0.5, delay: i * 0.1 } })

/* ────────────────────────────────────────────────────── */
export default function Landing() {
  const { loginWithGitHub, loginWithEmail, signupWithEmail, error: authError } = useAuth()
  const navigate = useNavigate()

  /* auth modal state (preserved) */
  const [authMode, setAuthMode] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState(null)

  /* nav visibility */
  const [navVisible, setNavVisible] = useState(false)
  /* keyboard toast */
  const [showToast, setShowToast] = useState(false)
  /* cursor spotlight */
  const cursorX = useMotionValue(-1000)
  const cursorY = useMotionValue(-1000)
  const smoothX = useSpring(cursorX, { damping: 30, stiffness: 200 })
  const smoothY = useSpring(cursorY, { damping: 30, stiffness: 200 })

  /* scroll progress bar */
  const { scrollYProgress } = useScroll()

  /* refs */
  const mainRef = useRef(null)
  const heroRef = useRef(null)

  /* starfield memoized */
  const stars = useMemo(() => generateStars(200), [])

  /* ─── Lenis smooth scroll ─── */
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.7 })
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])

  /* ─── inject global styles ─── */
  useEffect(() => {
    if (!document.getElementById(globalStyleId)) {
      const s = document.createElement('style')
      s.id = globalStyleId
      s.textContent = globalCSS
      document.head.appendChild(s)
    }
  }, [])

  /* ─── nav show/hide on scroll ─── */
  useEffect(() => {
    const handler = () => setNavVisible(window.scrollY > 80)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  /* ─── keyboard toast (once) ─── */
  useEffect(() => {
    if (localStorage.getItem('hf-kb-toast')) return
    const t = setTimeout(() => { setShowToast(true); localStorage.setItem('hf-kb-toast', '1') }, 5000)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!showToast) return
    const t = setTimeout(() => setShowToast(false), 4000)
    return () => clearTimeout(t)
  }, [showToast])

  /* ─── cursor spotlight ─── */
  useEffect(() => {
    const move = (e) => { cursorX.set(e.clientX); cursorY.set(e.clientY) }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [cursorX, cursorY])

  /* ─── auth handler (preserved) ─── */
  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLocalError(null)

    // Validate form
    const schema = authMode === 'signup' ? signupSchema : loginSchema
    const result = schema.safeParse({ email, password, ...(authMode === 'signup' ? { name: name || email.split('@')[0] } : {}) })
    if (!result.success) {
      const msg = result.error.issues[0].message
      setLocalError(msg)
      toast.error(msg)
      return
    }

    setLoading(true)
    try {
      if (authMode === 'signup') {
        await signupWithEmail(email, password, name || email.split('@')[0])
        toast.success('Account created!')
      } else {
        await loginWithEmail(email, password)
        toast.success('Welcome back!')
      }
      navigate('/')
    } catch (err) {
      setLocalError(err.message)
      toast.error(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || authError

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  /* ─────────── RENDER ─────────── */
  return (
    <div ref={mainRef} style={{ background: '#000', color: '#fff', fontFamily: outfit, minHeight: '100vh', position: 'relative' }}>

      {/* ── Progress bar ── */}
      <motion.div
        style={{ scaleX: scrollYProgress, transformOrigin: '0%', position: 'fixed', top: 0, left: 0, right: 0, height: 2, background: lime, zIndex: 200 }}
      />

      {/* ── Cursor spotlight (hero + CTA) ── */}
      <motion.div
        style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 5,
          width: 300, height: 300, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(168,255,62,0.06) 0%, transparent 70%)`,
          x: smoothX, y: smoothY,
          translateX: '-50%', translateY: '-50%',
        }}
      />

      {/* ── Sticky nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(0,0,0,0.7)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        opacity: navVisible ? 1 : 0, pointerEvents: navVisible ? 'auto' : 'none',
        transition: 'opacity 0.35s ease',
      }}>
        <span style={{ fontFamily: syne, fontWeight: 800, fontSize: 22, color: gold, cursor: 'pointer' }} onClick={() => scrollTo('hero')}>HF</span>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }} className="hf-nav-links">
          {['Hero','Agents','Architecture','Privacy','Start'].map(s => (
            <button key={s} onClick={() => scrollTo(s.toLowerCase() === 'agents' ? 'agent-01' : s.toLowerCase())} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: outfit,
              cursor: 'pointer', letterSpacing: 0.5, transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.5)'}
            >{s}</button>
          ))}
        </div>
        <button onClick={loginWithGitHub} style={{
          background: '#000', color: lime, border: `1px solid ${lime}`, borderRadius: 8,
          padding: '8px 18px', fontSize: 13, fontFamily: outfit, fontWeight: 500, cursor: 'pointer',
          transition: 'background 0.2s, color 0.2s',
        }}
        onMouseEnter={e => { e.target.style.background = lime; e.target.style.color = '#000' }}
        onMouseLeave={e => { e.target.style.background = '#000'; e.target.style.color = lime }}
        >Start Building →</button>
      </nav>

      {/* ── Mobile nav (logo + CTA only) ── */}
      <style>{`
        .hf-nav-links{display:flex}
        @media(max-width:768px){.hf-nav-links{display:none !important}}
      `}</style>

      {/* ── Keyboard toast ── */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            style={{
              position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 150,
              background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
              padding: '12px 24px', fontFamily: mono, fontSize: 13, color: 'rgba(255,255,255,0.6)',
              whiteSpace: 'nowrap',
            }}
          >
            Pro tip: use ↑↓ to navigate agents
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════ SECTION 1: HERO ═══════════════ */}
      <section id="hero" ref={heroRef} style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', padding: '0 24px' }}>
        {/* starfield */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {stars.map(s => (
            <div key={s.id} className="hf-star" style={{
              left: s.left, top: s.top, opacity: s.opacity,
              width: s.size, height: s.size,
              animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s`,
            }} />
          ))}
        </div>
        {/* nebula blobs */}
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(79,142,255,0.12) 0%, transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', right: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(157,78,221,0.1) 0%, transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-5%', left: '30%', width: '45%', height: '35%', background: 'radial-gradient(circle, rgba(168,255,62,0.06) 0%, transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        {/* staggered content */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 900 }}>
          {/* pill */}
          <motion.div {...stagger(0)} style={{ marginBottom: 28 }}>
            <span style={{
              display: 'inline-block', padding: '8px 20px', borderRadius: 100,
              background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
              fontFamily: outfit, fontSize: 14, fontWeight: 400, color: gold, letterSpacing: 0.3,
            }}>🌾 Now in Beta — Free to use</span>
          </motion.div>

          {/* h1 */}
          <motion.h1 {...stagger(1)} style={{
            fontFamily: syne, fontWeight: 800, fontSize: 'clamp(48px, 6vw, 96px)', lineHeight: 1.05,
            margin: '0 0 24px', letterSpacing: '-0.02em',
          }}>
            Ship your hackathon<br />
            in <span style={{ color: lime }}>minutes</span>, not days
          </motion.h1>

          {/* sub */}
          <motion.p {...stagger(2)} style={{
            fontFamily: outfit, fontWeight: 300, fontSize: 22, color: 'rgba(255,255,255,0.5)',
            maxWidth: 620, margin: '0 auto 40px', lineHeight: 1.6,
          }}>
            Upload a spec. Eight AI agents build your frontend, backend, pitch deck, architecture diagram, and push it to GitHub. All in under 5 minutes.
          </motion.p>

          {/* CTAs */}
          <motion.div {...stagger(3)} style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={loginWithGitHub} style={{
              background: lime, color: '#000', border: 'none', borderRadius: 12,
              padding: '16px 36px', fontSize: 16, fontFamily: outfit, fontWeight: 500, cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = `0 8px 30px ${lime}33` }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none' }}
            >Generate a project →</button>
            <button onClick={() => scrollTo('agent-01')} style={{
              background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 12, padding: '16px 36px', fontSize: 16, fontFamily: outfit, fontWeight: 400, cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.target.style.borderColor = 'rgba(255,255,255,0.5)'}
            onMouseLeave={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
            >Watch it work ↓</button>
          </motion.div>

          {/* stats */}
          <motion.div {...stagger(4)} style={{ display: 'flex', gap: 40, justifyContent: 'center', marginBottom: 56, flexWrap: 'wrap' }}>
            {['< 5 min','8 agents','3 LLM providers'].map((s, i) => (
              <span key={i} style={{ fontFamily: mono, fontSize: 14, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>{s}</span>
            ))}
          </motion.div>

          {/* pipeline visual */}
          <motion.div {...stagger(5)} style={{ position: 'relative', display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 56 }}>
            {agents.map((a, i) => (
              <div key={i} style={{
                padding: '8px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                fontFamily: mono, fontSize: 11, color: 'rgba(255,255,255,0.45)',
                whiteSpace: 'nowrap', position: 'relative', overflow: 'hidden',
              }}>
                <span style={{ position: 'relative', zIndex: 1 }}>{a.emoji} {a.number}</span>
                {/* cycling glow */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, width: '12.5%',
                  background: `linear-gradient(90deg, transparent, ${a.accent}44, transparent)`,
                  animation: `hf-pipeline-glow ${agents.length * 0.6}s linear infinite`,
                  animationDelay: `${i * 0.6}s`,
                }} />
              </div>
            ))}
          </motion.div>

          {/* scroll indicator */}
          <motion.div {...stagger(6)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <ChevronDown size={20} style={{ color: 'rgba(255,255,255,0.3)', animation: 'hf-bounce-chevron 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: outfit, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Scroll to explore agents</span>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ SECTIONS 2-9: AGENTS ═══════════════ */}
      <div className="hf-snap-container" id="agents-wrapper">
        {agents.map((agent, idx) => (
          <section
            key={agent.number}
            id={`agent-${agent.number}`}
            className="hf-snap-section"
            style={{
              minHeight: '100vh', background: agent.bg, position: 'relative', overflow: 'hidden',
              display: 'flex', alignItems: 'center', padding: '80px 5vw',
            }}
          >
            {/* bg figurine emoji */}
            <div style={{
              position: 'absolute', right: '5%', top: '50%', transform: 'translateY(-50%)',
              fontSize: 'clamp(200px, 30vw, 480px)', opacity: 0.055, filter: 'blur(1px)',
              willChange: 'transform', userSelect: 'none', pointerEvents: 'none', lineHeight: 1,
            }}>{agent.emoji}</div>

            {/* accent glow */}
            <div style={{
              position: 'absolute', top: '-10%', left: '-5%', width: 500, height: 500,
              background: `radial-gradient(circle, ${agent.accent}0a 0%, transparent 70%)`,
              filter: 'blur(100px)', opacity: 0.04, pointerEvents: 'none',
            }} />

            {/* content left */}
            <div style={{ position: 'relative', zIndex: 2, maxWidth: 580, flex: 1 }}>
              <motion.div {...inView(0)}>
                <span style={{
                  fontFamily: mono, fontSize: 13, color: agent.accent, letterSpacing: 2,
                  display: 'inline-block', marginBottom: 16, opacity: 0.8,
                }}>{agent.number} — {agent.tag}</span>
              </motion.div>
              <motion.h2 {...inView(1)} style={{
                fontFamily: syne, fontWeight: 800, fontSize: 'clamp(40px, 5.5vw, 72px)',
                lineHeight: 1.05, margin: '0 0 24px', letterSpacing: '-0.02em',
              }}>{agent.character}</motion.h2>
              <motion.p {...inView(2)} style={{
                fontFamily: outfit, fontWeight: 300, fontSize: 18, color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.7, marginBottom: 32, maxWidth: 540,
              }}>{agent.body}</motion.p>
              <motion.div {...inView(3)} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: mono, fontSize: 12, color: 'rgba(255,255,255,0.35)',
                  padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>{agent.stat}</span>
                <span style={{
                  fontFamily: mono, fontSize: 12, color: agent.accent,
                  padding: '6px 14px', borderRadius: 8, background: `${agent.accent}12`,
                  border: `1px solid ${agent.accent}30`,
                }}>{agent.techPill}</span>
              </motion.div>
            </div>

            {/* right side progress bars */}
            <motion.div {...inView(0)} style={{
              position: 'absolute', right: 'clamp(24px, 4vw, 60px)', top: '50%', transform: 'translateY(-50%)',
              display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end',
            }}>
              {agents.map((_, bIdx) => (
                <div key={bIdx} style={{
                  width: bIdx === idx ? 40 : 20, height: 3, borderRadius: 2,
                  background: bIdx === idx ? agent.accent : 'rgba(255,255,255,0.1)',
                  transition: 'all 0.4s ease',
                }} />
              ))}
            </motion.div>
          </section>
        ))}
      </div>

      {/* ═══════════════ SECTION 10: ARCHITECTURE ═══════════════ */}
      <section id="architecture" style={{
        minHeight: '100vh', position: 'relative', padding: '120px 5vw', overflow: 'hidden',
        backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 60px)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <motion.h2 {...inView(0)} style={{ fontFamily: syne, fontWeight: 800, fontSize: 56, textAlign: 'center', marginBottom: 12, letterSpacing: '-0.02em' }}>
            How it all fits together
          </motion.h2>
          <motion.p {...inView(1)} style={{ fontFamily: outfit, fontWeight: 300, fontSize: 20, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 72 }}>
            Every component, every connection
          </motion.p>

          {/* architecture boxes */}
          <motion.div {...inView(2)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0, marginBottom: 48, flexWrap: 'wrap' }}>
            {/* React SPA */}
            <div style={archBox(electric)}>
              <span style={{ fontSize: 28 }}>⚛️</span>
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 500 }}>React SPA</span>
              <span style={{ fontFamily: outfit, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Vite + TailwindCSS</span>
            </div>
            {/* animated dashed line */}
            <div style={{ width: 60, borderTop: '2px dashed rgba(255,255,255,0.15)', animation: 'hf-dash 1s linear infinite', flexShrink: 0 }} />
            {/* FastAPI / LangGraph */}
            <div style={archBox(lime)}>
              <span style={{ fontSize: 28 }}>🧠</span>
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 500 }}>FastAPI + LangGraph</span>
              <span style={{ fontFamily: outfit, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Orchestration Layer</span>
            </div>
            {/* animated dashed line */}
            <div style={{ width: 60, borderTop: '2px dashed rgba(255,255,255,0.15)', flexShrink: 0 }} />
            {/* Appwrite */}
            <div style={archBox(plasma)}>
              <span style={{ fontSize: 28 }}>☁️</span>
              <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 500 }}>Appwrite</span>
              <span style={{ fontFamily: outfit, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Auth · Storage · DB</span>
            </div>
          </motion.div>

          {/* LLM providers row */}
          <motion.div {...inView(3)} style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 80, flexWrap: 'wrap' }}>
            {[
              { name: 'Gemini', color: '#4285f4' },
              { name: 'Groq', color: '#f55036' },
              { name: 'OpenRouter', color: '#8b5cf6' },
            ].map(p => (
              <div key={p.name} style={{
                padding: '10px 24px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.color}30`,
                fontFamily: mono, fontSize: 13, color: p.color,
              }}>{p.name}</div>
            ))}
          </motion.div>

          {/* 3 feature columns */}
          <motion.div {...inView(4)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
            {[
              { icon: '🔒', title: 'Encrypted', desc: 'All keys encrypted with Fernet at rest. Decrypted only during execution.' },
              { icon: '⚡', title: 'Real-time', desc: 'Server-sent events stream every agent step to your dashboard live.' },
              { icon: '🔀', title: 'Multi-provider', desc: 'Three LLM providers run simultaneously — no single point of failure.' },
            ].map((f, i) => (
              <div key={i} style={{
                padding: 28, borderRadius: 16, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>{f.icon}</span>
                <h4 style={{ fontFamily: syne, fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{f.title}</h4>
                <p style={{ fontFamily: outfit, fontWeight: 300, fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ SECTION 11: PRIVACY ═══════════════ */}
      <section id="privacy" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '120px 5vw', position: 'relative',
        background: 'radial-gradient(ellipse at 50% 50%, #0d0018 0%, #050008 100%)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <motion.h2 {...inView(0)} style={{ fontFamily: syne, fontWeight: 800, fontSize: 'clamp(36px, 4.5vw, 56px)', textAlign: 'center', marginBottom: 12, letterSpacing: '-0.02em' }}>
            Your keys. Your code. Your data.
          </motion.h2>
          <motion.p {...inView(1)} style={{ fontFamily: outfit, fontWeight: 300, fontSize: 20, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 64 }}>
            We never see your API keys. Ever.
          </motion.p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {securityCards.map((card, i) => (
              <motion.div key={i} {...inView(i * 0.5)} style={{
                padding: 32, borderRadius: 20, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)', cursor: 'default',
                transition: 'transform 0.3s ease, border-color 0.3s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = `${card.accent}40` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
              >
                <span style={{ fontSize: 36, display: 'block', marginBottom: 16 }}>{card.emoji}</span>
                <h4 style={{ fontFamily: syne, fontWeight: 800, fontSize: 20, marginBottom: 8, color: card.accent }}>{card.title}</h4>
                <p style={{ fontFamily: outfit, fontWeight: 300, fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECTION 12: FEATURES ═══════════════ */}
      <section id="features" style={{ padding: '120px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 5vw' }}>
          <motion.h2 {...inView(0)} style={{ fontFamily: syne, fontWeight: 800, fontSize: 'clamp(36px, 4.5vw, 56px)', textAlign: 'center', marginBottom: 56, letterSpacing: '-0.02em' }}>
            Everything you need to ship fast
          </motion.h2>
        </div>
        <motion.div
          drag="x"
          dragConstraints={{ left: -(featureCards.length * 300 - (typeof window !== 'undefined' ? window.innerWidth : 1200)), right: 0 }}
          style={{ display: 'flex', gap: 16, cursor: 'grab', padding: '0 5vw', userSelect: 'none' }}
          whileTap={{ cursor: 'grabbing' }}
        >
          {featureCards.map((f, i) => (
            <motion.div key={i} {...inView(i * 0.05)} style={{
              minWidth: 280, padding: 28, borderRadius: 20,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 14 }}>{f.emoji}</span>
              <h4 style={{ fontFamily: syne, fontWeight: 800, fontSize: 18, marginBottom: 6 }}>{f.title}</h4>
              <p style={{ fontFamily: outfit, fontWeight: 300, fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══════════════ SECTION 12.5: HOW IT WORKS ═══════════════ */}
      <section style={{ padding: '120px 0', position: 'relative' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 5vw' }}>
          <motion.h2 {...inView(0)} style={{ fontFamily: syne, fontWeight: 800, fontSize: 'clamp(36px, 4.5vw, 56px)', textAlign: 'center', marginBottom: 16, letterSpacing: '-0.02em' }}>
            How it works
          </motion.h2>
          <motion.p {...inView(1)} style={{ fontFamily: outfit, fontSize: 18, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 64 }}>
            Three steps. Under two minutes. Zero config.
          </motion.p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { step: '01', title: 'Describe your idea', desc: 'Type a prompt or upload a PDF/DOCX spec. Our analyst agent extracts features, constraints, and scope automatically.', accent: electric },
              { step: '02', title: 'Watch agents build', desc: 'Seven specialized AI agents work in parallel — designing architecture, writing frontend & backend code, creating pitch decks, and validating everything.', accent: lime },
              { step: '03', title: 'Ship it', desc: 'Your complete project is pushed to GitHub with full code, README, architecture diagrams, and a pitch deck. Download the ZIP or open it directly.', accent: gold },
            ].map((s, i) => (
              <motion.div key={i} {...inView(i * 0.15)} style={{ display: 'flex', gap: 32, padding: '40px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none', alignItems: 'flex-start' }}>
                <div style={{ fontFamily: mono, fontSize: 48, fontWeight: 800, color: s.accent, opacity: 0.3, lineHeight: 1, flexShrink: 0, minWidth: 80 }}>{s.step}</div>
                <div>
                  <h3 style={{ fontFamily: syne, fontWeight: 700, fontSize: 24, marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontFamily: outfit, fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECTION 12.7: FAQ ═══════════════ */}
      <section style={{ padding: '120px 0', position: 'relative' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 5vw' }}>
          <motion.h2 {...inView(0)} style={{ fontFamily: syne, fontWeight: 800, fontSize: 'clamp(36px, 4.5vw, 56px)', textAlign: 'center', marginBottom: 56, letterSpacing: '-0.02em' }}>
            FAQ
          </motion.h2>
          {[
            { q: 'Is it free?', a: 'Yes — HackFarmer is free during beta. You bring your own LLM API keys (Gemini, Groq, or OpenRouter), so you only pay your provider\'s rates.' },
            { q: 'What LLM providers are supported?', a: 'We support Google Gemini, Groq, and OpenRouter. You can add multiple keys and we\'ll automatically fallback between them if one fails.' },
            { q: 'Is my code private?', a: 'Absolutely. Your API keys are Fernet-encrypted at rest. Generated code is pushed to your own GitHub account (public or private, your choice). We never store your source code on our servers.' },
            { q: 'What kinds of projects can it generate?', a: 'Full-stack web apps with a React + Vite frontend and FastAPI backend. Think: dashboards, SaaS apps, hackathon projects, MVPs, internal tools — anything describable in a spec.' },
            { q: 'How long does generation take?', a: 'Typically 60–90 seconds. Our agents run in parallel (frontend, backend, and business docs all generate simultaneously), so it\'s much faster than sequential generation.' },
            { q: 'Can I edit the generated code?', a: 'Yes — the code is pushed to your GitHub repo, so you can clone it and modify anything. You can also preview all files directly in HackFarmer\'s built-in code viewer with syntax highlighting.' },
          ].map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} i={i} />
          ))}
        </div>
      </section>

      {/* ═══════════════ SECTION 13: FINAL CTA ═══════════════ */}
      <section id="start" style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        padding: '120px 24px', textAlign: 'center', position: 'relative',
      }}>
        <div style={{ maxWidth: 800 }}>
          {/* staggered word reveal */}
          <h2 style={{ fontFamily: syne, fontWeight: 800, fontSize: 'clamp(40px, 5vw, 80px)', lineHeight: 1.1, marginBottom: 24, letterSpacing: '-0.02em' }}>
            {'Stop building. Start shipping.'.split(' ').map((word, i) => (
              <motion.span key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                style={{ display: 'inline-block', marginRight: '0.3em' }}
              >{word}</motion.span>
            ))}
          </h2>
          <motion.p {...inView(1)} style={{
            fontFamily: outfit, fontWeight: 300, fontSize: 20, color: 'rgba(255,255,255,0.45)',
            marginBottom: 48, lineHeight: 1.6,
          }}>
            Your next hackathon project, fully generated, pushed to GitHub, ready to demo.
          </motion.p>
          <motion.div {...inView(2)}>
            <button onClick={loginWithGitHub} style={{
              background: lime, color: '#000', border: 'none', borderRadius: 16,
              padding: '22px 56px', fontSize: 20, fontFamily: outfit, fontWeight: 500, cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-3px)'; e.target.style.boxShadow = `0 12px 40px ${lime}44` }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = 'none' }}
            >Generate your first project →</button>
          </motion.div>
          <motion.p {...inView(3)} style={{
            fontFamily: outfit, fontWeight: 400, fontSize: 14, color: 'rgba(255,255,255,0.3)',
            marginTop: 32, display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <span>✓ Free to use</span>
            <span>✓ No credit card</span>
            <span>✓ GitHub OAuth only</span>
          </motion.p>
        </div>

        {/* footer */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 32px',
          fontFamily: outfit, fontSize: 13, color: 'rgba(255,255,255,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          <span>HackFarmer © {new Date().getFullYear()}</span>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <a href="https://github.com/talelboussetta/HackFarm" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}>GitHub</a>
            <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
            <span>Built with LangGraph · Appwrite · FastAPI · React</span>
          </div>
        </div>
      </section>

      {/* ═══════════════ AUTH MODAL (preserved) ═══════════════ */}
      <AnimatePresence>
        {authMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            style={{ zIndex: 300 }}
            onClick={(e) => { if (e.target === e.currentTarget) setAuthMode(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              style={{
                width: '100%', maxWidth: 448, padding: 32, borderRadius: 20,
                background: '#111', border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <h2 style={{ fontFamily: syne, fontWeight: 800, fontSize: 24, marginBottom: 4 }}>
                {authMode === 'signup' ? 'Create account' : 'Welcome back'}
              </h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24, fontFamily: outfit }}>
                {authMode === 'signup' ? 'Start shipping hackathon projects in minutes.' : 'Log in to continue building.'}
              </p>

              {/* GitHub OAuth */}
              <button
                onClick={() => { setAuthMode(null); loginWithGitHub() }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 0', borderRadius: 12, background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14,
                  fontFamily: outfit, cursor: 'pointer', marginBottom: 16, transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                <Github size={18} /> Continue with GitHub
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: outfit }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {authMode === 'signup' && (
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} size={16} />
                    <input
                      type="text" value={name} onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      style={inputStyle}
                    />
                  </div>
                )}
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} size={16} />
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    style={inputStyle}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'} required minLength={8}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 8 characters)"
                    style={{ ...inputStyle, paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <AnimatePresence>
                  {displayError && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ fontSize: 14, color: '#f87171', paddingTop: 4, fontFamily: outfit }}
                    >
                      {displayError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '12px 0', borderRadius: 12,
                  background: electric, color: '#fff', border: 'none',
                  fontSize: 14, fontFamily: outfit, fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
                }}>
                  {loading ? '...' : authMode === 'signup' ? 'Create Account' : 'Log In'}
                </button>
              </form>

              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 16, fontFamily: outfit }}>
                {authMode === 'signup' ? (
                  <>Already have an account?{' '}<button onClick={() => { setAuthMode('login'); setLocalError(null) }} style={{ background: 'none', border: 'none', color: electric, cursor: 'pointer', fontSize: 12, fontFamily: outfit, textDecoration: 'underline' }}>Log in</button></>
                ) : (
                  <>Don&apos;t have an account?{' '}<button onClick={() => { setAuthMode('signup'); setLocalError(null) }} style={{ background: 'none', border: 'none', color: electric, cursor: 'pointer', fontSize: 12, fontFamily: outfit, textDecoration: 'underline' }}>Sign up</button></>
                )}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── shared styles ─── */
const inputStyle = {
  width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '10px 16px 10px 40px', fontSize: 14, color: '#fff',
  outline: 'none', fontFamily: "'Outfit', sans-serif",
}

function archBox(accent) {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '28px 32px', borderRadius: 16,
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}30`,
    minWidth: 180,
  }
}

function FaqItem({ q, a, i }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: i * 0.05 }}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 18, color: '#fff' }}>{q}</span>
        <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.3)', transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 16 }}>+</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, paddingBottom: 24 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
