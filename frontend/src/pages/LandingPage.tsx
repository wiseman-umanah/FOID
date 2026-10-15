import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import LandingNav from '@/components/landing/LandingNav'
import LandingFooter from '@/components/landing/LandingFooter'
import RemixIcon from '@/components/RemixIcon'
import FadeUp from '@/components/FadeUp'

/* ── Brand ───────────────────────────────────────────────────────────── */
const BRAND    = '#c026d3'
const BRAND_BG = 'linear-gradient(135deg, #C800DE 0%, #9000A8 100%)'

/* ── Partner logos — text-based as in screenshot ─────────────────────── */
const PARTNERS = [
  { name: 'WEMA BANK',              logo: '/wema.png' },
  { name: 'Moniepoint',             logo: '/moniepoint.png' },
  { name: 'Kuda.',                  logo: '/kuda.png' },
  { name: 'renmoney',               logo: '/renmoney.png' },
  { name: 'OPay',                   logo: '/opay.png' },
  { name: 'GTCO',                   logo: '/gtco.png' },
]

/* ── Stats ──────────────────────────────────────────────────────────── */
const STATS = [
  { value: '98.4',   label: 'Avg. trust score at verification'          },
  { value: '<60s',   label: 'Avg. trust score at verification'          },
  { value: '₦2.1B+', label: 'In transactions auto-categorised monthly'  },
  { value: '7',      label: 'Banks & fintechs supported at launch'      },
]

/* ── Ledger mock entries — matching screenshot exactly ───────────────── */
const LEDGER_ENTRIES = [
  {
    title: 'Uber fleet — delivery run',
    sub: 'Logistics · Receipt',
    color: '#c026d3',
    icon: 'ri-e-bike-2-line',
  },
  {
    title: 'Studio Kola — invoice #114',
    sub: 'Sales · Bank sync',
    color: '#c026d3',
    icon: 'ri-ancient-gate-line',
  },
  {
    title: 'Notion + Figma subscription',
    sub: 'Software · Invoice',
    color: '#c026d3',
    icon: 'ri-apps-line',
  },
  {
    title: 'Tax set-aside, this month',
    sub: 'Auto-reserved',
    color: '#c026d3',
    icon: 'ri-bank-line',
  },
]
const LEDGER_AMOUNT = '–₦48,200'

/* ── Avatar colours (social proof stack) ────────────────────────────── */
const AVATAR_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7']

/* ════════════════════════════════════════════════════════════════════ */
function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1)
          // ease-out cubic
          const ease = 1 - Math.pow(1 - progress, 3)
          setCount(Math.floor(ease * target))
          if (progress < 1) requestAnimationFrame(tick)
          else setCount(target)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  return { count, ref }
}

export default function LandingPage() {
  const { count, ref } = useCountUp(12400)

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
    >
      <LandingNav />

      
      <section id="product" className="max-w-[95%] min-h-screen mx-auto px-4 sm:px-10 flex flex-col justify-center md:justify-between gap-10 py-12 md:py-0 md:grid md:grid-rows-[1fr_120px]">
        <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] items-center gap-10">
          <div>
            {/* Social proof pill */}
            <motion.div
              className="flex items-center gap-2 mb-6 flex-wrap"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex -space-x-1.5 shrink-0">
                {AVATAR_COLORS.map((_, i) => (
                  <img
                    key={i}
                    src="/avatar.png"
                    alt="user avatar"
                    className="w-[22px] h-[22px] rounded-full border-2 border-white object-cover"
                    style={{ zIndex: AVATAR_COLORS.length - i }}
                  />
                ))}
              </div>
              <span className="text-[13px] sm:text-[16px] text-black">
                <b ref={ref}>{count.toLocaleString()}+</b> Nigerian founders &amp; freelancers verified this quarter
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-[1.07] tracking-tight text-neutral-900 mb-7"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              One identity{' '}
              <span style={{ color: BRAND }}>your<br />banks, apps, and<br />taxman</span>
              {' '}can all trust.
            </motion.h1>

            {/* CTAs */}
            <motion.div
              className="flex items-center gap-2 sm:gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to="/signup"
                className="inline-flex items-center px-4 py-2.5 sm:px-6 sm:py-3 rounded-full text-[12px] sm:text-[14px] font-bold text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                style={{ background: BRAND }}
              >
                Create your FOID
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center px-4 py-2.5 sm:px-5 sm:py-3 rounded-full text-[12px] sm:text-[13px] font-bold transition-colors hover:bg-neutral-50 whitespace-nowrap"
                style={{ border: `1.5px solid ${BRAND}`, color: BRAND }}
              >
                See how it Works
              </a>
            </motion.div>
          </div>

          {/* ── Right: hero image ── */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src="/landing/hero.png"
              alt="FOID dashboard preview"
              className="w-[100%] max-w-none object-contain"
            />
          </motion.div>
        </div>

        {/* ── Partner logos marquee ── */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            maskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          <div className="animate-marquee" style={{ gap: '2rem' }}>
            {[...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS].map((p, i) => (
              p.logo ? (
                <img
                  key={i}
                  src={`/landing${p.logo}`}
                  alt={p.name}
                  className="h-6 sm:h-8 w-auto object-contain shrink-0 opacity-70 hover:opacity-100 transition-opacity"
                />
              ) : null
            ))}
          </div>
        </div>
      </section>

     

      <section id="how-it-works" className="py-20 md:py-28 px-5 sm:px-10">
        {/* ── Header ── */}
        <FadeUp className="max-w-[640px] mx-auto text-center mb-12">
          <span
            className="inline-block mb-4 px-4 py-1 rounded-full text-white text-[11px] font-bold tracking-widest uppercase"
            style={{ background: BRAND_BG }}
          >
            Three steps, once
          </span>
          <h2 className="text-[28px] font-creato sm:text-[36px] md:text-[44px] font-extrabold text-neutral-900 leading-tight tracking-tight mb-4">
            Identity, banking, and<br />bookkeeping — finally one thing.
          </h2>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            Everything a lender, platform, or tax office needs to trust you,
            built from your own verified data instead of paperwork.
          </p>
        </FadeUp>

        {/* ── Feature cards ── */}
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: 'ri-fingerprint-line',    title: 'Verified identity',        body: 'Tier-2 KYC once, then share a single FOID code anywhere instead of re-uploading documents.' },
            { icon: 'ri-bank-line',            title: 'Open banking, read-only',  body: "Link accounts from any major Nigerian bank or fintech in under a minute — you approve exactly what's shared." },
            { icon: 'ri-quill-pen-line',           title: 'AI-kept ledger',           body: 'Every receipt, invoice, and bank transaction is categorised automatically — no spreadsheets, no missed entries.' },
            { icon: 'ri-file-shield-line',            title: 'Connect your accounts',    body: 'Securely link the banks and fintechs you already bank with. Read-only, revocable anytime.' },
            { icon: 'ri-government-line', title: 'Tax & budget planning',body: "FOID sets aside what you'll owe in tax and suggests what's safe to spend — before it becomes a scramble." },
            { icon: 'ri-bar-chart-fill',     title: 'Let the AI keep books',    body: "Export bank-grade cash-flow and income reports in one click when it's time to raise or borrow." },
          ].map(({ icon, title, body }, idx) => (
            <FadeUp key={title} delay={idx * 0.08}>
            <div
              className="rounded-2xl border border-neutral-200 bg-white p-6 flex flex-col gap-4 h-full"
            >
              {/* icon badge */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(22, 163, 74, 0.08)', color: BRAND }}
              >
                <RemixIcon name={icon} size={20} />
              </div>
              <div>
                <p className="font-bold font-creato text-[14px] text-neutral-900 mb-1">{title}</p>
                <p className="text-[13px] text-neutral-500 leading-relaxed">{body}</p>
              </div>
            </div>
            </FadeUp>
          ))}
        </div>
      </section>


      <section style={{ background: '#000000' }} className="py-20 md:py-28 px-5 sm:px-10">
        <FadeUp className="max-w-[760px] mx-auto text-center mb-14">
          {/* pill */}
          <span
            className="inline-block mb-5 px-4 py-1 rounded-full text-white text-[11px] font-bold tracking-widest uppercase"
            style={{ background: BRAND_BG }}
          >
            Three steps, once
          </span>
          <h2 className="text-[30px] font-creato sm:text-[40px] md:text-[48px] font-extrabold text-white leading-tight tracking-tight mb-4">
            Set it up this week.<br />Trusted from then on.
          </h2>
          <p className="text-[14px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            FOID does the verification work up front so every
            conversation after it starts from "yes."
          </p>
        </FadeUp>

        {/* ── Three step cards ── */}
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              num: '01',
              title: 'Connect your accounts',
              body: 'Securely link the banks and fintechs you already bank with. Read-only, revocable anytime.',
            },
            {
              num: '02',
              title: 'Get verified',
              body: 'Complete Tier-2 KYC once and receive your FOID code — a single credential that stands in for every document.',
            },
            {
              num: '03',
              title: 'Let the AI keep books',
              body: 'Transactions are categorised as they happen, tax is set aside automatically, and reports are always ready.',
            },
          ].map(({ num, title, body }, idx) => (
            <FadeUp key={num} delay={idx * 0.1}>
              <div
                className="rounded-2xl p-6 flex flex-col gap-3"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <span className="text-[24px] font-machina font-bold" style={{ color: BRAND, fontWeight: 800 }}>{num}</span>
                <p className="text-[14px] font-bold font-creato text-white">{title}</p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{body}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      <section id="trust" className="py-14 md:py-20 px-5 sm:px-10">
        <div className="max-w-[1100px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {STATS.map((s, i) => (
            <FadeUp key={i} delay={i * 0.1} className="flex text-center flex-col gap-1.5">
              <div className="text-[44px] font-creato sm:text-[56px] font-extrabold text-neutral-900 leading-none tracking-tight">
                {s.value}
              </div>
              <div className="text-[12.5px] text-neutral-500 leading-snug ">{s.label}</div>
            </FadeUp>
          ))}
        </div>
      </section>

      <section id="ai-ledger" className="relative max-w-[95%] mx-auto px-4 sm:px-10 py-20 md:min-h-screen md:flex md:items-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center w-full">

          <FadeUp>
            <h2 className="text-[28px] sm:text-[32px] md:text-[42px] font-extrabold text-neutral-900 leading-tight tracking-tight mb-4">
              Your books, kept without<br />you touching a spreadsheet.
            </h2>
            <p className="text-[14px] text-neutral-500 leading-relaxed mb-7">
              Snap a receipt or forward an invoice — FOID's AI reads it,
              categorises it, and reconciles it against your bank feed automatically.
            </p>
            <ul className="flex flex-col gap-3 mb-8">
              {[
                'Receipts, invoices, and bank syncs categorised in seconds',
                'Tax and savings estimates update as income comes in',
                'Ask it anything — "what did I spend on logistics this month?"',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-neutral-700">
                  <span
                    className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                    style={{ background: BRAND, width: 18, height: 18, minWidth: 18 }}
                  >
                    <RemixIcon name="ri-check-line" size={11} color="#fff" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/signup"
              className="inline-flex items-center px-5 py-2.5 rounded-full text-[13.5px] font-bold transition-colors hover:opacity-90"
              style={{ border: `1.5px solid ${BRAND}`, color: BRAND }}
            >
              Try the AI ledger
            </Link>
          </FadeUp>

          <FadeUp delay={0.15}>
          <div className="rounded-3xl p-4 pt-8" style={{ background: '#f2f2f2' }}>
            {/* inner white card */}
            <div className="bg-white px-5 md:px-2 py-4 rounded-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-1 pb-3" style={{ borderBottom: '1px solid #e4e4e7' }}>
                <span className="text-[14px] font-bold text-neutral-900">Latest entries</span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#22c55e' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
                  Live sync
                </span>
              </div>

              {/* Entry rows */}
              <div className="flex flex-col divide-y divide-neutral-100">
                {LEDGER_ENTRIES.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 py-3.5">
                    {/* brand-tinted square icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(22,163,74,0.10)', color: e.color }}
                    >
                      <RemixIcon name={e.icon} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-neutral-900 truncate">{e.title}</div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">{e.sub}</div>
                    </div>
                    <div className="text-[13px] font-bold text-neutral-900 shrink-0">{LEDGER_AMOUNT}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </FadeUp>

        </div>

        <div
		className="mt-14 md:absolute md:-bottom-40 md:left-1/2 md:-translate-x-1/2 w-full md:w-[560px] max-w-full rounded-2xl px-6 sm:px-12 py-10 text-center"
		style={{ background: BRAND_BG }}
		>
		<h2 className="text-[24px] sm:text-[28px] font-extrabold text-white leading-tight tracking-tight mb-3">
			Your financial identity, verified once.
		</h2>
		<p className="text-[13.5px] leading-relaxed mb-7" style={{ color: 'rgba(255,255,255,0.8)' }}>
			Free to create. Takes about six minutes, most of it spent choosing your bank.
		</p>
		<div className="flex flex-wrap items-center justify-center gap-3">
			<Link
			to="/signup"
			className="inline-flex items-center px-6 py-3 rounded-full text-[14px] font-bold bg-white transition-opacity hover:opacity-90"
			style={{ color: BRAND }}
			>
			Create your FOID
			</Link>
			<a
			href="mailto:hello@idra.ng"
			className="inline-flex items-center px-6 py-3 rounded-full text-[14px] font-bold text-white transition-colors hover:bg-white/10"
			style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}
			>
			Talk to us
			</a>
			</div>
		</div>
	</section>
      <LandingFooter />

    </div>
  )
}
