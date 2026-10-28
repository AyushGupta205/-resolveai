import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract server error message cleanly
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);

// Auth endpoints
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
};

// Ticket endpoints
export const ticketApi = {
  getTickets: (params) => api.get('/tickets', { params }),
  getTicketById: (id) => api.get(`/tickets/${id}`),
  createTicket: (formData) =>
    api.post('/tickets', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  updateTicket: (id, data) => api.patch(`/tickets/${id}`, data),
  getMessages: (ticketId) => api.get(`/tickets/${ticketId}/messages`),
  sendMessage: (ticketId, formData) =>
    api.post(`/tickets/${ticketId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getAiCategory: (ticketId) => api.post(`/tickets/${ticketId}/ai-category`),
  getAiDraft: (ticketId) => api.post(`/tickets/${ticketId}/ai-draft`),
};

// Admin endpoints
export const adminApi = {
  getOverview: () => api.get('/admin/overview'),
  getAgents: () => api.get('/admin/agents'),
  updateAgentStatus: (id, data) => api.patch(`/admin/agents/${id}`, data),
  getAnalytics: () => api.get('/admin/analytics'),
};

export default api;
