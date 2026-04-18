import { useState, useEffect } from 'react'
import { FileCheck, MapPin, BrainCircuit, CheckCircle, XCircle, Send, Loader2 } from 'lucide-react'
import { getAuditPending, auditDecide } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

export default function AuditOfficerDashboard() {
  const { t } = useLanguage()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState(null)

  useEffect(() => {
    getAuditPending().then(data => {
      const list = data?.pending || (Array.isArray(data) ? data : [])
      setCases(list)
      setLoading(false)
    })
  }, [])

  const handleVerify = async (caseId, decision) => {
    await auditDecide(caseId, decision, 'Reviewed by Audit Officer')
    setCases(prev => prev.map(c =>
      c.case_id === caseId
        ? { ...c, status: 'AUDIT_REVIEW', audit_report: { auditor_notes: 'Reviewed by Audit Officer', final_decision: decision } }
        : c
    ))
    setSelectedCase(null)
  }

  const handleForwardToDFO = () => {
    alert("Verified reports forwarded to DFO successfully!")
  }

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t('auditOfficer.title')}</h1>
          <p className="text-sm font-data text-text-secondary mt-1">{t('auditOfficer.subtitle')}</p>
        </div>
        <button 
          onClick={handleForwardToDFO}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-override text-white rounded-sm text-sm font-bold shadow-md hover:bg-blue-900 transition-colors"
        >
          <Send size={16} /> {t('auditOfficer.forwardReports')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileCheck size={20} className="text-primary-override" /> {t('auditOfficer.pendingReports')}
          </h2>
          
          {cases.filter(c => c.status === 'VERIFICATION_SUBMITTED').map(c => (
            <div key={c.case_id} className="bg-surface-lowest p-5 rounded-sm shadow-sm border border-border-subtle flex justify-between items-center hover:shadow-md transition-shadow">
              <div>
                <span className="text-xs font-mono bg-tint-blue text-primary-override px-2 py-1 rounded mb-2 inline-block">
                  {c.case_id}
                </span>
                <h3 className="text-sm font-bold text-text-primary">{t('queue.entity')}: {c.target_entity.entity_id}</h3>
                <p className="text-xs text-text-secondary mt-1">{t('queue.anomalyType')}: {c.anomaly_type}</p>
                <div className="flex items-center gap-4 mt-3 text-xs font-data">
                  <span className="flex items-center gap-1 text-text-secondary"><MapPin size={12} /> {t('verifier.gpsTagged')}</span>
                  <span className={`flex items-center gap-1 ${c.field_report.ai_verification_match ? 'text-green-600' : 'text-red-600'}`}>
                    <BrainCircuit size={12} /> {t('auditOfficer.aiMatch')}: {c.field_report.ai_verification_match ? t('common.yes') : t('common.no')}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCase(c)}
                className="px-4 py-2 border border-primary-override text-primary-override text-xs font-bold rounded hover:bg-primary-override hover:text-white transition-colors"
              >
                {t('auditOfficer.reviewReport')}
              </button>
            </div>
          ))}

          {cases.filter(c => c.status === 'VERIFICATION_SUBMITTED').length === 0 && (
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
            {cases.filter(c => c.status === 'AUDIT_REVIEW').map(c => (
              <div key={c.case_id} className="bg-surface-lowest p-4 rounded-sm border-l-4 border-green-500 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-bold text-text-primary">{c.case_id}</span>
                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${c.audit_report?.final_decision === 'LEGITIMATE' ? 'bg-tint-green text-emerald-600 dark:text-emerald-400' : 'bg-tint-red text-risk-critical'}`}>
                    {c.audit_report?.final_decision}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-2">{t('auditOfficer.readyForward')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-lowest rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-subtle flex justify-between items-center">
              <h3 className="text-xl font-bold text-text-primary">{t('auditOfficer.reviewReport')}: {selectedCase.case_id}</h3>
              <button onClick={() => setSelectedCase(null)} className="text-text-secondary hover:text-text-secondary">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">{t('auditOfficer.fieldEvidence')}</h4>
                  <div className="bg-surface-low rounded-sm overflow-hidden border border-border-subtle aspect-video relative">
                    <img src={selectedCase.field_report.photo_evidence_url} alt="Field Evidence" className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded flex flex-col items-end">
                      <span>Lat: {selectedCase.field_report.gps_coordinates.lat}</span>
                      <span>Lng: {selectedCase.field_report.gps_coordinates.lng}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">{t('auditOfficer.verifierNotes')}</h4>
                    <p className="text-sm text-text-primary bg-surface p-3 rounded-sm border border-border-subtle">
                      {selectedCase.field_report.verifier_notes}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">{t('auditOfficer.aiMatch')}</h4>
                    <div className={`p-4 rounded-sm border ${selectedCase.field_report.ai_verification_match ? 'bg-tint-green border-border-subtle' : 'bg-tint-red border-border-subtle'}`}>
                      <div className={`flex items-center gap-2 text-sm font-bold mb-3 ${selectedCase.field_report.ai_verification_match ? 'text-green-700' : 'text-red-700'}`}>
                        <BrainCircuit size={18} />
                        {selectedCase.field_report.ai_verification_match ? t('auditOfficer.matchConfirmed') : t('auditOfficer.mismatchDetected')}
                        <span className="ml-auto text-xs font-mono bg-surface-lowest px-2 py-1 rounded opacity-80 border border-current">
                          {t('auditOfficer.confidence')}: {selectedCase.field_report.ai_analysis?.confidence_score}%
                        </span>
                      </div>
                      
                      {selectedCase.field_report.ai_analysis && (
                        <>
                          <p className="text-sm text-text-primary mb-3 leading-relaxed">
                            <strong>{t('auditOfficer.analysisReason')}:</strong> {selectedCase.field_report.ai_analysis.reason}
                          </p>
                          
                          <div className="space-y-1">
                            <strong className="text-xs uppercase tracking-wider text-text-secondary block mb-2">{t('auditOfficer.cryptoProofs')}:</strong>
                            <ul className="list-disc pl-4 text-xs text-text-primary space-y-1">
                              {selectedCase.field_report.ai_analysis.proofs.map((proof, i) => (
                                <li key={i}>{proof}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-1">{t('auditOfficer.submissionDate')}</h4>
                    <p className="text-sm font-mono text-text-primary">
                      {new Date(selectedCase.field_report.submission_timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border-subtle pt-6">
                <h4 className="text-sm font-bold text-text-primary mb-4">{t('auditOfficer.auditDecision')}</h4>
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleVerify(selectedCase.case_id, 'LEGITIMATE')}
                    className="flex-1 py-3 bg-green-600 text-white rounded-sm text-sm font-bold flex justify-center items-center gap-2 hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle size={18} /> {t('auditOfficer.markLegitimate')}
                  </button>
                  <button 
                    onClick={() => handleVerify(selectedCase.case_id, 'FRAUD_CONFIRMED')}
                    className="flex-1 py-3 bg-red-600 text-white rounded-sm text-sm font-bold flex justify-center items-center gap-2 hover:bg-red-700 transition-colors"
                  >
                    <XCircle size={18} /> {t('auditOfficer.confirmFraud')}
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
