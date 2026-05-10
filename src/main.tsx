import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.tsx'

import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  window.isSecureContext &&
  (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
) {
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
