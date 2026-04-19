import { useState, useEffect } from 'react'
import { FileText, CheckCircle, XCircle, RotateCcw, Loader2, ChevronDown, ChevronUp, Sparkles, Clock } from 'lucide-react'
import { getDFOInstitutionReports, decideDFOReport } from '../../api'

const STATUS_META = {
  PENDING_DFO_REVIEW: { label: 'Pending Review', color: 'bg-tint-yellow text-yellow-700' },
  DFO_VERIFIED:       { label: 'Verified',        color: 'bg-tint-emerald text-emerald-700' },
  DFO_REJECTED:       { label: 'Rejected',        color: 'bg-tint-red text-risk-critical' },
  DFO_REASSIGN:       { label: 'Reassigned',      color: 'bg-tint-blue text-primary-override' },
}

export default function DFOInstitutionReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [deciding, setDeciding] = useState(null)
  const [notes, setNotes] = useState({})
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = () => {
    setLoading(true)
    getDFOInstitutionReports().then(data => {
      setReports(data?.reports || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  const handleDecide = async (report, decision) => {
    setDeciding(report.report_id)
    try {
      await decideDFOReport(report.report_id, decision, notes[report.report_id] || '')
      setReports(prev => prev.map(r =>
        r.report_id === report.report_id
          ? { ...r, status: `DFO_${decision}`, dfo_decision: decision, dfo_notes: notes[report.report_id] || '' }
          : r
      ))
    } catch (e) {
      console.error('Decision failed', e)
    } finally {
      setDeciding(null)
    }
  }

  const filtered = filter === 'ALL' ? reports : reports.filter(r => r.status === filter)
  const pending = reports.filter(r => r.status === 'PENDING_DFO_REVIEW').length

  return (
    <div className="p-8 pb-20 font-sans max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            <FileText size={28} className="text-primary-override" />
            Institution Audit Reports
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-data">
            Reports submitted by Audit Officers — verify, reject, or reassign
          </p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-tint-yellow rounded-lg border border-border-subtle shadow-sm text-center">
            <p className="text-2xl font-bold text-yellow-700 font-sans">{pending}</p>
            <p className="text-xs text-yellow-600">Pending</p>
          </div>
          <div className="px-4 py-2 bg-surface-lowest rounded-lg border border-border-subtle shadow-sm text-center">
            <p className="text-2xl font-bold text-text-primary font-sans">{reports.length}</p>
            <p className="text-xs text-text-secondary">Total</p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'ALL', label: 'All' },
          { key: 'PENDING_DFO_REVIEW', label: 'Pending' },
          { key: 'DFO_VERIFIED', label: 'Verified' },
          { key: 'DFO_REJECTED', label: 'Rejected' },
          { key: 'DFO_REASSIGN', label: 'Reassigned' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
              filter === tab.key
                ? 'bg-primary-override text-white dark:text-shell border-primary-override'
                : 'bg-surface-lowest text-text-secondary border-border-subtle hover:border-primary-override'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-primary-override" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-lowest rounded-xl border border-border-subtle p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-tint-blue flex items-center justify-center mx-auto mb-4">
            <FileText size={32} className="text-primary-override" />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">
            {filter === 'ALL' ? 'No Institution Reports Yet' : `No ${filter.replace('DFO_','').toLowerCase()} reports`}
          </h3>
          <p className="text-sm text-text-secondary font-data max-w-sm mx-auto">
            {filter === 'ALL'
              ? 'Audit Officers will submit institution reports from the Middlemen tab. They will appear here for your review.'
              : 'No reports match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(report => {
            const meta = STATUS_META[report.status] || { label: report.status, color: 'bg-surface-low text-text-secondary' }
            const isOpen = expanded === report.report_id
            const isPending = report.status === 'PENDING_DFO_REVIEW'
            return (
              <div key={report.report_id} className="bg-surface-lowest rounded-xl border border-border-subtle shadow-sm overflow-hidden">
                {/* Card header */}
                <div
                  className="p-5 flex items-center gap-4 cursor-pointer hover:bg-surface-low/30 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : report.report_id)}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-sm">{report.auditor_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AO'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-text-primary truncate">{report.institution_name}</h3>
                      {report.ai_generated && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-violet-500 bg-tint-violet px-2 py-0.5 rounded-full">
                          <Sparkles size={9} /> AI
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary font-data mt-0.5">
                      By <span className="font-semibold">{report.auditor_name || report.submitted_by}</span>
                      {' · '}<Clock size={9} className="inline" /> {new Date(report.submitted_at).toLocaleDateString('en-IN')}
                    </p>
                    {report.recommendation && (
                      <p className="text-xs text-text-secondary font-data mt-0.5">Recommendation: <span className="font-semibold">{report.recommendation}</span></p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${meta.color}`}>{meta.label}</span>
                    {isOpen ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
                  </div>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div className="border-t border-border-subtle px-5 pb-5 pt-4 space-y-4">
                    {/* Risk summary */}
                    {report.risk_summary && (
                      <div className="bg-surface-low px-4 py-3 rounded-lg text-xs font-data text-text-secondary">
                        <span className="font-bold text-text-primary">Risk Summary: </span>{report.risk_summary}
                      </div>
                    )}

                    {/* Report text */}
                    <div>
                      <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Audit Report</p>
                      <div className="bg-surface-low p-4 rounded-xl text-sm text-text-primary font-data leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {report.report_text}
                      </div>
                    </div>

                    {/* DFO decision form — only for pending */}
                    {isPending ? (
                      <div className="space-y-3 pt-2 border-t border-border-subtle">
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">Your Decision</p>
                        <textarea
                          value={notes[report.report_id] || ''}
                          onChange={e => setNotes(prev => ({ ...prev, [report.report_id]: e.target.value }))}
                          placeholder="Add notes (optional)…"
                          rows={2}
                          className="w-full bg-surface-low border border-border-subtle text-text-primary text-sm rounded-lg p-3 font-data outline-none focus:ring-2 focus:ring-primary-override resize-none"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleDecide(report, 'VERIFIED')}
                            disabled={deciding === report.report_id}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {deciding === report.report_id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                            Verify
                          </button>
                          <button
                            onClick={() => handleDecide(report, 'REASSIGN')}
                            disabled={deciding === report.report_id}
                            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {deciding === report.report_id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                            Reassign
                          </button>
                          <button
                            onClick={() => handleDecide(report, 'REJECTED')}
                            disabled={deciding === report.report_id}
                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {deciding === report.report_id ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Show existing decision */
                      <div className="pt-2 border-t border-border-subtle">
                        <div className={`px-4 py-3 rounded-lg ${meta.color}`}>
                          <p className="text-xs font-bold uppercase tracking-widest mb-0.5">DFO Decision: {report.dfo_decision}</p>
                          {report.dfo_notes && <p className="text-xs font-data">{report.dfo_notes}</p>}
                          {report.dfo_decided_at && (
                            <p className="text-xs font-data opacity-75 mt-1">
                              {new Date(report.dfo_decided_at).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
