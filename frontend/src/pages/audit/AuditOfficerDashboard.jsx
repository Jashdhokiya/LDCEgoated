import { useState, useEffect } from 'react'
import { FileCheck, MapPin, BrainCircuit, CheckCircle, XCircle, Send, Loader2 } from 'lucide-react'
import { getAuditPending, auditDecide } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

export default function AuditOfficerDashboard() {
  const { t } = useLanguage()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)
  const [deciding, setDeciding] = useState(false)

  useEffect(() => {
    getAuditPending().then(data => {
      const list = data?.pending || (Array.isArray(data) ? data : [])
      setCases(list)
      setLoading(false)
    })
  }, [])

  const getCaseId = (c) => c.case_id || c.flag_id

  const handleVerify = async (c, decision) => {
    setDeciding(true)
    await auditDecide(getCaseId(c), decision, 'Reviewed by Audit Officer')
    setCases(prev => prev.map(item =>
      getCaseId(item) === getCaseId(c)
        ? { ...item, status: 'AUDIT_REVIEW', audit_report: { auditor_notes: 'Reviewed by Audit Officer', final_decision: decision } }
        : item
    ))
    setDeciding(false)
    setSelectedCase(null)
  }

  const handleForwardToDFO = () => {
    const reviewedCount = cases.filter(c => c.status === 'AUDIT_REVIEW').length
    if (reviewedCount === 0) {
      alert('No reviewed cases to forward. Review pending cases first.')
      return
    }
    alert(`${reviewedCount} audit-reviewed case(s) are now visible to the DFO in their Investigation Queue under "Audit Reviewed" tab.`)
  }

  const pendingCases = cases.filter(c => c.status !== 'AUDIT_REVIEW')
  const reviewedCases = cases.filter(c => c.status === 'AUDIT_REVIEW')

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t('auditOfficer.title')}</h1>
          <p className="text-sm font-data text-text-secondary mt-1">{t('auditOfficer.subtitle')}</p>
        </div>
        <button 
          onClick={handleForwardToDFO}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-override text-white dark:text-shell rounded-sm text-sm font-bold shadow-md hover:brightness-110 transition-colors"
        >
          <Send size={16} /> {t('auditOfficer.forwardReports')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-surface-lowest rounded-sm border border-border-subtle">
          <Loader2 size={32} className="animate-spin text-primary-override" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileCheck size={20} className="text-primary-override" /> {t('auditOfficer.pendingReports')}
              <span className="text-xs font-mono bg-tint-blue text-primary-override px-2 py-0.5 rounded-full ml-2">{pendingCases.length}</span>
            </h2>
            
            {pendingCases.map(c => (
              <div key={getCaseId(c)} className="bg-surface-lowest p-5 rounded-sm shadow-sm border border-border-subtle flex justify-between items-center hover:shadow-md transition-shadow">
                <div>
                  <span className="text-xs font-mono bg-tint-blue text-primary-override px-2 py-1 rounded mb-2 inline-block">
                    {getCaseId(c)}
                  </span>
                  <h3 className="text-sm font-bold text-text-primary">
                    {c.beneficiary_name || c.target_entity?.name || c.target_entity?.entity_id || '—'}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">
                    {c.leakage_type || c.anomaly_type} · {c.district} · ₹{(c.payment_amount || 0).toLocaleString('en-IN')}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs font-data">
                    <span className="flex items-center gap-1 text-text-secondary">
                      Risk: <span className={`font-bold ${c.risk_score >= 70 ? 'text-risk-critical' : 'text-risk-medium'}`}>{c.risk_score}/100</span>
                    </span>
                    {c.field_report && (
                      <span className={`flex items-center gap-1 ${c.field_report.ai_verification_match ? 'text-green-600' : 'text-red-600'}`}>
                        <BrainCircuit size={12} /> AI: {c.field_report.ai_verification_match ? 'Match' : 'Mismatch'}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCase(c)}
                  className="px-4 py-2 border border-primary-override text-primary-override text-xs font-bold rounded hover:bg-primary-override hover:text-white dark:text-shell transition-colors"
                >
                  {t('auditOfficer.reviewReport')}
                </button>
              </div>
            ))}

            {pendingCases.length === 0 && (
              <div className="p-8 text-center text-text-secondary bg-surface-lowest border border-border-subtle rounded-sm">
                {t('auditOfficer.noPending')}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider mb-4">
              {t('auditOfficer.recentAudits')}
            </h2>
            <div className="space-y-3">
              {reviewedCases.map(c => (
                <div key={getCaseId(c)} className="bg-surface-lowest p-4 rounded-sm border-l-4 border-green-500 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold text-text-primary">{getCaseId(c)}</span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${c.audit_report?.final_decision === 'LEGITIMATE' ? 'bg-tint-green text-emerald-600 dark:text-emerald-400' : 'bg-tint-red text-risk-critical'}`}>
                      {c.audit_report?.final_decision}
                    </span>
                  </div>
                  <p className="text-xs text-text-primary mt-1 font-bold">{c.beneficiary_name || c.target_entity?.name || '—'}</p>
                  <p className="text-xs text-text-secondary mt-1">{t('auditOfficer.readyForward')}</p>
                </div>
              ))}
              {reviewedCases.length === 0 && (
                <p className="text-xs text-text-secondary font-data p-4 bg-surface-lowest rounded-sm border border-border-subtle text-center">
                  No cases reviewed yet. Review pending cases to get started.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-lowest rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-subtle flex justify-between items-center">
              <h3 className="text-xl font-bold text-text-primary">{t('auditOfficer.reviewReport')}: {getCaseId(selectedCase)}</h3>
              <button onClick={() => setSelectedCase(null)} className="text-text-secondary hover:text-text-primary">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Case Info */}
              <div className="grid grid-cols-2 gap-4 bg-surface-low p-4 rounded-sm">
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-widest font-bold">Beneficiary</span>
                  <p className="text-sm font-bold text-text-primary mt-1">{selectedCase.beneficiary_name || selectedCase.target_entity?.name || '—'}</p>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-widest font-bold">Anomaly Type</span>
                  <p className="text-sm font-bold text-text-primary mt-1">{selectedCase.leakage_type || selectedCase.anomaly_type}</p>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-widest font-bold">District</span>
                  <p className="text-sm text-text-primary mt-1">{selectedCase.district}</p>
                </div>
                <div>
                  <span className="text-xs text-text-secondary uppercase tracking-widest font-bold">Amount at Risk</span>
                  <p className="text-sm font-mono font-bold text-risk-critical mt-1">₹{(selectedCase.payment_amount || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Evidence / Notes */}
                <div>
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('auditOfficer.verifierNotes')}</h4>
                  <p className="text-sm text-text-primary bg-surface p-3 rounded-sm border border-border-subtle leading-relaxed">
                    {selectedCase.field_report?.verifier_notes || selectedCase.evidence || 'No notes available.'}
                  </p>
                </div>
                
                <div className="space-y-4">
                  {/* AI Analysis */}
                  {selectedCase.field_report && (
                    <div>
                      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">{t('auditOfficer.aiMatch')}</h4>
                      <div className={`p-4 rounded-sm border ${selectedCase.field_report.ai_verification_match ? 'bg-tint-green border-border-subtle' : 'bg-tint-red border-border-subtle'}`}>
                        <div className={`flex items-center gap-2 text-sm font-bold mb-3 ${selectedCase.field_report.ai_verification_match ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          <BrainCircuit size={18} />
                          {selectedCase.field_report.ai_verification_match ? t('auditOfficer.matchConfirmed') : t('auditOfficer.mismatchDetected')}
                          {selectedCase.field_report.ai_analysis && (
                            <span className="ml-auto text-xs font-mono bg-surface-lowest px-2 py-1 rounded opacity-80 border border-current">
                              {t('auditOfficer.confidence')}: {selectedCase.field_report.ai_analysis.confidence_score}%
                            </span>
                          )}
                        </div>
                        
                        {selectedCase.field_report.ai_analysis && (
                          <>
                            <p className="text-sm text-text-primary mb-3 leading-relaxed">
                              <strong>{t('auditOfficer.analysisReason')}:</strong> {selectedCase.field_report.ai_analysis.reason}
                            </p>
                            
                            {selectedCase.field_report.ai_analysis.proofs && (
                              <div className="space-y-1">
                                <strong className="text-xs uppercase tracking-wider text-text-secondary block mb-2">{t('auditOfficer.cryptoProofs')}:</strong>
                                <ul className="list-disc pl-4 text-xs text-text-primary space-y-1">
                                  {selectedCase.field_report.ai_analysis.proofs.map((proof, i) => (
                                    <li key={i}>{proof}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedCase.field_report?.gps_coordinates && (
                    <div>
                      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">GPS Location</h4>
                      <p className="text-xs font-mono text-text-primary flex items-center gap-1.5">
                        <MapPin size={12} className="text-primary-override" />
                        {selectedCase.field_report.gps_coordinates.lat}, {selectedCase.field_report.gps_coordinates.lng}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border-subtle pt-6">
                <h4 className="text-sm font-bold text-text-primary mb-4">{t('auditOfficer.auditDecision')}</h4>
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleVerify(selectedCase, 'LEGITIMATE')}
                    disabled={deciding}
                    className="flex-1 py-3 bg-green-600 text-white rounded-sm text-sm font-bold flex justify-center items-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {deciding ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                    {t('auditOfficer.markLegitimate')}
                  </button>
                  <button 
                    onClick={() => handleVerify(selectedCase, 'FRAUD_CONFIRMED')}
                    disabled={deciding}
                    className="flex-1 py-3 bg-red-600 text-white rounded-sm text-sm font-bold flex justify-center items-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deciding ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                    {t('auditOfficer.confirmFraud')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

