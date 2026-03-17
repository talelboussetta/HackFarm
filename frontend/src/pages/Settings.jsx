import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Settings as SettingsIcon, 
  Key, 
  Shield, 
  CheckCircle2, 
  Trash2,
  RefreshCw,
  Zap,
  Bot,
  Github,
  Globe,
  X,
  Check,
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { log } from '../lib/logger'
import { api } from '../lib/api'
import Button from '../components/Button'

export default function Settings() {
  const { user, logout, getJWT } = useAuth()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingProvider, setAddingProvider] = useState(null)
  const [newKey, setNewKey] = useState('')
  const [testResults, setTestResults] = useState({})
  const [testingProvider, setTestingProvider] = useState(null)
  const [savingProvider, setSavingProvider] = useState(null)
  const [saveError, setSaveError] = useState(null)

  // Preferences (static for now)
  const [repoVisibility, setRepoVisibility] = useState('public')
  const [retention, setRetention] = useState('30')

  const providers = [
    { id: 'gemini', name: 'Google Gemini', description: 'Power your project with Gemini 2.0 Flash.', icon: Zap, keyUrl: 'https://aistudio.google.com/app/apikey', keyLabel: 'Get Gemini API Key' },
    { id: 'groq', name: 'Groq', description: 'Ultra-fast Llama 3 generation.', icon: Zap, keyUrl: 'https://console.groq.com/keys', keyLabel: 'Get Groq API Key' },
    { id: 'openrouter', name: 'OpenRouter', description: 'Access any model with a single key.', icon: Globe, keyUrl: 'https://openrouter.ai/keys', keyLabel: 'Get OpenRouter API Key' },
  ]

  useEffect(() => {
    if (!user) return
    const fetchKeys = async () => {
      try {
        const jwt = await getJWT()
        const data = await api('/api/settings/keys', {}, jwt)
        setKeys(Array.isArray(data) ? data : [])
      } catch (e) {
        log.error('Failed to fetch keys:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchKeys()
  }, [user, getJWT])

  const handleSaveKey = async (provider) => {
    if (!newKey.trim()) return
    setSavingProvider(provider)
    setSaveError(null)
    try {
      const jwt = await getJWT()
      await api('/api/settings/keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key: newKey.trim() }),
      }, jwt)
      const data = await api('/api/settings/keys', {}, jwt)
      setKeys(Array.isArray(data) ? data : [])
      setAddingProvider(null)
      setNewKey('')
    } catch (e) {
      log.error('Failed to save key:', e)
      setSaveError(e.message || 'Failed to save key')
    } finally {
      setSavingProvider(null)
    }
  }

  const handleDeleteKey = async (provider) => {
    try {
      const jwt = await getJWT()
      await api(`/api/settings/keys/${provider}`, { method: 'DELETE' }, jwt)
      setKeys(keys.filter(k => k.provider !== provider))
      setTestResults(prev => { const n = {...prev}; delete n[provider]; return n })
    } catch (e) {
      log.error('Failed to delete key:', e)
    }
  }

  const handleTestKey = async (provider) => {
    setTestingProvider(provider)
    setTestResults(prev => ({ ...prev, [provider]: null }))
    try {
      const jwt = await getJWT()
      const res = await api(`/api/settings/keys/${provider}/test`, { method: 'POST' }, jwt)
      setTestResults(prev => ({ ...prev, [provider]: res.valid !== false }))
    } catch {
      setTestResults(prev => ({ ...prev, [provider]: false }))
    } finally {
      setTestingProvider(null)
    }
  }

  const noKeysConfigured = keys.length === 0 && !loading

  if (!user) return <div className="text-center py-24">Please sign in to view settings.</div>

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
          <SettingsIcon size={24} />
        </div>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* GitHub Connection Card */}
      <section className="p-6 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {user.prefs?.avatar ? (
              <img src={user.prefs.avatar} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-lg font-bold">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Github size={16} className="text-white/40" />
                <span className="font-bold">@{user.name}</span>
                <span className="text-[10px] bg-green-400/10 text-green-400 px-2 py-0.5 rounded-full border border-green-400/20 font-bold">Connected</span>
              </div>
              <p className="text-xs text-white/40 mt-1">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-sm text-white/40 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </section>

      {/* API Keys Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Bot size={20} className="text-blue-400" />
          <h2 className="text-xl font-semibold">API Keys</h2>
        </div>
        
        <p className="text-white/40 text-sm">
          Connect your API keys to enable AI agents. Keys are encrypted at rest.
        </p>

        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2">
          <p className="text-xs text-blue-300/80 font-medium">💡 Quick Start</p>
          <ul className="text-xs text-white/40 space-y-1 list-disc list-inside">
            <li><strong className="text-white/60">Groq</strong> — free tier, fastest inference. Best for quick iterations.</li>
            <li><strong className="text-white/60">Gemini</strong> — free tier available. Great for detailed code generation.</li>
            <li><strong className="text-white/60">OpenRouter</strong> — one key for 100+ models. Pay-per-use, most flexible.</li>
          </ul>
          <p className="text-[10px] text-white/25 mt-1">Add multiple keys for automatic fallback — if one provider fails, we try the next.</p>
        </div>

        <AnimatePresence>
          {noKeysConfigured && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400"
            >
              <AlertTriangle size={18} />
              <span className="text-sm font-medium">Add at least one API key to generate projects</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          {providers.map((p, idx) => {
            const existing = keys.find(k => k.provider === p.id)
            const isAdding = addingProvider === p.id
            const testResult = testResults[p.id]
            const ProviderIcon = p.icon

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -2, boxShadow: `0 8px 32px ${existing ? '#22c55e' : '#3b82f6'}20` }}
                className="p-6 rounded-2xl bg-white/5 border space-y-4"
                style={{ borderColor: existing ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <ProviderIcon size={20} className={existing ? 'text-amber-400' : 'text-white/20'} />
                    </div>
                    <div>
                      <h4 className="font-bold">{p.name}</h4>
                      <p className="text-xs text-white/40">{p.description}</p>
                      <a
                        href={p.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 mt-1 transition-colors"
                      >
                        <Key size={10} />
                        {p.keyLabel} →
                      </a>
                    </div>
                  </div>
                  
                  {existing && !isAdding && (
                    <div className="flex items-center gap-2">
                      {testResult === true && (
                        <span className="text-green-400"><Check size={18} /></span>
                      )}
                      {testResult === false && (
                        <span className="text-red-400"><X size={18} /></span>
                      )}
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 text-[10px] font-bold border border-green-400/20">
                        <CheckCircle2 size={10} />
                        ACTIVE
                      </div>
                      <button 
                        onClick={() => handleTestKey(p.id)}
                        disabled={testingProvider === p.id}
                        className="p-2 text-white/40 hover:text-white transition-colors"
                        title="Test key"
                      >
                        <RefreshCw size={18} className={testingProvider === p.id ? 'animate-spin' : ''} />
                      </button>
                      <button 
                        onClick={() => handleDeleteKey(p.id)}
                        className="p-2 text-white/40 hover:text-red-400 transition-colors"
                        title="Delete key"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {isAdding && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 pt-2">
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                        <input 
                          type="password"
                          autoFocus
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          placeholder="Enter API Key"
                          className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-blue-500/50 outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveKey(p.id)} disabled={!newKey.trim()} loading={savingProvider === p.id}>Save Key</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAddingProvider(null); setNewKey(''); setSaveError(null) }}>Cancel</Button>
                      </div>
                      {saveError && (
                        <p className="text-xs text-red-400">{saveError}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {!existing && !isAdding && (
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => setAddingProvider(p.id)}
                    className="w-full text-xs"
                  >
                    Connect {p.name}
                  </Button>
                )}

                {existing && !isAdding && (
                  <div className="text-[10px] text-white/20 font-mono">
                    Masked Key: {existing.masked_key}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Preferences Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Shield size={20} className="text-purple-400" />
          <h2 className="text-xl font-semibold">Preferences</h2>
        </div>
        
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Default Repo Visibility</p>
              <p className="text-xs text-white/40">New repos will be created with this visibility.</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
              <button
                onClick={() => setRepoVisibility('public')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${repoVisibility === 'public' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
              >
                Public
              </button>
              <button
                onClick={() => setRepoVisibility('private')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${repoVisibility === 'private' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
              >
                Private
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">File Retention</p>
              <p className="text-xs text-white/40">How long to keep generated ZIPs.</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5">
              {[{ v: '7', l: '7 days' }, { v: '30', l: '30 days' }, { v: '0', l: 'Forever' }].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setRetention(opt.v)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${retention === opt.v ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
