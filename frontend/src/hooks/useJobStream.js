import { appwriteClient, databases } from "../lib/appwrite";
import { Query } from "appwrite";
import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";

export function useJobStream(jobId) {
  const [agentStates, setAgentStates] = useState({});
  const [jobStatus, setJobStatus] = useState("running");
  const [result, setResult] = useState(null);
  const [businessContent, setBusinessContent] = useState({});
  const unsubRef = useRef(null);
  const lastDocIdRef = useRef(null);
  const pollTimerRef = useRef(null);
  const jobStatusRef = useRef("running");

  useEffect(() => {
    if (!jobId) return;
    const dbId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

    // 1. Replay past events (page refresh recovery)
    databases
      .listDocuments(dbId, "job-events", [
        Query.equal("jobId", jobId),
        Query.orderAsc("$createdAt"),
        Query.limit(200),
      ])
      .then((res) => {
        res.documents.forEach((d) => {
          try {
            handleEvent(d.eventType, JSON.parse(d.payload));
            lastDocIdRef.current = d.$id;
          } catch (e) {
            // ignore parse/handler errors when replaying history
          }
        });
      });
    // Ensure we hydrate completion payload even when event history exceeds replay window
    databases
      .listDocuments(dbId, "job-events", [
        Query.equal("jobId", jobId),
        Query.equal("eventType", "job_complete"),
        Query.orderDesc("$createdAt"),
        Query.limit(1),
      ])
      .then((res) => {
        const latest = res.documents?.[0];
        if (!latest) return;
        try {
          handleEvent(latest.eventType, JSON.parse(latest.payload));
          lastDocIdRef.current = latest.$id;
        } catch (e) {
          // ignore malformed completion payloads
        }
      });

    // 2. Subscribe to live events via Appwrite Realtime
    try {
      unsubRef.current = appwriteClient.subscribe(
        `databases.${dbId}.collections.job-events.documents`,
        (response) => {
          if (!response.events.some((e) => e.includes(".create"))) return;
          const doc = response.payload;
          if (doc.jobId !== jobId) return;
          try {
            handleEvent(doc.eventType, JSON.parse(doc.payload));
            lastDocIdRef.current = doc.$id;
          } catch (e) {
            // ignore malformed realtime payloads
          }
        },
      );
    } catch (e) {
      Sentry.captureMessage("Realtime WebSocket fallback to polling", {
        level: "warning",
        tags: { jobId, reason: "websocket_failed" },
      });
    }
    // 3. Fallback poller in case Realtime drops (keeps graph live without user interaction)
    pollTimerRef.current = setInterval(async () => {
      // stop polling once job is finished or failed
      if (
        jobStatusRef.current === "complete" ||
        jobStatusRef.current === "failed"
      )
        return;
      try {
        const queries = [
          Query.equal("jobId", jobId),
          Query.orderAsc("$createdAt"),
          Query.limit(100),
        ];
        if (lastDocIdRef.current) {
          queries.push(Query.cursorAfter(lastDocIdRef.current));
        }
        const res = await databases.listDocuments(dbId, "job-events", queries);
        res.documents.forEach((d) => {
          try {
            handleEvent(d.eventType, JSON.parse(d.payload));
            lastDocIdRef.current = d.$id;
          } catch (e) {
            // ignore parse/handler errors when replaying history
          }
        });
      } catch (err) {
        // Swallow poll errors; Realtime will likely still be active
      }
    }, 2500);

    return () => {
      unsubRef.current?.();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [jobId]);

  function handleEvent(type, payload) {
    const agentTypes = [
      "agent_start",
      "agent_thinking",
      "agent_done",
      "agent_failed",
    ];
    if (agentTypes.includes(type)) {
      setAgentStates((prev) => {
        const existing = prev[payload.agent] || {};
        const newState = {
          status:
            type === "agent_start"
              ? "running"
              : type === "agent_done"
                ? "done"
                : type === "agent_failed"
                  ? "failed"
                  : "running",
          message: payload.message || payload.summary || payload.error || "",
          files: payload.files_generated || existing.files || [],
          // Carry rich data from agent_done payloads
          agentData:
            type === "agent_done" ? { ...payload } : existing.agentData || null,
        };
        return { ...prev, [payload.agent]: newState };
      });
      if (type === "agent_done" && payload.agent === "business_agent") {
        setBusinessContent({
          readme_content: payload.readme_content || "",
          architecture_mermaid: payload.architecture_mermaid || "",
          pitch_slides: payload.pitch_slides || [],
        });
      }
    }
    if (type === "job_refining") {
      // Reset all agent states for a new refinement run
      setAgentStates({});
      setJobStatus("running");
      setResult(null);
      jobStatusRef.current = "running";
    }
    if (type === "job_complete") {
      setJobStatus("complete");
      setResult(payload);
      // If Realtime missed business_agent, hydrate from completion payload
      setBusinessContent((prev) => ({
        readme_content: payload.readme_content || prev.readme_content || "",
        architecture_mermaid:
          payload.architecture_mermaid || prev.architecture_mermaid || "",
        pitch_slides: payload.pitch_slides || prev.pitch_slides || [],
      }));
      jobStatusRef.current = "complete";
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
    if (type === "job_failed") {
      setJobStatus("failed");
      setResult(payload);
      jobStatusRef.current = "failed";
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }

  return { agentStates, jobStatus, result, businessContent };
}
