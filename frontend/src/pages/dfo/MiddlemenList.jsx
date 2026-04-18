import { useState, useEffect } from 'react'
import { Building2, AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus, Loader2 } from 'lucide-react'
import { getInstitutions } from '../../api'
import AssignCaseModal from '../../components/AssignCaseModal'

const TYPE_COLORS = {
  SCHOOL: 'bg-blue-100 text-blue-700',
  COLLEGE: 'bg-violet-100 text-violet-700',
  GRAM_PANCHAYAT: 'bg-emerald-100 text-emerald-700',
}

function RiskScore({ score }) {
  if (score >= 75) return <span className="font-mono text-sm font-bold text-risk-critical">{score}</span>
  if (score >= 50) return <span className="font-mono text-sm font-bold text-risk-high">{score}</span>
  if (score >= 25) return <span className="font-mono text-sm font-bold text-risk-medium">{score}</span>
  return <span className="font-mono text-sm font-bold text-risk-low">{score}</span>
}

export default function MiddlemenList() {
  const [institutions, setInstitutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [sortKey, setSortKey] = useState('risk_profile.risk_score')
  const [sortDir, setSortDir] = useState('desc')
  const [assignModal, setAssignModal] = useState(null)

  const fetchInstitutions = () => {
    setLoading(true)
    setError(false)
    getInstitutions().then(data => {
      const arr = Array.isArray(data) ? data : []
      setInstitutions(arr)
      setError(arr.length === 0)
      setLoading(false)
    }).catch(() => {
      setError(true)
      setLoading(false)
    })
  }

  useEffect(() => { fetchInstitutions() }, [])

  const sorted = [...institutions].sort((a, b) => {
    const getVal = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj) ?? 0
    const va = getVal(a, sortKey), vb = getVal(b, sortKey)
    return sortDir === 'desc' ? vb - va : va - vb
  })

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <Minus size={12} className="text-gray-300" />
    return sortDir === 'desc' ? <ChevronDown size={12} className="text-primary-override" /> : <ChevronUp size={12} className="text-primary-override" />
  }

  return (
    <div className="p-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-sans text-text-primary tracking-tight flex items-center gap-3">
            <Building2 size={28} className="text-primary-override" />
            Middlemen Registry
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            All institutions (schools, colleges, gram panchayats) under Ahmedabad District
          </p>
        </div>
        <div className="flex gap-3 text-sm font-data">
          <div className="px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
            <p className="text-2xl font-bold text-text-primary font-sans">{institutions.length}</p>
            <p className="text-xs text-text-secondary">Total</p>
          </div>
          <div className="px-4 py-2 bg-red-50 rounded-lg border border-red-100 shadow-sm text-center">
            <p className="text-2xl font-bold text-risk-critical font-sans">{institutions.filter(i => i.risk_profile.is_flagged).length}</p>
            <p className="text-xs text-red-400">Flagged</p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-center">
            <Loader2 size={32} className="animate-spin text-primary-override mx-auto mb-3" />
            <p className="text-sm text-text-secondary font-data">Loading institutions…</p>
          </div>
        </div>
      )}

      {/* Error / Empty */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
          <Building2 size={40} className="text-gray-300 mb-3" />
          <p className="text-sm font-bold text-text-primary font-sans mb-1">No institutions loaded</p>
          <p className="text-xs text-text-secondary font-data mb-4">Backend may be starting up. Try again.</p>
          <button onClick={fetchInstitutions} className="px-4 py-2 bg-primary-override text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition-all">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans">Institution</th>
              <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans">Type</th>
              <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans cursor-pointer hover:text-text-primary" onClick={() => toggleSort('financial_ledger.total_funds_credited')}>
                <div className="flex items-center gap-1">Credited <SortIcon k="financial_ledger.total_funds_credited" /></div>
              </th>
              <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans cursor-pointer hover:text-text-primary" onClick={() => toggleSort('financial_ledger.current_holding')}>
                <div className="flex items-center gap-1">Holding <SortIcon k="financial_ledger.current_holding" /></div>
              </th>
              <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans cursor-pointer hover:text-text-primary" onClick={() => toggleSort('risk_profile.risk_score')}>
                <div className="flex items-center gap-1">Risk <SortIcon k="risk_profile.risk_score" /></div>
              </th>
              <th className="px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans">Status</th>
              <th className="px-4 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((inst, idx) => (
              <>
                <tr
                  key={inst.institution_id}
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/40 transition-colors cursor-pointer border-b border-gray-100`}
                  onClick={() => setExpanded(expanded === inst.institution_id ? null : inst.institution_id)}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-text-primary font-sans">{inst.name}</p>
                    <p className="text-xs text-text-secondary font-data mt-0.5">{inst.taluka} · {inst.beneficiary_count} beneficiaries</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[inst.type] || 'bg-gray-100 text-gray-700'}`}>
                      {inst.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-sm text-text-primary">
                    ₹{(inst.financial_ledger.total_funds_credited / 100000).toFixed(1)}L
                  </td>
                  <td className="px-4 py-4">
                    <span className={`font-mono text-sm font-bold ${inst.financial_ledger.current_holding > 100000 ? 'text-risk-critical' : 'text-text-primary'}`}>
                      ₹{(inst.financial_ledger.current_holding / 1000).toFixed(0)}K
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <RiskScore score={inst.risk_profile.risk_score} />
                  </td>
                  <td className="px-4 py-4">
                    {inst.risk_profile.is_flagged ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-risk-critical font-data">
                        <AlertTriangle size={13} /> Flagged
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-risk-low font-data">Clear</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {inst.risk_profile.is_flagged && (
                        <button
                          onClick={e => { e.stopPropagation(); setAssignModal(inst) }}
                          className="text-xs font-semibold text-primary-override hover:underline font-sans"
                        >
                          Assign →
                        </button>
                      )}
                      {expanded === inst.institution_id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-300" />}
                    </div>
                  </td>
                </tr>
                {expanded === inst.institution_id && (
                  <tr key={`${inst.institution_id}-expanded`} className="bg-blue-50/50">
                    <td colSpan={7} className="px-6 py-5">
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 font-data">Financial Ledger</p>
                          <div className="space-y-1.5 font-data text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Total Credited</span>
                              <span className="font-mono font-bold text-text-primary">₹{inst.financial_ledger.total_funds_credited.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Total Debited</span>
                              <span className="font-mono font-bold text-text-primary">₹{inst.financial_ledger.total_funds_debited.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between border-t border-blue-100 pt-1.5">
                              <span className="font-bold text-text-primary">Current Holding</span>
                              <span className={`font-mono font-bold ${inst.financial_ledger.current_holding > 100000 ? 'text-risk-critical' : 'text-risk-low'}`}>
                                ₹{inst.financial_ledger.current_holding.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 font-data">Risk Profile</p>
                          <div className="space-y-1.5 font-data text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Risk Score</span>
                              <RiskScore score={inst.risk_profile.risk_score} />
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Status</span>
                              <span className={`font-bold ${inst.risk_profile.is_flagged ? 'text-risk-critical' : 'text-risk-low'}`}>
                                {inst.risk_profile.is_flagged ? 'FLAGGED' : 'CLEAR'}
                              </span>
                            </div>
                            {inst.risk_profile.flag_reason && (
                              <p className="text-xs text-risk-critical mt-1 bg-red-50 p-2 rounded">{inst.risk_profile.flag_reason}</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 font-data">Institution Details</p>
                          <div className="space-y-1.5 font-data text-sm">
                            <div className="flex justify-between">
                              <span className="text-text-secondary">ID</span>
                              <span className="font-mono text-xs text-text-primary">{inst.institution_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Beneficiaries</span>
                              <span className="font-bold text-text-primary">{inst.beneficiary_count}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-text-secondary">Taluka</span>
                              <span className="font-bold text-text-primary">{inst.taluka}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {assignModal && (
        <AssignCaseModal
          caseId={assignModal.institution_id}
          caseName={`${assignModal.name} — ${assignModal.risk_profile.flag_reason}`}
          onClose={() => setAssignModal(null)}
          onAssigned={() => setAssignModal(null)}
        />
      )}
    </div>
  )
}
