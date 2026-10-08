import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

const buttonClass = 'inline-flex min-h-12 items-center justify-center gap-3 rounded-full px-8 py-3 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50'

export function PhotoFrame({ orientation = 'portrait', frameRef, children }) {
  return (
    <div
      ref={frameRef}
      data-photo-frame
      className={clsx(
        'relative shrink-0 border-[0.2vw] border-[#07E3FD] bg-black/55 overflow-hidden [container-type:size]',
        orientation === 'landscape'
          ? 'w-[44vw] h-[60vh] rounded-[1vw]'
          : 'w-[78.33vw] h-[52.92vh] rounded-[1.27vw]',
      )}
    >
      {children}
    </div>
  )
}

function savePhoto(image) {
  const link = document.createElement('a')
  link.href = image
  link.download = 'photo-' + Date.now() + '.jpg'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export default function Preview({ image, orientation = 'portrait', onRetake, onConfirm, onError }) {
  const headingRef = useRef(null)
  const requestRef = useRef(null)
  const [loadedImage, setLoadedImage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState('')
  const canSubmit = Boolean(image) && loadedImage === image && !isSubmitting && !isComplete && !error

  useEffect(() => {
    setError('')
    setIsComplete(false)
    setIsSubmitting(false)
    headingRef.current?.focus()
    return () => {
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [image])

  const confirmPhoto = async () => {
    if (!canSubmit || requestRef.current) return
    const request = new AbortController()
    requestRef.current = request
    setIsSubmitting(true)
    setError('')

    try {
      if (onConfirm) await onConfirm(image, { signal: request.signal })
      else savePhoto(image)
      if (!request.signal.aborted && requestRef.current === request) setIsComplete(true)
    } catch (cause) {
      if (!request.signal.aborted && requestRef.current === request) {
        setError('The photo could not be submitted. Please try again.')
        onError?.(cause)
      }
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null
        setIsSubmitting(false)
      }
    }
  }

  return (
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-4 py-8 text-white" aria-label="Photo preview" aria-busy={isSubmitting}>
      <header className="space-y-3 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none sm:text-4xl">Your photo, ready to go</h1>
        <p className="max-w-xl text-base text-slate-300 sm:text-lg">Review your photo. Retake it or choose Use Photo to continue.</p>
      </header>

      <PhotoFrame orientation={orientation}>
        {image ? (
          <img
            src={image}
            alt="Your captured photo"
            className="h-full w-full object-cover"
            onLoad={() => setLoadedImage(image)}
            onError={() => {
              setLoadedImage('')
              setError('The photo could not be displayed. Please retake it.')
            }}
          />
        ) : (
          <p className="flex h-full items-center justify-center p-6 text-center" role="alert">No photo is available. Please take a photo first.</p>
        )}
        {image && loadedImage !== image && !error && (
          <p className="absolute inset-0 flex items-center justify-center bg-slate-950/80" role="status">Loading photo…</p>
        )}
      </PhotoFrame>

      <div className="flex flex-wrap justify-center gap-4">
        <button type="button" onClick={onRetake} disabled={isSubmitting || !onRetake} className={clsx(buttonClass, 'border border-slate-500 bg-slate-900 hover:bg-slate-800')}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6" /></svg>
          Retake
        </button>
        <button type="button" onClick={confirmPhoto} disabled={!canSubmit} className={clsx(buttonClass, 'bg-cyan-300 text-slate-950 hover:bg-cyan-200')}>
          {isSubmitting ? 'Submitting…' : isComplete ? 'Photo confirmed' : 'Use Photo'}
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>
        </button>
      </div>
      <div className="min-h-6 max-w-xl text-center" aria-live="polite" aria-atomic="true">
        {error ? (
          <p role="alert">{error}{loadedImage === image && <button type="button" onClick={() => setError('')} className="ml-2 underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Try again</button>}</p>
        ) : isComplete ? <p>{onConfirm ? 'Photo confirmed.' : 'Photo saved to your downloads.'}</p> : isSubmitting ? <p>Submitting your photo. Please wait.</p> : null}
      </div>
    </section>
  )
}
