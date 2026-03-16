import { useMemo } from 'react'
import { motion } from 'framer-motion'

export default function ParticleField({ color = '#3b82f6', count = 40, speed = 1 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: (8 + Math.random() * 12) / speed,
      delay: Math.random() * -15,
      opacity: 0.1 + Math.random() * 0.3,
      driftX: (Math.random() - 0.5) * 60,
    }))
  }, [count, speed])

  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {particles.map(p => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: p.opacity,
            willChange: 'transform',
          }}
          initial={{ y: '100vh', x: 0 }}
          animate={{
            y: '-20px',
            x: [0, p.driftX / 2, p.driftX, p.driftX / 2, 0],
          }}
          transition={{
            y: { duration: p.duration, delay: p.delay, repeat: Infinity, repeatType: 'loop', ease: 'linear' },
            x: { duration: p.duration, delay: p.delay, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' },
          }}
        />
      ))}
    </div>
  )
}
