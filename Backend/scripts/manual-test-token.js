/**
 * Manual Test: Check if push token API endpoint is working
 * This simulates what the app does when registering a token
 */

require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://chat-api-v4.0804.in';
const TEST_EMAIL = process.argv[2] || 'info@troikatech.net';
const TEST_PASSWORD = process.argv[3] || 'YourPasswordHere';
const JWT_SECRET = process.env.JWT_SECRET;

async function testTokenRegistration() {
  try {
    console.log('🧪 Testing Push Token Registration API\n');

    // Step 1: Login to get JWT token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BACKEND_URL}/api/user/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (!loginResponse.data.token) {
      console.error('❌ Login failed:', loginResponse.data);
      process.exit(1);
    }

    const authToken = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Step 2: Try to register a test push token
    console.log('2️⃣ Registering test push token...');
    const testToken = 'test_token_' + Date.now();

    try {
      const tokenResponse = await axios.post(
        `${BACKEND_URL}/api/user/push-token`,
        {
          token: testToken,
          platform: 'android',
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Token registration API call successful!');
      console.log('   Response:', tokenResponse.data);
      console.log('\n⚠️  Note: This was a test token. The real app needs to:');
      console.log('   1. Request notification permissions');
      console.log('   2. Get FCM token from Firebase');
      console.log('   3. Send that token to this endpoint');
    } catch (error) {
      console.error('❌ Token registration failed:');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Error:', error.response.data);
      } else {
        console.error('   Error:', error.message);
      }
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

console.log('Usage: node scripts/manual-test-token.js [email] [password]');
console.log('Default email: info@troikatech.net\n');

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  process.exit(0);
}

testTokenRegistration();
