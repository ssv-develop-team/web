import { defineStore } from 'pinia'
import { ref } from 'vue'

import { login as apiLogin } from '@/api/auth'
import { TOKEN_KEY } from '@/api/request'

/** 登录态;token 持久化到 localStorage(04 §6.6: 不入日志/URL) */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const username = ref<string>('')

  function persist(value: string | null) {
    token.value = value
    if (value) {
      localStorage.setItem(TOKEN_KEY, value)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  async function login(usernameInput: string, password: string): Promise<void> {
    const resp = await apiLogin(usernameInput, password)
    persist(resp.accessToken)
    username.value = resp.username
  }

  function logout() {
    persist(null)
    username.value = ''
  }

  return { token, username, login, logout }
})
