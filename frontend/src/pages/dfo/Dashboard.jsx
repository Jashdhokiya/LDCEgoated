import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { RiskBadge, LeakageBadge } from '../../components/RiskBadge'
import { Play, RefreshCw, FileText, AlertCircle } from 'lucide-react'
import { api } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

const COLORS = { DECEASED: '#E63946', DUPLICATE: '#F5A623', UNDRAWN: '#EAB308', CROSS_SCHEME: '#abc9f1' }

export default function Dashboard() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [analysisData, setAnalysisData] = useState(null)
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

  // Fetch existing data on mount
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
            total_transactions: 10306, // from demo data
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
    <div className="p-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-sans text-text-primary tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-text-secondary mt-1 font-data">{t('dashboard.subtitle')}</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-b from-primary-override to-shell text-white text-sm font-semibold rounded-md shadow-[0_8px_24px_rgba(15,28,44,0.08)] hover:shadow-lg disabled:opacity-70 transition-all font-sans"
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
          {loading ? `${t('dashboard.scanning')} ${elapsed}s` : t('dashboard.runAnalysis')}
        </button>
      </div>

      {/* Loading banner */}
      {loading && (
        <div className="mb-6 p-4 bg-tint-blue border border-border-subtle rounded-lg flex items-center gap-3">
          <RefreshCw size={18} className="animate-spin text-primary-override" />
          <div>
            <p className="text-sm font-bold text-primary-override font-sans">{t('dashboard.scanningBanner')}</p>
            <p className="text-xs text-text-secondary font-data mt-0.5">
              {t('dashboard.scanningDetail')} {elapsed}s
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-tint-red border border-border-subtle rounded-lg flex items-center gap-3">
          <AlertCircle size={18} className="text-risk-critical flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-risk-critical font-sans">{t('dashboard.analysisError')}</p>
            <p className="text-xs text-risk-critical font-data mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {analysisData && (
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[
            { label: t('dashboard.transactionsAnalysed'), value: analysisData.total_transactions?.toLocaleString('en-IN'), sub: `${t('dashboard.processedIn')} ${analysisData.processing_time_seconds}s`, color: 'bg-blue-500' },
            { label: t('dashboard.flagsRaised'), value: analysisData.flagged_count, sub: t('dashboard.acrossSchemes'), color: 'bg-orange-500' },
            { label: t('dashboard.amountAtRisk'), value: stats ? `₹${(stats.total_amount_at_risk/100000).toFixed(1)}L` : '—', sub: t('dashboard.pendingRecovery'), color: 'bg-yellow-500' },
            { label: t('dashboard.criticalCases'), value: analysisData.flags?.filter(f => f.risk_label === 'CRITICAL').length, sub: t('dashboard.immediateAction'), color: 'bg-risk-critical' },
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
            <h2 className="text-sm font-bold mb-6 text-text-primary uppercase tracking-widest font-sans">{t('dashboard.flagsByType')}</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    dataKey="value"
                    stroke="none"
                    label={({ name, value, cx, cy, midAngle, outerRadius }) => {
                      const RADIAN = Math.PI / 180
                      const radius = outerRadius + 18
                      const x = cx + radius * Math.cos(-midAngle * RADIAN)
                      const y = cy + radius * Math.sin(-midAngle * RADIAN)
                      const LABELS = { DECEASED: 'Deceased', DUPLICATE: 'Duplicate', UNDRAWN: 'Undrawn', CROSS_SCHEME: 'Cross-Scheme' }
                      return (
                        <text x={x} y={y} fill="var(--color-text-secondary)" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-data font-bold">
                          {LABELS[name] || name} ({value})
                        </text>
                      )
                    }}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={COLORS[entry.name] || '#3B82F6'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--color-surface-lowest)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(15,28,44,0.15)', color: 'var(--color-text-primary)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface-lowest p-6 rounded-lg shadow-sm col-span-2">
            <h2 className="text-sm font-bold mb-4 text-text-primary uppercase tracking-widest font-sans">{t('dashboard.criticalFlags')}</h2>
            <div className="overflow-hidden rounded-lg">
              {criticalFlags.map((flag, idx) => (
                <div key={flag.flag_id} className={`flex items-center justify-between p-4 ${idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low'}`}>
                  <div>
                    <p className="text-base font-bold font-sans text-text-primary">{flag.beneficiary_name}</p>
                    <p className="text-sm text-text-secondary font-data mt-1">{flag.district} · <LeakageBadge type={flag.leakage_type} /></p>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-lg font-mono font-medium text-risk-critical">₹{flag.payment_amount?.toLocaleString('en-IN')}</span>
                    <button onClick={() => navigate(`/dfo/case/${flag.flag_id}`)} className="text-sm font-sans font-semibold text-primary-override hover:text-blue-700 bg-surface-lowest shadow-sm border border-border-subtle px-3 py-1.5 rounded-md transition-colors">{t('common.review')} →</button>
                  </div>
                </div>
              ))}
              {criticalFlags.length === 0 && analysisData && (
                <p className="text-sm text-text-secondary font-data p-4">{t('dashboard.noCritical')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!analysisData && !loading && (
        <div className="flex flex-col items-center justify-center h-96 bg-surface-lowest rounded-lg border border-dashed border-border-subtle text-text-secondary mt-4">
          <FileText size={48} className="text-text-secondary/70 mb-4" />
          <p className="text-xl font-sans font-bold text-text-primary mb-2">{t('dashboard.workspaceEmpty')}</p>
          <p className="text-sm font-data">{t('dashboard.workspaceEmptyDesc')}</p>
          <p className="text-xs font-data text-text-secondary/50 mt-2">{t('dashboard.workspaceEmptyNote')}</p>
        </div>
      )}
    </div>
  )
}
