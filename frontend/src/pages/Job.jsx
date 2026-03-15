import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Terminal, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Github, 
  ExternalLink,
  Loader2,
  ChevronRight,
  Code,
  Activity
} from 'lucide-react'
import { appwriteClient, databases } from '../lib/appwrite'
import { useAuth } from '../hooks/useAuth'

export default function Job() {
  const { id } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState(null)
  const [logs, setLogs] = useState([])
  const [agentRuns, setAgentRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const logEndRef = useRef(null)

  // Scroll to bottom when logs update
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  useEffect(() => {
    if (!id || !user) return

    const fetchData = async () => {
      try {
        const dbId = 'hackfarmer-db'
        
        // 1. Fetch Job
        const jobData = await databases.getDocument(dbId, 'jobs', id)
        setJob(jobData)

        // 2. Fetch Agent Runs
        const runs = await databases.listDocuments(dbId, 'agent-runs', [
          // Query.equal('jobId', id) - using direct filter if needed
        ])
        setAgentRuns(runs.documents.filter(r => r.jobId === id))

        // 3. Fetch Events (Logs)
        const events = await databases.listDocuments(dbId, 'job-events', [
          // Query.equal('jobId', id)
        ])
        const jobEvents = events.documents.filter(e => e.jobId === id)
        setLogs(jobEvents.map(e => ({
          id: e.$id,
          type: e.eventType,
          payload: JSON.parse(e.payload),
          timestamp: e.$createdAt
        })))

        setLoading(false)
      } catch (err) {
        console.error(err)
        setError('Failed to load job details. It might be private or deleted.')
        setLoading(false)
      }
    }

    fetchData()

    // 4. Subscribe to Realtime
    const unsubscribe = appwriteClient.subscribe(
      [`databases.hackfarmer-db.collections.job-events.documents`],
      (response) => {
        const payload = response.payload
        if (payload.jobId === id) {
          setLogs(prev => [...prev, {
            id: payload.$id,
            type: payload.eventType,
            payload: JSON.parse(payload.payload),
            timestamp: payload.$createdAt
          }])
          
          // If it's an agent event, we might want to refresh agent-runs too
          if (payload.eventType.startsWith('agent_')) {
             // We can optimistically update or just re-fetch agent runs
             // For now, let's just re-fetch runs every few agent events
          }
        }
      }
    )

    return () => unsubscribe()
  }, [id, user])

  if (loading) return <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 className="animate-spin text-blue-500" size={32} /><p className="text-white/40">Fetching job status...</p></div>
  if (error) return <div className="text-center py-24 space-y-4"><AlertCircle className="mx-auto text-red-500" size={48} /><h2 className="text-xl font-bold">{error}</h2><Link to="/" className="text-blue-400 hover:underline">Back to Dashboard</Link></div>

  const activeAgent = agentRuns.find(r => r.status === 'running')?.agentName
  const completionPercentage = (agentRuns.filter(r => r.status === 'done').length / 8) * 100 // 8 agents total in graph

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Progress & Status */}
      <div className="lg:col-span-1 space-y-6">
        <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Pipeline Status</h2>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
               job.status === 'complete' ? 'bg-green-400/10 text-green-400 border-green-400/20' :
               job.status === 'failed' ? 'bg-red-400/10 text-red-400 border-red-400/20' :
               'bg-blue-400/10 text-blue-400 border-blue-400/20 animate-pulse'
            }`}>
              {job.status.toUpperCase()}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/40">
              <span>Overall Progress</span>
              <span>{Math.round(completionPercentage)}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/5">
            {['analyst', 'architect', 'frontend_agent', 'backend_agent', 'integrator', 'validator', 'github_agent'].map((agent) => {
              const run = agentRuns.find(r => r.agentName === agent)
              const status = run?.status || 'waiting'
              
              return (
                <div key={agent} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      status === 'done' ? 'bg-green-500' :
                      status === 'running' ? 'bg-blue-500 animate-ping' :
                      status === 'failed' ? 'bg-red-500' :
                      'bg-white/10'
                    }`} />
                    <span className={`text-sm capitalize ${status === 'running' ? 'text-white' : 'text-white/40 group-hover:text-white/60 transition-colors'}`}>
                      {agent.replace('_agent', '')}
                    </span>
                  </div>
                  {status === 'done' && <CheckCircle2 size={14} className="text-green-500" />}
                </div>
              )
            })}
          </div>
        </section>

        {job.githubUrl && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 text-white space-y-4 shadow-xl shadow-blue-500/20"
          >
            <div className="flex items-center gap-2">
               <Github size={20} />
               <h3 className="font-bold">Project Ready</h3>
            </div>
            <p className="text-sm text-white/80">Your project has been successfully pushed to GitHub. You can clones it and start hacking!</p>
            <a 
              href={job.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between w-full px-4 py-2 bg-white text-blue-600 rounded-lg font-bold text-sm hover:bg-white/90 transition-colors"
            >
              View on GitHub
              <ExternalLink size={16} />
            </a>
          </motion.div>
        )}
      </div>

      {/* Right: Live Logs */}
      <div className="lg:col-span-2 flex flex-col h-[700px]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal size={20} className="text-blue-500" />
            <h2 className="text-lg font-bold">Execution Logs</h2>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/40">
              <Activity size={12} />
              LIVE
            </div>
          </div>
        </div>

        <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col font-mono text-sm">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            </div>
            <span className="text-[10px] text-white/20 ml-2 italic">hackfarmer_core_v1.log</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-1"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white/20 tabular-nums">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      log.type === 'agent_start' ? 'bg-blue-500/20 text-blue-400' :
                      log.type === 'agent_done' ? 'bg-green-500/20 text-green-400' :
                      log.type === 'job_complete' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-white/10 text-white/60'
                    }`}>
                      {log.type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-white/60">
                      {log.payload.agent ? <span>Agent: <b className="text-white">{log.payload.agent}</b></span> : null}
                    </span>
                  </div>
                  <div className="pl-[78px] text-white/80">
                    {log.payload.message || log.payload.summary || JSON.stringify(log.payload)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
