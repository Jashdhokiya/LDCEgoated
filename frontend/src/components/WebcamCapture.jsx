import { useState, useRef, useCallback, useEffect } from 'react'
import { Camera, RotateCcw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

/**
 * WebcamCapture — reusable webcam component for face enrolment / KYC verification.
 *
 * Props:
 *  - onCapture(base64: string) — called with the captured image data URL
 *  - onCancel() — called when user cancels
 *  - mode: 'enroll' | 'verify' — changes copy/colors
 *  - disabled: bool
 */
export default function WebcamCapture({ onCapture, onCancel, mode = 'enroll', disabled = false }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [captured, setCaptured] = useState(null) // base64 data URL
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(null)

  // Start webcam
  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => setCameraReady(true)
        }
      } catch (err) {
        if (!cancelled) setError('Camera access denied. Please allow camera permissions and try again.')
      }
    }
    start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const doCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    // Mirror the image (selfie mode)
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCaptured(dataUrl)
  }, [])

  const handleCapture = useCallback(() => {
    setCountdown(3)
    let c = 3
    const interval = setInterval(() => {
      c--
      if (c <= 0) {
        clearInterval(interval)
        setCountdown(null)
        doCapture()
      } else {
        setCountdown(c)
      }
    }, 1000)
  }, [doCapture])

  const handleRetake = useCallback(() => {
    setCaptured(null)
  }, [])

  const handleConfirm = useCallback(() => {
    if (captured && onCapture) {
      onCapture(captured)
    }
  }, [captured, onCapture])

  const isVerify = mode === 'verify'

  return (
    <div className="flex flex-col items-center">
      {error ? (
        <div className="flex flex-col items-center gap-3 p-6">
          <AlertCircle size={40} className="text-risk-critical" />
          <p className="text-sm text-risk-critical font-data text-center">{error}</p>
          <button onClick={onCancel} className="text-xs text-text-secondary hover:text-text-primary transition-colors">
            Go Back
          </button>
        </div>
      ) : !captured ? (
        <>
          {/* Live Camera Feed */}
          <div className="relative w-64 h-64 rounded-2xl overflow-hidden bg-gray-900 mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <Loader2 size={28} className="animate-spin text-text-secondary" />
              </div>
            )}

            {/* Face guide overlay */}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Oval guide */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-36 h-44 border-2 border-dashed rounded-[50%] opacity-50"
                  style={{ borderColor: isVerify ? '#3b82f6' : '#10b981' }}
                />
                {/* Corner brackets */}
                {['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'].map((pos, i) => (
                  <div key={i} className={`absolute w-5 h-5 ${pos}`} style={{
                    borderColor: isVerify ? '#3b82f6' : '#10b981',
                    borderTopWidth: i < 2 ? 2 : 0,
                    borderBottomWidth: i >= 2 ? 2 : 0,
                    borderLeftWidth: i % 2 === 0 ? 2 : 0,
                    borderRightWidth: i % 2 === 1 ? 2 : 0,
                  }} />
                ))}
              </div>
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-5xl font-bold text-white animate-pulse">{countdown}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-text-secondary font-data text-center mb-4 max-w-xs">
            {isVerify
              ? 'Position your face within the guide. This will be matched against your enrolled photo.'
              : 'Position your face within the oval guide. Ensure good lighting and look straight at the camera.'
            }
          </p>

          <div className="flex gap-3">
            {onCancel && (
              <button onClick={onCancel} disabled={disabled}
                className="px-5 py-2.5 border border-border-subtle text-text-secondary text-sm font-bold rounded-lg hover:bg-surface-low transition-all">
                Cancel
              </button>
            )}
            <button
              onClick={handleCapture}
              disabled={!cameraReady || disabled || countdown !== null}
              className={`px-5 py-2.5 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-60 ${
                isVerify
                  ? 'bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900'
                  : 'bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900'
              }`}
            >
              <Camera size={16} />
              {countdown !== null ? `${countdown}...` : 'Capture Photo'}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Preview of captured image */}
          <div className="relative w-64 h-64 rounded-2xl overflow-hidden mb-4 border-2"
            style={{ borderColor: isVerify ? '#3b82f6' : '#10b981' }}
          >
            <img src={captured} alt="Captured selfie" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2">
              <CheckCircle size={24} className={isVerify ? 'text-blue-400' : 'text-emerald-400'} />
            </div>
          </div>

          <p className="text-xs text-text-secondary font-data text-center mb-4">
            {isVerify ? 'Does this photo look clear? It will be verified against your profile photo.' : 'Does this look good? This will be your face ID for KYC verification.'}
          </p>

          <div className="flex gap-3">
            <button onClick={handleRetake} disabled={disabled}
              className="px-5 py-2.5 border border-border-subtle text-text-secondary text-sm font-bold rounded-lg hover:bg-surface-low transition-all flex items-center gap-2">
              <RotateCcw size={14} /> Retake
            </button>
            <button onClick={handleConfirm} disabled={disabled}
              className={`px-5 py-2.5 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-60 ${
                isVerify
                  ? 'bg-gradient-to-b from-blue-600 to-blue-800'
                  : 'bg-gradient-to-b from-emerald-600 to-emerald-800'
              }`}
            >
              <CheckCircle size={14} /> {isVerify ? 'Verify Identity' : 'Use This Photo'}
            </button>
          </div>
        </>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
