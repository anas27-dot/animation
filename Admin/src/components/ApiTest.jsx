import React, { useState } from 'react';
import { 
  userLogin, 
  fetchUserCompany, 
  fetchUserUsage, 
  fetchChatbotSubscription, 
  fetchUserMessages, 
  fetchUniqueEmailsAndPhones 
} from '../services/api';
import { toast } from 'react-toastify';

const ApiTest = () => {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });

  const runTest = async (testName, testFunction) => {
    try {
      setLoading(true);
      const result = await testFunction();
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: 'success',
          data: result.data,
          message: 'API call successful'
        }
      }));
      toast.success(`${testName} test passed!`);
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: 'error',
          error: error.response?.data || error.message,
          message: 'API call failed'
        }
      }));
      toast.error(`${testName} test failed!`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    await runTest('User Login', () => userLogin(credentials));
  };

  const testUserCompany = async () => {
    await runTest('User Company', fetchUserCompany);
  };

  const testUserUsage = async () => {
    await runTest('User Usage', fetchUserUsage);
  };

  const testUserMessages = async () => {
    await runTest('User Messages', () => fetchUserMessages({ page: 1, limit: 10 }));
  };

  const testUniqueEmails = async () => {
    await runTest('Unique Emails', fetchUniqueEmailsAndPhones);
  };

  const testChatbotSubscription = async () => {
    const chatbotId = prompt('Enter chatbot ID for subscription test:');
    if (chatbotId) {
      await runTest('Chatbot Subscription', () => fetchChatbotSubscription(chatbotId));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">API Endpoints Test</h1>
      
      {/* Login Form */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Login Test</h2>
        <div className="flex gap-4 mb-4">
          <input
            type="email"
            placeholder="Email"
            value={credentials.email}
            onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
            className="px-3 py-2 border rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={credentials.password}
            onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
            className="px-3 py-2 border rounded"
          />
          <button
            onClick={handleLogin}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Test Login
          </button>
        </div>
      </div>

      {/* API Tests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={testUserCompany}
          disabled={loading}
          className="p-4 bg-green-100 hover:bg-green-200 rounded-lg text-left disabled:opacity-50"
        >
          <h3 className="font-semibold">Test User Company</h3>
          <p className="text-sm text-gray-600">GET /user/company</p>
        </button>

        <button
          onClick={testUserUsage}
          disabled={loading}
          className="p-4 bg-green-100 hover:bg-green-200 rounded-lg text-left disabled:opacity-50"
        >
          <h3 className="font-semibold">Test User Usage</h3>
          <p className="text-sm text-gray-600">GET /user/usage</p>
        </button>

        <button
          onClick={testUserMessages}
          disabled={loading}
          className="p-4 bg-green-100 hover:bg-green-200 rounded-lg text-left disabled:opacity-50"
        >
          <h3 className="font-semibold">Test User Messages</h3>
          <p className="text-sm text-gray-600">GET /user/messages</p>
        </button>

        <button
          onClick={testUniqueEmails}
          disabled={loading}
          className="p-4 bg-green-100 hover:bg-green-200 rounded-lg text-left disabled:opacity-50"
        >
          <h3 className="font-semibold">Test Unique Emails</h3>
          <p className="text-sm text-gray-600">GET /user/messages/unique-emails-and-phones</p>
        </button>

        <button
          onClick={testChatbotSubscription}
          disabled={loading}
          className="p-4 bg-green-100 hover:bg-green-200 rounded-lg text-left disabled:opacity-50"
        >
          <h3 className="font-semibold">Test Chatbot Subscription</h3>
          <p className="text-sm text-gray-600">GET /chatbot/{id}/subscription</p>
        </button>
      </div>

      {/* Results */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Test Results</h2>
        {Object.keys(testResults).length === 0 ? (
          <p className="text-gray-500">No tests run yet. Click a test button above.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(testResults).map(([testName, result]) => (
              <div
                key={testName}
                className={`p-3 rounded border-l-4 ${
                  result.status === 'success'
                    ? 'bg-green-50 border-green-500'
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{testName}</h3>
                    <p className="text-sm text-gray-600">{result.message}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      result.status === 'success'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {result.status}
                  </span>
                </div>
                {result.data && (
                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                )}
                {result.error && (
                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-32 text-red-600">
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiTest;
