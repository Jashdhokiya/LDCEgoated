import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, User, MapPin, CreditCard, Camera, ChevronRight, ChevronLeft,
  Loader2, AlertCircle, CheckCircle, Fingerprint, Eye, EyeOff, Search,
  Info, RefreshCw, Building2, X
} from 'lucide-react'
import { completeProfile, getGeography, aadhaarSendOTP, aadhaarVerifyOTP, lookupIFSC } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import WebcamCapture from '../../components/WebcamCapture'

// ── Static data ────────────────────────────────────────────────────────────────

const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'OTHER', label: 'Other / Prefer not to say' },
]

const CATEGORIES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'OBC', label: 'OBC (Other Backward Class)' },
  { value: 'SC', label: 'SC (Scheduled Caste)' },
  { value: 'ST', label: 'ST (Scheduled Tribe)' },
  { value: 'EWS', label: 'EWS (Economically Weaker Section)' },
]

const INDIAN_BANKS = [
  "State Bank of India", "Bank of Baroda", "Punjab National Bank", "Canara Bank",
  "Union Bank of India", "Bank of India", "Indian Bank", "Central Bank of India",
  "Indian Overseas Bank", "UCO Bank", "Bank of Maharashtra", "Punjab & Sind Bank",
  "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "Yes Bank",
  "IDFC First Bank", "IndusInd Bank", "Federal Bank", "South Indian Bank",
  "Karur Vysya Bank", "Lakshmi Vilas Bank", "City Union Bank", "Tamilnad Mercantile Bank",
  "Dhanlaxmi Bank", "Nainital Bank", "Bandhan Bank", "AU Small Finance Bank",
  "Equitas Small Finance Bank", "Ujjivan Small Finance Bank", "Fincare Small Finance Bank",
  "Jana Small Finance Bank", "Suryoday Small Finance Bank", "Utkarsh Small Finance Bank",
  "North East Small Finance Bank", "ESAF Small Finance Bank", "Shivalik Small Finance Bank",
  "Paytm Payments Bank", "Airtel Payments Bank", "India Post Payments Bank",
  "Fino Payments Bank", "Jio Payments Bank",
  "Gujarat State Co-operative Bank", "Sarvodaya Commercial Co-op Bank",
  "Saraswat Co-operative Bank", "COSMOS Co-operative Bank",
]

const STEP_LABELS = ['Aadhaar', 'Personal', 'Location', 'Bank', 'Face ID']
const STEP_ICONS = [Fingerprint, User, MapPin, CreditCard, Camera]

// ── Validation helpers ────────────────────────────────────────────────────────

const validate = {
  aadhaar: (v) => /^\d{12}$/.test(v.replace(/\s/g, '')) ? null : 'Enter valid 12-digit Aadhaar number',
  otp: (v) => /^\d{6}$/.test(v) ? null : 'OTP must be 6 digits',
  phone: (v) => /^[6-9]\d{9}$/.test(v) ? null : 'Enter valid 10-digit Indian mobile number',
  dob: (v) => {
    if (!v) return 'Date of birth is required'
    const age = (new Date() - new Date(v)) / (365.25 * 24 * 3600 * 1000)
    if (age < 5) return 'Age must be at least 5 years'
    if (age > 120) return 'Invalid date of birth'
    return null
  },
  income: (v) => !v || (parseFloat(v) >= 0 && parseFloat(v) <= 10000000) ? null : 'Enter valid annual income (0 - 1 Crore)',
  bankAccount: (v) => !v || /^\d{9,18}$/.test(v) ? null : 'Account number must be 9–18 digits',
  ifsc: (v) => !v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()) ? null : 'IFSC must be like SBIN0001234 (11 chars)',
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CompleteProfile() {
  const navigate = useNavigate()
  const { officer, login: authLogin } = useAuth()
  const [step, setStep] = useState(1) // 1=Aadhaar, 2=Personal, 3=Location, 4=Bank, 5=Face
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [geography, setGeography] = useState([])

  // Step 1 — Aadhaar
  const [aadhaar, setAadhaar] = useState('')
  const [aadhaarDisplay, setAadhaarDisplay] = useState('')
  const [showAadhaar, setShowAadhaar] = useState(false)
  const [aadhaarSending, setAadhaarSending] = useState(false)
  const [transactionId, setTransactionId] = useState(null)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [aadhaarVerified, setAadhaarVerified] = useState(false)
  const [aadhaarData, setAadhaarData] = useState(null)
  const [demoMode, setDemoMode] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  // Step 2 — Personal
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')
  const [caste, setCaste] = useState('')
  const [income, setIncome] = useState('')

  // Step 3 — Location
  const [district, setDistrict] = useState('')
  const [taluka, setTaluka] = useState('')
  const [address, setAddress] = useState('')

  // Step 4 — Bank
  const [bankSearch, setBankSearch] = useState('')
  const [bankName, setBankName] = useState('')
  const [showBankDropdown, setShowBankDropdown] = useState(false)
  const [bankAccount, setBankAccount] = useState('')
  const [bankIfsc, setBankIfsc] = useState('')
  const [ifscLooking, setIfscLooking] = useState(false)
  const [ifscData, setIfscData] = useState(null)
  const [ifscError, setIfscError] = useState('')
  const bankSearchRef = useRef(null)

  // Step 5 — Face
  const [facePhoto, setFacePhoto] = useState(null)

  useEffect(() => {
    getGeography().then(g => { if (g?.length) setGeography(g) })
  }, [])

  useEffect(() => {
    if (aadhaarData?.address) setAddress(aadhaarData.address)
    if (aadhaarData?.dob) setDob(aadhaarData.dob)
    if (aadhaarData?.gender) setGender(aadhaarData.gender === 'M' ? 'M' : aadhaarData.gender === 'F' ? 'F' : 'OTHER')
  }, [aadhaarData])

  // Resend countdown
  useEffect(() => {
    if (resendCountdown > 0) {
      const t = setTimeout(() => setResendCountdown(r => r - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendCountdown])

  const districtTalukas = geography.find(g => g.district === district)?.talukas || []

  // ── Aadhaar formatting ───────────────────────────────────────────────────────

  const handleAadhaarInput = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12)
    setAadhaar(raw)
    const display = raw.replace(/(\d{4})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(' ')
    )
    setAadhaarDisplay(display)
  }

  // ── Aadhaar Send OTP ─────────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    const err = validate.aadhaar(aadhaar)
    if (err) { setError(err); return }
    setError('')
    setAadhaarSending(true)
    try {
      const res = await aadhaarSendOTP(aadhaar)
      setTransactionId(res.transaction_id)
      setOtpSent(true)
      setDemoMode(res.demo_mode)
      setResendCountdown(60)
    } catch (e) {
      setError(e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setAadhaarSending(false)
    }
  }

  const handleVerifyOTP = async () => {
    const err = validate.otp(otp)
    if (err) { setError(err); return }
    setError('')
    setLoading(true)
    try {
      const res = await aadhaarVerifyOTP(transactionId, otp)
      setAadhaarVerified(true)
      setAadhaarData(res)
    } catch (e) {
      setError(e?.response?.data?.detail || 'OTP verification failed')
    } finally {
      setLoading(false)
    }
  }

  // ── IFSC Lookup ──────────────────────────────────────────────────────────────

  const handleIfscLookup = async () => {
    const err = validate.ifsc(bankIfsc)
    if (err) { setIfscError(err); return }
    if (bankIfsc.length < 11) return
    setIfscLooking(true)
    setIfscData(null)
    setIfscError('')
    const data = await lookupIFSC(bankIfsc)
    if (data) {
      setIfscData(data)
      if (data.BANK && !bankName) setBankName(data.BANK)
      if (data.BANK && !bankSearch) setBankSearch(data.BANK)
    } else {
      setIfscError('IFSC code not found. Check and try again.')
    }
    setIfscLooking(false)
  }

  // ── Step validation ──────────────────────────────────────────────────────────

  const validateCurrentStep = () => {
    setError('')
    if (step === 1) {
      if (!aadhaarVerified) return 'Please verify your Aadhaar to continue'
      return null
    }
    if (step === 2) {
      return validate.phone(phone)
        || (!gender ? 'Select gender' : null)
        || validate.dob(dob)
        || (!caste ? 'Select caste category' : null)
        || validate.income(income)
    }
    if (step === 3) {
      if (!district) return 'Select your district'
      if (!taluka) return 'Select your taluka'
      return null
    }
    if (step === 4) {
      if (bankAccount && validate.bankAccount(bankAccount)) return validate.bankAccount(bankAccount)
      if (bankIfsc && validate.ifsc(bankIfsc)) return validate.ifsc(bankIfsc)
      return null
    }
    return null
  }

  const handleNext = () => {
    const err = validateCurrentStep()
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
  }

  const handleFaceCapture = (base64) => {
    setFacePhoto(base64)
    handleSubmit(base64)
  }

  const handleSubmit = async (capturedFace = facePhoto) => {
    setError(''); setLoading(true)
    try {
      await completeProfile({
        phone:                phone.trim(),
        district,
        taluka,
        gender,
        dob,
        caste_category:       caste,
        income:               income ? parseFloat(income) : null,
        bank_name:            bankName || null,
        bank_account_display: bankAccount || null,
        bank_ifsc:            bankIfsc.toUpperCase() || null,
        address:              address || null,
        aadhaar_verified:     aadhaarVerified,
        face_photo:           capturedFace || null,
      })
      if (officer) authLogin('USER', { ...officer, profile_complete: true, district })
      navigate('/user/dashboard', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save profile')
      setLoading(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────────

  const inputClass = "w-full px-4 py-3 bg-surface-lowest border border-border-subtle text-sm font-mono text-text-primary rounded-xl outline-none focus:ring-2 focus:ring-primary-override/40 transition-all placeholder:text-text-secondary/50"
  const selectClass = "w-full px-4 py-3 bg-surface-lowest border border-border-subtle text-sm text-text-primary rounded-xl outline-none focus:ring-2 focus:ring-primary-override/40 transition-all"
  const labelClass = "block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5"

  const FieldError = ({ msg }) => msg ? (
    <p className="text-xs text-risk-critical font-data mt-1 flex items-center gap-1">
      <AlertCircle size={11} /> {msg}
    </p>
  ) : null

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-workspace flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Complete Your Profile</h1>
          <p className="text-sm text-text-secondary font-data mt-1">Secure government-verified registration</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEP_LABELS.map((label, i) => {
            const s = i + 1
            const Icon = STEP_ICONS[i]
            const done = s < step
            const active = s === step
            return (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                    done ? 'bg-emerald-600 text-white' :
                    active ? 'bg-primary-override text-white ring-4 ring-primary-override/20' :
                    'bg-surface-low text-text-secondary'
                  }`}>
                    {done ? <CheckCircle size={17} /> : <Icon size={15} />}
                  </div>
                  <span className={`text-[9px] mt-1 font-bold uppercase tracking-wide ${active ? 'text-primary-override' : done ? 'text-emerald-600' : 'text-text-secondary'}`}>
                    {label}
                  </span>
                </div>
                {i < 4 && <div className={`flex-1 h-0.5 mx-1 mb-4 rounded ${done ? 'bg-emerald-500' : 'bg-surface-low'}`} />}
              </div>
            )
          })}
        </div>

        <div className="bg-surface-lowest rounded-2xl border border-border-subtle p-6 shadow-lg">

          {/* ── STEP 1: Aadhaar Verification ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Fingerprint size={18} className="text-primary-override" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Aadhaar Verification</h3>
              </div>

              <div className="bg-tint-blue border border-border-subtle rounded-xl p-4 text-xs font-data text-text-secondary space-y-1 leading-relaxed">
                <p className="font-bold text-primary-override flex items-center gap-1.5"><Info size={12} /> Powered by UIDAI via Sandbox.co.in</p>
                <p>An OTP will be sent to your Aadhaar-linked mobile number. Demo mode uses Sandbox test credentials (no real OTP).</p>
              </div>

              {!aadhaarVerified ? (
                <>
                  {/* Aadhaar input */}
                  <div>
                    <label className={labelClass}>Aadhaar Number</label>
                    <div className="relative">
                      <input
                        type={showAadhaar ? 'text' : 'password'}
                        value={showAadhaar ? aadhaarDisplay : aadhaarDisplay.replace(/\d(?=(?:\s+\d{4})+$)|(?<!\d)\d(?!\d)/g, '•')}
                        onChange={handleAadhaarInput}
                        placeholder="XXXX XXXX XXXX"
                        maxLength={14}
                        disabled={otpSent}
                        className={`${inputClass} pr-20 tracking-widest text-base`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button type="button" onClick={() => setShowAadhaar(s => !s)} className="text-text-secondary hover:text-text-primary">
                          {showAadhaar ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        <span className="text-xs font-mono text-text-secondary">{aadhaar.length}/12</span>
                      </div>
                    </div>
                  </div>

                  {/* OTP */}
                  {otpSent && (
                    <div className="space-y-3">
                      <div className={`px-4 py-3 rounded-xl text-xs font-data border ${demoMode ? 'bg-tint-yellow border-yellow-300 text-yellow-800' : 'bg-tint-emerald border-emerald-200 text-emerald-800'}`}>
                        {demoMode
                          ? '⚡ DEMO MODE — API keys not configured. Use OTP: 123456'
                          : 'OTP sent to your Aadhaar-linked mobile. Valid for 10 minutes.'}
                      </div>
                      <div>
                        <label className={labelClass}>Enter OTP</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={otp}
                          onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6-digit OTP"
                          maxLength={6}
                          className={`${inputClass} tracking-[0.5em] text-center text-lg font-mono`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleVerifyOTP}
                          disabled={loading || otp.length < 6}
                          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                          Verify OTP
                        </button>
                        <button
                          onClick={() => { setOtpSent(false); setOtp(''); setTransactionId(null) }}
                          className="px-4 py-3 border border-border-subtle text-text-secondary text-sm rounded-xl hover:bg-surface-low transition-colors"
                        >
                          Change
                        </button>
                      </div>
                      {resendCountdown > 0 ? (
                        <p className="text-xs text-text-secondary text-center font-data">Resend in {resendCountdown}s</p>
                      ) : (
                        <button onClick={handleSendOTP} className="text-xs text-primary-override underline w-full text-center font-data">
                          Resend OTP
                        </button>
                      )}
                    </div>
                  )}

                  {!otpSent && (
                    <button
                      onClick={handleSendOTP}
                      disabled={aadhaar.length < 12 || aadhaarSending}
                      className="w-full py-3 bg-gradient-to-r from-primary-override to-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:brightness-110"
                    >
                      {aadhaarSending ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                      {aadhaarSending ? 'Sending OTP…' : 'Send OTP to Aadhaar Mobile'}
                    </button>
                  )}
                </>
              ) : (
                /* Verified state */
                <div className="bg-tint-emerald border border-emerald-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle size={20} />
                    <span className="font-bold text-sm">Aadhaar Verified Successfully</span>
                    {demoMode && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Demo</span>}
                  </div>
                  {aadhaarData && (
                    <div className="grid grid-cols-2 gap-3 text-xs font-data">
                      {aadhaarData.name && (
                        <div><span className="text-text-secondary">Name</span><p className="font-bold text-text-primary">{aadhaarData.name}</p></div>
                      )}
                      {aadhaarData.dob && (
                        <div><span className="text-text-secondary">Date of Birth</span><p className="font-bold text-text-primary">{aadhaarData.dob}</p></div>
                      )}
                      {aadhaarData.gender && (
                        <div><span className="text-text-secondary">Gender</span><p className="font-bold text-text-primary">{aadhaarData.gender}</p></div>
                      )}
                      {aadhaarData.address && (
                        <div className="col-span-2"><span className="text-text-secondary">Address</span><p className="font-bold text-text-primary">{aadhaarData.address}</p></div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Personal Info ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User size={16} className="text-primary-override" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Personal Information</h3>
              </div>

              {aadhaarData?.name && (
                <div className="bg-surface-low px-4 py-2.5 rounded-xl text-xs font-data text-text-secondary border border-border-subtle">
                  Pre-filled from Aadhaar. Review and correct if needed.
                </div>
              )}

              <div>
                <label className={labelClass}>Mobile Number <span className="text-risk-critical">*</span></label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-text-secondary font-mono">+91</span>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9XXXXXXXXX" maxLength={10} className={`${inputClass} pl-14`} />
                </div>
                <FieldError msg={phone && validate.phone(phone)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Gender <span className="text-risk-critical">*</span></label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className={selectClass}>
                    <option value="">— Select —</option>
                    {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date of Birth <span className="text-risk-critical">*</span></label>
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                    max={new Date().toISOString().split('T')[0]} className={selectClass} />
                  <FieldError msg={dob && validate.dob(dob)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Caste Category <span className="text-risk-critical">*</span></label>
                  <select value={caste} onChange={e => setCaste(e.target.value)} className={selectClass}>
                    <option value="">— Select —</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Annual Family Income (₹)</label>
                  <input type="number" value={income} onChange={e => setIncome(e.target.value)}
                    placeholder="Optional" min="0" max="10000000" className={inputClass} />
                  <FieldError msg={income && validate.income(income)} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Location ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={16} className="text-primary-override" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Location Details</h3>
              </div>

              <div>
                <label className={labelClass}>District <span className="text-risk-critical">*</span></label>
                <select value={district} onChange={e => { setDistrict(e.target.value); setTaluka('') }} className={selectClass}>
                  <option value="">— Select District —</option>
                  {geography.map(g => <option key={g.district} value={g.district}>{g.district}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>Taluka <span className="text-risk-critical">*</span></label>
                <select value={taluka} onChange={e => setTaluka(e.target.value)} disabled={!district} className={selectClass}>
                  <option value="">— Select Taluka —</option>
                  {districtTalukas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className={labelClass}>Full Address</label>
                <textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder={aadhaarData?.address || "House/Flat No., Street, Village/City..."}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          )}

          {/* ── STEP 4: Bank Details ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={16} className="text-primary-override" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Bank Details</h3>
              </div>
              <p className="text-xs text-text-secondary font-data bg-surface-low px-3 py-2 rounded-lg border border-border-subtle">
                Used for DBT scheme disbursement verification. Bank details are optional but recommended.
              </p>

              {/* Bank name searchable dropdown */}
              <div className="relative" ref={bankSearchRef}>
                <label className={labelClass}>Bank Name</label>
                <div className="relative">
                  <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={e => { setBankSearch(e.target.value); setShowBankDropdown(true); setBankName('') }}
                    onFocus={() => setShowBankDropdown(true)}
                    placeholder="Search bank name…"
                    className={`${inputClass} pl-10`}
                  />
                  {bankName && (
                    <button onClick={() => { setBankName(''); setBankSearch('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-risk-critical">
                      <X size={14} />
                    </button>
                  )}
                </div>
                {showBankDropdown && bankSearch && !bankName && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface-lowest border border-border-subtle rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
                    {INDIAN_BANKS.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase())).slice(0, 12).map(b => (
                      <button
                        key={b}
                        className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-tint-blue transition-colors flex items-center gap-2 border-b border-border-subtle last:border-0"
                        onClick={() => { setBankName(b); setBankSearch(b); setShowBankDropdown(false) }}
                      >
                        <Building2 size={13} className="text-text-secondary flex-shrink-0" /> {b}
                      </button>
                    ))}
                    {INDIAN_BANKS.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase())).length === 0 && (
                      <div className="px-4 py-3 text-sm text-text-secondary font-data">
                        No match — type the full bank name and press Enter
                      </div>
                    )}
                  </div>
                )}
                {bankName && <p className="text-xs text-emerald-600 font-data mt-1 flex items-center gap-1"><CheckCircle size={11} /> {bankName} selected</p>}
              </div>

              {/* Account number */}
              <div>
                <label className={labelClass}>Account Number</label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value.replace(/\D/g, '').slice(0, 18))}
                  placeholder="9–18 digit account number"
                  className={`${inputClass} tracking-widest`}
                />
                <FieldError msg={bankAccount && validate.bankAccount(bankAccount)} />
              </div>

              {/* IFSC Code with auto-lookup */}
              <div>
                <label className={labelClass}>IFSC Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bankIfsc}
                    onChange={e => {
                      setBankIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))
                      setIfscData(null); setIfscError('')
                    }}
                    placeholder="SBIN0001234"
                    maxLength={11}
                    className={`${inputClass} tracking-widest uppercase flex-1`}
                  />
                  <button
                    onClick={handleIfscLookup}
                    disabled={bankIfsc.length < 11 || ifscLooking}
                    className="px-4 py-3 bg-surface-low border border-border-subtle rounded-xl text-sm font-bold text-text-primary hover:bg-tint-blue transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {ifscLooking ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Verify
                  </button>
                </div>
                <FieldError msg={bankIfsc && validate.ifsc(bankIfsc)} />
                <FieldError msg={ifscError} />
                {ifscData && (
                  <div className="mt-2 bg-tint-emerald border border-emerald-200 rounded-xl px-4 py-3 text-xs font-data space-y-1">
                    <p className="font-bold text-emerald-700 flex items-center gap-1"><CheckCircle size={11} /> IFSC Verified</p>
                    <p className="text-text-primary"><span className="text-text-secondary">Bank:</span> {ifscData.BANK}</p>
                    <p className="text-text-primary"><span className="text-text-secondary">Branch:</span> {ifscData.BRANCH}</p>
                    <p className="text-text-primary"><span className="text-text-secondary">City:</span> {ifscData.CITY}, {ifscData.STATE}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 5: Face ID ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Camera size={16} className="text-primary-override" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Face ID Enrolment</h3>
              </div>
              <p className="text-xs text-text-secondary font-data bg-surface-low px-3 py-2 rounded-lg border border-border-subtle">
                Take a selfie for identity verification. Used during KYC renewal — AI matches your face.
              </p>
              <div className="flex justify-center py-2">
                <WebcamCapture mode="enroll" onCapture={handleFaceCapture} disabled={loading} />
              </div>
            </div>
          )}

          {/* ── Error display ── */}
          {error && (
            <div className="flex items-start gap-2 bg-tint-red border border-risk-critical/20 rounded-xl px-4 py-3 mt-4">
              <AlertCircle size={15} className="text-risk-critical flex-shrink-0 mt-0.5" />
              <p className="text-xs text-risk-critical font-data leading-relaxed">{error}</p>
            </div>
          )}

          {/* ── Navigation buttons ── */}
          <div className="flex gap-3 mt-6">
            {step > 1 && step < 5 && (
              <button
                onClick={() => { setStep(s => s - 1); setError('') }}
                className="flex-1 py-3 border border-border-subtle text-text-primary text-sm font-bold rounded-xl hover:bg-surface-low transition-all flex items-center justify-center gap-1"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}

            {step < 5 && (
              <button
                onClick={handleNext}
                disabled={step === 1 && !aadhaarVerified}
                className="flex-1 py-3 bg-gradient-to-r from-primary-override to-blue-800 text-white text-sm font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110"
              >
                {step === 4 ? 'Continue to Face ID' : 'Next'} <ChevronRight size={16} />
              </button>
            )}

            {step === 5 && (
              <button
                onClick={() => handleSubmit(null)}
                disabled={loading}
                className="flex-1 py-3 border border-border-subtle text-text-secondary text-sm font-bold rounded-xl hover:bg-surface-low transition-all flex items-center justify-center gap-1 disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                Skip Face ID & Submit
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-text-secondary/50 font-data mt-4">
          Government of Gujarat · EduGuard DBT · Data protected under IT Act 2000
        </p>
      </div>
    </div>
  )
}
