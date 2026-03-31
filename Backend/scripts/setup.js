/**
 * Setup script to initialize the application
 * Creates necessary directories and validates environment
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up AI Chat Agent Backend V3...\n');

// Create logs directory
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Created logs directory');
} else {
  console.log('ℹ️  Logs directory already exists');
}

// Check for .env file
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Please copy .env.example to .env and configure it.');
} else {
  console.log('✅ .env file found');
}

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'OPENAI_API_KEY',
];

console.log('\n📋 Required environment variables:');
requiredEnvVars.forEach((varName) => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}`);
  } else {
    console.log(`  ❌ ${varName} (missing)`);
  }
});

console.log('\n✨ Setup complete!');
console.log('📝 Next steps:');
console.log('  1. Configure your .env file with all required variables');
console.log('  2. Set up MongoDB Atlas and create vector search index');
console.log('  3. Start Redis server (optional, for caching)');
console.log('  4. Run: npm start\n');

