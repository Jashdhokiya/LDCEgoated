import { useEffect, useState } from 'react'
import { Megaphone, Loader2, Send, RefreshCw } from 'lucide-react'
import { createAdminAnnouncement, getAdminAnnouncements } from '../../api'

const TAGS = ['NEW', 'UPDATE', 'REMINDER']

export default function Announcements() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tag, setTag] = useState('UPDATE')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const loadAnnouncements = async () => {
    setLoading(true)
    const data = await getAdminAnnouncements()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!body.trim()) {
      setError('Message is required')
      return
    }

    setSaving(true)
    const res = await createAdminAnnouncement({ title, body, tag })
    setSaving(false)

    if (!res) {
      setError('Failed to publish announcement')
      return
    }

    setTitle('')
    setBody('')
    setTag('UPDATE')
    setItems((prev) => [res, ...prev])
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  return (
    <div className="p-8 pb-20 font-sans max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            <Megaphone size={26} className="text-primary-override" />
            State Announcements
          </h1>
          <p className="text-sm text-text-secondary mt-1 font-data">Publish announcements visible in user profiles.</p>
        </div>
        <button
          onClick={loadAnnouncements}
          className="px-4 py-2 text-sm rounded-lg border border-border-subtle bg-surface-lowest hover:bg-surface-low transition flex items-center gap-2"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-lowest border border-border-subtle rounded-2xl p-6 shadow-sm space-y-4">
        {error && <p className="text-sm text-risk-critical font-data">{error}</p>}
        {showSuccess && <p className="text-sm text-risk-low font-data">Announcement published successfully!</p>}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. NLY deadline extended"
              className="w-full px-3 py-2.5 border border-border-subtle rounded-lg bg-surface-lowest outline-none focus:ring-2 focus:ring-primary-override/30"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Tag</label>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full px-3 py-2.5 border border-border-subtle rounded-lg bg-surface-lowest outline-none"
            >
              {TAGS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write announcement details..."
            className="w-full px-3 py-2.5 border border-border-subtle rounded-lg bg-surface-lowest outline-none focus:ring-2 focus:ring-primary-override/30 resize-y"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-primary-override text-white font-bold text-sm hover:brightness-110 transition flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Publish Announcement
        </button>
      </form>

      <div className="bg-surface-lowest border border-border-subtle rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border-subtle">
          <h2 className="font-bold text-text-primary">Published Announcements</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-secondary font-data">
            <Loader2 size={20} className="animate-spin mx-auto mb-2" />
            Loading announcements...
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-sm text-text-secondary font-data">No announcements yet.</div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {items.map((a) => (
              <div key={a.announcement_id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-low text-text-primary">{a.tag}</span>
                  <span className="text-[11px] font-mono text-text-secondary">{(a.created_at || '').slice(0, 10)}</span>
                </div>
                <p className="font-bold text-text-primary mb-1">{a.title}</p>
                <p className="text-sm text-text-secondary font-data leading-relaxed">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
