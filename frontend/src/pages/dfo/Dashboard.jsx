import { useState, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { RiskBadge, LeakageBadge } from '../../components/RiskBadge'
import { Play, RefreshCw, FileText, AlertCircle } from 'lucide-react'
import { api } from '../../api'

const COLORS = { DECEASED: '#E63946', DUPLICATE: '#F5A623', UNDRAWN: '#EAB308', CROSS_SCHEME: '#abc9f1' }

export default function Dashboard({ onOpenCase, analysisData, setAnalysisData }) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  // Elapsed-time ticker — updates every second while analysis is running
  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [loading])

  const runAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.runAnalysis()
      setAnalysisData(res.data)
      const statsRes = await api.getStats()
      setStats(statsRes.data)
    } catch (e) {
      console.error('Analysis failed:', e)
      const msg = e?.response?.data?.detail || e?.message || 'Analysis failed. Is the backend running?'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const pieData = stats ? Object.entries(stats.by_leakage_type).map(([name, value]) => ({ name, value })) : []
  const criticalFlags = analysisData?.flags?.filter(f => f.risk_label === 'CRITICAL').slice(0, 5) || []

  return (
    <div className="p-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-sans text-text-primary tracking-tight">Intelligence Ledger</h1>
          <p className="text-sm text-text-secondary mt-1 font-data">Education Scheme Anomaly Detection — AY 2024–25</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-primary-override to-shell text-white text-sm font-semibold rounded-md shadow-[0_8px_24px_rgba(15,28,44,0.08)] hover:shadow-lg disabled:opacity-70 transition-all font-sans"
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
          {loading ? `Scanning… ${elapsed}s` : 'Run Analysis'}
        </button>
      </div>

      {/* Loading banner */}
      {loading && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
          <RefreshCw size={18} className="animate-spin text-blue-500" />
          <div>
            <p className="text-sm font-bold text-blue-800 font-sans">Scanning 10,000+ DBT transactions…</p>
            <p className="text-xs text-blue-600 font-data mt-0.5">
              Running 4 fraud detectors in parallel. This typically takes 30–60 seconds. Elapsed: {elapsed}s
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle size={18} className="text-risk-critical flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-risk-critical font-sans">Analysis Error</p>
            <p className="text-xs text-red-600 font-data mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {analysisData && (
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Transactions Analysed', value: analysisData.total_transactions?.toLocaleString('en-IN'), sub: `Processed in ${analysisData.processing_time_seconds}s`, color: 'bg-blue-500' },
            { label: 'Flags Raised', value: analysisData.flagged_count, sub: 'Across all schemes', color: 'bg-orange-500' },
            { label: 'Amount at Risk', value: stats ? `₹${(stats.total_amount_at_risk/100000).toFixed(1)}L` : '—', sub: 'Pending recovery', color: 'bg-yellow-500' },
            { label: 'Critical Cases', value: analysisData.flags?.filter(f => f.risk_label === 'CRITICAL').length, sub: 'Immediate action required', color: 'bg-risk-critical' },
          ].map((card, i) => (
            <div key={i} className={`p-5 bg-surface-lowest rounded-lg shadow-sm relative overflow-hidden`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${card.color}`} />
              <p className="text-xs text-text-secondary font-data font-semibold uppercase tracking-wider mb-2">{card.label}</p>
              <p className="text-4xl font-sans font-bold text-text-primary tracking-tight">
                {card.value}
              </p>
              <p className="text-xs text-text-secondary mt-2 font-data">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {analysisData && (
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-surface-lowest p-6 rounded-lg shadow-sm">
            <h2 className="text-sm font-bold mb-6 text-text-primary uppercase tracking-widest font-sans">Flags by Type</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} dataKey="value" stroke="none">
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] || '#3B82F6'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#ffffff', border: 'none', borderRadius: '8px', boxShadow: '0 8px 24px rgba(15,28,44,0.08)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface-lowest p-6 rounded-lg shadow-sm col-span-2">
            <h2 className="text-sm font-bold mb-4 text-text-primary uppercase tracking-widest font-sans">Critical Flags — Priority Action</h2>
            <div className="overflow-hidden rounded-lg">
              {criticalFlags.map((flag, idx) => (
                <div key={flag.flag_id} className={`flex items-center justify-between p-4 ${idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'}`}>
                  <div>
                    <p className="text-base font-bold font-sans text-text-primary">{flag.beneficiary_name}</p>
                    <p className="text-sm text-text-secondary font-data mt-1">{flag.district} · <LeakageBadge type={flag.leakage_type} /></p>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-lg font-mono font-medium text-risk-critical">₹{flag.payment_amount?.toLocaleString('en-IN')}</span>
                    <button
                      onClick={() => onOpenCase && onOpenCase(flag.flag_id)}
                      className="text-sm font-sans font-semibold text-primary-override hover:text-blue-700 bg-white shadow-sm border border-gray-100 px-3 py-1.5 rounded-md transition-colors"
                    >
                      Review →
                    </button>
                  </div>
                </div>
              ))}
              {criticalFlags.length === 0 && analysisData && (
                <p className="text-sm text-text-secondary font-data p-4">No critical flags detected.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!analysisData && !loading && (
        <div className="flex flex-col items-center justify-center h-96 bg-surface-lowest rounded-lg border border-dashed border-gray-300 text-text-secondary mt-4">
          <FileText size={48} className="text-gray-300 mb-4" />
          <p className="text-xl font-sans font-bold text-text-primary mb-2">Workspace Empty</p>
          <p className="text-sm font-data">Initialize the intelligence ledger by executing a data scan.</p>
          <p className="text-xs font-data text-text-secondary/50 mt-2">Analysis takes ~30–60 seconds to scan 10,000+ records</p>
        </div>
      )}
    </div>
  )
}
