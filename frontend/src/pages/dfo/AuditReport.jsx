import { useState, useEffect } from 'react'
import { api } from '../../api'
import { Printer, Download } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

export default function AuditReport() {
  const { t } = useLanguage()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getReport().then(res => {
      setReport(res.data)
      setLoading(false)
    }).catch(e => {
      console.error(e)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8 text-text-secondary font-data">{t('auditReport.generatingReport')}</div>
  if (!report) return <div className="p-8 text-text-secondary font-data">{t('auditReport.runFirst')}</div>

  const handlePrint = () => window.print()
  
  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([report], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "DBT_Audit_Report.txt";
    document.body.appendChild(element);
    element.click();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-sans text-text-primary tracking-tight">{t('auditReport.title')}</h1>
        <div className="flex gap-3">
          <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-surface-lowest border border-border-subtle rounded text-sm font-semibold text-text-primary hover:bg-surface-low transition-colors shadow-sm">
            <Download size={16} /> {t('auditReport.exportTxt')}
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-primary-override text-white rounded text-sm font-semibold hover:bg-blue-900 transition-colors shadow-sm">
            <Printer size={16} /> {t('auditReport.print')}
          </button>
        </div>
      </div>
      
      <div className="bg-surface-lowest p-10 rounded-sm shadow-md border border-border-subtle min-h-[800px]">
        <pre className="font-mono text-sm text-text-primary whitespace-pre-wrap leading-loose">
          {report}
        </pre>
      </div>
    </div>
  )
}
