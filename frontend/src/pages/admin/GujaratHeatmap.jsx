import { useState, useEffect } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import * as topojson from 'topojson-client'
import { getDistrictStats } from '../../api'
import { X, TrendingUp, ZoomIn, ZoomOut, RotateCcw, Loader2 } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

// The TopoJSON uses these district name variants — map them to our mock data keys
const DISTRICT_NAME_MAP = {
  'Valsad': 'Valsad',
  'Amreli': 'Amreli',
  'The Dangs': 'Dang',
  'Vadodara': 'Vadodara',
  'Bharuch': 'Bharuch',
  'Porbandar': 'Porbandar',
  'Narmada': 'Narmada',
  'Surat': 'Surat',
  'Tapi': 'Tapi',
  'Botad': 'Botad',
  'Chota Udaipur': 'Chhota Udaipur',
  'Gir Somnath': 'Gir Somnath',
  'Rajkot': 'Rajkot',
  'Bhavnagar': 'Bhavnagar',
  'Junagadh': 'Junagadh',
  'Jamnagar': 'Jamnagar',
  'Devbhumi Dwarka': 'Devbhoomi Dwarka',
  'Navsari': 'Navsari',
  'Banas Kantha': 'Banaskantha',
  'Patan': 'Patan',
  'Mahesana': 'Mehsana',
  'Gandhinagar': 'Gandhinagar',
  'Ahmadabad': 'Ahmedabad',
  'Panch Mahals': 'Panch Mahals',
  'Dohad': 'Dahod',
  'Aravalli': 'Aravalli',
  'Mahisagar': 'Mahisagar',
  'Sabar Kantha': 'Sabarkantha',
  'Kachchh': 'Kutch',
  'Surendranagar': 'Surendranagar',
  'Kheda': 'Kheda',
  'Anand': 'Anand',
  'Morbi': 'Morbi',
}

const statByDistrictFn = (districtStats) => Object.fromEntries(districtStats.map(d => [d.district, d]))

function getFillColor(flags, max) {
  if (!flags || flags === 0) return '#d1fae5'
  const ratio = flags / max
  if (ratio < 0.12) return '#6ee7b7'
  if (ratio < 0.25) return '#fcd34d'
  if (ratio < 0.45) return '#fb923c'
  if (ratio < 0.65) return '#f87171'
  if (ratio < 0.85) return '#dc2626'
  return '#991b1b'
}

const LEGEND = [
  { label: 'No flags', color: '#d1fae5' },
  { label: '1–3', color: '#6ee7b7' },
  { label: '4–8', color: '#fcd34d' },
  { label: '9–14', color: '#fb923c' },
  { label: '15–19', color: '#f87171' },
  { label: '20–23', color: '#dc2626' },
  { label: '24+', color: '#991b1b' },
]

export default function GujaratHeatmap() {
  const { t } = useLanguage()
  const [districtStats, setDistrictStats] = useState([])
  const [topoData, setTopoData] = useState(null)
  const [geoJSON, setGeoJSON] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    // Load district stats from API (fallback to mock in api.js)
    getDistrictStats().then(data => setDistrictStats(Array.isArray(data) ? data : []))
    // Load TopoJSON map
    fetch('/gujarat.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(topo => {
        setTopoData(topo)
        // Convert TopoJSON → GeoJSON FeatureCollection
        const geo = topojson.feature(topo, topo.objects.gujarat)
        setGeoJSON(geo)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load Gujarat TopoJSON:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const statByDistrict = statByDistrictFn(districtStats)
  const maxFlags = Math.max(...districtStats.map(d => d.total_flags), 1)
  const totalFlags = districtStats.reduce((s, d) => s + d.total_flags, 0)
  const totalRisk  = districtStats.reduce((s, d) => s + d.amount_at_risk, 0)

  const selectedData = selected ? statByDistrict[selected] : null

  // Gujarat bounding box center: ~22.3°N, 71.5°E
  const projConfig = { center: [71.5, 22.4], scale: 3600 }

  const getDistrictKey = (rawName) => DISTRICT_NAME_MAP[rawName] || rawName

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <Loader2 size={32} className="animate-spin text-violet-500" />
          <p className="text-sm font-data">{t('gujaratMap.loadingMap')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <p className="text-risk-critical font-bold">{t('gujaratMap.failedLoad')}</p>
          <p className="text-sm text-text-secondary font-data mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 pb-20 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t('gujaratMap.title')}</h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            {t('gujaratMap.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { label: t('gujaratMap.totalFlags'), value: totalFlags, color: 'text-risk-critical' },
            { label: t('gujaratMap.amountAtRisk'), value: `₹${(totalRisk / 100000).toFixed(1)}L` },
            { label: t('gujaratMap.districtsAffected'), value: `${districtStats.filter(d => d.total_flags > 0).length}/33` },
          ].map((s, i) => (
            <div key={i} className="px-4 py-2.5 bg-surface-lowest rounded-xl border border-border-subtle shadow-sm text-center min-w-[110px]">
              <p className={`text-2xl font-bold font-sans ${s.color || 'text-text-primary'}`}>{s.value}</p>
              <p className="text-xs text-text-secondary font-data">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-5">
        {/* Map Panel */}
        <div className="flex-1 bg-surface-lowest rounded-2xl shadow-sm border border-border-subtle overflow-hidden relative">
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
            {[
              { icon: ZoomIn, onClick: () => setZoom(z => Math.min(z + 0.5, 5)) },
              { icon: ZoomOut, onClick: () => setZoom(z => Math.max(z - 0.5, 0.5)) },
              { icon: RotateCcw, onClick: () => setZoom(1) },
            ].map(({ icon: Icon, onClick }, i) => (
              <button key={i} onClick={onClick} className="w-8 h-8 flex items-center justify-center bg-surface-lowest border border-border-subtle rounded-lg shadow-sm hover:bg-surface-low transition-colors">
                <Icon size={14} />
              </button>
            ))}
          </div>

          {/* Hover tooltip */}
          {hovered && (
            <div className="absolute top-3 left-3 z-10 bg-surface-lowest/95 backdrop-blur-sm border border-border-subtle rounded-lg px-3 py-2 shadow-md pointer-events-none">
              <p className="text-sm font-bold text-text-primary font-sans">{hovered}</p>
              {statByDistrict[hovered] ? (
                <p className="text-xs text-risk-critical font-mono font-bold">
                  {statByDistrict[hovered].total_flags} flags · ₹{(statByDistrict[hovered].amount_at_risk / 1000).toFixed(0)}K at risk
                </p>
              ) : (
                <p className="text-xs text-text-secondary font-data">{t('gujaratMap.noData')}</p>
              )}
            </div>
          )}

          <ComposableMap
            projection="geoMercator"
            projectionConfig={projConfig}
            width={700}
            height={560}
            style={{ width: '100%', height: 'auto' }}
          >
            <ZoomableGroup zoom={zoom} center={[71.5, 22.4]}>
              {geoJSON && (
                <Geographies geography={geoJSON}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const rawName = geo.properties.district
                      const mappedName = getDistrictKey(rawName)
                      const data = statByDistrict[mappedName]
                      const flags = data?.total_flags ?? 0
                      const isSelected = selected === mappedName
                      const fill = getFillColor(flags, maxFlags)

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => setSelected(selected === mappedName ? null : mappedName)}
                          onMouseEnter={() => setHovered(mappedName)}
                          onMouseLeave={() => setHovered(null)}
                          style={{
                            default: {
                              fill,
                              stroke: isSelected ? '#1B3A5B' : '#fff',
                              strokeWidth: isSelected ? 2 : 0.6,
                              outline: 'none',
                              cursor: 'pointer',
                              transition: 'fill 0.15s ease',
                            },
                            hover: {
                              fill,
                              stroke: '#1B3A5B',
                              strokeWidth: 1.5,
                              outline: 'none',
                              opacity: 0.85,
                              cursor: 'pointer',
                            },
                            pressed: { fill, outline: 'none' },
                          }}
                        />
                      )
                    })
                  }
                </Geographies>
              )}
            </ZoomableGroup>
          </ComposableMap>

          {/* Legend */}
          <div className="flex items-center flex-wrap gap-3 px-4 pb-3 pt-1 border-t border-border-subtle">
            <span className="text-[10px] text-text-secondary font-data font-bold uppercase tracking-wider">{t('gujaratMap.flags')}</span>
            {LEGEND.map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-4 h-3 rounded-sm border border-border-subtle" style={{ backgroundColor: l.color }} />
                <span className="text-[10px] text-text-secondary font-data">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          {selectedData ? (
            <div className="bg-surface-lowest rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-low">
                <div>
                  <h3 className="font-bold text-text-primary font-sans">{selectedData.district}</h3>
                  <p className="text-xs text-text-secondary font-data mt-0.5">{selectedData.beneficiaries.toLocaleString()} {t('common.beneficiaries')}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-text-secondary hover:text-text-secondary transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 border-b border-border-subtle">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-text-secondary font-data">{t('gujaratMap.totalFlags')}</p>
                    <p className="text-4xl font-bold font-sans" style={{ color: getFillColor(selectedData.total_flags, maxFlags) }}>
                      {selectedData.total_flags}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-secondary font-data">{t('gujaratMap.amountAtRisk')}</p>
                    <p className="text-xl font-bold font-mono text-text-primary">₹{(selectedData.amount_at_risk / 1000).toFixed(0)}K</p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 space-y-3">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-widest font-data">{t('gujaratMap.leakageBreakdown')}</p>
                {[
                  { label: t('gujaratMap.deceased'), value: selectedData.deceased, color: '#E63946' },
                  { label: t('gujaratMap.duplicate'), value: selectedData.duplicate, color: '#F5A623' },
                  { label: t('gujaratMap.undrawn'), value: selectedData.undrawn, color: '#EAB308' },
                  { label: t('gujaratMap.crossScheme'), value: selectedData.cross_scheme, color: '#3B82F6' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-text-secondary font-data">{item.label}</span>
                      <span className="text-xs font-bold font-mono" style={{ color: item.color }}>{item.value}</span>
                    </div>
                    <div className="h-1.5 bg-surface-low rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${selectedData.total_flags > 0 ? (item.value / selectedData.total_flags) * 100 : 0}%`,
                        backgroundColor: item.color,
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 bg-surface-low border-t border-border-subtle">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary font-data">
                  <TrendingUp size={12} />
                  <span>
                    {t('gujaratMap.ranks')} #{[...districtStats]
                      .filter((d, i, a) => a.findIndex(x => x.district === d.district) === i)
                      .sort((a, b) => b.total_flags - a.total_flags)
                      .findIndex(d => d.district === selectedData.district) + 1} / {districtStats.length} {t('gujaratMap.byRisk')}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-lowest rounded-2xl shadow-sm border border-border-subtle p-8 flex flex-col items-center justify-center text-center h-52">
              <div className="w-12 h-12 rounded-full bg-tint-violet flex items-center justify-center mb-3">
                <div className="w-7 h-7 rounded-sm" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #f87171 100%)' }} />
              </div>
              <p className="text-sm font-bold text-text-primary mb-1">{t('gujaratMap.clickDistrict')}</p>
              <p className="text-xs text-text-secondary font-data leading-relaxed">{t('gujaratMap.clickDistrictDesc')}</p>
            </div>
          )}

          {/* Top 5 */}
          <div className="bg-surface-lowest rounded-2xl shadow-sm border border-border-subtle overflow-hidden">
            <div className="px-5 py-3 border-b border-border-subtle">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest font-data">{t('gujaratMap.topHighRisk')}</p>
            </div>
            {[...districtStats]
              .filter((d, i, a) => a.findIndex(x => x.district === d.district) === i)
              .sort((a, b) => b.total_flags - a.total_flags)
              .slice(0, 5)
              .map((d, i) => (
                <button
                  key={d.district}
                  onClick={() => setSelected(d.district)}
                  className={`w-full flex items-center gap-3 px-5 py-3 border-b border-border-subtle hover:bg-surface-low transition-colors text-left ${selected === d.district ? 'bg-tint-violet' : ''}`}
                >
                  <span className="text-sm font-bold font-mono text-text-secondary w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary font-sans truncate">{d.district}</p>
                    <p className="text-xs text-text-secondary font-data">₹{(d.amount_at_risk / 1000).toFixed(0)}K {t('gujaratMap.atRisk')}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getFillColor(d.total_flags, maxFlags) }} />
                    <span className="text-sm font-bold font-mono text-risk-critical">{d.total_flags}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
