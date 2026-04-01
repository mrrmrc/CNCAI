import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.PROD ? 'https://www.pictosound.com' : '/api',
  timeout: 60000,
})

// Interceptor per gestire errori globali (es. 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
