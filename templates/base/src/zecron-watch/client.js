// Zecron Watch Client - Local Development Network Logger
// Only active during local Vite development mode (`npm run dev`)

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  const WATCH_PORTS = [4570, 4571, 4572, 4573, 4574, 4575]
  const SENSITIVE_KEY = /(token|secret|password|authorization|api[_-]?key|access[_-]?key|refresh)/i
  const originalFetch = window.fetch.bind(window)
  const OriginalXMLHttpRequest = window.XMLHttpRequest

  let mutedUntil = 0
  let activePort = null
  let portDiscovery = null

  const safeUrl = (value) => {
    try {
      const url = new URL(value, window.location.href)
      for (const key of url.searchParams.keys()) {
        if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, '[redacted]')
      }
      return url.toString()
    } catch {
      return String(value)
    }
  }

  const requestInfo = (input, init = {}) => {
    if (input instanceof Request) {
      return {
        method: init.method || input.method || 'GET',
        url: safeUrl(input.url),
      }
    }
    return {
      method: init.method || 'GET',
      url: safeUrl(input),
    }
  }

  const discoverPort = async () => {
    for (const port of WATCH_PORTS) {
      try {
        const res = await originalFetch(`http://127.0.0.1:${port}/api/watch-log`, { method: 'OPTIONS' })
        if (res.ok) return port
      } catch {
        // Not listening on this port
      }
    }
    return null
  }

  const resolveActivePort = () => {
    if (activePort !== null) return Promise.resolve(activePort)
    if (!portDiscovery) {
      portDiscovery = discoverPort().then((port) => {
        activePort = port
        portDiscovery = null
        return port
      })
    }
    return portDiscovery
  }

  const sendLog = async (payload) => {
    if (Date.now() < mutedUntil) return
    const port = await resolveActivePort()
    if (port === null) {
      mutedUntil = Date.now() + 2000
      return
    }

    try {
      await originalFetch(`http://127.0.0.1:${port}/api/watch-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      activePort = null
      mutedUntil = Date.now() + 2000
    }
  }

  window.fetch = async (input, init) => {
    const startedAt = performance.now()
    const info = requestInfo(input, init)

    try {
      const response = await originalFetch(input, init)
      const durationMs = Math.round(performance.now() - startedAt)

      sendLog({
        type: 'fetch',
        method: info.method,
        url: info.url,
        status: response.status,
        ok: response.ok,
        durationMs,
      })

      return response
    } catch (error) {
      sendLog({
        type: 'fetch',
        method: info.method,
        url: info.url,
        status: 'FAILED',
        ok: false,
        durationMs: Math.round(performance.now() - startedAt),
        response: error.message,
      })
      throw error
    }
  }

  if (OriginalXMLHttpRequest) {
    window.XMLHttpRequest = function XMLHttpRequestWithZecronWatch() {
      const xhr = new OriginalXMLHttpRequest()
      const state = { method: 'GET', url: '', startedAt: 0 }
      const originalOpen = xhr.open.bind(xhr)
      const originalSend = xhr.send.bind(xhr)

      xhr.open = (method, url, ...args) => {
        state.method = method || 'GET'
        state.url = safeUrl(url)
        return originalOpen(method, url, ...args)
      }

      xhr.send = (...args) => {
        state.startedAt = performance.now()
        return originalSend(...args)
      }

      xhr.addEventListener('loadend', () => {
        sendLog({
          type: 'xhr',
          method: state.method,
          url: state.url,
          status: xhr.status || 'FAILED',
          ok: xhr.status >= 200 && xhr.status < 300,
          durationMs: Math.round(performance.now() - state.startedAt),
        })
      })

      return xhr
    }
  }
}
