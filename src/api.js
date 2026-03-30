import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.PROD ? 'https://www.pictosound.com' : '/api',
  timeout: 60000,
})

export default api
