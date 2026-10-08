import { useEffect, useId, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import { ErrorBoundary } from 'react-error-boundary'
import clsx from 'clsx'
import Preview, { PhotoFrame } from '../components/Preview.jsx'

// use 0 for a standard webcam or -90 for a sideways portrait kiosk
const CAMERA_ROTATION = -90
const rotations = {
  0: '[transform:translate(-50%,-50%)_rotate(0deg)_scaleX(-1)]',
  90: '[transform:translate(-50%,-50%)_rotate(90deg)_scaleX(-1)]',
  180: '[transform:translate(-50%,-50%)_rotate(180deg)_scaleX(-1)]',
  270: '[transform:translate(-50%,-50%)_rotate(-90deg)_scaleX(-1)]',
}
const controlClass = 'min-h-12 rounded-xl border border-slate-500 bg-slate-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50'

function normalizeRotation(angle) {
  const normalized = ((Number(angle) % 360) + 360) % 360
  return Object.hasOwn(rotations, normalized) ? normalized : 270
}

function preferredCamera(devices) {
  return devices.find((device) => /brio/i.test(device.label))
    || devices.find((device) => /external|usb|logitech|4k/i.test(device.label))
    || devices[0]
}

function cameraError(error) {
  if (['NotAllowedError', 'PermissionDeniedError'].includes(error?.name)) return 'Camera access was denied. Allow camera access in your browser, then retry.'
  if (['NotFoundError', 'DevicesNotFoundError'].includes(error?.name)) return 'No camera was found. Connect a camera, then retry.'
  if (['NotReadableError', 'TrackStartError'].includes(error?.name)) return 'The camera is unavailable or busy. Close other camera apps, then retry.'
  if (error?.name === 'SecurityError') return 'Camera access requires HTTPS or localhost.'
  return 'The camera could not start. Check its connection and browser permissions, then retry.'
}

function capturePhoto(video, frame, rotation) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight || !frame?.clientWidth || !frame.clientHeight) {
    throw new Error('the camera is not ready to capture')
  }
  const sourceWidth = video.videoWidth
  const sourceHeight = video.videoHeight
  const containerAspect = frame.clientWidth / frame.clientHeight
  const isSideways = Math.abs(rotation) % 180 === 90
  const targetAspect = isSideways ? 1 / containerAspect : containerAspect
  const cropWidth = Math.min(sourceWidth, sourceHeight * targetAspect)
  const cropHeight = Math.min(sourceHeight, sourceWidth / targetAspect)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(isSideways ? cropHeight : cropWidth))
  canvas.height = Math.max(1, Math.round(isSideways ? cropWidth : cropHeight))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('the browser could not create a photo')

  // mirror in sensor space, then rotate to match the viewfinder
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(rotation * Math.PI / 180)
  context.scale(-1, 1)
  const drawWidth = isSideways ? canvas.height : canvas.width
  const drawHeight = isSideways ? canvas.width : canvas.height
  context.drawImage(video, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2, cropWidth, cropHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  const image = canvas.toDataURL('image/jpeg', 0.95)
  if (!image.startsWith('data:image/jpeg')) throw new Error('the browser could not encode the photo')
  return image
}

function CameraFlow({ orientation, initialRotation = CAMERA_ROTATION, countdownSeconds = 3, onConfirm, onError }) {
  const webcamRef = useRef(null)
  const frameRef = useRef(null)
  const captureButtonRef = useRef(null)
  const mountedRef = useRef(false)
  const streamRef = useRef(null)
  const automaticSelectionRef = useRef(true)
  const scanRef = useRef(0)
  const reporterRef = useRef(onError)
  const requestRef = useRef({ deviceId: '', relaxed: false, version: 0 })
  const controlsId = useId()
  const [request, setRequest] = useState(null)
  const [devices, setDevices] = useState([])
  const [stream, setStream] = useState(null)
  const [rotation, setRotation] = useState(() => normalizeRotation(initialRotation))
  const [wideScreen, setWideScreen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches)
  const [isReady, setIsReady] = useState(false)
  const [isSelecting, setIsSelecting] = useState(true)
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(null)
  const [photo, setPhoto] = useState('')
  const resolvedOrientation = orientation === 'landscape' || (orientation !== 'portrait' && wideScreen) ? 'landscape' : 'portrait'
  const isSideways = Math.abs(rotation) % 180 === 90
  const controlsDisabled = Boolean(photo) || countdown !== null || isSelecting
  const canCapture = isReady && !isSelecting && !error && !photo && countdown === null
  const videoConstraints = request ? {
    ...(request.deviceId ? { deviceId: { exact: request.deviceId } } : {}),
    width: request.relaxed ? { ideal: 3840 } : { ideal: 3840, min: 1920 },
    height: request.relaxed ? { ideal: 2160 } : { ideal: 2160, min: 1080 },
  } : undefined

  const restartCamera = (deviceId, relaxed = false) => {
    requestRef.current = { deviceId, relaxed, version: requestRef.current.version + 1 }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
    setIsReady(false)
    setIsSelecting(true)
    setError('')
    setCountdown(null)
    setRequest(requestRef.current)
  }

  const handleMedia = async (nextStream, version) => {
    if (!mountedRef.current || version !== requestRef.current.version) {
      nextStream.getTracks().forEach((track) => track.stop())
      return
    }
    streamRef.current = nextStream
    setStream(nextStream)
    const scan = ++scanRef.current
    try {
      const available = await navigator.mediaDevices.enumerateDevices()
      if (!mountedRef.current || version !== requestRef.current.version) return
      const cameras = available.filter((device) => device.kind === 'videoinput')
      if (scan === scanRef.current) setDevices(cameras)
      const selected = preferredCamera(cameras)
      const currentId = nextStream.getVideoTracks()[0]?.getSettings().deviceId
      if (automaticSelectionRef.current && selected?.deviceId && selected.deviceId !== currentId) {
        automaticSelectionRef.current = false
        restartCamera(selected.deviceId)
        return
      }
      automaticSelectionRef.current = false
    } catch (cause) {
      if (mountedRef.current && version === requestRef.current.version) reporterRef.current?.(cause)
    } finally {
      if (mountedRef.current && version === requestRef.current.version) setIsSelecting(false)
    }
  }

  const handleMediaError = (cause, version) => {
    if (!mountedRef.current || version !== requestRef.current.version) return
    if (['OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(cause?.name) && !requestRef.current.relaxed) {
      restartCamera(requestRef.current.deviceId, true)
      return
    }
    setIsReady(false)
    setIsSelecting(false)
    setCountdown(null)
    setError(cameraError(cause))
    reporterRef.current?.(cause)
  }

  useEffect(() => {
    reporterRef.current = onError
  }, [onError])

  useEffect(() => {
    mountedRef.current = true
    let active = true
    const media = navigator.mediaDevices
    const prepare = async () => {
      if (!window.isSecureContext || !media?.getUserMedia || !media.enumerateDevices) {
        setError('Camera access requires HTTPS or localhost and a browser with camera support.')
        setIsSelecting(false)
        return
      }
      try {
        const available = await media.enumerateDevices()
        if (!active) return
        const cameras = available.filter((device) => device.kind === 'videoinput')
        setDevices(cameras)
        requestRef.current = { deviceId: preferredCamera(cameras)?.deviceId || '', relaxed: false, version: requestRef.current.version + 1 }
        setRequest(requestRef.current)
      } catch (cause) {
        if (!active) return
        setError(cameraError(cause))
        setIsSelecting(false)
        reporterRef.current?.(cause)
      }
    }
    const refreshDevices = async () => {
      const scan = ++scanRef.current
      try {
        const available = await media.enumerateDevices()
        if (active && scan === scanRef.current) setDevices(available.filter((device) => device.kind === 'videoinput'))
      } catch (cause) {
        if (active) reporterRef.current?.(cause)
      }
    }
    void prepare()
    media?.addEventListener?.('devicechange', refreshDevices)
    return () => {
      active = false
      mountedRef.current = false
      scanRef.current += 1
      media?.removeEventListener?.('devicechange', refreshDevices)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(orientation: landscape)')
    const update = () => setWideScreen(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!stream) return
    const tracks = stream.getVideoTracks()
    const disconnected = () => {
      setIsReady(false)
      setCountdown(null)
      setError('The camera was disconnected. Reconnect it, then retry.')
    }
    tracks.forEach((track) => track.addEventListener('ended', disconnected))
    return () => tracks.forEach((track) => track.removeEventListener('ended', disconnected))
  }, [stream])

  useEffect(() => {
    if (countdown === null) return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((value) => value === null ? null : value - 1), 1000)
      return () => clearTimeout(timer)
    }
    try {
      setPhoto(capturePhoto(webcamRef.current?.video, frameRef.current, rotation))
    } catch (cause) {
      setError('The photo could not be captured. Please retry the camera.')
      reporterRef.current?.(cause)
    }
    setCountdown(null)
  }, [countdown, rotation])

  useEffect(() => {
    if (!photo) captureButtonRef.current?.focus()
  }, [photo])

  return (
    <main className="relative min-h-screen bg-slate-950 text-white">
      <section aria-label="Camera" aria-hidden={Boolean(photo)} className={clsx('flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-8', photo && 'pointer-events-none absolute inset-0')}>
        <header className="space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Make it a moment</h1>
          <p className="max-w-xl text-base text-slate-300 sm:text-lg">Look into the camera, find your frame, and take your photo.</p>
        </header>

        <PhotoFrame orientation={resolvedOrientation} frameRef={frameRef}>
          {request && (
            <Webcam
              key={request.version}
              ref={webcamRef}
              audio={false}
              muted
              mirrored={false}
              disablePictureInPicture
              videoConstraints={videoConstraints}
              onUserMedia={(nextStream) => void handleMedia(nextStream, request.version)}
              onUserMediaError={(cause) => handleMediaError(cause, request.version)}
              onLoadedData={(event) => {
                if (request.version !== requestRef.current.version) return
                const video = event.currentTarget
                setIsReady(video.readyState >= 2 && video.videoWidth > 0)
                setResolution(video.videoWidth + ' × ' + video.videoHeight)
              }}
              aria-label="Live camera viewfinder"
              className={clsx('absolute left-1/2 top-1/2 max-w-none object-cover', rotations[rotation], isSideways ? 'h-[100cqw] w-[100cqh]' : 'h-full w-full')}
            />
          )}
          {(!isReady || isSelecting) && !error && <p role="status" className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-6 text-center">Starting camera… Allow camera access if prompted.</p>}
          {error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90 p-6 text-center"><p role="alert">{error}</p><button type="button" disabled={Boolean(photo)} onClick={() => restartCamera(requestRef.current.deviceId)} className={controlClass}>Retry camera</button></div>}
          {countdown !== null && <p role="status" aria-live="assertive" aria-atomic="true" className="absolute inset-0 flex items-center justify-center bg-black/30 text-8xl font-bold">{countdown || 'Smile!'}</p>}
        </PhotoFrame>

        <fieldset disabled={controlsDisabled} className="flex flex-wrap items-end justify-center gap-4">
          <legend className="sr-only">Camera settings</legend>
          <label htmlFor={controlsId + '-device'} className="flex flex-col gap-2 text-sm text-slate-300">Camera
            <select id={controlsId + '-device'} value={request?.deviceId || ''} className={clsx(controlClass, 'max-w-xs')} onChange={(event) => { automaticSelectionRef.current = false; restartCamera(event.target.value) }}>
              <option value="">Default camera</option>
              {devices.filter((device) => device.deviceId).map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera ' + (index + 1)}</option>)}
            </select>
          </label>
          <label htmlFor={controlsId + '-rotation'} className="flex flex-col gap-2 text-sm text-slate-300">Camera rotation
            <select id={controlsId + '-rotation'} value={rotation} onChange={(event) => setRotation(Number(event.target.value))} className={controlClass}>
              <option value={270}>−90° · portrait kiosk</option><option value={0}>0° · standard webcam</option><option value={90}>90° · clockwise</option><option value={180}>180° · upside down</option>
            </select>
          </label>
        </fieldset>
        <div className="flex flex-wrap justify-center gap-4">
          <button ref={captureButtonRef} type="button" disabled={!canCapture} onClick={() => setCountdown(Number.isFinite(countdownSeconds) ? Math.min(10, Math.max(0, Math.floor(countdownSeconds))) : 3)} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-cyan-300 px-10 py-4 text-lg font-bold text-slate-950 hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6"><path d="M4 6h4l2-3h4l2 3h4v15H4z" /><circle cx="12" cy="13" r="4" /></svg>
            Take photo
          </button>
          {countdown !== null && <button type="button" onClick={() => setCountdown(null)} className={controlClass}>Cancel countdown</button>}
        </div>
        <p className="min-h-6 text-sm text-slate-300" role="status">{isReady && !isSelecting && !error ? 'Camera ready · ' + resolution : ''}</p>
      </section>
      {photo && <Preview image={photo} orientation={resolvedOrientation} onRetake={() => setPhoto('')} onConfirm={onConfirm} onError={onError} />}
    </main>
  )
}

function CameraFallback({ resetErrorBoundary }) {
  return (
    <section role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-white">
      <h1 className="text-3xl font-bold">The camera view could not load</h1>
      <p>Please try opening the camera again.</p>
      <button type="button" onClick={resetErrorBoundary} className={controlClass}>Restart camera</button>
    </section>
  )
}

export default function Camera(props) {
  return <ErrorBoundary FallbackComponent={CameraFallback} onError={props.onError}><CameraFlow {...props} /></ErrorBoundary>
}
