import { Link } from 'react-router-dom'
import IdraWordmark from '@/components/IdraWordmark'

export default function LandingFooter() {
  return (
    <footer
      style={{
        background: '#000000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >

      {/* Giant "IDRA" wordmark
          Width is locked to 90vw. Height follows from aspect ratio,
          so height scales with the viewport. Padding above/below gives breathing
          room that also scales with the viewport — no fixed screen height needed. */}
      <div
        aria-hidden="true"
        style={{
          padding: '8vw 0 6vw',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <IdraWordmark
          color="#ffffff"
          style={{ width: '90vw', height: 'auto' }}
        />
      </div>
      {/* Bottom bar — always at the natural bottom of the footer */}
      <div
        className="max-w-[1100px] px-5 sm:px-10 py-6 border-t border-neutral-600"
        style={{
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="IDRA" className="h-7 w-auto object-contain" />
          <IdraWordmark color="#ffffff" height={18} />
        </Link>
        <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>
          &copy; {new Date().getFullYear()} IDRA. Built for Nigerian founders and freelancers.
        </p>
      </div>

    </footer>
  )
}
