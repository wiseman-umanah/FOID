import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import RemixIcon from '../../components/RemixIcon'
import StatCard from '../../components/StatCard'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../lib/api'

/* ── Toggle switch ───────────────────────────────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 48, height: 28, borderRadius: 999,
        background: on ? '#c026d3' : '#d4d4d8',
        position: 'relative', flexShrink: 0,
        transition: 'background 200ms ease', border: 'none', padding: 0, cursor: 'pointer',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        transition: 'left 200ms ease', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }} />
    </button>
  )
}

/* ── Read-only field ─────────────────────────────────────────────────── */
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-neutral-800 mb-2">{label}</label>
      <div className="w-full rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-500 select-all">
        {value || '—'}
      </div>
    </div>
  )
}

/* ── Security toggle row ─────────────────────────────────────────────── */
function SecurityRow({ label, sub, on, onChange }: { label: string; sub: string; on: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-neutral-100 last:border-0">
      <div>
        <div className="text-[13px] font-semibold text-neutral-900">{label}</div>
        <div className="text-[11px] text-neutral-400 mt-0.5">{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

/* ── Notification preference row ─────────────────────────────────────── */
function PrefRow({ label, sub, on, onChange }: { label: string; sub: string; on: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-neutral-100 last:border-0">
      <div className="pr-6">
        <div className="text-[13px] font-semibold text-neutral-900">{label}</div>
        <div className="text-[11px] text-neutral-400 mt-0.5">{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

/* ── Change Password modal ───────────────────────────────────────────── */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent]     = useState('')
  const [next, setNext]           = useState('')
  const [confirm, setConfirm]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next !== confirm) { setError('New passwords do not match.'); return }
    setSaving(true)
    try {
      await api.patch('/auth/me/password', { current_password: current, new_password: next })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Failed to change password.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="font-bold text-[16px] text-neutral-900">Change password</div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-neutral-100 transition-colors">
            <RemixIcon name="ri-close-line" size={18} color="#71717a" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <RemixIcon name="ri-checkbox-circle-fill" size={48} color="#c026d3" />
            <p className="text-[14px] font-semibold text-neutral-900">Password updated!</p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            {[
              { label: 'Current password', val: current, set: setCurrent },
              { label: 'New password',     val: next,    set: setNext    },
              { label: 'Confirm new',      val: confirm, set: setConfirm },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-[13px] font-medium text-neutral-800 mb-1.5">{label}</label>
                <input
                  type="password"
                  value={val}
                  onChange={e => set(e.target.value)}
                  required
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-[13px] outline-none focus:border-brand-400 transition-colors"
                />
              </div>
            ))}
            {error && <p className="text-[12.5px] text-red-600">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-full border border-neutral-200 text-[13px] font-bold text-neutral-800 hover:bg-neutral-50 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-full text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: '#c026d3' }}
              >
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ── Utility bill upload modal ───────────────────────────────────────── */
function UtilityBillModal({ onClose }: { onClose: () => void }) {
  const [dragging, setDragging]   = useState(false)
  const [file, setFile]           = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const fileRef                   = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => { setFile(f); setError('') }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      await api.post('/auth/me/utility-bill', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onClose()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-[16px] text-neutral-900">Upload utility bill</div>
            <div className="text-[12px] text-neutral-400 mt-0.5">Electricity, water, or broadband — dated within 3 months</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-neutral-100 transition-colors">
            <RemixIcon name="ri-close-line" size={18} color="#71717a" />
          </button>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl py-10 cursor-pointer transition-colors"
          style={{
            border: `2px dashed ${dragging ? '#c026d3' : file ? '#c026d3' : '#e879f9'}`,
            background: '#fdf4ff',
          }}
        >
          {file ? (
            <>
              <RemixIcon name="ri-file-check-line" size={44} color="#c026d3" />
              <p className="text-[13px] font-semibold text-neutral-800">{file.name}</p>
              <p className="text-[11px] text-neutral-400">{(file.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <RemixIcon name="ri-upload-cloud-2-line" size={44} color="#c026d3" />
              <p className="text-[13px] text-neutral-600"><span className="font-bold text-neutral-900">Drop file here</span> or click to browse</p>
              <p className="text-[11px] text-neutral-400">JPG, PNG, PDF up to 10 MB</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

        {error && <p className="text-[12.5px] text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-full border border-neutral-200 text-[13px] font-bold text-neutral-800 hover:bg-neutral-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!file || uploading}
            className="flex-1 py-2.5 rounded-full text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: '#c026d3' }}
          >
            {uploading ? 'Uploading…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Identity doc row ────────────────────────────────────────────────── */
type DocStatus = 'verified' | 'not-linked'
function DocRow({ icon, name, sub, status, onAdd }: { icon: string; name: string; sub: string; status: DocStatus; onAdd?: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 px-1 border-b border-neutral-100 last:border-0">
      <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
        <RemixIcon name={icon} size={18} color="#fff" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-neutral-900">{name}</div>
        <div className="text-[11px] text-neutral-400">{sub}</div>
      </div>
      {status === 'verified' ? (
        <span className="flex items-center gap-1.5 rounded-full bg-brand-500 text-white text-[11px] font-semibold px-3 py-1">
          <RemixIcon name="ri-checkbox-circle-fill" size={13} color="#fff" />
          Verified
        </span>
      ) : (
        <button onClick={onAdd} className="text-[12px] font-semibold text-neutral-800 hover:text-brand-500 transition-colors px-2 py-1 rounded-lg hover:bg-brand-50">
          Add
        </button>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════════ */
interface Prefs {
  two_fa_enabled: boolean
  biometric_enabled: boolean
  login_alerts_enabled: boolean
  notif_verification_alerts: boolean
  notif_consent_alerts: boolean
  notif_ai_nudges: boolean
  notif_weekly_digest: boolean
}

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth()

  /* Address edit */
  const [address, setAddress]       = useState(user?.address ?? '')
  const [savingAddr, setSavingAddr] = useState(false)
  const [addrSaved, setAddrSaved]   = useState(false)

  /* Modals */
  const [showPassword, setShowPassword]   = useState(false)
  const [showUtility, setShowUtility]     = useState(false)

  /* Preferences — loaded from backend */
  const [prefs, setPrefs] = useState<Prefs>({
    two_fa_enabled: true,
    biometric_enabled: true,
    login_alerts_enabled: true,
    notif_verification_alerts: true,
    notif_consent_alerts: true,
    notif_ai_nudges: true,
    notif_weekly_digest: false,
  })

  useEffect(() => {
    void api.get<Prefs>('/preferences').then(r => setPrefs(r.data)).catch(() => {})
  }, [])

  const togglePref = async (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)  // optimistic
    try {
      const res = await api.patch<Prefs>('/preferences', { [key]: next[key] })
      setPrefs(res.data)
    } catch {
      setPrefs(prefs)  // revert on failure
    }
  }

  const handleSaveAddress = async () => {
    if (!address.trim()) return
    setSavingAddr(true)
    try {
      await api.patch('/auth/me/address', { address: address.trim() })
      await refreshUser()
      setAddrSaved(true)
      setTimeout(() => setAddrSaved(false), 2500)
    } catch {
      // ignore
    } finally {
      setSavingAddr(false)
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

  return (
    <div className="flex flex-col gap-6 min-h-full">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Profile &amp; Settings</h1>
        <p className="text-[13px] text-neutral-400 mt-1">
          Manage your personal information, security, and how FOID's AI helps you
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Account Tier"          value="Tier 2"          sub="Full KYC complete"         subColor="text-neutral-400"            icon="ri-shield-star-fill"      />
        <StatCard label="Identity Documents"    value="3 / 4"           sub="1 document not linked"     subColor="text-neutral-400"            icon="ri-profile-fill"          />
        <StatCard label="Member Since"          value={memberSince}     sub="Account age"               subColor="text-neutral-400"            icon="ri-calendar-line"         />
        <StatCard label="Last Login"            value="Just now"        sub="Session active"            subColor="text-green-600 font-semibold" icon="ri-lock-2-fill"          />
      </div>

      {/* ── Two-column section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Personal information ── */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-[15px] font-bold text-neutral-900">Personal information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadField label="First name"   value={user?.firstName  ?? ''} />
            <ReadField label="Last name"    value={user?.lastName   ?? ''} />
            <ReadField label="Middle name"  value={user?.middleName ?? ''} />
            <ReadField label="NIN"          value={user?.nin ? '****' + user.nin.slice(-4) : '—'} />
            <ReadField label="Email"        value={user?.email ?? ''} />
            <ReadField label="Phone"        value={user?.phone ?? 'Not set'} />
          </div>

          {/* Address — editable */}
          <div>
            <label className="block text-[13px] font-medium text-neutral-800 mb-2">Address</label>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={2}
              placeholder="Enter your residential address"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-[13px] text-neutral-800 placeholder:text-neutral-400 outline-none focus:border-brand-400 transition-colors resize-none"
            />
            <button
              onClick={() => void handleSaveAddress()}
              disabled={savingAddr || !address.trim()}
              className="mt-2 px-5 py-2 rounded-full text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#c026d3' }}
            >
              {savingAddr ? 'Saving…' : addrSaved ? '✓ Saved' : 'Save address'}
            </button>
          </div>
        </div>

        {/* ── Linked identity documents ── */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-4">Linked identity documents</h2>
          <div className="divide-y divide-neutral-100">
            <DocRow icon="ri-bank-fill"              name="BVN"                   sub={user?.bvn ? 'Linked and Verified' : 'Not yet submitted'} status={user?.bvn ? 'verified' : 'not-linked'} />
            <DocRow icon="ri-profile-fill"           name="NIN"                   sub="Linked and Verified"  status="verified"   />
            <DocRow icon="ri-passport-fill"          name="International passport" sub="Not linked"           status="not-linked" />
            <DocRow icon="ri-lightbulb-flash-fill"   name="Utility bill"           sub="Not verified"         status="not-linked" onAdd={() => setShowUtility(true)} />
          </div>
        </div>

        {/* ── Security ── */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">Security</h2>
          <div>
            <SecurityRow label="Two-factor authentication" sub="Require a code from your phone when signing in" on={prefs.two_fa_enabled}        onChange={() => void togglePref('two_fa_enabled')}        />
            <SecurityRow label="Biometric unlock"          sub="Use Face ID / fingerprint on this device"       on={prefs.biometric_enabled}      onChange={() => void togglePref('biometric_enabled')}      />
            <SecurityRow label="Login alerts"              sub="Email me when there's a new sign-in"            on={prefs.login_alerts_enabled}   onChange={() => void togglePref('login_alerts_enabled')}   />
          </div>
          <button
            onClick={() => setShowPassword(true)}
            className="mt-5 w-full rounded-xl border border-neutral-200 bg-white py-3 text-[13px] font-bold text-neutral-900 hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
          >
            <RemixIcon name="ri-lock-password-line" size={15} color="#18181b" />
            Change Password
          </button>
        </div>

        {/* ── Notifications & AI preferences ── */}
        <div className="bg-white rounded-2xl border border-neutral-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">Notifications &amp; AI preferences</h2>
          <div>
            <PrefRow label="Verification request alerts" sub="Notify me when a platform wants to verify my identity"   on={prefs.notif_verification_alerts} onChange={() => void togglePref('notif_verification_alerts')} />
            <PrefRow label="Consent request alerts"      sub="Notify me when an app requests my data"                  on={prefs.notif_consent_alerts}      onChange={() => void togglePref('notif_consent_alerts')}      />
            <PrefRow label="AI budget nudges"            sub="Let the assistant surface spending insights proactively"  on={prefs.notif_ai_nudges}           onChange={() => void togglePref('notif_ai_nudges')}           />
            <PrefRow label="Weekly digest email"         sub="Summary of your finances and credential activity"        on={prefs.notif_weekly_digest}       onChange={() => void togglePref('notif_weekly_digest')}       />
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
      {showUtility  && <UtilityBillModal   onClose={() => setShowUtility(false)}  />}
    </div>
  )
}
