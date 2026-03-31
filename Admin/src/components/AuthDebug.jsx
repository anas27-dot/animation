import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const AuthDebug = () => {
  const [token, setToken] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    const currentToken = localStorage.getItem("token");
    setToken(currentToken);

    // Test API connection
    testApiConnection();
  }, []);

  const testApiConnection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/company`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem("token")}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setApiStatus('success');
      } else if (response.status === 401) {
        setApiStatus('unauthorized');
      } else {
        setApiStatus(`error-${response.status}`);
      }
    } catch (error) {
      setApiStatus('network-error');
    }
  };

  const clearToken = () => {
    localStorage.removeItem("token");
    setToken(null);
    window.location.reload();
  };

  const refreshToken = () => {
    window.location.reload();
  };

  if (import.meta.env.PROD) {
    return null; // Don't show in production
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-sm z-50">
      <h3 className="font-bold text-sm mb-2">🔧 Auth Debug</h3>

      <div className="space-y-2 text-xs">
        <div>
          <strong>Token:</strong> {token ? '✅ Found' : '❌ Missing'}
        </div>

        {token && (
          <div>
            <strong>Length:</strong> {token.length} chars
          </div>
        )}

        {token && (
          <div>
            <strong>Preview:</strong> {token.substring(0, 20)}...
          </div>
        )}

        <div>
          <strong>API Status:</strong>
          <span className={`ml-1 ${apiStatus === 'success' ? 'text-green-400' :
            apiStatus === 'unauthorized' ? 'text-red-400' :
              apiStatus === 'network-error' ? 'text-yellow-400' :
                'text-gray-400'
            }`}>
            {apiStatus === 'success' ? '✅ Connected' :
              apiStatus === 'unauthorized' ? '❌ Unauthorized' :
                apiStatus === 'network-error' ? '⚠️ Network Error' :
                  apiStatus === 'checking' ? '🔄 Checking...' :
                    `❌ Error ${apiStatus}`}
          </span>
        </div>

        <div className="flex space-x-2 mt-3">
          <button
            onClick={clearToken}
            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
          >
            Clear Token
          </button>
          <button
            onClick={refreshToken}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthDebug;
