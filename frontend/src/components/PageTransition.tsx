import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

/**
 * Wrap a page's root element with this to get a consistent
 * fade-in on route enter and fade-out on route leave.
 */
export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  )
}
