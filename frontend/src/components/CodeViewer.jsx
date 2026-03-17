import { useState, useEffect, useRef } from 'react'
import { Copy, Check, ChevronRight, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import hljs from 'highlight.js/lib/core'

// Register only common languages to keep bundle small
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import sql from 'highlight.js/lib/languages/sql'
import dockerfile from 'highlight.js/lib/languages/dockerfile'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('dockerfile', dockerfile)
// Aliases
hljs.registerLanguage('jsx', javascript)
hljs.registerLanguage('tsx', typescript)
hljs.registerLanguage('py', python)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('md', markdown)

const EXT_TO_LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python',
  css: 'css', scss: 'css',
  html: 'html', htm: 'html', svg: 'xml', xml: 'xml',
  json: 'json',
  md: 'markdown',
  sh: 'bash', bash: 'bash',
  yml: 'yaml', yaml: 'yaml',
  sql: 'sql',
  dockerfile: 'dockerfile',
  txt: null, env: null, gitignore: null,
}

function getLang(filepath) {
  const name = filepath.split('/').pop().toLowerCase()
  if (name === 'dockerfile') return 'dockerfile'
  if (name === '.gitignore' || name === '.env' || name === '.env.example') return null
  const ext = name.split('.').pop()
  return EXT_TO_LANG[ext] ?? null
}

const FILE_ICONS = {
  js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
  py: '🐍', css: '🎨', html: '🌐', json: '📋',
  md: '📝', yml: '⚙️', yaml: '⚙️', sql: '🗃️',
  sh: '💻', env: '🔒', gitignore: '👁️',
}

function getFileIcon(filepath) {
  const name = filepath.split('/').pop().toLowerCase()
  if (name === 'dockerfile') return '🐳'
  if (name === 'readme.md') return '📖'
  if (name === 'requirements.txt' || name === 'package.json') return '📦'
  const ext = name.split('.').pop()
  return FILE_ICONS[ext] || '📄'
}

// Build tree structure from flat file list
function buildTree(files) {
  const root = { name: '', children: {}, files: [] }
  for (const f of files) {
    const parts = f.path.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children[parts[i]]) {
        node.children[parts[i]] = { name: parts[i], children: {}, files: [] }
      }
      node = node.children[parts[i]]
    }
    node.files.push(f)
  }
  return root
}

function TreeNode({ node, depth = 0, selectedFile, onSelect }) {
  const [open, setOpen] = useState(depth < 2)
  const dirs = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name))
  const files = [...node.files].sort((a, b) => a.path.localeCompare(b.path))

  return (
    <div>
      {node.name && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 w-full px-2 py-1 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="text-blue-400/60">📁</span>
          <span className="truncate">{node.name}</span>
        </button>
      )}
      {(node.name ? open : true) && (
        <>
          {dirs.map(d => (
            <TreeNode key={d.name} node={d} depth={depth + (node.name ? 1 : 0)} selectedFile={selectedFile} onSelect={onSelect} />
          ))}
          {files.map(f => {
            const name = f.path.split('/').pop()
            const isSelected = selectedFile === f.path
            return (
              <button
                key={f.path}
                onClick={() => onSelect(f.path)}
                className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded transition-colors ${
                  isSelected
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
                style={{ paddingLeft: `${(depth + (node.name ? 1 : 0)) * 12 + 8}px` }}
                title={f.path}
              >
                <span>{getFileIcon(f.path)}</span>
                <span className="truncate">{name}</span>
                <span className="ml-auto text-[10px] text-white/20">
                  {f.size > 1024 ? `${(f.size / 1024).toFixed(1)}k` : `${f.size}b`}
                </span>
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}

export default function CodeViewer({ jobId, jobStatus }) {
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const contentCache = useRef({})
  const codeRef = useRef(null)
  const listAttemptsRef = useRef(0)

  // Fetch file list when job is complete
  useEffect(() => {
    if (jobStatus !== 'complete' && jobStatus !== 'completed') return
    let cancelled = false
    const attempt = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/jobs/${jobId}/files`, { credentials: 'include' })
        if (!res.ok) throw new Error('list failed')
        const data = await res.json()
        if (cancelled) return
        setFiles(data.files || [])
        setFileError(null)
        if (data.files?.length > 0) {
          setSelectedFile(data.files[0].path)
        }
      } catch (e) {
        setFileError('Files not ready yet — retrying...')
        listAttemptsRef.current += 1
        const delay = Math.min(2000 * listAttemptsRef.current, 8000)
        setTimeout(() => attempt(), delay)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    attempt()
    return () => { cancelled = true }
  }, [jobId, jobStatus])

  // Fetch file content when selection changes
  useEffect(() => {
    if (!selectedFile) return
    if (contentCache.current[selectedFile]) {
      setContent(contentCache.current[selectedFile])
      return
    }
    setFileLoading(true)
    fetch(`/api/jobs/${jobId}/files/${selectedFile}`, { credentials: 'include' })
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(text => {
        contentCache.current[selectedFile] = text
        setContent(text)
      })
      .catch(() => {
        setContent('// Failed to load file content')
        toast.error('Failed to load file')
      })
      .finally(() => setFileLoading(false))
  }, [selectedFile, jobId])

  // Highlight code
  useEffect(() => {
    if (!codeRef.current || !content || fileLoading) return
    const lang = getLang(selectedFile || '')
    if (lang) {
      try {
        const result = hljs.highlight(content, { language: lang })
        codeRef.current.innerHTML = result.value
      } catch {
        codeRef.current.textContent = content
      }
    } else {
      codeRef.current.textContent = content
    }
  }, [content, selectedFile, fileLoading])

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const [copied, setCopied] = useState(false)
  const tree = buildTree(files)
  const lines = content.split('\n')

  if (jobStatus !== 'complete' && jobStatus !== 'completed') {
    return (
      <div className="flex items-center justify-center h-full text-white/30 text-sm gap-2">
        <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
        Code preview available when job completes
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (fileError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40 text-sm gap-3">
        <div className="w-5 h-5 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
        <p>{fileError}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden rounded-lg border border-white/10">
      {/* File tree sidebar */}
      <div className="w-[240px] min-w-[200px] border-r border-white/10 overflow-y-auto bg-black/30">
        <div className="px-3 py-2 text-[10px] font-bold text-white/30 uppercase tracking-wider border-b border-white/5">
          Files ({files.length})
        </div>
        <div className="py-1">
          <TreeNode node={tree} selectedFile={selectedFile} onSelect={setSelectedFile} />
        </div>
      </div>

      {/* Code panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
        {selectedFile ? (
          <>
            {/* File header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{getFileIcon(selectedFile)}</span>
                <span className="text-xs text-white/60 truncate font-mono">{selectedFile}</span>
                <span className="text-[10px] text-white/20">{lines.length} lines</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/40 hover:text-white/80 bg-white/5 hover:bg-white/10 rounded transition-colors"
                  title="Copy file content"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Code content */}
            <div className="flex-1 overflow-auto">
              {fileLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex text-xs font-mono leading-5">
                  {/* Line numbers */}
                  <div className="select-none text-right pr-3 pl-3 py-3 text-white/15 border-r border-white/5 bg-black/20 sticky left-0">
                    {lines.map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  {/* Code */}
                  <pre className="flex-1 p-3 overflow-x-auto">
                    <code ref={codeRef} className="hljs">
                      {content}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-white/20 text-sm">
            ← Select a file to view its content
          </div>
        )}
      </div>
    </div>
  )
}
