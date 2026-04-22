import { startDashboard } from './dashboard.js';

console.log('=== Pangkas Dashboard Debug ===\n');

// Test 1: Check if port is available
console.log('1. Testing port availability...');
startDashboard(8765);

// Test 2: Wait a bit then make a request
setTimeout(async () => {
  try {
    const response = await fetch('http://localhost:8765/api/stats');
    const data = await response.json();
    console.log('\n2. Dashboard is accessible!');
    console.log('   Stats:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('\n2. ERROR: Cannot connect to dashboard');
    console.log('   Error:', e.message);
  }
}, 1000);

// Keep running
console.log('\n3. Dashboard should be running at http://localhost:8765');
console.log('   Press Ctrl+C to stop\n');
