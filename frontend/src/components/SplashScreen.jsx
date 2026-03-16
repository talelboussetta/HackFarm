import { motion } from 'framer-motion'

export default function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          fontFamily: "'Syne', 'Space Grotesk', sans-serif",
          fontWeight: 800,
          fontSize: 48,
          color: '#c9a84c',
          letterSpacing: '-0.02em',
          userSelect: 'none',
        }}
      >
        HF
      </motion.span>
      <span style={{
        fontFamily: "'Outfit', 'DM Sans', sans-serif",
        fontWeight: 300,
        fontSize: 14,
        color: 'rgba(255,255,255,0.2)',
        marginTop: 16,
      }}>
        Loading...
      </span>
    </div>
  )
}
