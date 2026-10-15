import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const BRAND = '#c026d3'

/* Map each nav item to the section id it corresponds to */
const NAV_ITEMS = [
  { label: 'Product',      href: '#product'     },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Trust',        href: '#trust'        },
  { label: 'AI Ledger',    href: '#ai-ledger'    },
]

/* IDs we observe */
const SECTION_IDS = ['product', 'how-it-works', 'ai-ledger', 'trust']

export default function LandingNav() {
  /* Default to 'product' — hero is visible before any scroll */
  const [activeId, setActiveId] = useState<string>('product')

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    SECTION_IDS.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(id)
        },
        {
          /* Section is "active" once its top edge crosses the middle of the viewport */
          rootMargin: '-40% 0px -55% 0px',
          threshold: 0,
        }
      )

      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach(o => o.disconnect())
  }, [])

  return (
    <nav className="sticky top-0 z-40 bg-white py-6">
      <div className="max-w-[95%] mx-auto sm:px-10 h-[60px] flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.png" alt="FOID" className="h-9 w-auto object-contain" />
          <span
            className="font-extrabold font-machina"
            style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.4px', color: '#18181b' }}
          >
            FOID
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-7 text-[16px] font-regular text-black">
          {NAV_ITEMS.map(({ label, href }) => {
            const sectionId = href.slice(1)   // strip leading '#'
            const isActive = activeId === sectionId
            return (
              <a
                key={label}
                href={href}
                className="transition-colors duration-200"
                style={{
                  color: isActive ? BRAND : undefined,
                  fontWeight: isActive ? 600 : undefined,
                }}
              >
                {label}
              </a>
            )
          })}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/login"
            className="inline-flex items-center px-6 py-3 rounded-full text-[13px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: BRAND }}
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="hidden sm:inline-flex items-center px-5 py-3 rounded-full text-[13px] font-bold transition-colors hover:bg-neutral-50"
            style={{ border: `1.5px solid ${BRAND}`, color: BRAND }}
          >
            Get your FOID
          </Link>
        </div>
      </div>
    </nav>
  )
}
