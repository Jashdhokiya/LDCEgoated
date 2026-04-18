import { useState, useEffect } from 'react'
import { getDistrictStats } from '../../api'
import { BarChart3, ChevronDown, ChevronUp, Search, Loader2 } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

const LEAKAGE_COLORS = {
  deceased: '#E63946',
  duplicate: '#F5A623',
  undrawn: '#EAB308',
  cross_scheme: '#3B82F6',
}

function RiskBar({ value, max, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-surface-low rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

export default function DistrictOverview() {
  const { t } = useLanguage()
  const [allStats, setAllStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('total_flags')
  const [sortDir, setSortDir] = useState('desc')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getDistrictStats().then(data => {
      setAllStats(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  const uniqueDistricts = [...new Map(allStats.map(d => [d.district, d])).values()]

  const filtered = uniqueDistricts
    .filter(d => d.district.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0
      return sortDir === 'desc' ? vb - va : va - vb
    })

  const maxFlags = Math.max(...uniqueDistricts.map(d => d.total_flags))
  const totalFlags = uniqueDistricts.reduce((s, d) => s + d.total_flags, 0)
  const totalRisk = uniqueDistricts.reduce((s, d) => s + d.amount_at_risk, 0)
  const totalBeneficiaries = uniqueDistricts.reduce((s, d) => s + d.beneficiaries, 0)

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return null
    return sortDir === 'desc' ? <ChevronDown size={11} className="inline ml-1" /> : <ChevronUp size={11} className="inline ml-1" />
  }

  return (
    <div className="p-8 pb-20 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            <BarChart3 size={26} className="text-violet-600" />
            {t('districtOverview.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            {t('districtOverview.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { label: t('districtOverview.totalDistricts'), value: uniqueDistricts.length },
            { label: t('districtOverview.totalFlags'), value: totalFlags, color: 'text-risk-critical' },
            { label: t('districtOverview.amountAtRisk'), value: `₹${(totalRisk / 100000).toFixed(0)}L` },
            { label: t('common.beneficiaries'), value: totalBeneficiaries.toLocaleString('en-IN') },
          ].map((s, i) => (
            <div key={i} className="px-4 py-2.5 bg-surface-lowest rounded-lg border border-border-subtle shadow-sm text-center min-w-[100px]">
              <p className={`text-xl font-bold font-sans ${s.color || 'text-text-primary'}`}>{s.value}</p>
              <p className="text-xs text-text-secondary font-data">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search + table */}
      <div className="bg-surface-lowest rounded-xl shadow-sm border border-border-subtle overflow-hidden">
        {/* Search bar */}
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-3">
          <Search size={16} className="text-text-secondary" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('districtOverview.searchDistrict')}
            className="flex-1 text-sm font-data outline-none text-text-primary bg-transparent placeholder:text-text-secondary/70"
          />
          <span className="text-xs text-text-secondary font-data">{filtered.length} {t('districtOverview.districts')}</span>
        </div>

        {/* Table */}
        <table className="w-full text-left">
          <thead className="bg-surface-low border-b border-border-subtle">
            <tr>
              <th className="px-5 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans w-6">#</th>
              <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans cursor-pointer hover:text-text-primary" onClick={() => toggleSort('district')}>
                {t('heatmap.district')} <SortIcon k="district" />
              </th>
              <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans cursor-pointer hover:text-text-primary" onClick={() => toggleSort('total_flags')}>
                {t('districtOverview.totalFlags')} <SortIcon k="total_flags" />
              </th>
              <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans">{t('districtOverview.breakdown')}</th>
              <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans cursor-pointer hover:text-text-primary" onClick={() => toggleSort('amount_at_risk')}>
                {t('districtOverview.amountAtRisk')} <SortIcon k="amount_at_risk" />
              </th>
              <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest font-sans">{t('districtOverview.topLeakage')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, idx) => {
              const topType = ['deceased', 'duplicate', 'undrawn', 'cross_scheme']
                .map(t => ({ t, v: d[t] }))
                .sort((a, b) => b.v - a.v)[0]

              const isSelected = selected === d.district

              return (
                <tr
                  key={d.district}
                  className={`border-b border-border-subtle hover:bg-tint-violet transition-colors cursor-pointer ${isSelected ? 'bg-tint-violet' : idx % 2 === 0 ? 'bg-surface-lowest' : 'bg-surface-low/30'}`}
                  onClick={() => setSelected(isSelected ? null : d.district)}
                >
                  <td className="px-5 py-3.5 text-xs font-mono text-text-secondary">{idx + 1}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-bold text-text-primary font-sans">{d.district}</p>
                    <p className="text-xs text-text-secondary font-data">{d.beneficiaries.toLocaleString()} {t('common.beneficiaries')}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-surface-low rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${maxFlags > 0 ? (d.total_flags / maxFlags) * 100 : 0}%`,
                            backgroundColor: d.total_flags >= 18 ? '#dc2626' : d.total_flags >= 10 ? '#f97316' : d.total_flags >= 5 ? '#eab308' : '#16a34a'
                          }}
                        />
                      </div>
                      <span className={`text-sm font-bold font-mono ${d.total_flags >= 18 ? 'text-risk-critical' : d.total_flags >= 10 ? 'text-risk-high' : d.total_flags >= 5 ? 'text-risk-medium' : 'text-risk-low'}`}>
                        {d.total_flags}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      {[
                        { key: 'deceased', v: d.deceased, color: '#E63946' },
                        { key: 'duplicate', v: d.duplicate, color: '#F5A623' },
                        { key: 'undrawn', v: d.undrawn, color: '#EAB308' },
                        { key: 'cross_scheme', v: d.cross_scheme, color: '#3B82F6' },
                      ].map(item => (
                        <div key={item.key} title={item.key} className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: item.color, opacity: item.v === 0 ? 0.2 : 1 }}>
                          {item.v}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {d.amount_at_risk > 0 ? `₹${(d.amount_at_risk / 1000).toFixed(0)}K` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {topType.v > 0 ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                        backgroundColor: LEAKAGE_COLORS[topType.t] + '20',
                        color: LEAKAGE_COLORS[topType.t]
                      }}>
                        {t(`anomalyLabels.${topType.t.toUpperCase()}`) || topType.t.replace('_', ' ').toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600 font-bold">{t('districtOverview.clean')}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs font-data text-text-secondary">
        <span className="font-bold">{t('districtOverview.breakdownKey')}</span>
        {[
          { label: t('gujaratMap.deceased'), color: '#E63946' },
          { label: t('gujaratMap.duplicate'), color: '#F5A623' },
          { label: t('gujaratMap.undrawn'), color: '#EAB308' },
          { label: t('gujaratMap.crossScheme'), color: '#3B82F6' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}
