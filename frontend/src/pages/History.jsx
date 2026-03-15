import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  History as HistoryIcon, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Code2,
  Calendar,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function History() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // API Call placeholder: GET /api/jobs
    const fetchJobs = async () => {
      // Simulate API delay
      await new Promise(r => setTimeout(r, 1000))
      
      const mockJobs = [
        {
          id: '1',
          status: 'complete',
          repo_name: 'e-commerce-ai-agent',
          created_at: '2024-03-15T10:00:00Z',
          github_url: 'https://github.com/user/repo',
          input_type: 'pdf'
        },
        {
          id: '2',
          status: 'running',
          repo_name: 'defi-bot-v2',
          created_at: '2024-03-15T11:30:00Z',
          input_type: 'text'
        },
        {
          id: '3',
          status: 'failed',
          repo_name: 'nft-marketplace-demo',
          created_at: '2024-03-14T15:00:00Z',
          error_message: 'Validation failed in Architect agent',
          input_type: 'docx'
        }
      ]
      setJobs(mockJobs)
      setLoading(false)
    }

    if (user) fetchJobs()
  }, [user])

  const statusColors = {
    complete: 'text-green-400 bg-green-400/10 border-green-400/20',
    running: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
    queued: 'text-white/40 bg-white/5 border-white/10'
  }

  const statusIcons = {
    complete: CheckCircle2,
    running: Clock,
    failed: AlertCircle,
    queued: Clock
  }

  if (!user) {
    return (
      <div className="text-center py-24 space-y-4">
        <h2 className="text-2xl font-bold">Please sign in to view your history</h2>
        <p className="text-white/40">Your generated projects will be listed here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <HistoryIcon size={24} />
          </div>
          <h1 className="text-3xl font-bold">Project History</h1>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
          <p className="text-white/40">You haven't generated any projects yet.</p>
          <Link to="/" className="text-blue-400 hover:underline mt-4 inline-block">Start your first project</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job, idx) => {
            const StatusIcon = statusIcons[job.status] || Clock
            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group relative h-full flex flex-col p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusColors[job.status]}`}>
                    <StatusIcon size={14} />
                    <span className="capitalize">{job.status}</span>
                  </div>
                  <div className="text-white/20">
                    <Code2 size={24} />
                  </div>
                </div>

                <h3 className="text-lg font-bold mb-2 group-hover:text-blue-400 transition-colors truncate">
                  {job.repo_name}
                </h3>

                <div className="mt-auto pt-6 space-y-4">
                  <div className="flex items-center gap-4 text-xs text-white/40">
                    <div className="flex items-center gap-1.5 underline">
                      <Calendar size={14} />
                      {new Date(job.created_at).toLocaleDateString()}
                    </div>
                    <span className="uppercase">{job.input_type}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/job/${job.id}`}
                      className="flex-1 flex items-center justify-between px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-colors"
                    >
                      View Logs
                      <ChevronRight size={16} className="opacity-50" />
                    </Link>
                    {job.github_url && (
                      <a 
                        href={job.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        <ExternalLink size={20} />
                      </a>
                    )}
                  </div>
                </div>

                {job.status === 'failed' && job.error_message && (
                  <div className="mt-4 p-3 rounded-lg bg-red-400/10 text-red-400 text-xs flex gap-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <p className="line-clamp-2">{job.error_message}</p>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
