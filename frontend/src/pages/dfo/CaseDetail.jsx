import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, getVerifiers, assignInvestigation } from '../../api'
import { LeakageBadge } from '../../components/RiskBadge'
import { 
  Sparkles, Loader2, Check, UserPlus, MapPin, X, ArrowLeft, 
  CreditCard, User, Landmark, Fingerprint, ShieldAlert,
  Calendar, FileText, ChevronRight, Info
} from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

// --- Helper Component: Risk Gauge ---
function RiskGauge({ score, label }) {
  const radius = 60;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  // We want a semi-circle (180 degrees)
  const semiCircumference = circumference / 2;
  const percentage = Math.min(Math.max(score, 0), 100);
  const strokeDashoffset = semiCircumference - (percentage / 100) * semiCircumference;

  const getColor = () => {
    if (label === 'CRITICAL') return '#ef4444' // red-500
    if (label === 'HIGH') return '#f97316' // orange-500
    if (label === 'MEDIUM') return '#facc15' // yellow-400
    return '#3b82f6' // blue-500
  }

  return (
    <div className="relative flex flex-col items-center justify-center pt-6 pb-2">
      <svg width="160" height="90" viewBox="0 0 160 90" className="rotate-0">
        {/* Background Arc */}
        <path
          d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Progress Arc */}
        <path
          d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none"
          stroke={getColor()}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${semiCircumference} ${semiCircumference}`}
          style={{ 
            strokeDashoffset, 
            transition: 'stroke-dashoffset 1s ease-out' 
          }}
        />
      </svg>
      <div className="absolute bottom-4 flex flex-col items-center">
        <span className="text-3xl font-bold text-text-primary tracking-tight">{score}</span>
        <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest mt-0.5">Risk Score / 100</span>
      </div>
    </div>
  )
}

export default function CaseDetail() {
  const { flagId } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [flag, setFlag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [evidenceSource, setEvidenceSource] = useState('template')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // ── Assign modal state ──
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [verifiers, setVerifiers] = useState([])
  const [loadingVerifiers, setLoadingVerifiers] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignSuccess, setAssignSuccess] = useState(null)
  const [showAIModal, setShowAIModal] = useState(false)

  useEffect(() => {
    if (!flagId) return
    api.getFlag(flagId).then(res => {
      setFlag(res.data)
      setSelectedStatus(res.data?.status || 'OPEN')
      setLoading(false)
      setEvidenceSource('template')
    }).catch(e => {
      console.error(e)
      setLoading(false)
    })
  }, [flagId])

  const handleStatusChange = async (newStatus) => {
    try {
      await api.updateFlagStatus(flagId, newStatus)
      setFlag({ ...flag, status: newStatus })
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveChanges = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await handleStatusChange(selectedStatus)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateAIEvidence = async () => {
    if (aiLoading) return
    setAiLoading(true)
    try {
      console.log('[CaseDetail] Generating evidence for:', flagId)
      const res = await api.generateEvidence(flagId)
      console.log('[CaseDetail] AI Result:', res.data)
      
      if (res.data && res.data.evidence) {
        setFlag(prev => ({ ...prev, evidence: res.data.evidence }))
        setEvidenceSource(res.data.source || 'ai')
        setShowAIModal(true)
      } else {
        throw new Error('AI failed to return evidence content')
      }
    } catch (e) {
      console.error('[CaseDetail] AI Generation Error:', e)
      const msg = e.code === 'ECONNABORTED' 
        ? 'AI Analysis timed out. The server is taking too long to process the data. Please try again in a few moments.'
        : 'AI Analysis failed: ' + (e.response?.data?.detail || e.message)
      alert(msg)
    } finally {
      setAiLoading(false)
    }
  }

  // ── Assign to verifier ──
  const openAssignModal = async () => {
    setShowAssignModal(true)
    setLoadingVerifiers(true)
    setAssignSuccess(null)
    try {
      const data = await getVerifiers()
      setVerifiers(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setVerifiers([])
    } finally {
      setLoadingVerifiers(false)
    }
  }

  const handleAssign = async (verifier) => {
    setAssigning(true)
    try {
      await assignInvestigation(flagId, verifier.officer_id)
      setAssignSuccess(verifier)
      setFlag({
        ...flag,
        status: 'ASSIGNED_TO_VERIFIER',
        assigned_verifier_id: verifier.officer_id,
      })
      setSelectedStatus('ASSIGNED_TO_VERIFIER')
      setTimeout(() => setShowAssignModal(false), 2000)
    } catch (e) {
      console.error('Assignment failed:', e)
      alert('Assignment failed. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-low gap-4">
      <Loader2 size={40} className="animate-spin text-primary-override" />
      <span className="text-text-secondary font-medium">{t('caseDetail.loadingCase')}</span>
    </div>
  )
  
  if (!flag) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-low gap-4">
      <ShieldAlert size={48} className="text-red-500" />
      <span className="text-text-secondary font-bold text-xl">{t('caseDetail.caseNotFound')}</span>
      <button onClick={() => navigate('/dfo/queue')} className="text-primary-override font-bold hover:underline">Back to Queue</button>
    </div>
  )

  const isAssigned = flag.status === 'ASSIGNED_TO_VERIFIER' || flag.status === 'VERIFICATION_SUBMITTED'

  // Helper to parse evidence into bullet points
  const evidenceBullets = flag?.evidence 
    ? flag.evidence.includes('\n')
      ? flag.evidence.split('\n').map(s => s.trim()).filter(s => s.length > 10)
      : flag.evidence.split('.').map(s => s.trim()).filter(s => s.length > 10).map(s => s + '.')
    : ["No specific evidence points generated yet. Use AI layer for analysis."]

  return (
    <div className="min-h-screen bg-surface-low/50 pb-12">
      {/* --- Breadcrumb/Header --- */}
      <div className="bg-surface-lowest border-b border-border-subtle px-8 py-4 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dfo/queue')}
              className="p-2 hover:bg-surface rounded-lg transition-colors text-text-secondary"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold text-text-primary">EduGuard Case Management</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-widest">
            <span>District Dashboard</span>
            <ChevronRight size={12} />
            <span className="text-primary-override">Case Detail</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-6">
        
        {/* --- CASE HEADER --- */}
        <section className="bg-surface-lowest rounded-2xl shadow-sm border border-border-subtle p-8">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">Case Header</span>
            
            <div className="flex flex-wrap items-center gap-4 mb-2">
              <h2 className="text-3xl font-extrabold text-[#1e293b] tracking-tight">
                {flag.beneficiary_name}
              </h2>
              <div className="flex gap-2">
                <LeakageBadge type={flag.leakage_type} />
                {flag.risk_label === 'CRITICAL' && (
                  <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-full border border-red-100">
                    Critical Intervention
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-text-secondary font-medium">
              <div className="flex items-center gap-1.5">
                <MapPin size={16} className="text-text-secondary" />
                <span>{flag.district} · {flag.taluka || 'NLY'}</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden sm:block"></div>
              <div>Flag ID: <span className="text-text-primary font-bold">{flag.flag_id}</span></div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden sm:block"></div>
              <div>Status: <span className={`font-bold ${flag.status === 'OPEN' ? 'text-blue-600' : 'text-text-primary'}`}>{flag.status || 'OPEN'}</span></div>
            </div>
          </div>
        </section>


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* --- LEFT AREA (Evidence + Data Records) (COL 1-9) --- */}
          <div className="lg:col-span-9 flex flex-col gap-6">
            
            {/* EVIDENCE DOSSIER */}
            <div className="bg-surface-lowest rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
              <div className="bg-[#0f172a] px-6 py-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-sm tracking-wide">Case Evidence</h3>
                <button
                  onClick={handleGenerateAIEvidence}
                  disabled={aiLoading || evidenceSource === 'ai'}
                  className="bg-surface-lowest text-[#0f172a] px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-surface transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {aiLoading ? 'Analyzing...' : 'Generate AI Evidence'}
                </button>
              </div>
              <div className="p-8">
                <div className="mb-8">
                  <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-4">Evidence Summary</h4>
                  <ul className="space-y-4">
                    {evidenceBullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0"></div>
                        <p className="text-text-secondary text-sm leading-relaxed">{bullet}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-4">Data Sources</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { icon: CreditCard, label: 'Payment Ledger', color: 'bg-blue-50 text-blue-600' },
                      { icon: User, label: 'Death Registry', color: 'bg-red-50 text-red-600' },
                      { icon: Landmark, label: 'U-DISE', color: 'bg-indigo-50 text-indigo-600' },
                      { icon: Fingerprint, label: 'Aadhaar Registry', color: 'bg-orange-50 text-orange-600' },
                    ].map((source, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border-subtle hover:border-border-subtle transition-colors group">
                        <div className={`p-2 rounded-lg ${source.color} transition-transform group-hover:scale-110`}>
                          <source.icon size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wide">{source.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* DATA RECORDS (NEW POSITION & STYLE) */}
            <div className="bg-surface-lowest rounded-2xl shadow-sm border border-border-subtle p-8">
              <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-6">Data Records</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100/50">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-2">Payment Amount</span>
                  <div className="text-2xl font-black text-text-primary tracking-tight">₹{flag.payment_amount?.toLocaleString('en-IN') || 0}</div>
                </div>
                <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100/50">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-2">Disbursement Date</span>
                  <div className="text-2xl font-black text-text-primary tracking-tight">{flag.payment_date || '2024-08-25'}</div>
                </div>
              </div>
            </div>

          </div>

          {/* --- ACTION PANEL (COL 10-12) --- */}
          <div className="lg:col-span-3 space-y-6">

            <div className="bg-surface/80 rounded-2xl border border-border-subtle p-6">
              <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-4">Action Panel</h3>
              
              <div className="bg-surface-lowest rounded-xl p-4 shadow-sm border border-border-subtle mb-6 flex flex-col items-center">
                <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Risk Assessment</h4>
                <RiskGauge score={flag.risk_score} label={flag.risk_label} />
              </div>

              {isAssigned ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={18} className="text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-800">Assigned to Verifier</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-emerald-700/80 font-medium">ID: {flag.assigned_verifier_id || '—'}</p>
                    <p className="text-xs text-emerald-700/80 font-medium capitalize">Status: {flag.status?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={openAssignModal}
                  className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white py-4 rounded-xl font-bold text-sm shadow-md shadow-orange-500/20 transition-all active:scale-[0.98] mb-6 flex items-center justify-center gap-2"
                >
                  <UserPlus size={18} /> Assign to Scheme Verifier
                </button>
              )}

              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Info size={16} className="text-blue-600" />
                  <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Recommended Action</h4>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed font-medium">
                  {flag.recommended_action || "Freeze payment immediately. Initiate recovery proceedings. Refer to District Collector."}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2 px-1">Status Management</h4>
                  <div className="relative">
                    <select 
                      value={selectedStatus} 
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full appearance-none bg-surface-lowest border border-border-subtle text-text-primary text-sm font-bold rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-primary-override/20 focus:border-primary-override transition-all"
                    >
                      <option value="OPEN">OPEN - Pending Review</option>
                      <option value="ASSIGNED">ASSIGNED - Field Investigation</option>
                      <option value="ASSIGNED_TO_VERIFIER">ASSIGNED TO VERIFIER</option>
                      <option value="RESOLVED">RESOLVED - Case Closed</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
                      <ChevronRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveChanges}
                  disabled={saving || selectedStatus === flag.status}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <Check size={18} /> : null}
                  {saving ? 'Saving...' : saved ? 'Changes Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Assign Modal ── */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowAssignModal(false)}>
          <div
            className="bg-surface-lowest rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-border-subtle animate-in fade-in zoom-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-8 py-6 border-b border-border-subtle bg-surface-low/50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-text-primary">Assign to Scheme Verifier</h2>
                <p className="text-xs text-text-secondary font-bold uppercase tracking-widest mt-1">
                  Case {flagId} · District Officers
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-text-secondary">
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="max-h-[500px] overflow-y-auto p-2">
              {assignSuccess ? (
                <div className="p-12 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Check size={40} className="text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-text-primary mb-2">Successfully Assigned</h3>
                  <p className="text-text-secondary font-medium">
                    The case has been forwarded to <span className="text-text-primary font-bold">{assignSuccess.name}</span>
                  </p>
                </div>
              ) : loadingVerifiers ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4">
                  <Loader2 size={32} className="animate-spin text-primary-override" />
                  <span className="text-sm text-text-secondary font-bold uppercase tracking-widest">Finding available verifiers...</span>
                </div>
              ) : verifiers.length === 0 ? (
                <div className="p-12 text-center text-text-secondary font-bold uppercase tracking-widest text-xs">
                  No verifiers found for your district.
                </div>
              ) : (
                <div className="space-y-1">
                  {verifiers.map(v => (
                    <div
                      key={v.officer_id}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-surface-low transition-all rounded-2xl group cursor-pointer"
                      onClick={() => handleAssign(v)}
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center flex-shrink-0 group-hover:bg-primary-override/10 transition-colors">
                        <span className="text-text-secondary font-bold group-hover:text-primary-override transition-colors">
                          {v.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'SV'}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">{v.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-[10px] text-text-secondary font-bold uppercase tracking-wider">
                            <MapPin size={10} /> {v.taluka}
                          </span>
                          <span className="text-slate-200">·</span>
                          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">{v.district}</span>
                        </div>
                      </div>

                      {/* Active cases badge */}
                      <div className="text-center flex-shrink-0 px-4">
                        <p className="text-lg font-black text-text-primary">{v.active_cases ?? 0}</p>
                        <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">Active</p>
                      </div>

                      {/* Assign arrow */}
                      <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight size={20} className="text-primary-override" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AI Analysis Modal ── */}
      {showAIModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
          <div className="bg-surface-lowest rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-border-subtle animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
            {/* Modal Header */}
            <div className="bg-[#0f172a] px-10 py-8 relative">
              <button 
                onClick={() => setShowAIModal(false)}
                className="absolute top-6 right-6 p-2 bg-surface-lowest/10 hover:bg-surface-lowest/20 rounded-full text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-override flex items-center justify-center shadow-lg shadow-primary-override/20">
                  <Sparkles size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">AI Intelligence Report</h3>
                  <p className="text-text-secondary text-xs font-bold uppercase tracking-widest mt-0.5">Automated Investigative Analysis</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-surface"></div>
                <span className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Generated Evidence</span>
                <div className="h-px flex-1 bg-surface"></div>
              </div>

              <div className="space-y-4">
                {evidenceBullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-5 rounded-2xl bg-surface-low border border-border-subtle animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="w-8 h-8 rounded-full bg-surface-lowest border border-border-subtle flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Check size={14} className="text-emerald-500" />
                    </div>
                    <p className="text-text-secondary text-sm font-medium leading-relaxed mt-1">{bullet}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex gap-4">
                <button 
                  onClick={() => setShowAIModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] shadow-xl shadow-slate-200"
                >
                  Confirm & Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
