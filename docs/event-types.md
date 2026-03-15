# SSE Event Type Reference

All events: {type, payload, job_id, timestamp}

agent_start
  payload: {agent: string, message: string, estimated_seconds: int}

agent_thinking
  payload: {agent: string, message: string}

agent_done
  payload: {agent: string, summary: string, files_generated?: string[]}

agent_failed
  payload: {agent: string, error: string, retry_count: int}

job_complete
  payload: {github_url: string, zip_path: string, file_count: int,
            validation_score: int, total_seconds: int}

job_failed
  payload: {error: string, last_agent: string}

job_queued
  payload: {position: int, message: string}

heartbeat
  payload: {active_agents: string[]}