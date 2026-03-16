import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History as HistoryIcon,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Code2,
  Calendar,
  ChevronRight,
  Download,
  Trash2,
  FileText,
  MessageSquare,
  Zap
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import Button from '../components/Button'

function relativeTime(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (seconds < 60) return rtf.format(-seconds, 'second')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  return rtf.format(-days, 'day')
}

export default function History() {
  const { user, getJWT } = useAuth()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (!user) return
    const fetchJobs = async () => {
      try {
        const jwt = await getJWT()
        if (!jwt) { navigate('/landing'); return }
        const data = await api('/api/jobs', {}, jwt)
        setJobs(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error('Failed to fetch jobs:', e)
        if (e.message?.includes('401') || e.message?.includes('Session expired')) {
          navigate('/landing')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchJobs()
  }, [user, getJWT, navigate])

  const handleDelete = async (jobId) => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    setDeleting(jobId)
    try {
      const jwt = await getJWT()
      if (!jwt) { navigate('/landing'); return }
      await api(`/api/jobs/${jobId}`, { method: 'DELETE' }, jwt)
      setJobs(jobs.filter(j => (j.id || j.$id) !== jobId))
    } catch (e) {
      console.error('Failed to delete job:', e)
    } finally {
      setDeleting(null)
    }
  }

  const statusColors = {
    complete: 'text-green-400 bg-green-400/10 border-green-400/20',
    running: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    failed: 'text-red-400 bg-red-400/10 border-red-400/20',
    queued: 'text-white/40 bg-white/5 border-white/10',
  }

  const statusIcons = {
    complete: CheckCircle2,
    running: Clock,
    failed: AlertCircle,
    queued: Clock,
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
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
          <HistoryIcon size={24} />
        </div>
        <h1 className="text-3xl font-bold">Project History</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10 space-y-4">
          <Zap size={48} className="mx-auto text-white/10" />
          <p className="text-white/40 text-lg">No projects yet</p>
          <Button onClick={() => navigate('/')} variant="primary" size="lg">
            Generate your first project
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/5">
                <th className="text-left py-3 px-4 font-medium">Project</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Input</th>
                <th className="text-left py-3 px-4 font-medium">Created</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {jobs.map((job) => {
                  const jobId = job.id || job.$id || job.job_id
                  const status = job.status || 'queued'
                  const StatusIcon = statusIcons[status] || Clock
                  const repoName = job.repo_name || job.repoName || 'Untitled'
                  const inputType = job.input_type || job.inputType || 'text'
                  const githubUrl = job.github_url || job.githubUrl
                  const zipFileId = job.zip_file_id || job.zipFileId
                  const createdAt = job.created_at || job.$createdAt || job.createdAt

                  return (
                    <motion.tr
                      key={jobId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)', x: 4 }}
                      onClick={() => navigate(`/job/${jobId}`)}
                      className="border-b border-white/5 cursor-pointer transition-colors"
                      style={{ borderLeft: `2px solid transparent` }}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-white hover:text-blue-400 transition-colors">
                          {repoName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusColors[status]}`}>
                          <StatusIcon size={10} className={status === 'running' ? 'animate-pulse' : ''} />
                          {status.toUpperCase()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {inputType === 'text' ? (
                          <MessageSquare size={14} className="text-white/30" />
                        ) : (
                          <FileText size={14} className="text-white/30" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-white/40">
                        {createdAt ? relativeTime(createdAt) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {githubUrl && (
                            <a href={githubUrl} target="_blank" rel="noreferrer" className="p-1.5 text-white/30 hover:text-white transition-colors" title="Open GitHub">
                              <ExternalLink size={14} />
                            </a>
                          )}
                          {zipFileId && (
                            <a href={`/api/downloads/${jobId}`} className="p-1.5 text-white/30 hover:text-white transition-colors" title="Download ZIP">
                              <Download size={14} />
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(jobId)}
                            disabled={deleting === jobId}
                            className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} className={deleting === jobId ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
