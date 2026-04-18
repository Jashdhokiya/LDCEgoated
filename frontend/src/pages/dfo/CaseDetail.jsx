import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, getVerifiers, assignInvestigation } from '../../api'
import { LeakageBadge } from '../../components/RiskBadge'
import { Sparkles, Loader2, Check, UserPlus, MapPin, X, ArrowLeft } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

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
    setAiLoading(true)
    try {
      const res = await api.generateEvidence(flagId)
      setFlag({ ...flag, evidence: res.data.evidence })
      setEvidenceSource(res.data.source)
    } catch (e) {
      console.error(e)
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
      // Auto-close after 2s
      setTimeout(() => setShowAssignModal(false), 2000)
    } catch (e) {
      console.error('Assignment failed:', e)
      alert('Assignment failed. Please try again.')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) return <div className="p-8 text-text-secondary font-data">{t('caseDetail.loadingCase')}</div>
  if (!flag) return <div className="p-8 text-text-secondary font-data">{t('caseDetail.caseNotFound')}</div>

  const getBannerColor = (label) => {
    if (label === 'CRITICAL') return 'bg-risk-critical'
    if (label === 'HIGH') return 'bg-risk-high'
    if (label === 'MEDIUM') return 'bg-risk-medium'
    return 'bg-risk-low'
  }

  const isAssigned = flag.status === 'ASSIGNED_TO_VERIFIER' || flag.status === 'VERIFICATION_SUBMITTED'

  return (
    <div className="p-8 font-sans">
      {/* Back button */}
      <button
        onClick={() => navigate('/dfo/queue')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-semibold mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Investigation Queue
      </button>

      <div className="flex gap-6">
        {/* LEFT COLUMN (60%) */}
        <div className="w-3/5 flex flex-col gap-6">
          <div className="bg-surface-lowest rounded-lg shadow-sm overflow-hidden">
            <div className={`h-2 ${getBannerColor(flag.risk_label)} w-full`}></div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-text-primary">{flag.beneficiary_name}</h1>
                  <p className="text-sm font-data text-text-secondary mt-1">{flag.district} · {flag.scheme}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-text-secondary">Flag ID: {flag.flag_id}</div>
                  <div className="font-mono text-sm text-text-secondary mt-1">Status: {flag.status || 'OPEN'}</div>
                </div>
              </div>
              <LeakageBadge type={flag.leakage_type} />
            </div>
          </div>

          <div className="bg-surface-lowest border border-border-subtle rounded-sm p-6 shadow-[inset_0_0_20px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-text-secondary font-sans">{t('caseDetail.evidenceRecord')}</span>
              <button
                onClick={handleGenerateAIEvidence}
                disabled={aiLoading || evidenceSource === 'ai'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-sans rounded-sm bg-gradient-to-b from-primary-override to-shell text-white hover:shadow-md disabled:opacity-50 transition-all"
              >
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiLoading ? t('caseDetail.generatingAI') : evidenceSource === 'ai' ? t('caseDetail.aiEvidence') : t('caseDetail.generateAI')}
              </button>
            </div>
            <pre className="font-mono text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
{`┌─────────────────────────────────────────────┐
│  EVIDENCE RECORD                            │
│  Flag ID: ${flag.flag_id.padEnd(25)} │
│  Generated by EduGuard Intelligence Unit    │
│  Source: ${(evidenceSource === 'ai' ? 'Groq AI (LLaMA 3.3 70B)' : 'Template Engine').padEnd(27)} │
├─────────────────────────────────────────────┤
│                                             │
│  ${flag.evidence || "No evidence string generated by AI layer."}                               
│                                             │
│  DATA SOURCES: Payment Ledger · Death       │
│  Registry · U-DISE · Aadhaar Registry       │
└─────────────────────────────────────────────┘`}
            </pre>
          </div>

          <div className="bg-surface-lowest p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">{t('caseDetail.dataRecords')}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm font-data">
              <div className="bg-surface-low p-4 rounded">
                <span className="text-text-secondary block text-xs mb-1 uppercase font-bold">{t('caseDetail.paymentAmount')}</span>
                <span className="font-mono font-medium text-lg text-text-primary">₹{flag.payment_amount?.toLocaleString('en-IN') || 0}</span>
              </div>
              <div className="bg-surface-low p-4 rounded">
                <span className="text-text-secondary block text-xs mb-1 uppercase font-bold">{t('caseDetail.disbursementDate')}</span>
                <span className="font-medium text-text-primary">{flag.payment_date || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (40%) */}
        <div className="w-2/5 flex flex-col gap-6">
          <div className="bg-surface-lowest p-6 rounded-lg shadow-sm text-center">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">{t('caseDetail.riskAssessment')}</h3>
            <div className={`text-6xl font-bold font-sans ${flag.risk_label === 'CRITICAL' ? 'text-risk-critical' : 'text-primary-override'}`}>
              {flag.risk_score}
            </div>
            <div className="text-sm font-data font-semibold text-text-secondary mt-2">{t('caseDetail.riskScoreOf100')}</div>
          </div>

          {/* ── Assign to Verifier ── */}
          <div className="bg-surface-lowest p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">Assign to Verifier</h3>

            {isAssigned ? (
              <div className="bg-tint-emerald border border-border-subtle rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Check size={16} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700">Assigned to Verifier</span>
                </div>
                <p className="text-xs text-emerald-600 font-data">
                  Verifier ID: {flag.assigned_verifier_id || '—'}
                </p>
                <p className="text-xs text-text-secondary font-data mt-1">
                  Status: {flag.status}
                </p>
              </div>
            ) : (
              <button
                onClick={openAssignModal}
                className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-sm transition-all shadow-sm"
              >
                <UserPlus size={16} /> Assign to Scheme Verifier
              </button>
            )}
          </div>

          <div className="bg-surface-lowest p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">{t('caseDetail.recommendedAction')}</h3>
            <p className="text-sm text-text-primary font-data bg-surface-low p-4 rounded border-l-4 border-primary-override leading-relaxed">
              {flag.recommended_action || t('caseDetail.defaultAction')}
            </p>
          </div>

          <div className="bg-surface-lowest p-6 rounded-lg shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">{t('caseDetail.statusManagement')}</h3>
            <select 
              value={selectedStatus} 
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-surface-lowest border border-border-subtle text-text-primary text-sm rounded p-2.5 mb-4 font-sans font-semibold outline-none focus:ring-2 focus:ring-primary-override"
            >
              <option value="OPEN">{t('caseDetail.openPending')}</option>
              <option value="ASSIGNED">{t('caseDetail.assignedField')}</option>
              <option value="ASSIGNED_TO_VERIFIER">ASSIGNED TO VERIFIER</option>
              <option value="RESOLVED">{t('caseDetail.resolvedClosed')}</option>
            </select>

            <button
              onClick={handleSaveChanges}
              disabled={saving || selectedStatus === flag.status}
              className="w-full bg-gradient-to-b from-primary-override to-shell text-white text-sm font-bold rounded p-2.5 hover:shadow-lg transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
              {saving ? 'Saving...' : saved ? 'Saved!' : t('caseDetail.saveChanges')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Assign Modal ── */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
          <div
            className="bg-surface-lowest rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-border-subtle"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-border-subtle bg-surface-low flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Assign to Scheme Verifier</h2>
                <p className="text-xs text-text-secondary font-data mt-0.5">
                  Case {flagId} · Select a verifier from your district
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-surface-low rounded-lg transition-colors">
                <X size={18} className="text-text-secondary" />
              </button>
            </div>

            {/* Modal body */}
            <div className="max-h-[400px] overflow-y-auto">
              {assignSuccess ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-tint-emerald flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-1">Case Assigned!</h3>
                  <p className="text-sm text-text-secondary font-data">
                    Assigned to <span className="font-bold">{assignSuccess.name}</span>
                  </p>
                  <p className="text-xs text-text-secondary font-data mt-1">
                    <MapPin size={11} className="inline mr-1" />{assignSuccess.taluka}, {assignSuccess.district}
                  </p>
                </div>
              ) : loadingVerifiers ? (
                <div className="p-8 flex items-center justify-center gap-3">
                  <Loader2 size={20} className="animate-spin text-primary-override" />
                  <span className="text-sm text-text-secondary font-data">Loading verifiers...</span>
                </div>
              ) : verifiers.length === 0 ? (
                <div className="p-8 text-center text-text-secondary font-data text-sm">
                  No verifiers found for your district.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {verifiers.map(v => (
                    <div
                      key={v.officer_id}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-surface-low transition-colors"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-600 font-bold text-sm">
                          {v.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'SV'}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">{v.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-text-secondary font-data">
                            <MapPin size={10} /> {v.taluka}
                          </span>
                          <span className="text-xs text-text-secondary font-data">·</span>
                          <span className="text-xs text-text-secondary font-data">{v.district}</span>
                        </div>
                        <p className="text-[10px] text-text-secondary font-mono mt-0.5">{v.officer_id}</p>
                      </div>

                      {/* Active cases badge */}
                      <div className="text-center flex-shrink-0 mr-2">
                        <p className="text-lg font-bold text-text-primary">{v.active_cases ?? 0}</p>
                        <p className="text-[10px] text-text-secondary font-data">cases</p>
                      </div>

                      {/* Assign button */}
                      <button
                        onClick={() => handleAssign(v)}
                        disabled={assigning}
                        className="px-4 py-2 bg-primary-override text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {assigning ? <Loader2 size={14} className="animate-spin" /> : 'Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
