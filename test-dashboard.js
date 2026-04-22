import { startDashboard } from './dashboard.js';

// Test 1: Check if port is available
startDashboard(8765);

// Test 2: Wait a bit then make a request
setTimeout(async () => {
  try {
    const response = await fetch('http://localhost:8765/api/stats');
    const data = await response.json();
    process.stdout.write('\n2. Dashboard is accessible!\n');
    process.stdout.write('   Stats: ' + JSON.stringify(data, null, 2) + '\n');
  } catch (e) {
    process.stdout.write('\n2. ERROR: Cannot connect to dashboard\n');
    process.stdout.write('   Error: ' + e.message + '\n');
  }
}, 1000);

// Keep running
process.stdout.write('\n3. Dashboard should be running at http://localhost:8765\n');
process.stdout.write('   Press Ctrl+C to stop\n');
