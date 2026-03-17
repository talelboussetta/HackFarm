import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Users, Zap, TrendingUp, CheckCircle2, XCircle, Clock, Activity, AlertTriangle } from 'lucide-react'

const CARD = ({ icon: Icon, label, value, sub, color = 'blue' }) => {
  const colors = {
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    red: 'text-red-400 bg-red-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
  }
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-bold font-heading">{value ?? '—'}</div>
      {sub && <div className="text-xs text-white/30 mt-1">{sub}</div>}
    </div>
  )
}

const BAR = ({ label, value, max, color = '#3b82f6' }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs">
      <span className="text-white/60 truncate max-w-[140px]">{label}</span>
      <span className="text-white/40">{value}</span>
    </div>
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${max ? (value / max) * 100 : 0}%` }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  </div>
)

const AGENT_COLORS = {
  analyst: '#8b5cf6',
  architect: '#3b82f6',
  frontend_agent: '#06b6d4',
  backend_agent: '#10b981',
  business_agent: '#f59e0b',
  integrator: '#f97316',
  validator: '#ec4899',
  github_agent: '#6366f1',
}

export default function Admin() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(r => {
        if (r.status === 403) throw new Error('Admin access required. Set ADMIN_USER_IDS in backend .env')
        if (!r.ok) throw new Error('Failed to load stats')
        return r.json()
      })
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/30">
      <Activity size={20} className="animate-pulse mr-2" /> Loading analytics…
    </div>
  )

  if (error) return (
    <div className="max-w-lg mx-auto mt-20 p-6 rounded-2xl border border-red-400/20 bg-red-400/5 text-center space-y-2">
      <AlertTriangle size={32} className="text-red-400 mx-auto" />
      <p className="text-white font-semibold">Access Denied</p>
      <p className="text-sm text-white/50">{error}</p>
    </div>
  )

  const j = stats.jobs
  const maxDailyCount = Math.max(...(stats.daily_volume || []).map(d => d.count), 1)
  const agentEntries = Object.entries(stats.agents || {})
  const maxAgentDur = Math.max(...agentEntries.map(([, v]) => v.avg_duration_s), 1)

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-heading">Platform Analytics</h1>
        <p className="text-sm text-white/40 mt-1">Admin view — real-time platform metrics</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CARD icon={BarChart3} label="Total Jobs" value={j.total} color="blue" />
        <CARD icon={Users} label="Active Users" value={stats.users.active_this_month} sub="last 30 days" color="purple" />
        <CARD icon={CheckCircle2} label="Success Rate" value={`${j.success_rate}%`} sub={`${j.completed} completed`} color="green" />
        <CARD icon={XCircle} label="Failed Jobs" value={j.failed} sub={`${j.running} running now`} color="red" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <CARD icon={TrendingUp} label="Today" value={j.today} color="amber" />
        <CARD icon={TrendingUp} label="This Week" value={j.this_week} color="blue" />
        <CARD icon={TrendingUp} label="This Month" value={j.this_month} color="purple" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily volume chart */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <BarChart3 size={14} /> Jobs per day (last 7 days)
          </h3>
          <div className="space-y-3">
            {(stats.daily_volume || []).map(d => (
              <BAR key={d.date} label={d.date.slice(5)} value={d.count} max={maxDailyCount} color="#3b82f6" />
            ))}
          </div>
        </div>

        {/* Popular keywords */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <Zap size={14} /> Popular project keywords
          </h3>
          {(stats.popular_keywords || []).length === 0 ? (
            <p className="text-xs text-white/20 italic">No completed jobs yet</p>
          ) : (
            <div className="space-y-3">
              {stats.popular_keywords.map((kw, i) => (
                <BAR key={kw.word} label={kw.word} value={kw.count}
                  max={stats.popular_keywords[0]?.count || 1}
                  color={`hsl(${(i * 37) % 360}, 70%, 60%)`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agent performance */}
      {agentEntries.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
            <Clock size={14} /> Agent performance (last 200 runs)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 border-b border-white/5">
                  <th className="text-left py-2 pr-4">Agent</th>
                  <th className="text-right py-2 px-4">Runs</th>
                  <th className="text-right py-2 px-4">Avg Duration</th>
                  <th className="text-right py-2 px-4">Failures</th>
                  <th className="py-2 pl-4">Speed</th>
                </tr>
              </thead>
              <tbody>
                {agentEntries
                  .sort((a, b) => b[1].avg_duration_s - a[1].avg_duration_s)
                  .map(([name, data]) => (
                    <tr key={name} className="border-b border-white/5 last:border-0">
                      <td className="py-2 pr-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: `${AGENT_COLORS[name] || '#555'}22`, color: AGENT_COLORS[name] || '#aaa' }}>
                          {name}
                        </span>
                      </td>
                      <td className="text-right py-2 px-4 text-white/60">{data.runs}</td>
                      <td className="text-right py-2 px-4 text-white/60">{data.avg_duration_s}s</td>
                      <td className="text-right py-2 px-4 text-red-400/70">{data.failures || '—'}</td>
                      <td className="py-2 pl-4 w-32">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(data.avg_duration_s / maxAgentDur) * 100}%` }}
                            transition={{ duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: AGENT_COLORS[name] || '#555' }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
