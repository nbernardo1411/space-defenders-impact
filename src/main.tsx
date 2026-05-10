import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.tsx'

import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

function isAndroidWebView() {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent.toLowerCase()
  return userAgent.includes('; wv') || userAgent.includes('version/4.0 chrome')
}

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  window.isSecureContext &&
  (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
) {
  if (isAndroidWebView()) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch((error) => {
          console.warn('Service worker cleanup failed:', error)
        })
    })
  } else {
    window.addEventListener('load', () => {
      void import('virtual:pwa-register')
        .then(({ registerSW }) => {
          registerSW({
            immediate: true,
            onRegisterError(error) {
              console.warn('Service worker registration failed:', error)
            },
          })
        })
        .catch((error) => {
          console.warn('PWA registration module failed:', error)
        })
    })
  }
}
