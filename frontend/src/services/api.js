/**
 * API client service for NH-58 Landslide Decision Support System.
 * Connects to the FastAPI backend with environment-configurable base URL.
 */

const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  try {
    const res = await fetch(url, options)
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}: ${res.statusText}`
      try {
        const body = await res.json()
        if (body.detail) errMsg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      } catch {
        // use status text fallback
      }
      throw new Error(errMsg)
    }
    return await res.json()
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error(`Cannot reach backend at ${API_BASE}. Ensure the FastAPI server is running.`)
    }
    throw err
  }
}

export const api = {
  getBaseUrl: () => API_BASE,

  checkHealth: () => request('/'),

  getDates: () => request('/dates'),

  getRisk: (date) => request(`/risk${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getRiskOne: (segId, date) =>
    request(`/risk/${segId}${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getTimeseries: (segId) => request(`/risk/${segId}/timeseries`),

  getRainfall: (date) =>
    request(`/rainfall${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getSusceptibility: () => request('/susceptibility'),

  getFactors: (segId, date) =>
    request(`/factors/${segId}${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getMetrics: () => request('/metrics'),

  getDynamicMetrics: () => request('/metrics/dynamic'),

  getGeoJSON: (date) =>
    request(`/geojson${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getAIStatus: () => request('/ai-status'),

  generateReport: (segId, date) =>
    request('/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seg_id: Number(segId), date: date || null })
    })
}
