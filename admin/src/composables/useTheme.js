import { computed, ref } from 'vue'

const THEME_STORAGE_KEY = 'codeaip_theme_preference_v1'
const THEME_OPTIONS = ['system', 'light', 'dark']

const themePreference = ref('system')
const systemTheme = ref('dark')
let initialized = false
let mediaQuery = null
let mediaListener = null

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme() {
  if (typeof document === 'undefined') return
  const resolvedTheme = themePreference.value === 'system' ? systemTheme.value : themePreference.value
  document.documentElement.setAttribute('data-theme', resolvedTheme)
  document.documentElement.style.colorScheme = resolvedTheme
}

function setThemePreference(nextTheme) {
  themePreference.value = THEME_OPTIONS.includes(nextTheme) ? nextTheme : 'system'
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, themePreference.value)
  }
  applyTheme()
}

export function initTheme() {
  if (initialized) return
  initialized = true

  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (THEME_OPTIONS.includes(saved)) {
      themePreference.value = saved
    }
  }

  systemTheme.value = getSystemTheme()
  applyTheme()

  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaListener = event => {
      systemTheme.value = event.matches ? 'dark' : 'light'
      if (themePreference.value === 'system') applyTheme()
    }

    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', mediaListener)
    else if (mediaQuery.addListener) mediaQuery.addListener(mediaListener)
  }
}

export function useTheme() {
  const resolvedTheme = computed(() => (themePreference.value === 'system' ? systemTheme.value : themePreference.value))
  const themeLabel = computed(() => {
    if (themePreference.value === 'light') return '浅色'
    if (themePreference.value === 'dark') return '深色'
    return `跟随系统（${resolvedTheme.value === 'dark' ? '深色' : '浅色'}）`
  })

  return {
    themePreference,
    resolvedTheme,
    themeLabel,
    setThemePreference
  }
}
