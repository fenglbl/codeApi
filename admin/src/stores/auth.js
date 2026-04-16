import { defineStore } from 'pinia'

function getSafeAdminUser() {
  const raw = localStorage.getItem('codeaip_admin_user')
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem('codeaip_admin_user')
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('codeaip_admin_token') || '',
    admin: getSafeAdminUser()
  }),
  actions: {
    setAuth(token, admin) {
      this.token = token
      this.admin = admin
      localStorage.setItem('codeaip_admin_token', token)
      localStorage.setItem('codeaip_admin_user', JSON.stringify(admin))
    },
    logout() {
      this.token = ''
      this.admin = null
      localStorage.removeItem('codeaip_admin_token')
      localStorage.removeItem('codeaip_admin_user')
    }
  }
})
