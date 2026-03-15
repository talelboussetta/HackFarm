import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Settings as SettingsIcon, 
  Key, 
  Shield, 
  Smartphone, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Zap,
  Bot
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Button from '../components/Button'

export default function Settings() {
  const { user } = useAuth()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingProvider, setAddingProvider] = useState(null) // 'gemini', 'groq', 'openrouter'
  const [newKey, setNewKey] = useState('')
  const [testingProvider, setTestingProvider] = useState(null)

  const providers = [
    { id: 'gemini', name: 'Google Gemini', description: 'Power your project with Gemini 2.0 Flash.' },
    { id: 'groq', name: 'Groq', description: 'Ultra-fast Llama 3 generation.' },
    { id: 'openrouter', name: 'OpenRouter', description: 'Access any model with a single key.' },
  ]

  useEffect(() => {
    const fetchKeys = async () => {
      // Simulate API: GET /settings/keys
      await new Promise(r => setTimeout(r, 800))
      setKeys([
        { provider: 'gemini', masked_key: '...abcd', is_valid: true, last_used: '2024-03-15T12:00:00Z' }
      ])
      setLoading(false)
    }
    if (user) fetchKeys()
  }, [user])

  const handleSaveKey = async (provider) => {
    // API Call: POST /settings/keys
    setLoading(true)
    setTimeout(() => {
      setKeys([...keys.filter(k => k.provider !== provider), {
        provider,
        masked_key: '...' + newKey.slice(-4),
        is_valid: true,
        last_used: new Date().toISOString()
      }])
      setAddingProvider(null)
      setNewKey('')
      setLoading(false)
    }, 1000)
  }

  const handleDeleteKey = async (provider) => {
    // API Call: DELETE /settings/keys/{provider}
    setKeys(keys.filter(k => k.provider !== provider))
  }

  const handleTestKey = async (provider) => {
    setTestingProvider(provider)
    // API Call: POST /settings/keys/{provider}/test
    setTimeout(() => setTestingProvider(null), 1500)
  }

  if (!user) return <div className="text-center py-24">Please sign in to view settings.</div>

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
          <SettingsIcon size={24} />
        </div>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Bot size={20} className="text-blue-400" />
          <h2 className="text-xl font-semibold">LLM Providers</h2>
        </div>
        
        <p className="text-white/40 text-sm">
          Connect your API keys to enable AI agents. Your keys are encrypted at rest and never shared.
        </p>

        <div className="space-y-4">
          {providers.map((p) => {
            const existing = keys.find(k => k.provider === p.id)
            const isAdding = addingProvider === p.id

            return (
              <div key={p.id} className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <Zap size={20} className={existing ? 'text-amber-400' : 'text-white/20'} />
                    </div>
                    <div>
                      <h4 className="font-bold">{p.name}</h4>
                      <p className="text-xs text-white/40">{p.description}</p>
                    </div>
                  </div>
                  
                  {existing && !isAdding && (
                    <div className="flex items-center gap-2">
                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 text-[10px] font-bold border border-green-400/20">
                        <CheckCircle2 size={10} />
                        ACTIVE
                      </div>
                      <button 
                        onClick={() => handleTestKey(p.id)}
                        disabled={testingProvider === p.id}
                        className="p-2 text-white/40 hover:text-white transition-colors"
                      >
                        <RefreshCw size={18} className={testingProvider === p.id ? 'animate-spin' : ''} />
                      </button>
                      <button 
                        onClick={() => handleDeleteKey(p.id)}
                        className="p-2 text-white/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {isAdding ? (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-2">
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
                      <Button size="sm" onClick={() => handleSaveKey(p.id)} disabled={!newKey.trim()}>Save Key</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddingProvider(null)}>Cancel</Button>
                    </div>
                  </motion.div>
                ) : (
                  !existing && (
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => setAddingProvider(p.id)}
                      className="w-full text-xs"
                    >
                      Connect {p.name}
                    </Button>
                  )
                )}

                {existing && !isAdding && (
                  <div className="text-[10px] text-white/20 font-mono">
                    Masked Key: {existing.masked_key} • Last used: {new Date(existing.last_used).toLocaleString()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <Shield size={20} className="text-purple-400" />
          <h2 className="text-xl font-semibold">Security & Preferences</h2>
        </div>
        
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
           <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">Data Retention</p>
              <p className="text-xs text-white/40">Keep job logs and files for 30 days before automatic deletion.</p>
            </div>
            <div className="flex items-center gap-2 p-1 bg-black/40 rounded-lg border border-white/5">
              <button className="px-3 py-1 text-xs bg-white/10 rounded-md">30d</button>
              <button className="px-3 py-1 text-xs text-white/40 hover:text-white">60d</button>
              <button className="px-3 py-1 text-xs text-white/40 hover:text-white">90d</button>
            </div>
          </div>

          <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="space-y-1">
                <p className="font-medium flex items-center gap-2">
                  Two-Factor Authentication
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">PRO</span>
                </p>
                <p className="text-xs text-white/40">Secure your account with an extra layer of protection.</p>
            </div>
            <div className="w-10 h-5 bg-white/10 rounded-full relative">
              <div className="absolute left-1 top-1 w-3 h-3 bg-white/20 rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
