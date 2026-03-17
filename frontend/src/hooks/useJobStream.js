import { appwriteClient, databases } from '../lib/appwrite'
import { Query } from 'appwrite'
import { useState, useEffect, useRef } from 'react'

export function useJobStream(jobId) {
  const [agentStates, setAgentStates] = useState({})
  const [jobStatus, setJobStatus] = useState('running')
  const [result, setResult] = useState(null)
  const [businessContent, setBusinessContent] = useState({})
  const unsubRef = useRef(null)

  useEffect(() => {
    if (!jobId) return
    const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID

    // 1. Replay past events (page refresh recovery)
    databases.listDocuments(dbId, 'job-events', [
      Query.equal('jobId', jobId),
      Query.orderAsc('$createdAt'),
      Query.limit(200)
    ]).then(res => res.documents.forEach(d => {
      try { handleEvent(d.eventType, JSON.parse(d.payload)) } catch(e) { }
    }))

    // 2. Subscribe to live events via Appwrite Realtime
    unsubRef.current = appwriteClient.subscribe(
      `databases.${dbId}.collections.job-events.documents`,
      response => {
        if (!response.events.some(e => e.includes('.create'))) return
        const doc = response.payload
        if (doc.jobId !== jobId) return
        try { handleEvent(doc.eventType, JSON.parse(doc.payload)) } catch(e) { }
      }
    )
    return () => unsubRef.current?.()
  }, [jobId])

  function handleEvent(type, payload) {
    const agentTypes = ['agent_start','agent_thinking','agent_done','agent_failed']
    if (agentTypes.includes(type)) {
      setAgentStates(prev => {
        const existing = prev[payload.agent] || {}
        const newState = {
          status: type === 'agent_start' ? 'running'
                : type === 'agent_done' ? 'done'
                : type === 'agent_failed' ? 'failed' : 'running',
          message: payload.message || payload.summary || payload.error || '',
          files: payload.files_generated || existing.files || [],
          // Carry rich data from agent_done payloads
          agentData: type === 'agent_done' ? { ...payload } : (existing.agentData || null),
        }
        return { ...prev, [payload.agent]: newState }
      })
      if (type === 'agent_done' && payload.agent === 'business_agent') {
        setBusinessContent({
          readme_content: payload.readme_content || '',
          architecture_mermaid: payload.architecture_mermaid || '',
          pitch_slides: payload.pitch_slides || [],
        })
      }
    }
    if (type === 'job_refining') {
      // Reset all agent states for a new refinement run
      setAgentStates({})
      setJobStatus('running')
      setResult(null)
    }
    if (type === 'job_complete') { setJobStatus('complete'); setResult(payload) }
    if (type === 'job_failed')   { setJobStatus('failed'); setResult(payload) }
  }

  return { agentStates, jobStatus, result, businessContent }
}
