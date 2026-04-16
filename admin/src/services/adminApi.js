import request from './request'

export const adminApi = {
  login: (payload) => request.post('/auth/login', payload),
  me: () => request.get('/auth/me'),
  getUpstreams: () => request.get('/upstreams'),
  createUpstream: (payload) => request.post('/upstreams', payload),
  updateUpstream: (id, payload) => request.put(`/upstreams/${id}`, payload),
  testUpstream: (id) => request.post(`/upstreams/${id}/test`),
  fetchUpstreamModels: (id) => request.post(`/upstreams/${id}/fetch-models`),
  toggleUpstream: (id) => request.patch(`/upstreams/${id}/toggle`),
  deleteUpstream: (id) => request.delete(`/upstreams/${id}`),
  getLocalKeys: () => request.get('/local-keys'),
  getLocalKeyRawKey: (id) => request.get(`/local-keys/${id}/raw-key`),
  createLocalKey: (payload) => request.post('/local-keys', payload),
  updateLocalKey: (id, payload) => request.put(`/local-keys/${id}`, payload),
  toggleLocalKey: (id) => request.patch(`/local-keys/${id}/toggle`),
  regenerateLocalKey: (id) => request.post(`/local-keys/${id}/regenerate`),
  deleteLocalKey: (id) => request.delete(`/local-keys/${id}`),
  getRequestLogs: (params = {}) => request.get('/request-logs', { params })
}
