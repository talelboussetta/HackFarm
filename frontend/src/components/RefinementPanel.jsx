import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, MessageCircle, Loader2, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import Button from './Button'

const SUGGESTIONS = [
  'Add dark/light mode toggle',
  'Improve the mobile responsive design',
  'Add loading skeletons to all pages',
  'Add better error handling and user feedback',
  'Make the landing page more visually appealing',
  'Add search and filter functionality',
]

export default function RefinementPanel({ jobId, jobStatus, onRefineStart }) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const canRefine = (jobStatus === 'complete' || jobStatus === 'completed' || jobStatus === 'failed') && !loading

  const handleSubmit = async () => {
    if (!feedback.trim() || !canRefine) return

    const userMsg = feedback.trim()
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setFeedback('')
    setLoading(true)

    try {
      const res = await fetch(`/api/jobs/${jobId}/refine`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: userMsg }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Refinement failed')
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: '🔄 Refinement started! The agents are re-generating your code with your feedback. Watch the pipeline above.',
      }])
      toast.success('Refinement started')
      onRefineStart?.()
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `❌ ${err.message}` }])
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestion = (suggestion) => {
    setFeedback(suggestion)
  }

  if (!canRefine && messages.length === 0) return null

  return (
    <div className="border-t border-white/10">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-white/60">
          <Sparkles size={14} className="text-purple-400" />
          <span className="font-medium">Refine with AI</span>
          {messages.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-400/20 text-purple-300">
              {messages.filter(m => m.role === 'user').length} refinements
            </span>
          )}
        </div>
        {open ? <ChevronDown size={14} className="text-white/30" /> : <ChevronUp size={14} className="text-white/30" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Chat messages */}
              {messages.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-blue-500/20 text-blue-200 rounded-br-sm'
                            : 'bg-white/5 text-white/60 rounded-bl-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {messages.length === 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/20 uppercase tracking-wider">Suggestions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestion(s)}
                        className="px-2.5 py-1 text-[11px] text-white/40 bg-white/[0.03] border border-white/5 rounded-full hover:border-white/15 hover:text-white/60 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                  placeholder="Describe what to change..."
                  disabled={!canRefine}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-purple-400/50 outline-none disabled:opacity-50"
                  maxLength={5000}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!feedback.trim() || !canRefine}
                  loading={loading}
                  variant="primary"
                  size="sm"
                  className="px-3"
                >
                  <Send size={14} />
                </Button>
              </div>

              <p className="text-[10px] text-white/15">
                Agents will re-generate code with your feedback. Architecture stays the same.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
