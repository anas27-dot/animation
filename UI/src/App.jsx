import NovaPremiumEnterprise from './components/NovaPremiumEnterprise'
import { AuthProvider } from './contexts/AuthContext'
import config from './config';

const API_BASE_URL = config.apiBaseUrl;

function App() {
  return (
    <AuthProvider apiBase={API_BASE_URL}>
      <NovaPremiumEnterprise />
    </AuthProvider>
  )
}

export default App

