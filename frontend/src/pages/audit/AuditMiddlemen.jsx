import { useState, useEffect } from 'react'
import {
  Building2, AlertTriangle, ChevronDown, ChevronUp, Minus, Loader2,
  Sparkles, FileText, Send, CheckCircle, X, AlertCircle
} from 'lucide-react'
import { getAuditInstitutions, submitInstitutionReport } from '../../api'
import { useAuth } from '../../contexts/AuthContext'

const TYPE_COLORS = {
  SCHOOL: 'bg-tint-blue text-primary-override',
  COLLEGE: 'bg-tint-violet text-text-primary',
  BANK: 'bg-tint-emerald text-text-primary',
  GRAM_PANCHAYAT: 'bg-tint-yellow text-yellow-700',
}

function RiskScore({ score }) {
  if (score >= 75) return <span className="font-mono text-sm font-bold text-risk-critical">{score}</span>
  if (score >= 50) return <span className="font-mono text-sm font-bold text-risk-high">{score}</span>
  if (score >= 25) return <span className="font-mono text-sm font-bold text-risk-medium">{score}</span>
  return <span className="font-mono text-sm font-bold text-risk-low">{score}</span>
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''

async function generateAIReport(institution) {
  // Call Groq from frontend (or skip and use a fixed prompt as demo)
  const prompt = `You are a government audit officer writing a formal institution audit report for the Gujarat DBT (Direct Benefit Transfer) leakage detection system.

Institution Details:
- Name: ${institution.name}
- Type: ${institution.type}
- District: ${institution.district}, Taluka: ${institution.taluka}
- Beneficiary Count: ${institution.beneficiary_count}
- Total Funds Credited: ₹${institution.financial_ledger?.total_funds_credited?.toLocaleString('en-IN')}
- Total Funds Debited: ₹${institution.financial_ledger?.total_funds_debited?.toLocaleString('en-IN')}
- Current Holding: ₹${institution.financial_ledger?.current_holding?.toLocaleString('en-IN')}
- Risk Score: ${institution.risk_profile?.risk_score}/100
- Flagged: ${institution.risk_profile?.is_flagged ? 'YES' : 'NO'}
- Flag Reason: ${institution.risk_profile?.flag_reason || 'None'}

Write a concise, formal, 3-paragraph audit report covering:
1. Institution overview and fund flow summary
2. Risk observations and anomaly analysis
3. Recommendation (probe / monitor / clear)

Be specific, formal, and reference the numbers above.`

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` }
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.4,
    }),
  })
  if (!res.ok) throw new Error(`Groq error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export default function AuditMiddlemen() {
  const { officer } = useAuth()
  const [institutions, setInstitutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [sortKey, setSortKey] = useState('risk_profile.risk_score')
  const [sortDir, setSortDir] = useState('desc')

  // Report modal state
  const [reportModal, setReportModal] = useState(null)  // institution object
  const [reportText, setReportText] = useState('')
  const [riskSummary, setRiskSummary] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    getAuditInstitutions().then(data => {
      setInstitutions(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const sorted = [...institutions].sort((a, b) => {
    const getVal = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj) ?? 0
    return sortDir === 'desc' ? getVal(b, sortKey) - getVal(a, sortKey) : getVal(a, sortKey) - getVal(b, sortKey)
  })

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <Minus size={12} className="text-text-secondary/70" />
    return sortDir === 'desc' ? <ChevronDown size={12} className="text-primary-override" /> : <ChevronUp size={12} className="text-primary-override" />
  }

  const openReportModal = (inst) => {
    setReportModal(inst)
    setReportText('')
    setRiskSummary('')
    setRecommendation('')
    setAiGenerated(false)
    setSubmitted(false)
    setSubmitError('')
  }

  const handleGenerateAI = async () => {
    setAiGenerating(true)
    setSubmitError('')
    try {
      const text = await generateAIReport(reportModal)
      setReportText(text)
      // Auto-extract recommendation keyword
      const lower = text.toLowerCase()
      if (lower.includes('probe') || lower.includes('investigate')) setRecommendation('Probe')
      else if (lower.includes('monitor')) setRecommendation('Monitor')
      else setRecommendation('Clear')
      setRiskSummary(`Risk Score: ${reportModal.risk_profile?.risk_score}/100 — ${reportModal.risk_profile?.flag_reason || 'No active flag'}`)
      setAiGenerated(true)
    } catch (e) {
      setSubmitError('AI generation failed. Please write the report manually.')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!reportText.trim()) { setSubmitError('Report text is required'); return }
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitInstitutionReport({
        institution_id:   reportModal.institution_id,
        institution_name: reportModal.name,
        report_text:      reportText,
        risk_summary:     riskSummary,
        recommendation,
        ai_generated:     aiGenerated,
      })
      setSubmitted(true)
      setTimeout(() => setReportModal(null), 2000)
    } catch (e) {
      setSubmitError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8 pb-20 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            <Building2 size={28} className="text-emerald-500" />
            Middlemen Registry — Audit View
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            Review institutions in your district and submit audit reports to DFO
          </p>
        </div>
        <div className="flex gap-3 text-sm font-data">
          <div className="px-4 py-2 bg-surface-lowest rounded-lg border border-border-subtle shadow-sm text-center">
            <p className="text-2xl font-bold text-text-primary font-sans">{institutions.length}</p>
            <p className="text-xs text-text-secondary">Total</p>
          </div>
          <div className="px-4 py-2 bg-tint-red rounded-lg border border-border-subtle shadow-sm text-center">
            <p className="text-2xl font-bold text-risk-critical font-sans">
              {institutions.filter(i => i.risk_profile?.is_flagged).length}
            </p>
            <p className="text-xs text-risk-critical">Flagged</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-surface-lowest rounded-xl border border-border-subtle">
          <Loader2 size={32} className="animate-spin text-primary-override" />
        </div>
      ) : (
        <div className="bg-surface-lowest rounded-xl shadow-sm border border-border-subtle overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface-low border-b border-border-subtle">
              <tr>
                <th className="px-5 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest">Institution</th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest">Type</th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest cursor-pointer hover:text-text-primary" onClick={() => toggleSort('financial_ledger.total_funds_credited')}>
                  <div className="flex items-center gap-1">Credited <SortIcon k="financial_ledger.total_funds_credited" /></div>
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest cursor-pointer hover:text-text-primary" onClick={() => toggleSort('financial_ledger.current_holding')}>
                  <div className="flex items-center gap-1">Holding <SortIcon k="financial_ledger.current_holding" /></div>
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest cursor-pointer hover:text-text-primary" onClick={() => toggleSort('risk_profile.risk_score')}>
                  <div className="flex items-center gap-1">Risk <SortIcon k="risk_profile.risk_score" /></div>
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest">Status</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((inst, idx) => (
                <>
                  <tr
                    key={inst.institution_id}
                    className={`${idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low/50'} hover:bg-tint-blue/40 transition-colors cursor-pointer border-b border-border-subtle`}
                    onClick={() => setExpanded(expanded === inst.institution_id ? null : inst.institution_id)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-text-primary">{inst.name}</p>
                      <p className="text-xs text-text-secondary font-data mt-0.5">{inst.taluka} · {inst.beneficiary_count} beneficiaries</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[inst.type] || 'bg-surface-low text-text-secondary'}`}>
                        {inst.type?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-text-primary">
                      ₹{((inst.financial_ledger?.total_funds_credited || 0) / 100000).toFixed(1)}L
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-mono text-sm font-bold ${(inst.financial_ledger?.current_holding || 0) > 100000 ? 'text-risk-critical' : 'text-text-primary'}`}>
                        ₹{((inst.financial_ledger?.current_holding || 0) / 1000).toFixed(0)}K
                      </span>
                    </td>
                    <td className="px-4 py-4"><RiskScore score={inst.risk_profile?.risk_score || 0} /></td>
                    <td className="px-4 py-4">
                      {inst.risk_profile?.is_flagged ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-risk-critical">
                          <AlertTriangle size={13} /> Flagged
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-risk-low">Clear</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); openReportModal(inst) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <FileText size={12} /> Report
                        </button>
                        {expanded === inst.institution_id ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary/70" />}
                      </div>
                    </td>
                  </tr>

                  {expanded === inst.institution_id && (
                    <tr key={`${inst.institution_id}-exp`} className="bg-tint-blue">
                      <td colSpan={7} className="px-6 py-5">
                        <div className="grid grid-cols-3 gap-6">
                          <div>
                            <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Financial Ledger</p>
                            <div className="space-y-1.5 font-data text-sm">
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Total Credited</span>
                                <span className="font-mono font-bold text-text-primary">₹{(inst.financial_ledger?.total_funds_credited || 0).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Total Debited</span>
                                <span className="font-mono font-bold text-text-primary">₹{(inst.financial_ledger?.total_funds_debited || 0).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between border-t border-border-subtle pt-1.5">
                                <span className="font-bold text-text-primary">Current Holding</span>
                                <span className={`font-mono font-bold ${(inst.financial_ledger?.current_holding || 0) > 100000 ? 'text-risk-critical' : 'text-risk-low'}`}>
                                  ₹{(inst.financial_ledger?.current_holding || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Risk Profile</p>
                            <div className="space-y-1.5 font-data text-sm">
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Score</span>
                                <RiskScore score={inst.risk_profile?.risk_score || 0} />
                              </div>
                              {inst.risk_profile?.flag_reason && (
                                <p className="text-xs text-risk-critical mt-1 bg-tint-red p-2 rounded">{inst.risk_profile.flag_reason}</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Institution Details</p>
                            <div className="space-y-1.5 font-data text-sm">
                              <div className="flex justify-between">
                                <span className="text-text-secondary">ID</span>
                                <span className="font-mono text-xs">{inst.institution_id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Beneficiaries</span>
                                <span className="font-bold">{inst.beneficiary_count}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-secondary">Taluka</span>
                                <span className="font-bold">{inst.taluka}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-text-secondary font-data text-sm">
                    No institutions found for your district.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Report Modal ── */}
      {reportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setReportModal(null)}>
          <div className="bg-surface-lowest rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-border-subtle" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-border-subtle bg-surface-low flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Institution Audit Report</h2>
                <p className="text-xs text-text-secondary font-data mt-0.5">{reportModal.name} · {reportModal.taluka}</p>
              </div>
              <button onClick={() => setReportModal(null)} className="p-2 hover:bg-surface-low rounded-lg transition-colors">
                <X size={18} className="text-text-secondary" />
              </button>
            </div>

            {submitted ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-tint-emerald flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-1">Report Submitted!</h3>
                <p className="text-sm text-text-secondary font-data">Your report has been sent to the DFO for review.</p>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Institution summary */}
                <div className="grid grid-cols-3 gap-3 bg-surface-low p-4 rounded-xl">
                  <div className="text-center">
                    <p className="text-xs text-text-secondary mb-1">Risk Score</p>
                    <RiskScore score={reportModal.risk_profile?.risk_score || 0} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-text-secondary mb-1">Holding</p>
                    <p className="text-sm font-mono font-bold text-text-primary">₹{((reportModal.financial_ledger?.current_holding || 0) / 1000).toFixed(0)}K</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-text-secondary mb-1">Beneficiaries</p>
                    <p className="text-sm font-bold text-text-primary">{reportModal.beneficiary_count}</p>
                  </div>
                </div>

                {/* AI Generate button */}
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Audit Report</label>
                  <button
                    onClick={handleGenerateAI}
                    disabled={aiGenerating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-primary-override text-white text-xs font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-60"
                  >
                    {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {aiGenerating ? 'Generating with AI…' : aiGenerated ? 'Regenerate with AI' : 'Generate with AI'}
                  </button>
                </div>

                <textarea
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="Write your audit observations here, or use AI generation above…"
                  rows={10}
                  className="w-full bg-surface-low border border-border-subtle text-text-primary text-sm rounded-xl p-4 font-data leading-relaxed outline-none focus:ring-2 focus:ring-primary-override resize-none"
                />

                {aiGenerated && (
                  <div className="flex items-center gap-2 text-xs text-violet-500 font-data bg-tint-violet px-3 py-2 rounded-lg">
                    <Sparkles size={12} /> AI-assisted report generated with Groq LLaMA 3.3 70B
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-1.5">Risk Summary</label>
                    <input
                      value={riskSummary}
                      onChange={e => setRiskSummary(e.target.value)}
                      placeholder="e.g. Risk Score 82/100 — High holding anomaly"
                      className="w-full bg-surface-low border border-border-subtle text-text-primary text-sm rounded-lg p-3 font-data outline-none focus:ring-2 focus:ring-primary-override"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-1.5">Recommendation</label>
                    <select
                      value={recommendation}
                      onChange={e => setRecommendation(e.target.value)}
                      className="w-full bg-surface-low border border-border-subtle text-text-primary text-sm rounded-lg p-3 font-sans outline-none focus:ring-2 focus:ring-primary-override"
                    >
                      <option value="">— Select —</option>
                      <option value="Probe">Probe / Investigate</option>
                      <option value="Monitor">Monitor</option>
                      <option value="Clear">Clear — No Action</option>
                    </select>
                  </div>
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 text-xs text-risk-critical font-data bg-tint-red px-3 py-2 rounded-lg">
                    <AlertCircle size={14} /> {submitError}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !reportText.trim()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {submitting ? 'Submitting…' : 'Submit Report to DFO'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
