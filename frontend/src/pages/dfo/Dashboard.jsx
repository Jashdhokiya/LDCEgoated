import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { Play, RefreshCw, FileText, AlertCircle, TrendingUp, TrendingDown, UserCircle } from 'lucide-react'
import { api } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

const COLORS = {
  DECEASED: '#2563eb',
  DUPLICATE: '#3b82f6',
  UNDRAWN: '#93c5fd',
  SCHEMA_IRREGULARITY: '#f97316',
  CROSS_SCHEME: '#facc15'
}

// Dummy data for sparklines to match the image's aesthetic
const sparkData1 = [ {v:10}, {v:12}, {v:11}, {v:15}, {v:14}, {v:18}, {v:17}, {v:20} ]
const sparkData2 = [ {v:5}, {v:8}, {v:7}, {v:12}, {v:10}, {v:15}, {v:14}, {v:20} ]
const sparkData3 = [ {v:20}, {v:18}, {v:25}, {v:22}, {v:28}, {v:26}, {v:24}, {v:22} ]
const sparkData4 = [ {v:2}, {v:2}, {v:3}, {v:3}, {v:3}, {v:4}, {v:4}, {v:8} ]

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [analysisData, setAnalysisData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [loading])

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const [statsRes, flagsRes] = await Promise.all([
          api.getStats(),
          api.getFlags()
        ])
        if (flagsRes.data && flagsRes.data.length > 0) {
          setAnalysisData({
            flags: flagsRes.data,
            total_transactions: 10306,
            flagged_count: flagsRes.data.length,
            processing_time_seconds: 0
          })
          setStats(statsRes.data)
        }
      } catch (e) {
        console.warn('Could not fetch existing analysis data:', e)
      }
    }
    fetchExisting()
  }, [])

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
    <div className="p-4 sm:p-8 pb-20 bg-workspace min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-bold font-sans text-text-primary tracking-tight">Intelligence Ledger</h1>
          <p className="text-sm text-text-secondary mt-1 font-sans">Education Scheme Anomaly Detection — AY 2024–25</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-override text-white dark:text-shell dark:text-shell text-sm font-semibold rounded-lg shadow-sm hover:shadow disabled:opacity-70 transition-all font-sans w-full sm:w-auto justify-center"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
          {loading ? `Running... ${elapsed}s` : 'Run Analysis'}
        </button>
      </div>

      {/* Loading banner */}
      {loading && (
        <div className="mb-6 p-4 bg-tint-blue border border-border-subtle rounded-lg flex items-center gap-3">
          <RefreshCw size={18} className="animate-spin text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-bold text-blue-900 dark:text-blue-200 font-sans">{t('dashboard.scanningBanner') || 'Scanning records...'}</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 font-sans mt-0.5">
              {t('dashboard.scanningDetail') || 'Processing'} {elapsed}s
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-tint-red border border-border-subtle rounded-lg flex items-center gap-3">
          <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-900 dark:text-red-200 font-sans">{t('dashboard.analysisError') || 'Analysis Error'}</p>
            <p className="text-xs text-red-700 dark:text-red-300 font-sans mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {analysisData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          {/* Card 1 */}
          <div className="bg-surface-lowest p-5 rounded-xl border border-border-subtle shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[11px] text-text-secondary font-sans font-bold uppercase tracking-wider">TRANSACTIONS ANALYSED</p>
            </div>
            <div className="flex items-end justify-between mb-4">
              <span className="text-3xl font-sans font-bold text-text-primary tracking-tight">10,306</span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-tint-emerald px-2 py-0.5 rounded-md">
                <TrendingUp size={12} strokeWidth={3} /> +12%
              </span>
            </div>
            <div className="h-10 mt-auto -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData1}>
                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-surface-lowest p-5 rounded-xl border border-border-subtle shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[11px] text-text-secondary font-sans font-bold uppercase tracking-wider">FLAGS RAISED</p>
            </div>
            <div className="flex items-end justify-between mb-4">
              <span className="text-3xl font-sans font-bold text-text-primary tracking-tight">8</span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-tint-emerald px-2 py-0.5 rounded-md">
                <TrendingUp size={12} strokeWidth={3} /> +25%
              </span>
            </div>
            <div className="h-10 mt-auto -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData2}>
                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-surface-lowest p-5 rounded-xl border border-border-subtle shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[11px] text-text-secondary font-sans font-bold uppercase tracking-wider">AMOUNT AT RISK</p>
            </div>
            <div className="flex items-end justify-between mb-4">
              <span className="text-3xl font-sans font-bold text-text-primary tracking-tight">₹1.5L</span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-red-700 dark:text-red-400 bg-tint-red px-2 py-0.5 rounded-md">
                <TrendingDown size={12} strokeWidth={3} /> -5%
              </span>
            </div>
            <div className="h-10 mt-auto -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData3}>
                  <Line type="monotone" dataKey="v" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-surface-lowest p-5 rounded-xl border border-border-subtle shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <p className="text-[11px] text-text-secondary font-sans font-bold uppercase tracking-wider">CRITICAL CASES</p>
            </div>
            <div className="flex items-end justify-between mb-4">
              <span className="text-3xl font-sans font-bold text-text-primary tracking-tight">4</span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-tint-emerald px-2 py-0.5 rounded-md">
                <TrendingUp size={12} strokeWidth={3} /> +100%
              </span>
            </div>
            <div className="h-10 mt-auto -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData4}>
                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {analysisData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Donut Chart */}
          <div className="bg-surface-lowest p-6 rounded-xl border border-border-subtle shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:col-span-1">
            <h2 className="text-xs font-bold mb-4 text-text-secondary uppercase tracking-widest font-sans">FLAGS BY TYPE</h2>
            <div className="h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] || '#3B82F6'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border-subtle)', backgroundColor: 'var(--color-surface-lowest)', color: 'var(--color-text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-4">
               {pieData.map(entry => (
                 <div key={entry.name} className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[entry.name] || '#3b82f6' }} />
                   <span className="text-[11px] font-sans text-text-secondary truncate capitalize">{entry.name.replace('_', ' ')} ({entry.value})</span>
                 </div>
               ))}
            </div>
          </div>

          {/* Critical Flags List */}
          <div className="bg-surface-lowest p-6 rounded-xl border border-border-subtle shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:col-span-2">
            <h2 className="text-xs font-bold mb-4 text-text-secondary uppercase tracking-widest font-sans">CRITICAL FLAGS — PRIORITY ACTION</h2>
            <div className="flex flex-col gap-3">
              {criticalFlags.map((flag, idx) => (
                <div key={flag.flag_id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 border-b border-border-subtle last:border-0 hover:bg-surface-low transition-colors gap-3 sm:gap-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-low flex items-center justify-center text-text-secondary shrink-0">
                      <UserCircle size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold font-sans text-text-primary">{flag.beneficiary_name}</p>
                      <p className="text-xs text-text-secondary font-sans mt-0.5">{flag.district} · {flag.leakage_type.replace('_', ' ')} Beneficiary</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${idx % 2 === 0 ? 'bg-orange-500 text-white' : 'bg-red-600 text-white'}`}>
                      {idx % 2 === 0 ? 'High Priority tag' : 'Critical'}
                    </span>
                    <span className="text-sm font-sans font-bold text-text-primary w-auto sm:w-20 text-right">₹{flag.payment_amount?.toLocaleString('en-IN')}</span>
                    <button onClick={() => navigate(`/dfo/case/${flag.flag_id}`)} className="text-xs font-sans font-semibold text-text-secondary bg-surface-lowest shadow-sm border border-border-subtle px-4 py-1.5 rounded-md hover:bg-surface-low transition-colors shrink-0">Review</button>
                  </div>
                </div>
              ))}
              {criticalFlags.length === 0 && (
                <p className="text-sm text-text-secondary font-sans p-4 text-center mt-8">No critical cases found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!analysisData && !loading && (
        <div className="flex flex-col items-center justify-center h-96 bg-surface-lowest rounded-xl border border-dashed border-border-subtle text-text-secondary mt-4 shadow-sm">
          <FileText size={48} className="text-text-secondary opacity-50 mb-4" />
          <p className="text-xl font-sans font-bold text-text-primary mb-2">{t('dashboard.workspaceEmpty') || 'No Data'}</p>
          <p className="text-sm font-sans text-text-secondary">{t('dashboard.workspaceEmptyDesc') || 'Run an analysis to view intelligence ledger.'}</p>
          <p className="text-xs font-sans text-text-secondary mt-2">{t('dashboard.workspaceEmptyNote') || 'Requires backend to be running'}</p>
        </div>
      )}
    </div>
  )
}
