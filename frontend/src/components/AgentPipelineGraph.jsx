import { useEffect, useMemo } from 'react'
import {
  ReactFlow, Background, useNodesState, useEdgesState,
  Handle, Position, MarkerType
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Lottie from 'lottie-react'
import agentRunningAnim from '../animations/agent-running.json'
import agentDoneAnim from '../animations/agent-done.json'
import agentFailedAnim from '../animations/agent-failed.json'
import codeGenAnim from '../animations/code-gen.json'

const AGENT_CONFIG = {
  analyst:        { label: 'Analyst',    icon: '🔍', accent: '#3b82f6' },
  architect:      { label: 'Architect',  icon: '🏗️', accent: '#8b5cf6' },
  frontend_agent: { label: 'Frontend',   icon: '🖥️', accent: '#06b6d4' },
  backend_agent:  { label: 'Backend',    icon: '⚙️', accent: '#f59e0b' },
  business_agent: { label: 'Business',   icon: '📄', accent: '#ec4899' },
  integrator:     { label: 'Integrator', icon: '🔗', accent: '#3b82f6' },
  validator:      { label: 'Validator',  icon: '✅', accent: '#22c55e' },
  github_agent:   { label: 'GitHub',     icon: '🐙', accent: '#ffffff' },
}

function getPosition(agentKey) {
  const positions = {
    analyst:        { x: 195, y: 0   },
    architect:      { x: 195, y: 110 },
    frontend_agent: { x: 30,  y: 230 },
    business_agent: { x: 195, y: 230 },
    backend_agent:  { x: 360, y: 230 },
    integrator:     { x: 195, y: 360 },
    validator:      { x: 195, y: 470 },
    github_agent:   { x: 195, y: 580 },
  }
  return positions[agentKey] || { x: 195, y: 0 }
}

function AgentNode({ data }) {
  const { agentKey, label, icon, accent, status, message, fileCount, onClick } = data

  const lottieAnim = status === 'running'
    ? (agentKey === 'frontend_agent' || agentKey === 'backend_agent' ? codeGenAnim : agentRunningAnim)
    : status === 'done' ? agentDoneAnim
    : status === 'failed' ? agentFailedAnim
    : null

  const borderClass = {
    idle:    'border-white/10',
    running: 'border-2',
    done:    'border-green-500/50',
    failed:  'border-red-500/50',
    queued:  'border-amber-500/30',
  }[status] || 'border-white/10'

  return (
    <div
      onClick={onClick}
      className={`
        relative w-[120px] h-[76px] rounded-xl cursor-pointer
        bg-[rgba(255,255,255,0.03)] backdrop-blur-sm
        border ${borderClass}
        transition-all duration-300
        hover:bg-[rgba(255,255,255,0.06)]
        ${status === 'running' ? 'shadow-lg' : ''}
      `}
      style={status === 'running' ? { borderColor: accent, boxShadow: `0 0 20px ${accent}30` } : {}}
    >
      {status === 'running' && (
        <div
          className="absolute inset-0 rounded-xl agent-running-ring"
          style={{ border: `1px solid ${accent}` }}
        />
      )}

      <Handle type="target" position={Position.Top} className="opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="opacity-0 !w-2 !h-2" />

      <div className="flex flex-col items-center justify-center h-full px-2 gap-1">
        <div className="flex items-center gap-1.5 w-full">
          {lottieAnim ? (
            <div className="w-6 h-6 flex-shrink-0">
              <Lottie
                animationData={lottieAnim}
                loop={status === 'running'}
                autoplay={true}
                style={{ width: 24, height: 24 }}
              />
            </div>
          ) : (
            <span className="text-sm flex-shrink-0" style={{ opacity: status === 'idle' ? 0.2 : 0.8 }}>
              {icon}
            </span>
          )}
          <span
            className="text-[11px] font-semibold tracking-wide truncate"
            style={{
              color: status === 'idle' ? 'rgba(255,255,255,0.2)'
                : status === 'done' ? '#22c55e'
                : status === 'failed' ? '#ef4444'
                : '#ffffff'
            }}
          >
            {label}
          </span>
          {status === 'done' && fileCount > 0 && (
            <span className="ml-auto text-[9px] bg-white/10 text-white/60 px-1 rounded">
              {fileCount}
            </span>
          )}
        </div>

        <div className="w-full">
          {status === 'idle' && (
            <p className="text-[9px] text-white/15 text-center">Waiting</p>
          )}
          {(status === 'running' || status === 'queued') && message && (
            <p className="text-[9px] text-white/50 text-center truncate leading-tight">
              {message}
            </p>
          )}
          {status === 'done' && (
            <p className="text-[9px] text-green-400/70 text-center">Complete</p>
          )}
          {status === 'failed' && (
            <p className="text-[9px] text-red-400/70 text-center truncate">Failed</p>
          )}
        </div>
      </div>
    </div>
  )
}

const EDGE_PAIRS = [
  ['analyst', 'architect'],
  ['architect', 'frontend_agent'],
  ['architect', 'business_agent'],
  ['architect', 'backend_agent'],
  ['frontend_agent', 'integrator'],
  ['business_agent', 'integrator'],
  ['backend_agent', 'integrator'],
  ['integrator', 'validator'],
  ['validator', 'github_agent'],
]

export default function AgentPipelineGraph({ agentStates, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    const newNodes = Object.entries(AGENT_CONFIG).map(([key, cfg]) => {
      const state = agentStates[key] || {}
      return {
        id: key,
        type: 'agentNode',
        position: getPosition(key),
        data: {
          agentKey: key,
          label: cfg.label,
          icon: cfg.icon,
          accent: cfg.accent,
          status: state.status || 'idle',
          message: state.message || '',
          fileCount: state.files?.length || 0,
          onClick: () => onNodeClick?.(key),
        },
        draggable: false,
        selectable: true,
      }
    })
    setNodes(newNodes)
  }, [agentStates])

  useEffect(() => {
    const newEdges = EDGE_PAIRS.map(([src, tgt]) => {
      const srcStatus = agentStates[src]?.status || 'idle'
      const isActive = srcStatus === 'done' || srcStatus === 'running'
      const accent = AGENT_CONFIG[src]?.accent || '#3b82f6'
      return {
        id: `${src}-${tgt}`,
        source: src,
        target: tgt,
        type: 'smoothstep',
        animated: isActive,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: srcStatus === 'done' ? accent
            : srcStatus === 'running' ? 'rgba(59,130,246,0.5)'
            : 'rgba(255,255,255,0.15)',
        },
        style: {
          stroke: srcStatus === 'done' ? accent
            : srcStatus === 'running' ? 'rgba(59,130,246,0.5)'
            : 'rgba(255,255,255,0.08)',
          strokeWidth: isActive ? 1.5 : 1,
          strokeDasharray: srcStatus === 'idle' ? '4 3' : undefined,
        },
      }
    })
    setEdges(newEdges)
  }, [agentStates])

  const nodeTypes = useMemo(() => ({ agentNode: AgentNode }), [])

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 700 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_event, node) => onNodeClick?.(node.id)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        className="!bg-transparent"
      >
        <Background
          color="rgba(255,255,255,0.03)"
          gap={24}
          size={1}
          variant="dots"
        />
      </ReactFlow>
    </div>
  )
}
