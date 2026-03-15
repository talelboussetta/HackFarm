import { appwriteClient, databases } from '../lib/appwrite'
import { Query } from 'appwrite'
import { useState, useEffect, useRef } from 'react'

export function useJobStream(jobId) {
  const [agentStates, setAgentStates] = useState({})
  const [jobStatus, setJobStatus] = useState('running')
  const [result, setResult] = useState(null)
  const unsubRef = useRef(null)

  useEffect(() => {
    if (!jobId) return
    const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID

    // 1. Replay past events (page refresh recovery)
    databases.listDocuments(dbId, 'job-events', [
      Query.equal('job_id', jobId),
      Query.orderAsc('$createdAt'),
      Query.limit(200)
    ]).then(res => res.documents.forEach(d => handleEvent(d.event_type, JSON.parse(d.payload))))

    // 2. Subscribe to live events via Appwrite Realtime
    unsubRef.current = appwriteClient.subscribe(
      `databases.${dbId}.collections.job-events.documents`,
      response => {
        if (!response.events.some(e => e.includes('.create'))) return
        const doc = response.payload
        if (doc.job_id !== jobId) return
        handleEvent(doc.event_type, JSON.parse(doc.payload))
      }
    )
    return () => unsubRef.current?.()
  }, [jobId])

  function handleEvent(type, payload) {
    const agentTypes = ['agent_start','agent_thinking','agent_done','agent_failed']
    if (agentTypes.includes(type)) {
      setAgentStates(prev => ({
        ...prev,
        [payload.agent]: {
          status: type === 'agent_start' ? 'running'
                : type === 'agent_done' ? 'done'
                : type === 'agent_failed' ? 'failed' : 'running',
          message: payload.message || payload.summary || '',
          files: payload.files_generated || []
        }
      }))
    }
    if (type === 'job_complete') { setJobStatus('complete'); setResult(payload) }
    if (type === 'job_failed')   { setJobStatus('failed') }
  }

  return { agentStates, jobStatus, result }
}
