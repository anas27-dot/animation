import NovaPremiumEnterprise from './components/NovaPremiumEnterprise'
import PreloaderGate from './components/PreloaderGate'
import AppErrorBoundary from './components/AppErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import config from './config';

const API_BASE_URL = config.apiBaseUrl;

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider apiBase={API_BASE_URL}>
        <PreloaderGate>
          <NovaPremiumEnterprise />
        </PreloaderGate>
      </AuthProvider>
    </AppErrorBoundary>
  )
}

export default App

