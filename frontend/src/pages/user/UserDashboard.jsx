import { useState, useEffect } from 'react'
import { CheckCircle, Clock, AlertTriangle, FileCheck, ChevronRight, RefreshCw, Shield, Camera, User, Phone, MapPin, CreditCard, X, Loader2, Check, XCircle } from 'lucide-react'
import { getUser, faceVerifyKYC, completeKYC, uploadFaceReference, getEligibleSchemes, getSchemePreferences, optInScheme, optOutScheme } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'
import WebcamCapture from '../../components/WebcamCapture'



const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'bg-tint-emerald text-emerald-600 dark:text-emerald-400 border-border-subtle', dot: 'bg-emerald-500' },
  PENDING_VERIFICATION: { label: 'Pending Review', color: 'bg-tint-yellow text-yellow-600 dark:text-yellow-400 border-border-subtle', dot: 'bg-yellow-500' },
  SUSPENDED: { label: 'Suspended', color: 'bg-tint-red text-risk-critical border-border-subtle', dot: 'bg-red-500' },
}

const TAG_CONFIG = {
  NEW: 'bg-tint-blue text-primary-override',
  UPDATE: 'bg-tint-violet text-text-primary',
  REMINDER: 'bg-tint-orange text-risk-high',
}

// ─── KYC Modal ─────────────────────────────────────────────────────────────────
function KYCModal({ user, onClose, onComplete }) {
  const { t } = useLanguage()
  const [step, setStep] = useState(1)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)

  const hasFaceRef = user?.face_enrolled

  const INFO_ROWS = [
    { icon: User, label: t('userDashboard.fullName'), value: user?.full_name || user?.name || '—' },
    { icon: CreditCard, label: t('userDashboard.aadhaar'), value: user?.aadhaar_display || 'XXXX-XXXX-XXXX' },
    { icon: Phone, label: t('userDashboard.mobile'), value: user?.phone || '—' },
    { icon: MapPin, label: t('userDashboard.address'), value: `${user?.demographics?.taluka || '—'}, ${user?.demographics?.district || '—'}` },
    { icon: Shield, label: t('userDashboard.category'), value: user?.demographics?.category || '—' },
    { icon: CreditCard, label: t('userDashboard.bankAccount'), value: `${user?.bank?.bank || '—'} · ${user?.bank?.account_display || '—'}` },
  ]

  const handleFaceCapture = async (base64) => {
    setVerifying(true)
    try {
      if (!hasFaceRef) {
        // Enrolling for the first time
        await uploadFaceReference(base64)
        // Immediately do basic KYC to finish the process since they just enrolled
        await completeKYC()
        setVerifyResult({ success: true, confidence: 100, details: 'Face enrolled successfully', message: 'Done' })
      } else {
        // Normal verification
        const res = await faceVerifyKYC(base64)
        setVerifyResult(res)
      }
      setStep(3)
    } catch (err) {
      setVerifyResult({ success: false, confidence: 0, details: err?.response?.data?.detail || 'Verification failed', message: 'Error' })
      setStep(3)
    } finally { setVerifying(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-lowest rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-low">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-primary-override" />
            <div>
              <h2 className="font-bold text-text-primary font-sans text-sm">{t('userDashboard.kycRenewal')}</h2>
              <p className="text-xs text-text-secondary font-data">{t('userDashboard.step')} {step} {t('userDashboard.of')} 3</p>
            </div>
          </div>
          {!verifying && <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors"><X size={18} /></button>}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-1">
          {[t('userDashboard.verifyInfo'), 'Face Scan', t('userDashboard.complete')].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="w-full flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-all ${
                  step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-primary-override text-white dark:text-shell' : 'bg-surface-low text-text-secondary'
                }`}>{step > i + 1 ? <Check size={14} /> : i + 1}</div>
                <span className={`text-[10px] font-data ${step === i + 1 ? 'text-primary-override font-bold' : 'text-text-secondary'}`}>{s}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px mx-1 mb-5 ${step > i + 1 ? 'bg-emerald-400' : 'bg-surface-low'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Review info */}
        {step === 1 && (
          <div className="px-6 py-5">
            <p className="text-sm font-data text-text-secondary mb-4 leading-relaxed">{t('userDashboard.reviewInfo')}</p>
            <div className="space-y-3 mb-4">
              {INFO_ROWS.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 bg-surface-low rounded-lg">
                  <Icon size={16} className="text-text-secondary flex-shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <span className="text-xs text-text-secondary font-data">{label}</span>
                    <span className="text-sm font-bold text-text-primary font-sans">{value}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-4 ${hasFaceRef ? 'bg-tint-emerald' : 'bg-tint-red'}`}>
              <Camera size={14} className={hasFaceRef ? 'text-emerald-600' : 'text-risk-critical'} />
              <span className={`text-xs font-data font-bold ${hasFaceRef ? 'text-emerald-600' : 'text-risk-critical'}`}>
                Face ID: {hasFaceRef ? 'Enrolled — face verification available' : 'Not enrolled — Face enrolment required to proceed'}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 border border-border-subtle text-sm font-semibold text-text-secondary rounded-xl hover:bg-surface-low transition-all">{t('common.cancel')}</button>
              <button 
                onClick={() => setStep(2)} 
                className="flex-1 py-2.5 bg-primary-override text-white dark:text-shell text-sm font-bold rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                <Camera size={14} /> {hasFaceRef ? 'Verify Face' : 'Enroll Face ID'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Real webcam face verification */}
        {step === 2 && (
          <div className="px-6 py-6 flex flex-col items-center">
            <p className="text-sm font-data text-text-secondary mb-4 text-center">
              Position your face in the camera. Your photo will be matched against your enrolled Face ID using AI face recognition.
            </p>
            {verifying ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary-override/30 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-primary-override" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary-override flex items-center justify-center">
                    <Shield size={14} className="text-white" />
                  </div>
                </div>
                <p className="text-sm font-bold text-text-primary">Analyzing Face…</p>
                <p className="text-xs text-text-secondary font-data">Running multi-metric face verification</p>
              </div>
            ) : (
              <WebcamCapture mode="verify" onCapture={handleFaceCapture} onCancel={() => setStep(1)} disabled={verifying} />
            )}
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && verifyResult && (
          <div className="px-6 py-8 flex flex-col items-center text-center">
            {verifyResult.success ? (
              <>
                <div className="w-16 h-16 rounded-full bg-tint-emerald flex items-center justify-center mb-4">
                  <CheckCircle size={32} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-text-primary font-sans mb-1">{t('userDashboard.kycSuccess')}</h3>
                <p className="text-sm text-text-secondary font-data leading-relaxed mb-2">{t('userDashboard.kycSuccessDesc')}</p>
                {verifyResult.confidence > 0 && verifyResult.confidence < 100 && (
                  <div className="w-full max-w-xs bg-surface-low rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-text-secondary font-data">AI Confidence</span>
                      <span className="text-lg font-bold text-emerald-600 font-mono">{verifyResult.confidence}%</span>
                    </div>
                    <div className="h-2 bg-surface-lowest rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${verifyResult.confidence}%` }} />
                    </div>
                    {verifyResult.breakdown && (
                      <div className="mt-3 space-y-1">
                        {Object.entries(verifyResult.breakdown).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between text-[10px] font-data">
                            <span className="text-text-secondary capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="text-text-primary font-mono">{val}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <span className="block text-xs font-bold text-emerald-600 mb-4">
                  {t('userDashboard.newExpiry')} {new Date(Date.now() + 90 * 86400000).toLocaleDateString('en-IN')}
                </span>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-tint-red flex items-center justify-center mb-4">
                  <XCircle size={32} className="text-risk-critical" />
                </div>
                <h3 className="text-lg font-bold text-text-primary font-sans mb-1">Verification Failed</h3>
                <p className="text-sm text-text-secondary font-data leading-relaxed mb-2">{verifyResult.details || verifyResult.message}</p>
                {verifyResult.confidence > 0 && (
                  <p className="text-xs text-text-secondary font-mono mb-4">Confidence: {verifyResult.confidence}% (min required: 55%)</p>
                )}
              </>
            )}
            <div className="flex gap-3 w-full">
              {!verifyResult.success && (
                <button onClick={() => { setVerifyResult(null); setStep(2) }} className="flex-1 py-3 border border-border-subtle text-text-primary text-sm font-bold rounded-xl hover:bg-surface-low transition-all">
                  Try Again
                </button>
              )}
              <button onClick={() => { if (verifyResult.success) onComplete(verifyResult); onClose() }}
                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${verifyResult.success ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border border-border-subtle text-text-secondary hover:bg-surface-low'}`}>
                {verifyResult.success ? t('common.done') : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



// ─── Bank Update Modal ────────────────────────────────────────────────────────
function BankUpdateModal({ user, onClose, onUpdate }) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    bank_name: user?.bank?.bank || '',
    account_number: '',
    ifsc: user?.bank?.ifsc || '',
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.bank_name || !formData.account_number || !formData.ifsc) {
      setError('Please fill all fields')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await updateBank(formData)
      onUpdate({
        bank: formData.bank_name,
        account_display: formData.account_number.slice(-4),
        ifsc: formData.ifsc
      })
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update bank details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-lowest rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-low">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-primary-override" />
            <h2 className="font-bold text-text-primary font-sans text-sm">Update Bank Details</h2>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-risk-critical/10 text-risk-critical text-xs font-bold rounded-lg border border-risk-critical/20">{error}</div>}
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider font-data">Bank Name</label>
            <input
              type="text"
              className="w-full bg-surface-low border border-border-subtle rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-override outline-none transition-all"
              placeholder="e.g. State Bank of India"
              value={formData.bank_name}
              onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider font-data">Account Number</label>
            <input
              type="password"
              className="w-full bg-surface-low border border-border-subtle rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-override outline-none transition-all"
              placeholder="Enter full account number"
              value={formData.account_number}
              onChange={e => setFormData({ ...formData, account_number: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider font-data">IFSC Code</label>
            <input
              type="text"
              className="w-full bg-surface-low border border-border-subtle rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-override outline-none transition-all uppercase"
              placeholder="e.g. SBIN0001234"
              value={formData.ifsc}
              onChange={e => setFormData({ ...formData, ifsc: e.target.value })}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-border-subtle text-sm font-semibold text-text-secondary rounded-xl hover:bg-surface-low transition-all">Cancel</button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-primary-override text-white dark:text-shell text-sm font-bold rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Update Bank'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function SupportModal({ onClose }) {
  const { t } = useLanguage()
  const [view, setView] = useState('list') // 'list' | 'new'
  const [loading, setLoading] = useState(false)
  const [tickets, setTickets] = useState([])
  const [fetchingTickets, setFetchingTickets] = useState(true)
  const [formData, setFormData] = useState({ subject: '', message: '' })
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (view === 'list') {
      setFetchingTickets(true)
      getUserSupportTickets().then(res => {
        setTickets(res || [])
        setFetchingTickets(false)
      })
    }
  }, [view])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.subject || !formData.message) {
      setError('Please fill all fields')
      return
    }
    setLoading(true)
    setError('')
    try {
      await contactSupport(formData)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setFormData({ subject: '', message: '' })
        setView('list')
      }, 2000)
    } catch (err) {
      setError('Failed to send message. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-lowest rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-low shrink-0">
          <div className="flex items-center gap-3">
            <Mail size={20} className="text-emerald-500" />
            <h2 className="font-bold text-text-primary font-sans text-sm">
              {view === 'list' ? 'Support Hub' : 'Contact DFO Office'}
            </h2>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto overflow-x-hidden flex-1">
          {view === 'list' ? (
            <div className="p-6">
              {fetchingTickets ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 size={24} className="animate-spin text-emerald-500" />
                  <p className="text-xs text-text-secondary font-data">Loading requests...</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <MessageSquare size={32} className="text-text-tertiary mb-3" />
                  <p className="text-sm font-bold text-text-primary">No Requests Yet</p>
                  <p className="text-xs text-text-secondary mt-1">You haven't contacted the DFO office yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map(t => (
                    <div key={t._id} className="p-4 bg-surface-low border border-border-subtle rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm text-text-primary">{t.subject}</h4>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                          t.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mb-3">{t.message}</p>
                      
                      {t.response && (
                        <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">DFO Response</p>
                          <p className="text-xs text-emerald-900">{t.response}</p>
                        </div>
                      )}
                      <p className="text-[10px] text-text-tertiary font-data mt-3 text-right">
                        {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : success ? (
            <div className="p-12 flex flex-col items-center text-center animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Message Sent!</h3>
              <p className="text-sm text-text-secondary">Your request has been forwarded to the DFO. They will review it shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-risk-critical/10 text-risk-critical text-xs font-bold rounded-lg border border-risk-critical/20">{error}</div>}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider font-data">Subject</label>
                <input
                  type="text"
                  className="w-full bg-surface-lowest border border-border-subtle rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Brief reason for contact"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider font-data">Message</label>
                <textarea
                  className="w-full bg-surface-lowest border border-border-subtle rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all h-32 resize-none"
                  placeholder="Describe your issue in detail..."
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                />
              </div>
            </form>
          )}
        </div>

        <div className="p-4 border-t border-border-subtle bg-surface-low shrink-0 flex gap-3">
          {view === 'list' ? (
            <button 
              onClick={() => setView('new')}
              className="w-full py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 transition-all"
            >
              Compose New Message
            </button>
          ) : !success && (
            <>
              <button type="button" onClick={() => setView('list')} className="flex-1 py-2.5 border border-border-subtle text-sm font-semibold text-text-secondary rounded-xl hover:bg-surface-lowest transition-all">Back</button>
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : 'Send Message'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── KYC Card ──────────────────────────────────────────────────────────────────
function KYCCard({ kyc, onOpenModal }) {
  const { t } = useLanguage()
  const { is_kyc_compliant = false, days_remaining = 0, kyc_expiry_date = '—', last_kyc_date = '—' } = kyc || {}
  const isExpiringSoon = days_remaining <= 14
  const isExpired = days_remaining <= 0

  const total_days = kyc?.dynamic_validity_days || 90
  const percentage = Math.max(0, Math.min(100, (days_remaining / total_days) * 100)).toFixed(0)
  const colorClass = isExpired ? 'text-risk-critical' : isExpiringSoon ? 'text-yellow-500' : 'text-emerald-500'
  
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-surface-lowest rounded-3xl shadow-sm border border-border-subtle p-6 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider font-data">Profile & KYC Status</h3>
        <Shield size={16} className={colorClass} />
      </div>

      <div className="flex flex-col items-center justify-center py-6">
        <div className="relative flex items-center justify-center mb-5">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-surface-low" />
            <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className={`${colorClass} transition-all duration-1000`}
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold font-sans tracking-tight ${colorClass}`}>{percentage}%</span>
            <span className="text-[10px] text-text-secondary font-data mt-0.5">VALID</span>
          </div>
        </div>
        
        <div className="text-center space-y-1.5 mb-2">
          <p className="text-sm font-bold text-text-primary">{isExpired ? t('userDashboard.expired') : is_kyc_compliant ? t('userDashboard.verified') : t('userDashboard.notVerified')}</p>
          <p className="text-xs text-text-secondary font-data">{days_remaining} of {total_days} {t('userDashboard.daysRemaining')} · Expires {kyc_expiry_date}</p>
        </div>
      </div>

      <button
        onClick={onOpenModal}
        className={`w-full py-3.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
          isExpired ? 'bg-risk-critical text-white hover:bg-red-700'
          : isExpiringSoon ? 'bg-yellow-600 text-white hover:bg-yellow-700'
          : 'bg-surface-low text-text-primary hover:bg-surface-lowest border border-border-subtle'
        }`}
      >
        <RefreshCw size={14} />
        {isExpired ? t('userDashboard.renewNow') : isExpiringSoon ? t('userDashboard.renewSoon') : 'Update KYC Profile'}
      </button>
    </div>
  )
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function UserDashboard() {
  const { t } = useLanguage()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showKYCModal, setShowKYCModal] = useState(false)
  const [showBankModal, setShowBankModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [kycDone, setKycDone] = useState(false)
  const [readNews, setReadNews] = useState(new Set())
  const [eligibleSchemes, setEligibleSchemes] = useState([])
  const [schemePrefs, setSchemePrefs] = useState({ opted_in_scheme_ids: [] })
  const [schemeBusy, setSchemeBusy] = useState({})
  const [schemeMessage, setSchemeMessage] = useState('')

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [profile, eligibleRes, prefsRes] = await Promise.all([
          getUser(),
          getEligibleSchemes(),
          getSchemePreferences(),
        ])
        setUser(profile)
        setEligibleSchemes(eligibleRes?.eligible || [])
        setSchemePrefs(prefsRes || { opted_in_scheme_ids: [] })
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const refreshSchemeState = async () => {
    const [eligibleRes, prefsRes, profile] = await Promise.all([
      getEligibleSchemes(),
      getSchemePreferences(),
      getUser(),
    ])
    setEligibleSchemes(eligibleRes?.eligible || [])
    setSchemePrefs(prefsRes || { opted_in_scheme_ids: [] })
    setUser(profile)
  }

  const handleSchemeToggle = async (schemeId, isOptedIn) => {
    setSchemeBusy(prev => ({ ...prev, [schemeId]: true }))
    setSchemeMessage('')
    try {
      if (isOptedIn) {
        await optOutScheme(schemeId)
        setSchemeMessage(`Opted out from ${schemeId}`)
      } else {
        await optInScheme(schemeId)
        setSchemeMessage(`Opted in to ${schemeId}`)
      }
      await refreshSchemeState()
    } catch (err) {
      setSchemeMessage(err?.response?.data?.detail || 'Unable to update scheme preference right now')
    } finally {
      setSchemeBusy(prev => ({ ...prev, [schemeId]: false }))
    }
  }

  const handleKYCComplete = async () => {
    if (user) {
      try {
        await completeKYC()
        setUser(prev => ({
          ...prev,
          kyc_complete: true,
          kyc_profile: {
            ...prev.kyc_profile,
            is_kyc_compliant: true,
            days_remaining: 90,
            kyc_expiry_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
            last_kyc_date: new Date().toISOString().split('T')[0],
          },
        }))
      } catch (e) {
        console.error('KYC error:', e)
      }
    }
    setKycDone(true)
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <Loader2 size={28} className="animate-spin text-primary-override" />
          <p className="text-sm font-data">{t('userDashboard.loadingDashboard')}</p>
        </div>
      </div>
    )
  }

  const optedSet = new Set(schemePrefs?.opted_in_scheme_ids || user?.opted_in_scheme_ids || [])

  return (
    <div className="p-8 pb-20 font-sans max-w-6xl mx-auto space-y-8">
      {/* KYC Modal */}
      {showKYCModal && (
        <KYCModal
          user={user}
          onClose={() => setShowKYCModal(false)}
          onComplete={handleKYCComplete}
        />
      )}

      {/* Bank Modal */}
      {showBankModal && (
        <BankUpdateModal
          user={user}
          onClose={() => setShowBankModal(false)}
          onUpdate={(newData) => setUser(prev => ({ ...prev, bank: { ...prev.bank, ...newData } }))}
        />
      )}

      {/* Support Modal */}
      {showSupportModal && (
        <SupportModal
          onClose={() => setShowSupportModal(false)}
        />
      )}

      {/* Hero Banner */}
      <div className="bg-surface-lowest border border-border-subtle rounded-3xl p-8 flex items-center justify-between shadow-sm relative overflow-hidden">
        {/* Decorative background gradient */}
        <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-tint-blue/40 to-transparent pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight mb-2">
            Welcome Back, {(user?.full_name || user?.name || 'User').split(' ')[0]}!
          </h1>
        </div>

        <div className="bg-surface-low rounded-2xl p-6 border border-border-subtle flex flex-col items-end relative z-10 min-w-[260px] shadow-sm">
           <div className="flex items-center gap-2 mb-1">
             <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest font-data">Total Benefits Received</span>
           </div>
           <p className="text-4xl font-bold text-primary-override font-sans tracking-tight mb-1">
             ₹{totalBenefits > 0 ? totalBenefits.toLocaleString('en-IN') : '45,500'}
           </p>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ROW 1: KYC (Col 1) */}
        <div className="col-span-1 lg:col-span-1 flex flex-col">
          {kycDone ? (
            <div className="bg-surface-lowest rounded-3xl shadow-sm border border-border-subtle p-6 h-full flex flex-col items-center text-center justify-center">
              <div className="w-16 h-16 rounded-full bg-tint-emerald flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-emerald-700 text-lg mb-1">{t('userDashboard.kycRenewed')}</h3>
              <p className="text-sm text-emerald-600 font-data">{t('userDashboard.kycRenewedDesc')}</p>
            </div>
          ) : (
            <KYCCard kyc={user?.kyc_profile} onOpenModal={() => setShowKYCModal(true)} />
          )}
        </div>

        {/* ROW 1: Scholarship Journey (Col 2 & 3) */}
        <div className="col-span-1 lg:col-span-2 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-text-primary font-sans text-sm uppercase tracking-wider font-data">Your Scholarship Journey</h2>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            {((user?.registered_schemes || []).length > 0 ? user.registered_schemes : [
              {
                scheme_id: 'SCH-2023-01',
                name: 'Post-Matric Scholarship (2023-24)',
                status: 'PENDING_VERIFICATION',
                registration_date: 'Oct 15, 2023',
                amount: 45500
              }
            ]).map((scheme, index) => {
              const activeIndex = scheme.status === 'PENDING_VERIFICATION' ? 1 
                                : scheme.last_payment ? 3 
                                : scheme.status === 'ACTIVE' ? 2 : 0;
              
              return (
                <div key={scheme.scheme_id || index} className="bg-surface-lowest rounded-3xl shadow-sm border border-border-subtle p-8 h-full flex flex-col justify-center">
                  <h3 className="font-bold text-text-primary font-sans text-lg mb-8">
                    {index === 0 ? 'Primary ' : ''}Scheme Status: {scheme.name || scheme.scheme_id}
                  </h3>

                  {/* Status timeline styled like the image */}
                  <div className="relative z-0 my-4 px-2">
                    {/* Track Background */}
                    <div className="absolute top-6 left-[12.5%] right-[12.5%] h-1.5 bg-border-subtle -z-10" />
                    
                    {/* Active Track */}
                    <div className="absolute top-6 left-[12.5%] h-1.5 bg-gradient-to-r from-emerald-500 to-primary-override -z-10 transition-all duration-500" 
                         style={{ width: `${activeIndex * 33.33}%` }} />

                    <div className="flex items-start justify-between w-full">
                      {[
                        { id: 0, label: 'Application Submitted', subLabel: scheme.registration_date ? `(${scheme.registration_date})` : '' },
                        { id: 1, label: 'Verification Pending', subLabel: scheme.status === 'PENDING_VERIFICATION' ? '(Current)' : '' },
                        { id: 2, label: 'Approved', subLabel: scheme.status === 'ACTIVE' && !scheme.last_payment ? '(Current)' : '' },
                        { id: 3, label: 'Fund Disbursement', subLabel: scheme.last_payment ? `(${scheme.last_payment})` : '' },
                      ].map((s, i) => {
                        let stepState = 'pending';
                        if (scheme.status === 'PENDING_VERIFICATION') {
                          if (i === 0) stepState = 'completed';
                          if (i === 1) stepState = 'current';
                        } else if (scheme.status === 'ACTIVE') {
                          if (scheme.last_payment) {
                            stepState = 'completed';
                          } else {
                            if (i <= 1) stepState = 'completed';
                            if (i === 2) stepState = 'current';
                          }
                        } else {
                          if (i === 0) stepState = 'completed';
                        }
                        
                        // Override for dummy data to match the image exactly
                        if (scheme.scheme_id === 'SCH-2023-01' && i === 1) {
                          stepState = 'current';
                        }
                        
                        return (
                          <div key={s.id} className="flex flex-col items-center w-1/4 relative">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 z-10 transition-colors ${
                              stepState === 'completed' ? 'bg-emerald-500 text-white' :
                              stepState === 'current' ? 'bg-primary-override text-white dark:text-shell ring-4 ring-tint-blue' :
                              'bg-surface-lowest border-4 border-border-subtle text-transparent'
                            }`}>
                              {stepState === 'completed' && <Check size={24} strokeWidth={3} />}
                              {stepState === 'current' && <span className="font-bold text-xs whitespace-nowrap">-))</span>}
                            </div>
                            <span className={`text-sm font-bold text-center ${stepState === 'current' ? 'text-text-primary' : 'text-text-primary/70'}`}>
                              {s.label}
                            </span>
                            {s.subLabel && (
                              <span className={`text-xs font-data text-center mt-1 ${stepState === 'current' ? 'text-primary-override' : 'text-text-secondary'}`}>
                                {s.subLabel}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scheme Management */}
          <div className="bg-surface-lowest rounded-xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <h2 className="font-bold text-text-primary font-sans">Scheme Management</h2>
              <span className="text-xs text-text-secondary font-data">{optedSet.size} opted in</span>
            </div>

            {schemeMessage && (
              <div className="px-6 py-3 border-b border-border-subtle bg-surface-low">
                <p className="text-xs font-data text-text-secondary">{schemeMessage}</p>
              </div>
            )}

            {eligibleSchemes.length === 0 ? (
              <div className="px-6 py-6 text-sm text-text-secondary font-data">
                No eligible schemes available right now. Complete profile details to unlock more options.
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {eligibleSchemes.map((scheme) => {
                  const schemeId = scheme.scheme_id
                  const isOptedIn = optedSet.has(schemeId)
                  const isBusy = !!schemeBusy[schemeId]
                  return (
                    <div key={schemeId} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary font-sans truncate">{scheme.name || schemeId}</p>
                        <p className="text-xs text-text-secondary font-data mt-1">
                          {schemeId} · Annual Benefit: ₹{(scheme.amount || 0).toLocaleString('en-IN')}
                        </p>
                      </div>

                      <button
                        onClick={() => handleSchemeToggle(schemeId, isOptedIn)}
                        disabled={isBusy}
                        className={`min-w-[108px] px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                          isOptedIn
                            ? 'bg-tint-red text-risk-critical border border-red-200 hover:bg-red-100'
                            : 'bg-tint-emerald text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        } ${isBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {isBusy ? 'Updating...' : isOptedIn ? 'Opt Out' : 'Opt In'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Quick Actions (Col 1) */}
        <div className="col-span-1 lg:col-span-1 flex flex-col gap-4">
          {[
            { 
              label: t('userDashboard.updateBank'), 
              icon: CreditCard, 
              color: 'text-violet-500', 
              bg: 'bg-tint-violet', 
              desc: 'Manage account', 
              onClick: () => setShowBankModal(true),
              extra: user?.bank?.bank ? (
                <div className="mt-4 p-3 bg-surface-low rounded-2xl border border-border-subtle/50">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Current Account</p>
                  <p className="text-sm font-bold text-text-primary truncate">{user.bank.bank}</p>
                  <p className="text-xs text-text-secondary font-mono">•••• {user.bank.account_display}</p>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-risk-critical/5 rounded-2xl border border-risk-critical/10">
                  <p className="text-xs text-risk-critical font-bold">No bank account linked</p>
                </div>
              )
            },
            { 
              label: t('userDashboard.contactDFO'), 
              icon: Mail, 
              color: 'text-emerald-500', 
              bg: 'bg-tint-emerald', 
              desc: 'Get support',
              onClick: () => setShowSupportModal(true),
              extra: (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="p-3 bg-yellow-50 rounded-2xl border border-yellow-100 flex flex-col items-center justify-center text-center">
                    <p className="text-xl font-bold text-yellow-600 mb-0.5">{supportTickets.filter(t => t.status === 'OPEN').length}</p>
                    <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-widest">Open</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                    <p className="text-xl font-bold text-emerald-600 mb-0.5">{supportTickets.filter(t => t.status === 'RESOLVED').length}</p>
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Resolved</p>
                  </div>
                </div>
              )
            },
          ].map((a, i) => {
            const Icon = a.icon
            return (
              <button 
                key={i} 
                onClick={a.onClick}
                className="bg-surface-lowest rounded-3xl shadow-sm border border-border-subtle p-5 flex flex-col items-start hover:-translate-y-1 transition-transform group text-left w-full h-fit"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${a.bg}`}>
                    <Icon size={32} className={a.color} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="font-bold text-text-primary text-sm">{a.label}</p>
                    <p className="text-xs text-text-secondary font-data group-hover:text-primary-override transition-colors">{a.desc}</p>
                  </div>
                </div>
                
                <div className="w-full">
                  {a.extra}
                </div>

                <div className="mt-4 flex items-center justify-between w-full pt-4 border-t border-border-subtle/30 opacity-60 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{i === 0 ? 'Update Details' : 'Contact Support'}</span>
                  <ChevronRight size={14} className="text-text-secondary/30 group-hover:text-primary-override transition-colors" />
                </div>
              </button>
            )
          })}
        </div>

        {/* ROW 2: Scheme News (Col 2 & 3) */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-surface-lowest rounded-3xl shadow-sm border border-border-subtle overflow-hidden h-full flex flex-col">
            <div className="flex items-center gap-2 px-6 py-5 border-b border-border-subtle">
              <h2 className="font-bold text-text-primary font-sans text-xs uppercase tracking-wider font-data">{t('userDashboard.schemeNews')}</h2>
            </div>
            <div className="divide-y divide-border-subtle flex-1 overflow-y-auto">
              {announcements.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-secondary font-data">No news or updates.</div>
              ) : announcements.slice(0, 5).map(news => {
                const isRead = readNews.has(news.announcement_id)
                const isExpanded = expandedNews.has(news.announcement_id)
                
                const toggleNews = () => {
                  setReadNews(s => new Set([...s, news.announcement_id]))
                  setExpandedNews(s => {
                    const next = new Set(s)
                    if (next.has(news.announcement_id)) next.delete(news.announcement_id)
                    else next.add(news.announcement_id)
                    return next
                  })
                }

                return (
                  <button key={news.announcement_id} onClick={toggleNews}
                    className={`w-full px-6 py-4 text-left hover:bg-surface-low transition-all ${isRead && !isExpanded ? 'opacity-55' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAG_CONFIG[news.tag] || 'bg-surface-low text-text-secondary'}`}>{news.tag}</span>
                        {isExpanded && <span className="text-[10px] font-bold text-primary-override animate-pulse">EXPANDED</span>}
                      </div>
                      <span className="text-[10px] font-mono text-text-secondary">{(news.created_at || '').slice(0, 10)}</span>
                    </div>
                    <p className={`text-sm font-bold font-sans text-text-primary leading-snug mb-1 ${isExpanded ? '' : 'line-clamp-1'}`}>{news.title}</p>
                    <p className={`text-xs text-text-secondary font-data leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>{news.body}</p>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border-subtle flex justify-end">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Click to collapse</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
