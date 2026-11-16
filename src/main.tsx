import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[Zylift] Uncaught application error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8FAF9',
          color: '#14201A',
          padding: '20px',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{
            maxWidth: '440px',
            width: '100%',
            background: '#FFFFFF',
            border: '1.5px solid #DDE3DF',
            borderRadius: '24px',
            padding: '28px',
            boxShadow: '0 12px 32px rgba(14, 124, 58, 0.08)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#E6F4EC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontWeight: 800,
              fontSize: '22px',
              color: '#0E7C3A',
            }}>
              Z
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px', color: '#14201A' }}>
              Zylift Campus Transit
            </h2>
            <p style={{ fontSize: '13px', color: '#7A857F', margin: '0 0 20px', lineHeight: 1.5 }}>
              A temporary interface issue occurred. Your saved login and ride status remain intact.
            </p>
            <div style={{
              background: '#F3F6F4',
              padding: '12px',
              borderRadius: '12px',
              textAlign: 'left',
              fontSize: '11px',
              color: '#D93A3A',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              marginBottom: '20px',
              overflowX: 'auto',
              maxHeight: '140px',
              border: '1px solid #DDE3DF',
            }}>
              {this.state.error?.message || 'Unknown render exception'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.reload();
                }}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  padding: '12px 20px',
                  background: '#0E7C3A',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(14, 124, 58, 0.25)',
                }}
              >
                Reload App (Keep Session)
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('zylift_active_trip');
                    localStorage.removeItem('kerb_active_trip');
                    sessionStorage.clear();
                  } catch (e) {}
                  window.location.reload();
                }}
                style={{
                  width: '100%',
                  minHeight: '38px',
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#7A857F',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Reset active screen state
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// One-time migration from legacy kerb_* localStorage keys to zylift_*
try {
  if (typeof window !== 'undefined' && window.localStorage && !localStorage.getItem('zylift_storage_migrated')) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('kerb_')) {
        const newKey = 'zylift_' + k.slice('kerb_'.length);
        if (localStorage.getItem(newKey) === null) {
          const val = localStorage.getItem(k);
          if (val !== null) localStorage.setItem(newKey, val);
        }
      }
    }
    localStorage.setItem('zylift_storage_migrated', '1');
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

// Register Progressive Web App (PWA) Service Worker
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[PWA] ServiceWorker registration successful with scope:', registration.scope);
      },
      (error) => {
        console.warn('[PWA] ServiceWorker registration failed:', error);
      }
    );
  });
}
