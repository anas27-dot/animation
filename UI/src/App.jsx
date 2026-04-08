import NovaPremiumEnterprise from './components/NovaPremiumEnterprise'
import PreloaderGate from './components/PreloaderGate'
import AppErrorBoundary from './components/AppErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import config from './config';

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider apiBase={config.apiBaseUrl}>
        <PreloaderGate>
          <NovaPremiumEnterprise />
        </PreloaderGate>
      </AuthProvider>
    </AppErrorBoundary>
  )
}

export default App

