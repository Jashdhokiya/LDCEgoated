import { useState, useRef, useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, UploadCloud, MapPin, Camera, CheckCircle, XCircle,
  AlertTriangle, Loader2, FileImage, User, Calendar, Clock,
  Shield, ChevronRight, Check, X, ScanLine
} from 'lucide-react'
// GPS is now captured live via navigator.geolocation (no EXIF needed)
import { submitEvidence as submitEvidenceAPI } from '../../api'
import { useLanguage } from '../../i18n/LanguageContext'

// Gujarat bounding box for coordinate validation
const GUJARAT_BOUNDS = { latMin: 20.1, latMax: 24.7, lngMin: 68.1, lngMax: 74.5 }

const isInGujarat = (lat, lng) =>
  lat >= GUJARAT_BOUNDS.latMin && lat <= GUJARAT_BOUNDS.latMax &&
  lng >= GUJARAT_BOUNDS.lngMin && lng <= GUJARAT_BOUNDS.lngMax

// ─── Reverse geocode via Nominatim (OpenStreetMap — free, no API key) ────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=12`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'EduGuard-DBT/1.0' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const addr = data.address || {}
    return {
      display: data.display_name || '',
      district: addr.state_district || addr.county || '',
      taluka: addr.suburb || addr.town || addr.village || addr.city || '',
      state: addr.state || '',
      raw: addr,
    }
  } catch {
    return null
  }
}

// ─── Fuzzy location match (handles name variations like Jamjodhpur/Jodiya) ───
function locationMatches(geoName, assignedName) {
  if (!geoName || !assignedName) return false
  const a = geoName.toLowerCase().replace(/[^a-z]/g, '')
  const b = assignedName.toLowerCase().replace(/[^a-z]/g, '')
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  // 3-char prefix match for similar names
  if (a.length >= 3 && b.length >= 3 && a.slice(0, 3) === b.slice(0, 3)) return true
  return false
}

const ANOMALY_LABELS = {
  DEAD_BENEFICIARY: 'Deceased Beneficiary',
  DECEASED: 'Deceased Beneficiary',
  DUPLICATE: 'Duplicate Identity',
  UNDRAWN: 'Undrawn Funds',
  CROSS_SCHEME: 'Cross-Scheme Violation',
}

// ─── Steps ──────────────────────────────────────────────────────────────────
const STEPS = ['Case Info', 'Capture Photo', 'Field Notes', 'Verify & Submit']

// ─── Verification engine (frontend only) ────────────────────────────────────
function verifyEvidence({ photoFile, gps, notes, beneficiaryPresent, exifDate, photoGeoResult, caseData, isRealGps }) {
  const checks = []

  // 1. Photo captured
  checks.push({
    id: 'photo',
    label: 'Photo evidence captured',
    pass: !!photoFile,
    detail: photoFile ? `${photoFile.name} (${(photoFile.size / 1024).toFixed(0)} KB)` : 'No photo captured',
  })

  // 2. GPS location captured
  checks.push({
    id: 'gps',
    label: 'Live GPS location captured',
    pass: !!(gps?.latitude && gps?.longitude),
    detail: gps?.latitude
      ? `Lat ${gps.latitude.toFixed(5)}, Lng ${gps.longitude.toFixed(5)}`
      : 'GPS location not available — enable location services',
  })

  // 3. Location within Gujarat
  const inGuj = gps?.latitude && isInGujarat(gps.latitude, gps.longitude)
  checks.push({
    id: 'location',
    label: 'Location within Gujarat jurisdiction',
    pass: !!inGuj,
    detail: inGuj
      ? 'Coordinates fall within Gujarat state boundaries'
      : gps?.latitude
        ? `Coordinates (${gps.latitude.toFixed(3)}, ${gps.longitude.toFixed(3)}) are outside Gujarat`
        : 'Cannot validate — no GPS data',
    warn: !gps?.latitude, // warn rather than fail if no GPS
  })

  // 4. ★ PHOTO GPS LOCATION MATCH — photo must have been taken at the assigned district
  const assignedDistrict = caseData?.district || ''
  let gpsMatchPassed = false
  let gpsMatchDetail = 'No GPS data — capture a photo at the assigned location'
  if (gps?.latitude && photoGeoResult) {
    const districtMatch = locationMatches(photoGeoResult.district, assignedDistrict)
    if (districtMatch) {
      gpsMatchPassed = true
      gpsMatchDetail = `✓ Photo taken in ${photoGeoResult.district}${photoGeoResult.taluka ? ', ' + photoGeoResult.taluka : ''} — matches assigned district (${assignedDistrict})`
    } else {
      gpsMatchPassed = false
      gpsMatchDetail = `✗ Photo taken in ${photoGeoResult.district || photoGeoResult.state || 'unknown location'} but case is assigned to ${assignedDistrict}. Upload a photo taken at the correct location.`
    }
  } else if (gps?.latitude && !photoGeoResult) {
    gpsMatchDetail = 'Photo GPS detected but location lookup pending…'
  }
  checks.push({
    id: 'gps_location_match',
    label: `Photo location matches assigned district (${assignedDistrict || 'N/A'})`,
    pass: gpsMatchPassed,
    detail: gpsMatchDetail + (!isRealGps && !gpsMatchPassed ? ' (demo GPS — not blocking)' : ''),
    warn: !gps?.latitude || !isRealGps, // warn (don't block) if no GPS or demo GPS
  })

  // 5. Photo recency (within 7 days)
  let recencyPassed = false
  let recencyDetail = 'No EXIF timestamp found'
  if (exifDate) {
    const daysDiff = (Date.now() - new Date(exifDate).getTime()) / (1000 * 86400)
    recencyPassed = daysDiff <= 7
    recencyDetail = recencyPassed
      ? `Taken ${daysDiff.toFixed(1)} days ago — within 7-day window`
      : `Taken ${daysDiff.toFixed(0)} days ago — exceeds 7-day policy`
  }
  checks.push({
    id: 'recency',
    label: 'Photo taken within 7 days',
    pass: recencyPassed,
    detail: recencyDetail,
    warn: !exifDate,
  })

  // 6. Field notes filled
  checks.push({
    id: 'notes',
    label: 'Field observations recorded',
    pass: notes.trim().length >= 30,
    detail: notes.trim().length >= 30
      ? `${notes.trim().length} characters recorded`
      : `Too brief — needs at least 30 characters (currently ${notes.trim().length})`,
  })

  // 7. Beneficiary presence noted
  checks.push({
    id: 'presence',
    label: 'Beneficiary presence documented',
    pass: beneficiaryPresent !== null,
    detail: beneficiaryPresent === null
      ? 'Mark whether beneficiary was present during visit'
      : beneficiaryPresent
        ? 'Beneficiary was present during visit'
        : 'Beneficiary was absent during visit',
  })

  const hardFails = checks.filter(c => !c.pass && !c.warn)
  const warnings  = checks.filter(c => !c.pass && c.warn)
  const passed    = checks.filter(c => c.pass)
  const score     = Math.round((passed.length / checks.length) * 100)
  const approved  = hardFails.length === 0

  return { checks, score, approved, hardFails, warnings }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SubmitEvidence() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const caseData = location.state?.caseData
  const onBack = () => navigate('/verifier/my-cases')
  const onComplete = () => navigate('/verifier/my-cases')

  const [step, setStep]     = useState(0)
  const [photoFile, setPhotoFile]   = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [gps, setGps]       = useState(null)
  const [exifDate, setExifDate] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [notes, setNotes]   = useState('')
  const [beneficiaryPresent, setBeneficiaryPresent] = useState(null)
  const [visitDate, setVisitDate]   = useState(new Date().toISOString().slice(0, 10))
  const [findingCategory, setFindingCategory] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [submitting, setSubmitting]  = useState(false)
  const [done, setDone]     = useState(false)
  const fileRef = useRef()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // Photo GPS reverse geocode result
  const [photoGeoResult, setPhotoGeoResult] = useState(null)
  const [geocoding, setGeocoding] = useState(false)
  const [isRealGps, setIsRealGps] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [liveGps, setLiveGps] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [countdown, setCountdown] = useState(null)

  // Fallback: simulate realistic GPS if browser denies location (demo mode)
  const DEMO_GPS = { latitude: 23.0225, longitude: 72.5714 } // Ahmedabad

  // ── Camera + Live GPS helpers ───────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('')
    setCameraActive(true)
    setCameraReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setCameraReady(true)
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions.')
      setCameraActive(false)
    }
    // Start fetching GPS in parallel
    setGpsLoading(true)
    setLiveGps(null)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setLiveGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGpsLoading(false) },
        () => { setLiveGps(null); setGpsLoading(false) },
        { enableHighAccuracy: true, timeout: 15000 }
      )
    } else { setGpsLoading(false) }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
    setCameraReady(false)
  }, [])

  // Cleanup camera on unmount
  useEffect(() => { return () => { streamRef.current?.getTracks().forEach(t => t.stop()) } }, [])

  const doCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    // Create a File-like object for verification engine
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], `evidence-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setPhotoFile(file)
    setPhotoPreview(dataUrl)
    setExifDate(new Date())
    stopCamera()
    // Apply GPS (live or demo fallback)
    const usedGps = liveGps || DEMO_GPS
    setIsRealGps(!!liveGps)
    setGps({ latitude: usedGps.latitude, longitude: usedGps.longitude })
    setGeocoding(true)
    const geo = await reverseGeocode(usedGps.latitude, usedGps.longitude)
    setPhotoGeoResult(geo)
    setGeocoding(false)
  }, [liveGps, stopCamera])

  const handleCaptureWithCountdown = useCallback(() => {
    setCountdown(3)
    let c = 3
    const iv = setInterval(() => {
      c--
      if (c <= 0) { clearInterval(iv); setCountdown(null); doCapture() }
      else setCountdown(c)
    }, 1000)
  }, [doCapture])

  const resetCapture = useCallback(() => {
    setPhotoFile(null); setPhotoPreview(null); setGps(null); setExifDate(null)
    setPhotoGeoResult(null); setLiveGps(null)
  }, [])

  const runVerification = () => {
    const result = verifyEvidence({ photoFile, gps, notes, beneficiaryPresent, exifDate, photoGeoResult, caseData, isRealGps })
    setVerifyResult(result)
    setStep(3)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await submitEvidenceAPI(caseData?.case_id || caseData?.flag_id, {
        photo_evidence_url: photoPreview || 'field-evidence-photo.jpg',
        gps_lat: gps?.latitude || 0,
        gps_lng: gps?.longitude || 0,
        verifier_notes: notes,
        ai_verification_match: verifyResult?.approved ?? null,
        confidence_score: verifyResult?.score ?? 0,
        live_gps_lat: liveGps?.latitude || gps?.latitude || 0,
        live_gps_lng: liveGps?.longitude || gps?.longitude || 0,
        live_gps_accuracy: liveGps?.accuracy || null,
        reverse_geocode_district: photoGeoResult?.district || null,
        reverse_geocode_taluka: photoGeoResult?.taluka || null,
      })
      setDone(true)
    } catch (err) {
      console.error('Evidence submission failed:', err)
      alert('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const canProceedStep0 = true
  const canProceedStep1 = !!photoFile
  const canProceedStep2 = notes.trim().length >= 30 && beneficiaryPresent !== null && findingCategory

  // ── Done screen ──
  if (done) {
    return (
      <div className="p-8 max-w-2xl mx-auto font-sans flex flex-col items-center text-center py-20">
        <div className="w-20 h-20 rounded-full bg-tint-emerald flex items-center justify-center mb-5">
          <CheckCircle size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Evidence Submitted</h2>
        <p className="text-sm text-text-secondary font-data leading-relaxed mb-1">
          Case <span className="font-mono font-bold">{caseData?.case_id}</span> has been submitted for AI verification and Audit Officer review.
        </p>
        <p className="text-xs text-text-secondary font-data mb-8">
          Submission time: {new Date().toLocaleString('en-IN')} · Reference: EV-{Math.random().toString(36).slice(2, 8).toUpperCase()}
        </p>
        {verifyResult && (
          <div className={`w-full mb-6 p-4 rounded-xl border ${verifyResult.approved ? 'bg-tint-emerald border-border-subtle' : 'bg-tint-yellow border-border-subtle'}`}>
            <p className={`text-sm font-bold mb-1 ${verifyResult.approved ? 'text-emerald-700' : 'text-yellow-700'}`}>
              Verification Score: {verifyResult.score}% — {verifyResult.approved ? 'APPROVED' : 'SUBMITTED WITH WARNINGS'}
            </p>
            <p className="text-xs font-data text-text-secondary">The Audit Officer will review discrepancies before final decision.</p>
          </div>
        )}
        <button onClick={onComplete} className="px-8 py-3 bg-primary-override text-white dark:text-shell font-bold rounded-xl text-sm hover:brightness-110 transition-all">
          Back to My Cases
        </button>
      </div>
    )
  }

  return (
    <div className="p-8 pb-20 font-sans max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-surface-low transition-colors text-text-secondary hover:text-text-primary">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-primary font-sans">{t('verifier.submitEvidenceBtn')}</h1>
          <p className="text-xs text-text-secondary font-data">
            {t('queue.case')} <span className="font-mono font-bold">{caseData?.case_id || caseData?.flag_id}</span>
            {' '}· {t(`anomalyLabels.${caseData?.anomaly_type || caseData?.leakage_type}`) || ANOMALY_LABELS[caseData?.anomaly_type || caseData?.leakage_type] || caseData?.anomaly_type || caseData?.leakage_type}
          </p>
        </div>
        <Shield size={18} className="text-text-secondary" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > i ? 'bg-emerald-500 text-white' :
                step === i ? 'bg-primary-override text-white dark:text-shell' :
                'bg-surface-low text-text-secondary'
              }`}>
                {step > i ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-[10px] font-data mt-1 ${step === i ? 'text-primary-override font-bold' : 'text-text-secondary'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-4 ${step > i ? 'bg-emerald-400' : 'bg-surface-low'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Case Info ── */}
      {step === 0 && (
        <div className="bg-surface-lowest rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle bg-surface-low">
            <h2 className="font-bold text-text-primary">Confirm Case Details</h2>
            <p className="text-xs text-text-secondary font-data mt-0.5">Verify you have the correct case before submitting</p>
          </div>
          <div className="px-6 py-5 space-y-3">
            {[
              { label: 'Case ID',       value: caseData?.case_id || caseData?.flag_id },
              { label: 'Beneficiary',   value: caseData?.beneficiary_name || caseData?.target_entity?.name || caseData?.target_entity?.entity_id },
              { label: 'Entity ID',     value: caseData?.beneficiary_id || caseData?.target_entity?.entity_id },
              { label: 'Anomaly Type',  value: ANOMALY_LABELS[caseData?.anomaly_type || caseData?.leakage_type] || caseData?.anomaly_type || caseData?.leakage_type },
              { label: 'Scheme',        value: caseData?.scheme },
              { label: 'District',      value: caseData?.district },
              { label: 'Amount at Risk',value: (caseData?.amount || caseData?.payment_amount) ? `₹${(caseData.amount || caseData.payment_amount).toLocaleString('en-IN')}` : '—' },
              { label: 'Assigned Date', value: caseData?.assigned_date || '—' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                <span className="text-xs text-text-secondary font-data">{row.label}</span>
                <span className="text-sm font-bold text-text-primary font-sans">{row.value || '—'}</span>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 bg-tint-orange border-t border-border-subtle">
            <p className="text-xs text-orange-700 font-data flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              Submitting false evidence is a criminal offence under the Indian Penal Code. All submissions are GPS-verified and timestamped.
            </p>
          </div>
          <div className="px-6 py-4 border-t border-border-subtle">
            <button onClick={() => setStep(1)} className="w-full py-3 bg-primary-override text-white dark:text-shell font-bold rounded-xl text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2">
              Confirm & Capture Photo <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 1: Capture Photo ── */}
      {step === 1 && (
        <div className="space-y-4">
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera / Preview area */}
          {!photoPreview ? (
            <div className="rounded-2xl border-2 border-dashed border-border-subtle bg-surface-lowest overflow-hidden">
              {!cameraActive ? (
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-surface-low flex items-center justify-center mb-4">
                    <Camera size={26} className="text-text-secondary" />
                  </div>
                  <p className="text-sm font-bold text-text-primary mb-1">Capture field evidence photo</p>
                  <p className="text-xs text-text-secondary font-data mb-4">Your live GPS location will be recorded automatically</p>
                  <button onClick={startCamera}
                    className="px-6 py-2.5 bg-primary-override text-white dark:text-shell text-sm font-bold rounded-xl hover:brightness-110 transition-all flex items-center gap-2">
                    <Camera size={16} /> Open Camera
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-80 object-cover bg-black" />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <Loader2 size={28} className="animate-spin text-white" />
                    </div>
                  )}
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-5xl font-bold text-white animate-pulse">{countdown}</span>
                    </div>
                  )}
                  {/* Live GPS indicator overlay */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
                    <MapPin size={12} className={liveGps ? 'text-emerald-400' : gpsLoading ? 'text-yellow-400 animate-pulse' : 'text-red-400'} />
                    <span className="text-xs font-mono text-white">
                      {liveGps ? `${liveGps.latitude.toFixed(4)}, ${liveGps.longitude.toFixed(4)}` : gpsLoading ? 'Acquiring GPS…' : 'GPS unavailable'}
                    </span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center gap-3">
                    <button onClick={() => { stopCamera(); setCameraActive(false) }}
                      className="px-4 py-2 bg-white/20 text-white text-sm font-bold rounded-lg hover:bg-white/30 transition-all">
                      Cancel
                    </button>
                    <button onClick={handleCaptureWithCountdown} disabled={!cameraReady || countdown !== null}
                      className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center gap-2">
                      <Camera size={16} /> {countdown !== null ? `${countdown}…` : 'Capture'}
                    </button>
                  </div>
                </div>
              )}
              {cameraError && (
                <div className="p-4 bg-tint-red">
                  <p className="text-xs text-red-600 font-data flex items-center gap-2"><AlertTriangle size={13} />{cameraError}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative rounded-2xl border-2 border-emerald-400 bg-tint-emerald overflow-hidden">
              <img src={photoPreview} alt="Captured evidence" className="w-full max-h-72 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                <div className="text-white">
                  <p className="text-sm font-bold">📸 Photo captured</p>
                  <p className="text-xs opacity-70">{new Date().toLocaleString('en-IN')}</p>
                </div>
                <button onClick={resetCapture}
                  className="ml-auto w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                  <X size={14} className="text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Live GPS verification result */}
          {photoFile && !geocoding && gps && (
            <div className={`p-4 rounded-xl border ${gps ? 'bg-tint-emerald border-border-subtle' : 'bg-tint-red border-border-subtle'}`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-emerald-600" />
                <p className="text-sm font-bold text-emerald-700">{isRealGps ? 'Live GPS Location Captured' : 'Demo GPS Used'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-data text-emerald-700">
                  <MapPin size={11} />
                  <span className="font-mono">Lat {gps.latitude.toFixed(6)}, Lng {gps.longitude.toFixed(6)}</span>
                  {liveGps?.accuracy && <span className="opacity-60">±{liveGps.accuracy.toFixed(0)}m</span>}
                </div>
                <div className="flex items-center gap-2 text-xs font-data text-emerald-700">
                  {isInGujarat(gps.latitude, gps.longitude)
                    ? <><CheckCircle size={11} /> <span>Within Gujarat jurisdiction</span></>
                    : <><AlertTriangle size={11} /> <span>Outside Gujarat bounds — will be flagged</span></>
                  }
                </div>
                <div className="flex items-center gap-2 text-xs font-data text-emerald-700">
                  <Clock size={11} />
                  <span>Captured: {new Date(exifDate).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Geocode district match */}
          {geocoding && (
            <div className="flex items-center gap-3 p-4 bg-tint-blue rounded-xl border border-border-subtle">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <p className="text-sm text-blue-700 font-data">Verifying location against assigned district…</p>
            </div>
          )}

          {!geocoding && photoFile && gps && photoGeoResult && (
            <div className={`p-4 rounded-xl border ${
              locationMatches(photoGeoResult.district, caseData?.district)
                ? 'bg-tint-emerald border-emerald-200' : 'bg-tint-red border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {locationMatches(photoGeoResult.district, caseData?.district)
                  ? <CheckCircle size={16} className="text-emerald-600" />
                  : <XCircle size={16} className="text-red-500" />
                }
                <p className={`text-sm font-bold ${
                  locationMatches(photoGeoResult.district, caseData?.district) ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  {locationMatches(photoGeoResult.district, caseData?.district)
                    ? `✓ Location verified: ${photoGeoResult.district}`
                    : `✗ Location mismatch: You are in ${photoGeoResult.district || 'unknown'}`
                  }
                </p>
              </div>
              <p className="text-xs font-data text-text-secondary ml-6">
                {locationMatches(photoGeoResult.district, caseData?.district)
                  ? `You are in ${photoGeoResult.district}${photoGeoResult.taluka ? ' (' + photoGeoResult.taluka + ')' : ''} — matches assigned district (${caseData?.district})`
                  : `Case is assigned to ${caseData?.district}. Your current location is ${photoGeoResult.district || photoGeoResult.state || 'somewhere else'}. Go to the assigned location to capture evidence.`
                }
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="px-5 py-2.5 border border-border-subtle text-sm font-semibold rounded-xl hover:bg-surface-low transition-all">
              ← {t('common.cancel')}
            </button>
            <button onClick={() => setStep(2)} disabled={!canProceedStep1}
              className="flex-1 py-2.5 bg-primary-override text-white dark:text-shell text-sm font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              Continue to Field Notes <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Field Notes ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-surface-lowest rounded-2xl border border-border-subtle shadow-sm p-6 space-y-5">

            {/* Visit date */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 font-data">
                <Calendar size={11} className="inline mr-1" />Visit Date
              </label>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-border-subtle rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-primary-override/30 focus:border-primary-override" />
            </div>

            {/* Beneficiary present? */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 font-data">
                <User size={11} className="inline mr-1" />Was beneficiary present during visit?
              </label>
              <div className="flex gap-3">
                {[true, false].map(val => (
                  <button key={String(val)}
                    onClick={() => setBeneficiaryPresent(val)}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg border-2 transition-all ${
                      beneficiaryPresent === val
                        ? val ? 'border-emerald-500 bg-tint-emerald text-emerald-600 dark:text-emerald-400' : 'border-red-400 bg-tint-red text-risk-critical'
                        : 'border-border-subtle text-text-secondary hover:border-border-subtle'
                    }`}>
                    {val ? 'Yes — Present' : 'No — Absent'}
                  </button>
                ))}
              </div>
            </div>

            {/* Finding category */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 font-data">Finding Category</label>
              <select value={findingCategory} onChange={e => setFindingCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-border-subtle rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-override/30 focus:border-primary-override bg-surface-lowest">
                <option value="">Select finding…</option>
                <option value="CONFIRMED_FRAUD">Confirmed Fraud — Evidence supports anomaly</option>
                <option value="LEGITIMATE">Legitimate — No issue found</option>
                <option value="INCONCLUSIVE">Inconclusive — Requires further investigation</option>
                <option value="BENEFICIARY_UNREACHABLE">Beneficiary Unreachable</option>
              </select>
            </div>

            {/* Field notes */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 font-data">
                Field Observations
                <span className={`ml-2 font-normal ${notes.trim().length >= 30 ? 'text-emerald-600' : 'text-text-secondary'}`}>
                  ({notes.trim().length}/30 min. chars)
                </span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={5}
                placeholder="Describe what you observed at the field visit. Include: physical verification, documents checked, neighbours/witnesses spoken to, discrepancies found…"
                className="w-full px-3 py-3 border border-border-subtle rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-override/30 focus:border-primary-override resize-none font-sans"
              />
              {notes.trim().length > 0 && notes.trim().length < 30 && (
                <p className="text-xs text-orange-600 font-data mt-1">Add {30 - notes.trim().length} more characters</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-5 py-2.5 border border-border-subtle text-sm font-semibold rounded-xl hover:bg-surface-low transition-all">
              ← {t('common.cancel')}
            </button>
            <button onClick={runVerification} disabled={!canProceedStep2}
              className="flex-1 py-2.5 bg-primary-override text-white dark:text-shell text-sm font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              <ScanLine size={16} /> Run Verification Check
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Verify & Submit ── */}
      {step === 3 && verifyResult && (
        <div className="space-y-4">
          {/* Score banner */}
          <div className={`rounded-2xl p-5 border-2 ${verifyResult.approved ? 'bg-tint-emerald border-emerald-300' : 'bg-tint-yellow border-yellow-300'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest font-data ${verifyResult.approved ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  Verification Result
                </p>
                <p className={`text-2xl font-bold mt-0.5 ${verifyResult.approved ? 'text-emerald-700' : 'text-yellow-700'}`}>
                  {verifyResult.approved ? 'PASSED — Ready to Submit' : 'WARNINGS DETECTED'}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4 ${
                verifyResult.approved ? 'border-emerald-400 text-emerald-700 bg-surface-lowest' : 'border-yellow-400 text-yellow-700 bg-surface-lowest'
              }`}>
                {verifyResult.score}%
              </div>
            </div>
            {/* Score bar */}
            <div className="h-2 bg-surface-lowest rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${verifyResult.score >= 80 ? 'bg-emerald-500' : verifyResult.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${verifyResult.score}%` }} />
            </div>
          </div>

          {/* Check breakdown */}
          <div className="bg-surface-lowest rounded-2xl border border-border-subtle shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border-subtle">
              <p className="text-xs font-bold uppercase tracking-widest text-text-secondary font-data">Verification Checklist</p>
            </div>
            {verifyResult.checks.map(c => (
              <div key={c.id} className="flex items-start gap-3 px-5 py-3.5 border-b border-border-subtle last:border-0">
                {c.pass
                  ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  : c.warn
                    ? <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    : <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                }
                <div className="flex-1">
                  <p className={`text-sm font-bold ${c.pass ? 'text-text-primary' : c.warn ? 'text-yellow-700' : 'text-red-700'}`}>
                    {c.label}
                  </p>
                  <p className="text-xs text-text-secondary font-data mt-0.5">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {verifyResult.hardFails.length > 0 && (
            <div className="p-4 bg-tint-red rounded-xl border border-border-subtle">
              <p className="text-sm font-bold text-red-700 mb-1">Cannot Submit</p>
              <ul className="text-xs text-red-600 font-data space-y-0.5">
                {verifyResult.hardFails.map(f => <li key={f.id}>• {f.label}: {f.detail}</li>)}
              </ul>
              <button onClick={() => setStep(1)} className="mt-3 text-xs font-bold text-red-700 underline">
                Go back and fix issues
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-5 py-2.5 border border-border-subtle text-sm font-semibold rounded-xl hover:bg-surface-low transition-all">
              ← {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!verifyResult.approved || submitting}
              className="flex-1 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                : <><UploadCloud size={16} /> Submit Evidence for AI Review</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
