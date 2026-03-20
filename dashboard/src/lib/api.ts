const BASE_URL = import.meta.env.VITE_API_URL || ''

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const token = localStorage.getItem('ob_token')
    if (token) headers['Authorization'] = `Bearer ${token}`
    return headers
  }

  private async request(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (res.status === 401) {
      localStorage.removeItem('ob_token')
      localStorage.removeItem('ob_tenant_id')
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Request failed')
    return data
  }

  get(path: string) { return this.request('GET', path) }
  post(path: string, body?: unknown) { return this.request('POST', path, body) }
  patch(path: string, body?: unknown) { return this.request('PATCH', path, body) }
  delete(path: string) { return this.request('DELETE', path) }
}

export const api = new ApiClient()
