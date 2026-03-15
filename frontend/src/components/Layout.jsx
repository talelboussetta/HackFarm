import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout({ children }) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30">
      <Navbar />
      
      {/* Background radial gradients for premium feel */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] bg-green-600/5 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
