import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { installGlobalErrorHandlers } from './lib/errorReporting'
import './styles.css'
import './platform.css'

// Attach window-level error and unhandledrejection reporters before the
// very first render so even a boot-time crash is reported to the platform.
installGlobalErrorHandlers()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
