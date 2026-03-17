import { motion } from 'framer-motion'

const illustrations = {
  projects: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="30" width="80" height="60" rx="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.3" />
      <path d="M45 55L55 65L75 45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <circle cx="60" cy="20" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <circle cx="30" cy="100" r="4" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <circle cx="95" cy="95" r="3" stroke="currentColor" strokeWidth="1" opacity="0.15" />
    </svg>
  ),
  keys: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="45" cy="55" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.3" />
      <path d="M58 68L90 68" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M80 68L80 58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M90 68L90 58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <circle cx="45" cy="55" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  ),
  files: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M35 25H70L85 40V95H35V25Z" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.3" />
      <path d="M70 25V40H85" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path d="M50 55H70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
      <path d="M50 65H75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
      <path d="M50 75H65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  ),
  rocket: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 20C60 20 45 45 45 70C45 80 52 90 60 95C68 90 75 80 75 70C75 45 60 20 60 20Z" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="60" cy="58" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path d="M45 70L30 80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M75 70L90 80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <path d="M55 95L55 105" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.2" />
      <path d="M60 95L60 110" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.2" />
      <path d="M65 95L65 105" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.2" />
    </svg>
  ),
}

export default function EmptyState({ icon = 'projects', title, description, action, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-white/20 mb-6"
      >
        {illustrations[icon] || illustrations.projects}
      </motion.div>

      <h3 className="text-lg font-semibold text-white/70 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-white/40 max-w-sm mb-6 leading-relaxed">{description}</p>
      )}
      {action && <div>{action}</div>}
    </motion.div>
  )
}
