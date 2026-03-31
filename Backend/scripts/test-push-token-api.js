/**
 * Test the push token registration API endpoint
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'https://chat-api-v4.0804.in';
const email = 'kishor@tr.in';
const password = '9822667827@123Was';

async function testPushTokenAPI() {
  try {
    console.log('🧪 Testing Push Token Registration API\n');
    console.log('========================================\n');

    // Step 1: Login to get auth token
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/user/login`, {
      email,
      password,
    });

    if (!loginResponse.data.success) {
      console.error('❌ Login failed:', loginResponse.data.message);
      process.exit(1);
    }

    const authToken = loginResponse.data.data.token || loginResponse.data.data.tokens?.access;
    if (!authToken) {
      console.error('❌ No auth token received');
      process.exit(1);
    }

    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 30)}...\n`);

    // Step 2: Test push token registration
    console.log('2️⃣ Testing push token registration...');
    const testToken = 'test_token_' + Date.now();
    
    try {
      const pushTokenResponse = await axios.post(
        `${API_BASE_URL}/api/user/push-token`,
        {
          token: testToken,
          platform: 'android',
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      console.log('✅ Push token registration successful!');
      console.log('   Response:', JSON.stringify(pushTokenResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Push token registration failed!');
      console.error('   Status:', error.response?.status);
      console.error('   Error:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        console.error('\n   ⚠️  Authentication failed - token may be invalid');
      } else if (error.response?.status === 403) {
        console.error('\n   ⚠️  Access forbidden - user type may be incorrect');
      } else if (error.response?.status === 400) {
        console.error('\n   ⚠️  Bad request - check token format');
      }
    }

    console.log('\n========================================');
    console.log('📋 SUMMARY');
    console.log('========================================');
    console.log('✅ Login: Working');
    console.log('⚠️  Push Token API: Check results above');
    console.log('\nIf push token registration failed, check:');
    console.log('1. Backend logs for errors');
    console.log('2. User type (must be "user", not "admin")');
    console.log('3. JWT token validity');
    console.log('4. API endpoint URL');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

testPushTokenAPI();
