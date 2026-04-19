import { useState, useEffect } from 'react'
import { MessageSquare, Clock, User, MapPin, ChevronRight, CheckCircle, Search, Filter, AlertCircle, Loader2, X } from 'lucide-react'
import { getSupportTickets, updateSupportTicket } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

export default function PublicComplaints() {
  const { t } = useLanguage()
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('ALL') // ALL, OPEN, RESOLVED
  const [updatingId, setUpdatingId] = useState(null)
  
  // Response Modal State
  const [respondComplaint, setRespondComplaint] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [isSending, setIsSending] = useState(false)

  const fetchTickets = () => {
    getSupportTickets().then(res => {
      console.log('Complaints received:', res)
      setComplaints(res || [])
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const handleResolve = async (id) => {
    setUpdatingId(id)
    try {
      await updateSupportTicket(id, { status: 'RESOLVED' })
      setComplaints(prev => prev.map(c => c._id === id ? { ...c, status: 'RESOLVED' } : c))
    } catch (err) {
      console.error('Failed to update ticket', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRespond = (complaint) => {
    setRespondComplaint(complaint)
    setResponseText(complaint.response || '')
  }

  const submitResponse = async () => {
    if (!responseText.trim() || !respondComplaint) return
    setIsSending(true)
    try {
      await updateSupportTicket(respondComplaint._id, { 
        response: responseText,
        status: 'RESOLVED' 
      })
      setComplaints(prev => prev.map(c => 
        c._id === respondComplaint._id 
          ? { ...c, response: responseText, status: 'RESOLVED' } 
          : c
      ))
      setRespondComplaint(null)
    } catch (err) {
      console.error('Failed to send response', err)
    } finally {
      setIsSending(false)
    }
  }

  const filtered = complaints.filter(c => {
    const matchesSearch = c.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.message?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filter === 'ALL' || c.status === filter
    return matchesSearch && matchesFilter
  })

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 size={40} className="animate-spin text-primary-override" />
      <span className="text-text-secondary font-medium">Loading complaints...</span>
    </div>
  )

  return (
    <div className="p-8 space-y-8 min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-text-primary font-sans tracking-tight">Public Complaints</h1>
          <p className="text-sm text-text-secondary">Review and manage support requests from citizens in your district</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
            <input 
              type="text" 
              placeholder="Search complaints..."
              className="bg-surface-lowest border border-border-subtle rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary-override outline-none w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="bg-surface-lowest border border-border-subtle rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary-override outline-none"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filtered.length === 0 ? (
          <div className="bg-surface-lowest border border-border-subtle rounded-3xl p-16 text-center shadow-sm">
            <div className="w-20 h-20 bg-surface-low rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare size={40} className="text-text-secondary/20" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">No complaints found</h3>
            <p className="text-sm text-text-secondary max-w-sm mx-auto">Your district queue is clear. New citizen requests will appear here as they are submitted.</p>
          </div>
        ) : filtered.map(complaint => (
          <div key={complaint._id} className="bg-surface-lowest border border-border-subtle rounded-3xl p-6 hover:shadow-md transition-shadow group">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${complaint.status === 'OPEN' ? 'bg-risk-critical/10 text-risk-critical' : 'bg-emerald-100 text-emerald-700'}`}>
                        {complaint.status}
                      </span>
                      <span className="text-[10px] font-mono text-text-secondary flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(complaint.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-text-primary leading-tight">{complaint.subject}</h2>
                  </div>
                </div>

                <p className="text-sm text-text-secondary leading-relaxed bg-surface-low p-4 rounded-2xl italic border border-border-subtle/30">
                  "{complaint.message}"
                </p>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary-override/10 rounded-full flex items-center justify-center">
                      <User size={14} className="text-primary-override" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">{complaint.user_name || 'Anonymous'}</p>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wider">Citizen</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                      <MapPin size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">{complaint.district || 'Unknown'}</p>
                      <p className="text-[10px] text-text-secondary uppercase tracking-wider">District</p>
                    </div>
                  </div>
                  
                  {complaint.response && (
                    <div className="mt-4 p-3 bg-primary-override/5 rounded-lg border border-primary-override/10">
                      <p className="text-xs font-bold text-primary-override mb-1">DFO Response:</p>
                      <p className="text-sm text-text-secondary">{complaint.response}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:w-48 flex flex-col justify-center gap-3">
                <button 
                  onClick={() => handleRespond(complaint)}
                  className="w-full py-2.5 bg-primary-override text-white dark:text-shell text-xs font-bold rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  <ChevronRight size={14} />
                  Respond
                </button>
                {complaint.status !== 'RESOLVED' && (
                  <button 
                    onClick={() => handleResolve(complaint._id)}
                    disabled={updatingId === complaint._id}
                    className="w-full py-2.5 border border-border-subtle text-xs font-bold text-text-secondary rounded-xl hover:bg-surface-low transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {updatingId === complaint._id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Response Modal */}
      {respondComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-lowest w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Respond to Citizen</h3>
                <p className="text-sm text-text-secondary mt-1">Ticket: {respondComplaint.subject}</p>
              </div>
              <button 
                onClick={() => setRespondComplaint(null)}
                className="w-8 h-8 rounded-full hover:bg-surface-low flex items-center justify-center text-text-tertiary transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-semibold text-text-primary mb-2">
                Your Message
              </label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Type your response here. This will be visible to the citizen and will automatically resolve the ticket."
                className="w-full h-32 p-3 rounded-xl border border-border-subtle bg-surface-low focus:bg-surface-lowest focus:ring-2 focus:ring-primary-override/20 focus:border-primary-override transition-all outline-none resize-none text-sm"
              />
            </div>
            
            <div className="p-4 border-t border-border-subtle bg-surface-low flex justify-end gap-3">
              <button
                onClick={() => setRespondComplaint(null)}
                className="px-5 py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface-lowest rounded-xl transition-colors border border-transparent hover:border-border-subtle"
              >
                Cancel
              </button>
              <button
                onClick={submitResponse}
                disabled={isSending || !responseText.trim()}
                className="px-5 py-2.5 text-sm font-bold text-white dark:text-shell bg-primary-override rounded-xl hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSending ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                Send & Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
