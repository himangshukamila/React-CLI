const WATCH_PORTS = [4570, 4571, 4572, 4573, 4574, 4575]
const MAX_RESPONSE_CHARS = 4000
const SENSITIVE_KEY = /(token|secret|password|authorization|api[_-]?key|access[_-]?key|refresh)/i
const originalFetch = window.fetch.bind(window)
const OriginalXMLHttpRequest = window.XMLHttpRequest

let mutedUntil = 0

const redactValue = (value) => {
  if (Array.isArray(value)) return value.map(redactValue)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[redacted]' : redactValue(item),
    ]),
  )
}

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

const formatBody = (text, contentType) => {
  if (!text) {
    return {
      label: 'response',
      value: '',
    }
  }

  if (contentType.includes('application/json')) {
    try {
      const parsed = redactValue(JSON.parse(text))
      const hasDataField = parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && Object.prototype.hasOwnProperty.call(parsed, 'data')
      const value = hasDataField ? parsed.data : parsed

      return {
        label: hasDataField ? 'data' : 'response',
        value: JSON.stringify(value, null, 2).slice(0, MAX_RESPONSE_CHARS),
      }
    } catch {
      return {
        label: 'response',
        value: text.slice(0, MAX_RESPONSE_CHARS),
      }
    }
  }

  return {
    label: 'response',
    value: text.slice(0, MAX_RESPONSE_CHARS),
  }
}

const sendLog = async (payload) => {
  if (Date.now() < mutedUntil) return

  const body = JSON.stringify(payload)
  let delivered = false

  for (const port of WATCH_PORTS) {
    try {
      await originalFetch(`http://127.0.0.1:${port}/api/frontend-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      delivered = true
    } catch {
      // react watch is optional and may not be running.
    }
  }

  if (!delivered) mutedUntil = Date.now() + 1500
}

const readXhrBody = (xhr) => {
  try {
    if (typeof xhr.responseText === 'string') return xhr.responseText
  } catch {
    // responseText throws for non-text response types.
  }

  if (typeof xhr.response === 'string') return xhr.response
  if (xhr.response && typeof xhr.response === 'object') {
    try {
      return JSON.stringify(xhr.response)
    } catch {
      return '[unreadable object response]'
    }
  }

  return ''
}

window.fetch = async (input, init) => {
  const startedAt = performance.now()
  const info = requestInfo(input, init)

  try {
    const response = await originalFetch(input, init)
    const durationMs = Math.round(performance.now() - startedAt)

    response.clone().text()
      .then((text) => {
        const formattedBody = formatBody(text, response.headers.get('content-type') || '')

        sendLog({
          type: 'fetch',
          method: info.method,
          url: info.url,
          status: response.status,
          ok: response.ok,
          durationMs,
          contentType: response.headers.get('content-type') || '',
          bodyLabel: formattedBody.label,
          response: formattedBody.value,
        })
      })
      .catch((error) => {
        sendLog({
          type: 'fetch',
          method: info.method,
          url: info.url,
          status: response.status,
          ok: response.ok,
          durationMs,
          response: `Could not read response body: ${error.message}`,
        })
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
  window.XMLHttpRequest = function XMLHttpRequestWithAnshhWatch() {
    const xhr = new OriginalXMLHttpRequest()
    const state = {
      method: 'GET',
      url: '',
      startedAt: 0,
    }
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
      const contentType = xhr.getResponseHeader('content-type') || ''
      const responseBody = readXhrBody(xhr)
      const formattedBody = responseBody
        ? formatBody(responseBody, contentType)
        : { label: 'response', value: '[empty or binary response]' }

      sendLog({
        type: 'xhr',
        method: state.method,
        url: state.url,
        status: xhr.status || 'FAILED',
        ok: xhr.status >= 200 && xhr.status < 300,
        durationMs: Math.round(performance.now() - state.startedAt),
        contentType,
        bodyLabel: formattedBody.label,
        response: formattedBody.value,
      })
    })

    xhr.addEventListener('error', () => {
      sendLog({
        type: 'xhr',
        method: state.method,
        url: state.url,
        status: 'FAILED',
        ok: false,
        durationMs: Math.round(performance.now() - state.startedAt),
        response: 'XMLHttpRequest failed',
      })
    })

    return xhr
  }
}
