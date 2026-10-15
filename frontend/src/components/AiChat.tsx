import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import RemixIcon from './RemixIcon'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

/* ── Inline markdown renderer ───────────────────────────────────────── */
/** Convert **bold** and `code` within a single line to React nodes. */
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = []
  // Split on **bold** and `code` patterns
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[0].startsWith('**')) {
      parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>)
    } else {
      parts.push(<code key={m.index} className="bg-neutral-200 rounded px-1 text-[12px] font-mono">{m[3]}</code>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

/**
 * Render a plain-text markdown string as styled JSX.
 * Handles: headings (#/##/###), tables (|…|), ordered lists, bullet lists, bold, code, blank lines.
 */
function MarkdownBubble({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    // ── Blank line ──────────────────────────────────────────────────
    if (line === '') { i++; continue }

    // ── Heading ─────────────────────────────────────────────────────
    const hMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (hMatch) {
      const level = hMatch[1].length
      const cls = level === 1
        ? 'text-[14.5px] font-bold mt-2 mb-0.5'
        : level === 2
          ? 'text-[13.5px] font-bold mt-2 mb-0.5'
          : 'text-[13px] font-semibold mt-1'
      nodes.push(<div key={i} className={cls}>{renderInline(hMatch[2])}</div>)
      i++; continue
    }

    // ── Table ───────────────────────────────────────────────────────
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableRows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cols = lines[i].trim().split('|').slice(1, -1).map(c => c.trim())
        // Skip separator rows like |---|---|
        if (!cols.every(c => /^[-: ]+$/.test(c))) {
          tableRows.push(cols)
        }
        i++
      }
      nodes.push(
        <div key={`tbl-${i}`} className="overflow-x-auto my-2">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="border-b border-neutral-300">
                {tableRows[0]?.map((h, ci) => (
                  <th key={ci} className="text-left py-1 pr-3 font-semibold text-neutral-700">{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-neutral-100/60' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-1 pr-3 align-top">{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // ── Ordered list item ───────────────────────────────────────────
    const olMatch = line.match(/^(\d+)\.\s+(.+)/)
    if (olMatch) {
      const listItems: ReactNode[] = []
      let num = parseInt(olMatch[1])
      while (i < lines.length) {
        const m = lines[i].trim().match(/^\d+\.\s+(.+)/)
        if (!m) break
        listItems.push(
          <li key={i} className="flex gap-2">
            <span className="shrink-0 font-semibold text-brand-500 w-4">{num}.</span>
            <span>{renderInline(m[1])}</span>
          </li>
        )
        num++; i++
      }
      nodes.push(<ol key={`ol-${i}`} className="flex flex-col gap-1 my-1 text-[13px]">{listItems}</ol>)
      continue
    }

    // ── Bullet list item ────────────────────────────────────────────
    const ulMatch = line.match(/^[-*•]\s+(.+)/)
    if (ulMatch) {
      const listItems: ReactNode[] = []
      while (i < lines.length) {
        const m = lines[i].trim().match(/^[-*•]\s+(.+)/)
        if (!m) break
        listItems.push(
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-brand-500 mt-0.5">•</span>
            <span>{renderInline(m[1])}</span>
          </li>
        )
        i++
      }
      nodes.push(<ul key={`ul-${i}`} className="flex flex-col gap-1 my-1 text-[13px]">{listItems}</ul>)
      continue
    }

    // ── Normal paragraph ────────────────────────────────────────────
    nodes.push(<p key={i} className="leading-relaxed">{renderInline(line)}</p>)
    i++
  }

  return <div className="flex flex-col gap-1 text-[13.5px]">{nodes}</div>
}

/* ── Types ──────────────────────────────────────────────────────────── */
interface Message {
  role: 'ai' | 'user'
  text: string
}

/* Matches the backend ChatMessage schema */
interface HistoryItem {
  role: 'user' | 'assistant'
  content: string
}

/* ── Quick-action chips ─────────────────────────────────────────────── */
const CHIPS = [
  'Spending this month',
  'Estimate my tax',
  "What's my net profit?",
  'Top expense categories',
]

/* ── Idle nudge messages ─────────────────────────────────────────────── */
const NUDGES = [
  "I'm here if you need anything 👋",
  'Ask me about your finances',
  'Want a summary of this month?',
  "How's your cash flow looking?",
]

/* ── Colours ────────────────────────────────────────────────────────── */
const GREEN      = '#c026d3'
const GREEN_DARK = '#701a75'

/* ── Bot avatar ──────────────────────────────────────────────────────── */
function BotAvatar({ size = 32 }: { size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, background: GREEN, border: `2px solid ${GREEN_DARK}` }}
    >
      <img src="/logo.png" alt="FOID AI" style={{ width: size * 0.55, height: size * 0.55, objectFit: 'contain' }} />
    </div>
  )
}

/* ── Typing indicator ────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <BotAvatar size={32} />
      <div className="rounded-2xl px-4 py-3 flex items-center gap-1.5" style={{ background: '#f0f0f0', borderBottomLeftRadius: 4 }}>
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: '#a1a1aa',
              animation: 'bounce 1.2s infinite',
              animationDelay: `${delay}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ── FAB button ─────────────────────────────────────────────────────── */
function FabButton({ onClick, nudge }: { onClick: () => void; nudge: string | null }) {
  return (
    <div className="flex flex-col items-end gap-2">
      {nudge && (
        <div
          className="text-[12px] font-medium px-3 py-1.5 rounded-full shadow-md max-w-[200px] text-center leading-snug"
          style={{ background: '#fff', color: '#18181b', border: '1px solid #e4e4e7' }}
        >
          {nudge}
        </div>
      )}
      <button
        onClick={onClick}
        aria-label="Open AI assistant"
        className="rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          width: 60, height: 60,
          background: GREEN,
          border: '3px solid rgba(0,217,83,0.35)',
          outline: '4px solid rgba(0,217,90,0.18)',
        }}
      >
        <img src="/logo.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════════ */
export default function AiChat() {
  const { user } = useAuth()
  const firstName = user?.firstName ?? 'there'

  const [open, setOpen]           = useState(false)
  const [input, setInput]         = useState('')
  const [nudge, setNudge]         = useState<string | null>(null)
  const [nudgeIdx, setNudgeIdx]   = useState(0)
  const [thinking, setThinking]   = useState(false)
  const [credits, setCredits]     = useState<number | null>(null)
  const [noCredits, setNoCredits] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])

  // history kept in sync with messages for the backend — only user/assistant turns
  const historyRef = useRef<HistoryItem[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Set welcome message once user is loaded
  useEffect(() => {
    setMessages([{
      role: 'ai',
      text: `Hi ${firstName} 👋 I'm FOID AI. I can help you understand your spending, income, taxes, and identity credentials. What would you like to know?`,
    }])
  }, [firstName])

  /* Nudge interval */
  useEffect(() => {
    if (open) { setNudge(null); return }
    const id = setInterval(() => {
      setNudge(NUDGES[nudgeIdx % NUDGES.length])
      setNudgeIdx(i => i + 1)
      setTimeout(() => setNudge(null), 4000)
    }, 20_000)
    const first = setTimeout(() => {
      setNudge(NUDGES[0])
      setTimeout(() => setNudge(null), 4000)
    }, 5000)
    return () => { clearInterval(id); clearTimeout(first) }
  }, [open, nudgeIdx])

  /* Scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, thinking])

  /* Focus input */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || thinking) return

    setNoCredits(false)
    setInput('')

    const userMsg: Message = { role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setThinking(true)

    try {
      const res = await api.post<{ reply: string; credits_remaining: number }>('/ledger/chat', {
        message: trimmed,
        history: historyRef.current,
      })

      const reply = res.data.reply
      setCredits(res.data.credits_remaining)

      // Update history for next turn
        historyRef.current = [
          ...historyRef.current,
          { role: 'user' as const, content: trimmed },
          { role: 'assistant' as const, content: reply },
        ].slice(-20)  // keep last 10 turns

      setMessages(prev => [...prev, { role: 'ai', text: reply }])
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 402) {
        setNoCredits(true)
        setMessages(prev => [...prev, {
          role: 'ai',
          text: "You've run out of AI credits. Head to the AI Credit Wallet page to top up — then come back and we can continue! 💳",
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'ai',
          text: "Sorry, I couldn't reach my servers right now. Please try again in a moment.",
        }])
      }
    } finally {
      setThinking(false)
    }
  }

  return (
    <>
      {/* Bounce animation for typing dots */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>

      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex flex-col items-end gap-3">

        {/* ── Chat panel ── */}
        {open && (
          <div
            className="flex flex-col rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl"
            style={{
              width: 'min(380px, calc(100vw - 32px))',
              maxHeight: '82vh',
              background: '#fff',
              border: '1px solid #e4e4e7',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4" style={{ background: GREEN }}>
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="FOID" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                <div>
                  <div className="text-white font-extrabold text-[17px] leading-tight" style={{ fontFamily: "'Neue Machina', sans-serif" }}>
                    FOID AI
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-fuchsia-300 shrink-0" />
                    <span className="text-[12px] font-semibold text-fuchsia-200">
                      {credits !== null ? `${credits} credits remaining` : 'Online · Finance & identity'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              >
                <RemixIcon name="ri-close-line" size={18} color="#fff" clickable />
              </button>
            </div>

            {/* No-credits banner */}
            {noCredits && (
              <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2 text-[12.5px] font-semibold text-amber-800" style={{ background: '#fef3c7' }}>
                <RemixIcon name="ri-coin-line" size={15} color="#92400e" />
                No credits left — <a href="/dashboard/wallet" className="underline">top up your wallet</a>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4" style={{ minHeight: 260, maxHeight: 360 }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {m.role === 'ai' && <BotAvatar size={32} />}
                  <div
                    className="rounded-2xl px-4 py-3 max-w-[84%]"
                    style={
                      m.role === 'ai'
                        ? { background: '#f0f0f0', color: '#3a3a3a', borderBottomLeftRadius: 4 }
                        : { background: GREEN, color: '#fff', borderBottomRightRadius: 4, fontSize: 13.5, lineHeight: 1.55 }
                    }
                  >
                    {m.role === 'ai'
                      ? <MarkdownBubble text={m.text} />
                      : m.text
                    }
                  </div>
                </div>
              ))}
              {thinking && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>

            {/* Quick chips */}
            <div className="flex gap-2 px-4 pb-3 flex-wrap border-t border-neutral-100 pt-3">
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => void send(chip)}
                  disabled={thinking}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div className="px-4 pb-4">
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-full"
                style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
                  placeholder="Ask about your finances or identity…"
                  disabled={thinking}
                  className="flex-1 bg-transparent text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none disabled:opacity-60"
                />
                <button
                  onClick={() => void send(input)}
                  disabled={!input.trim() || thinking}
                  aria-label="Send"
                  className="shrink-0 transition-opacity disabled:opacity-30"
                >
                  <RemixIcon name="ri-send-plane-fill" size={20} color={GREEN} clickable />
                </button>
              </div>
              <p className="text-[10.5px] text-neutral-400 mt-1.5 text-center">
                1 credit per message · finance &amp; identity only
              </p>
            </div>
          </div>
        )}

        {/* ── FAB ── */}
        <FabButton onClick={() => setOpen(o => !o)} nudge={open ? null : nudge} />
      </div>
    </>
  )
}
