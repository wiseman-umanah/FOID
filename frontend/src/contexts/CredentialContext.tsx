/**
 * CredentialContext — wired to the real backend.
 *
 * On mount: fetches credential + notifications from the API.
 * triggerEvent: calls POST /credentials/trigger; on success updates both
 *   credential and notification list from the response (no extra round-trip).
 * markRead / markAllRead: call the notifications PATCH endpoints.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { CredentialState, IdraCredential, Notification } from '../types/idra'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

/* ── Trigger event types (kept for DemoControlPanel compatibility) ─────── */
export type TriggerEvent =
  | 'missed_repayment'
  | 'suspicious_activity'
  | 'income_drop'
  | 'manual_revoke'
  | 'review_cleared'
  | 'appeal_approved'
  | 'repayment_restored'

export interface TriggerEventMeta {
  event: TriggerEvent
  label: string
  description: string
  requiredState: CredentialState | null
  resultState: CredentialState
  reason: string
  action: string
}

export const TRIGGER_EVENTS: TriggerEventMeta[] = [
  {
    event: 'missed_repayment',
    label: 'Missed repayment',
    description: 'Simulate a missed loan repayment detected via Open Banking feed',
    requiredState: 'active',
    resultState: 'under_review',
    reason: 'A missed repayment was detected on your connected bank account.',
    action: 'Review your linked accounts and resolve any outstanding payments.',
  },
  {
    event: 'suspicious_activity',
    label: 'Suspicious activity',
    description: 'Simulate an unusual transaction pattern flagged by rules engine',
    requiredState: 'active',
    resultState: 'under_review',
    reason: 'Unusual transaction patterns were detected on your account.',
    action: 'Verify your recent transactions and contact support if needed.',
  },
  {
    event: 'income_drop',
    label: 'Significant income drop',
    description: 'Simulate >40% income drop over 2 consecutive months',
    requiredState: 'under_review',
    resultState: 'downgraded',
    reason: 'A significant income drop (>40%) was detected over two consecutive months.',
    action: 'Upload recent proof of income or link an additional account.',
  },
  {
    event: 'review_cleared',
    label: 'Review cleared',
    description: 'Simulate passing the review (repayment resolved, no issues found)',
    requiredState: 'under_review',
    resultState: 'active',
    reason: 'Your account review has been completed with no outstanding issues.',
    action: 'No action required — your credential is fully active again.',
  },
  {
    event: 'repayment_restored',
    label: 'Repayment restored',
    description: 'Simulate repayment resumed after a downgrade',
    requiredState: 'downgraded',
    resultState: 'under_review',
    reason: 'Repayment activity has resumed. Your credential is back under review.',
    action: 'Continue maintaining regular repayments to restore full status.',
  },
  {
    event: 'appeal_approved',
    label: 'Appeal approved',
    description: 'Simulate a successful appeal reinstating a downgraded credential',
    requiredState: 'downgraded',
    resultState: 'active',
    reason: 'Your appeal has been reviewed and approved.',
    action: 'No action required — your credential is fully active again.',
  },
  {
    event: 'manual_revoke',
    label: 'Manual revoke',
    description: 'Permanently revoke the credential (irreversible in demo)',
    requiredState: null,
    resultState: 'revoked',
    reason: 'Your FOID credential has been manually revoked.',
    action: 'Contact support or re-verify your identity to issue a new credential.',
  },
]

/* ── Fallback credential shown while loading ────────────────────────────── */
const LOADING_CREDENTIAL: IdraCredential = {
  id: '',
  holder: '…',
  state: 'active',
  claims: {
    identity_verified: false,
    bvn_validated: false,
    age_over_18: false,
    income_band: 'high',
    account_stability: 'stable',
    repayment_reliability: 'reliable',
  },
  issued_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

/* ── Context shape ──────────────────────────────────────────────────────── */
interface CredentialContextValue {
  credential: IdraCredential
  notifications: Notification[]
  unreadCount: number
  triggerEvent: (event: TriggerEvent) => Promise<void>
  markAllRead: () => Promise<void>
  markRead: (id: string) => Promise<void>
}

const CredentialContext = createContext<CredentialContextValue | null>(null)

/* ── Provider ───────────────────────────────────────────────────────────── */
export function CredentialProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [credential, setCredential] = useState<IdraCredential>(LOADING_CREDENTIAL)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Fetch on mount (and whenever authentication state changes)
  useEffect(() => {
    if (!isAuthenticated) return
    void (async () => {
      try {
        const [credRes, notifRes] = await Promise.all([
          api.get<IdraCredential>('/credentials/me'),
          api.get<Notification[]>('/notifications'),
        ])
        setCredential(credRes.data)
        setNotifications(notifRes.data)
      } catch {
        // silently ignore — user may not be authenticated yet
      }
    })()
  }, [isAuthenticated])

  const triggerEvent = useCallback(async (event: TriggerEvent): Promise<void> => {
    const res = await api.post<{ credential: IdraCredential; notification: Notification }>(
      '/credentials/trigger',
      { event }
    )
    setCredential(res.data.credential)
    setNotifications(prev => [res.data.notification, ...prev])
  }, [])

  const markAllRead = useCallback(async (): Promise<void> => {
    await api.patch('/notifications/read-all')
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const markRead = useCallback(async (id: string): Promise<void> => {
    await api.patch(`/notifications/${id}/read`)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <CredentialContext.Provider value={{ credential, notifications, unreadCount, triggerEvent, markAllRead, markRead }}>
      {children}
    </CredentialContext.Provider>
  )
}

/* ── Hook ───────────────────────────────────────────────────────────── */
export function useCredential() {
  const ctx = useContext(CredentialContext)
  if (!ctx) throw new Error('useCredential must be used inside <CredentialProvider>')
  return ctx
}
