import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, User, MapPin, CreditCard, ChevronRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { completeProfile, getGeography } from '../../api'
import { useAuth } from '../../contexts/AuthContext'

const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
]

const CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'OBC', label: 'OBC' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' },
  { value: 'EWS', label: 'EWS' },
]

export default function CompleteProfile() {
  const navigate = useNavigate()
  const { officer, login: authLogin } = useAuth()
  const [step, setStep] = useState(1) // 1: personal, 2: location, 3: bank
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [geography, setGeography] = useState([])

  // Form fields
  const [phone, setPhone]         = useState('')
  const [gender, setGender]       = useState('')
  const [dob, setDob]             = useState('')
  const [caste, setCaste]         = useState('')
  const [income, setIncome]       = useState('')
  const [district, setDistrict]   = useState('')
  const [taluka, setTaluka]       = useState('')
  const [bankName, setBankName]   = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankIfsc, setBankIfsc]   = useState('')

  useEffect(() => {
    getGeography().then(g => { if (g && g.length) setGeography(g) })
  }, [])

  const districtTalukas = geography.find(g => g.district === district)?.talukas || []

  const validateStep1 = () => {
    if (!phone || phone.length < 10) return 'Enter a valid 10-digit phone number'
    if (!gender) return 'Select your gender'
    if (!dob) return 'Enter your date of birth'
    if (!caste) return 'Select your caste category'
    return null
  }

  const validateStep2 = () => {
    if (!district) return 'Select your district'
    if (!taluka) return 'Select your taluka'
    return null
  }

  const handleNext = () => {
    setError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }
      setStep(3)
    }
  }

  const handleSubmit = async () => {
    setError(''); setLoading(true)
    try {
      const data = await completeProfile({
        phone:                phone.trim(),
        district:             district,
        taluka:               taluka,
        gender:               gender,
        dob:                  dob,
        caste_category:       caste,
        income:               income ? parseFloat(income) : null,
        bank_name:            bankName.trim() || null,
        bank_account_display: bankAccount.trim() || null,
        bank_ifsc:            bankIfsc.trim() || null,
      })
      // Update the auth context with profile_complete = true
      if (officer) {
        authLogin('USER', { ...officer, profile_complete: true, district })
      }
      navigate('/user/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save profile')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-workspace flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Complete Your Profile</h1>
          <p className="text-sm text-text-secondary font-data mt-1">
            Please fill in your details to access your dashboard
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s < step ? 'bg-emerald-600 text-white' :
                s === step ? 'bg-primary-override text-white' :
                'bg-surface-low text-text-secondary'
              }`}>
                {s < step ? <CheckCircle size={16} /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 rounded ${s < step ? 'bg-emerald-600' : 'bg-surface-low'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-surface-lowest rounded-xl border border-border-subtle p-6 shadow-sm">
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
                <User size={16} /> Personal Information
              </h3>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Phone Number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={10}
                  placeholder="10-digit mobile number"
                  className="w-full px-4 py-2.5 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Gender</label>
                  <select value={gender} onChange={e => setGender(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30">
                    <option value="">Select</option>
                    {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Date of Birth</label>
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Caste Category</label>
                  <select value={caste} onChange={e => setCaste(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30">
                    <option value="">Select</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Annual Income (₹)</label>
                  <input type="number" value={income} onChange={e => setIncome(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2.5 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
                <MapPin size={16} /> Location Details
              </h3>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">District</label>
                <select value={district} onChange={e => { setDistrict(e.target.value); setTaluka('') }}
                  className="w-full px-3 py-2.5 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30">
                  <option value="">Select your district</option>
                  {geography.map(g => <option key={g.district} value={g.district}>{g.district}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Taluka</label>
                <select value={taluka} onChange={e => setTaluka(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30">
                  <option value="">Select your taluka</option>
                  {districtTalukas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Bank Details */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={16} /> Bank Details (Optional)
              </h3>
              <p className="text-xs text-text-secondary font-data">For scheme disbursement verification</p>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">Bank Name</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India"
                  className="w-full px-4 py-2.5 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">Account (last 4 digits)</label>
                  <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} maxLength={4}
                    placeholder="XXXX"
                    className="w-full px-3 py-2.5 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">IFSC Code</label>
                  <input type="text" value={bankIfsc} onChange={e => setBankIfsc(e.target.value)} maxLength={11}
                    placeholder="SBIN0001234"
                    className="w-full px-3 py-2.5 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-lg outline-none focus:ring-2 focus:ring-primary-override/30" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-tint-red border border-border-subtle rounded-lg px-3 py-2 mt-4">
              <AlertCircle size={14} className="text-risk-critical flex-shrink-0" />
              <p className="text-xs text-risk-critical font-data">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button onClick={() => { setStep(step - 1); setError('') }}
                className="flex-1 py-3 border border-border-subtle text-text-primary text-sm font-bold rounded-lg hover:bg-surface-low transition-all">
                Back
              </button>
            )}
            {step < 3 ? (
              <button onClick={handleNext}
                className="flex-1 py-3 bg-gradient-to-b from-primary-override to-blue-900 text-white text-sm font-bold rounded-lg shadow transition-all flex items-center justify-center gap-2">
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-3 bg-gradient-to-b from-emerald-700 to-emerald-900 text-white text-sm font-bold rounded-lg shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {loading ? 'Saving…' : 'Complete Profile'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
