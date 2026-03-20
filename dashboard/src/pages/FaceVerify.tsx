import { useState, useCallback } from 'react'
import { useWebcam } from '../lib/useWebcam'
import { useAuth } from '../lib/auth'

const ENGINE_URL = import.meta.env.VITE_API_URL || ''

export default function FaceVerify() {
  const { videoRef, ready, error: camError, captureFrame } = useWebcam()
  const { completeFaceVerify, tenantId, logout } = useAuth()
  const [status, setStatus] = useState<'idle' | 'capturing' | 'verifying' | 'enrolling'>('idle')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const watchlistName = `face2fa_${tenantId}`

  const handleVerify = useCallback(async () => {
    setError('')
    setStatus('capturing')

    try {
      const frame = await captureFrame()

      // Try to identify against the tenant's face2fa watchlist
      setStatus('verifying')
      const form = new FormData()
      form.append('image', frame, 'face.jpg')
      form.append('watchlist_name', watchlistName)
      form.append('top_k', '1')
      form.append('threshold', '0.4')

      const res = await fetch(`${ENGINE_URL}/api/v1/identify`, { method: 'POST', body: form })
      const data = await res.json()

      if (data.face && data.matches && data.matches.length > 0) {
        // Face matched — 2FA passed
        setMessage(`Verified! (${(data.matches[0].similarity * 100).toFixed(0)}% match)`)
        setTimeout(() => completeFaceVerify(), 1000)
      } else if (data.face) {
        // Face detected but no match — first time, offer enrollment
        setError('Face not recognized. If this is your first login, enroll your face below.')
        setStatus('idle')
      } else {
        setError('No face detected. Please look at the camera.')
        setStatus('idle')
      }
    } catch (e: any) {
      setError(e.message || 'Verification failed')
      setStatus('idle')
    }
  }, [captureFrame, watchlistName, completeFaceVerify])

  const handleEnroll = useCallback(async () => {
    setError('')
    setStatus('enrolling')

    try {
      const frame = await captureFrame()

      const form = new FormData()
      form.append('image', frame, 'face.jpg')
      form.append('label', tenantId || 'user')
      form.append('watchlist_name', watchlistName)

      const res = await fetch(`${ENGINE_URL}/api/v1/watchlist/enroll`, { method: 'POST', body: form })
      const data = await res.json()

      if (data.identity_id) {
        setMessage('Face enrolled! Verifying...')
        // Now verify immediately
        setTimeout(() => handleVerify(), 1500)
      } else {
        setError('Enrollment failed. Please try again.')
        setStatus('idle')
      }
    } catch (e: any) {
      setError(e.message || 'Enrollment failed')
      setStatus('idle')
    }
  }, [captureFrame, tenantId, watchlistName, handleVerify])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-indigo-400" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Face Verification</h1>
          <p className="mt-2 text-sm text-gray-400">
            Look at the camera to verify your identity
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {camError ? (
            <div className="flex h-64 items-center justify-center p-6 text-center text-sm text-red-400">
              {camError}. Please allow camera access and reload.
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full mirror"
              style={{ transform: 'scaleX(-1)' }}
              muted
              playsInline
            />
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
            {message}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <button
            onClick={handleVerify}
            disabled={!ready || status === 'verifying' || status === 'capturing'}
            className="w-full rounded-lg bg-indigo-500 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {status === 'verifying' ? 'Verifying...' : status === 'capturing' ? 'Capturing...' : 'Verify Face'}
          </button>

          <button
            onClick={handleEnroll}
            disabled={!ready || status === 'enrolling'}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            {status === 'enrolling' ? 'Enrolling...' : 'First time? Enroll your face'}
          </button>
        </div>

        <button
          onClick={logout}
          className="mt-4 w-full text-center text-sm text-gray-500 transition hover:text-gray-300"
        >
          Cancel and sign out
        </button>

        <p className="mt-6 text-center text-xs text-gray-600">
          Powered by OpenBiometrics — eating our own dogfood
        </p>
      </div>
    </div>
  )
}
