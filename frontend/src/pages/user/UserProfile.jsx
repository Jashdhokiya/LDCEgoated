import { useState, useEffect } from 'react'
import { User, Phone, MapPin, CreditCard, Shield, Loader2, Megaphone } from 'lucide-react'
import { getUser, getUserAnnouncements } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

const TAG_STYLES = {
  NEW: 'bg-tint-blue text-primary-override',
  UPDATE: 'bg-tint-violet text-text-primary',
  REMINDER: 'bg-tint-orange text-risk-high',
}

export default function UserProfile() {
  const { t } = useLanguage()
  const [user, setUser] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getUser(), getUserAnnouncements()]).then(([userData, annData]) => {
      setUser(userData)
      setAnnouncements(annData?.announcements || [])
      setLoading(false)
    })
  }, [])

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <Loader2 size={28} className="animate-spin text-primary-override" />
          <p className="text-sm font-data">Loading Profile...</p>
        </div>
      </div>
    )
  }

  const INFO_ROWS = [
    { icon: User, label: t('userDashboard.fullName') || 'Full Name', value: user?.full_name || user?.name || '—' },
    { icon: CreditCard, label: t('userDashboard.aadhaar') || 'Aadhaar Number', value: user?.aadhaar_display || 'XXXX-XXXX-XXXX' },
    { icon: Phone, label: t('userDashboard.mobile') || 'Mobile Number', value: user?.phone || '—' },
    { icon: MapPin, label: t('userDashboard.address') || 'Address', value: `${user?.demographics?.taluka || '—'}, ${user?.demographics?.district || '—'}` },
    { icon: Shield, label: t('userDashboard.category') || 'Category', value: user?.demographics?.category || '—' },
    { icon: CreditCard, label: t('userDashboard.bankAccount') || 'Bank Account', value: `${user?.bank?.bank || '—'} · ${user?.bank?.account_display || '—'}` },
  ]

  return (
    <div className="p-8 pb-20 font-sans max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">My Profile</h1>
          <p className="text-sm text-text-secondary mt-1 font-data">View and manage your personal details</p>
        </div>
      </div>

      <div className="bg-surface-lowest rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="px-8 py-6 border-b border-border-subtle bg-surface-low/50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-tint-blue flex items-center justify-center text-primary-override">
              <User size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">{user?.full_name || user?.name || 'User'}</h2>
              <p className="text-sm text-text-secondary font-data">ID: {user?.user_id}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider font-data mb-6">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {INFO_ROWS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-4 p-4 bg-surface-low rounded-2xl border border-border-subtle">
                <div className="w-10 h-10 rounded-xl bg-surface-lowest flex items-center justify-center border border-border-subtle flex-shrink-0">
                  <Icon size={18} className="text-text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary font-data mb-1">{label}</p>
                  <p className="font-bold text-text-primary">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface-lowest rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
        <div className="px-8 py-5 border-b border-border-subtle bg-surface-low/50 flex items-center gap-3">
          <Megaphone size={18} className="text-primary-override" />
          <div>
            <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider font-data">Announcements</h3>
            <p className="text-xs text-text-secondary font-data">Updates from State Admin</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {announcements.length === 0 ? (
            <p className="text-sm text-text-secondary font-data">No announcements yet.</p>
          ) : (
            announcements.slice(0, 8).map((a) => (
              <div key={a.announcement_id} className="p-4 rounded-2xl border border-border-subtle bg-surface-low">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAG_STYLES[a.tag] || 'bg-surface-low text-text-secondary'}`}>
                    {a.tag || 'UPDATE'}
                  </span>
                  <span className="text-[11px] font-mono text-text-secondary">{(a.created_at || '').slice(0, 10)}</span>
                </div>
                <p className="font-bold text-text-primary mb-1">{a.title}</p>
                <p className="text-sm text-text-secondary font-data leading-relaxed">{a.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
