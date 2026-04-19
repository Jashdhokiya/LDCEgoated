import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { verifyMagicLink } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import { Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login: authLogin } = useAuth()
  
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setErrorMsg('Invalid or missing verification token.')
      return
    }

    verifyMagicLink(token)
      .then(data => {
        authLogin('USER', data)
        setStatus('success')
        // Automatically redirect to complete profile after showing success for 2 seconds
        setTimeout(() => {
          navigate('/user/complete-profile', { replace: true })
        }, 2000)
      })
      .catch(err => {
        setStatus('error')
        setErrorMsg(err?.response?.data?.detail || 'Verification failed. The link may have expired.')
      })
  }, [searchParams, authLogin, navigate])

  return (
    <div className="min-h-screen bg-shell flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1b2a] to-[#1b3a5b] opacity-90 layer-z-bottom" />
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="bg-workspace relative z-10 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-surface-lowest">
        <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-6 flex flex-col items-center justify-center border-b border-surface-medium">
          <Shield size={36} className="text-white mb-2" />
          <h1 className="text-xl font-bold text-white tracking-tight">EduGuard Auth</h1>
        </div>

        <div className="p-8 text-center bg-surface-lowest">
          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
              <h2 className="text-lg font-bold text-text-primary mb-1">Verifying Email...</h2>
              <p className="text-sm text-text-secondary font-data">Please wait while we validate your magic link.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-tint-emerald rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-text-primary mb-1">Email Verified!</h2>
              <p className="text-sm text-text-secondary font-data">Redirecting you to complete your profile...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-tint-red rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-risk-critical" />
              </div>
              <h2 className="text-lg font-bold text-text-primary mb-1">Verification failed</h2>
              <p className="text-sm text-text-secondary font-data mb-6">{errorMsg}</p>
              <button onClick={() => navigate('/login', { replace: true })}
                className="w-full py-2.5 bg-surface-low border border-border-subtle text-text-primary text-sm font-bold rounded-lg hover:bg-surface-medium transition-all">
                Return to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
