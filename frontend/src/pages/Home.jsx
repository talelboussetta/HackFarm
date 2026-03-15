import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload, MessageSquare, Terminal, ChevronRight, Wand2, Github } from 'lucide-react'
import Button from '../components/Button'

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [file, setFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const navigate = useNavigate()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => setFile(acceptedFiles[0])
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsUploading(true)
    
    // API call placeholder
    // In reality, this will call POST /api/jobs
    try {
      const formData = new FormData()
      formData.append('repo_name', 'my-hackathon-app') // placeholder
      if (file) formData.append('file', file)
      else if (prompt) formData.append('prompt', prompt)
      
      // Navigate to a fake job ID for now to show the UI
      setTimeout(() => {
        navigate('/job/placeholder-id')
      }, 1500)
    } catch (err) {
      console.error(err)
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 py-12">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent"
        >
          Build Your Vision. <br />
          <span className="text-blue-500">Faster Than Ever.</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl text-white/40 max-w-2xl mx-auto"
        >
          Transform hackathon specs and ideas into fully functional codebases with our multi-agent AI pipeline.
        </motion.p>
      </section>

      {/* Main Action Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Spec Upload */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Upload size={24} />
            </div>
            <h3 className="text-xl font-semibold">Upload Spec</h3>
          </div>
          
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
              isDragActive ? 'border-blue-500 bg-blue-500/5' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-2">
                <p className="text-blue-400 font-medium">{file.name}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-xs text-white/40 hover:text-white"
                >
                  Change file
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="text-white/40" />
                </div>
                <div className="space-y-1">
                  <p className="text-white/80">Drop your PDF or DOCX here</p>
                  <p className="text-sm text-white/40">or click to browse</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right: Text Prompt */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-xl font-semibold">Describe Idea</h3>
          </div>
          
          <div className="relative h-[200px]">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g. Build a SaaS platform for real-time collaborative code reviews with integrated AI feedback..."
              className="w-full h-full bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
            <div className="absolute bottom-4 right-4 text-xs text-white/20">
              Markdown supported
            </div>
          </div>
        </motion.div>
      </div>

      {/* Submission Footer */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center gap-6"
      >
        <Button 
          onClick={handleSubmit}
          variant="primary" 
          size="lg" 
          className="w-full max-w-md gap-3 py-6 text-xl rounded-2xl shadow-xl shadow-blue-600/20"
          loading={isUploading}
          disabled={!file && !prompt.trim()}
        >
          <Wand2 size={24} />
          Generate Project
          <ChevronRight size={20} className="ml-1 opacity-50" />
        </Button>
        
        <div className="flex items-center gap-8 text-white/30 text-sm">
          <div className="flex items-center gap-2">
            <Terminal size={14} />
            <span>Full CLI Integration</span>
          </div>
          <div className="flex items-center gap-2">
            <Github size={14} />
            <span>Auto GitHub Push</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
