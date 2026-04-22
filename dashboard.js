import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const LOG_FILE = path.join(os.homedir(), '.config/opencode/pangkas.log');
const CONFIG_FILE = path.join(process.cwd(), 'pangkas.jsonc');
let server = null;

function readLogs() {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          const match = line.match(/^\[(.+?)\] (.+)$/);
          if (match) {
            return { timestamp: match[1], data: JSON.parse(match[2]) };
          }
        } catch (e) {}
        return null;
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return getDefaults();
    }
    let raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    raw = raw.replace(/\/\/.*$/gm, '');
    return { ...getDefaults(), ...JSON.parse(raw) };
  } catch (e) {
    return getDefaults();
  }
}

function getDefaults() {
  return {
    compressionLevel: 0.3,
    maxHistoryMessages: 30,
    pruneSystemPrompt: true,
    pruneUserMessages: true,
    pruneAssistantMessages: true,
    useSummarization: true,
    usePipeline: true,
    dedupThreshold: 0.85,
    enableDashboard: true,
  };
}

function saveConfig(config) {
  try {
    const jsonc = `{
  // Compression: 0.0 (none) to 1.0 (max)
  "compressionLevel": ${config.compressionLevel},
  
  // History limit (0 = unlimited)
  "maxHistoryMessages": ${config.maxHistoryMessages},
  
  // Pruning toggles
  "pruneSystemPrompt": ${config.pruneSystemPrompt},
  "pruneUserMessages": ${config.pruneUserMessages},
  "pruneAssistantMessages": ${config.pruneAssistantMessages},
  
  // Summarization
  "useSummarization": ${config.useSummarization},
  
  // v3 Pipeline
  "usePipeline": ${config.usePipeline},
  "dedupThreshold": ${config.dedupThreshold},
  
  // Dashboard
  "enableDashboard": ${config.enableDashboard}
}`;
    fs.writeFileSync(CONFIG_FILE, jsonc);
    return true;
  } catch (e) {
    return false;
  }
}

function calculateStats(logs, config) {
  let totalSaved = 0;
  let totalOriginal = 0;
  let totalCompressed = 0;
  let eventCounts = {};

  for (const log of logs) {
    const event = log.data.event || 'unknown';
    eventCounts[event] = (eventCounts[event] || 0) + 1;
    if (log.data.savedTokens) totalSaved += log.data.savedTokens;
    if (log.data.originalTokens) totalOriginal += log.data.originalTokens;
    if (log.data.compressedTokens) totalCompressed += log.data.compressedTokens;
  }

  const savingsPercent = totalOriginal > 0 ? ((totalSaved / totalOriginal) * 100).toFixed(1) : 0;
  
  return {
    totalSaved,
    totalOriginal,
    totalCompressed,
    savingsPercent,
    eventCounts,
    totalEvents: logs.length,
    recentEvents: logs.slice(-30).reverse(),
    contextLimit: config?.contextLimit || 200000
  };
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pangkas</title>
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #fafafa;
  --surface: #ffffff;
  --text: #171717;
  --text-muted: #737373;
  --text-subtle: #a3a3a3;
  --border: #e5e5e5;
  --border-light: #f0f0f0;
  --accent: #171717;
  --accent-light: #404040;
  --success: #16a34a;
  --warning: #f59e0b;
  --radius: 8px;
  --shadow: 0 1px 2px rgba(0,0,0,0.04);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Header */
.topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 56px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  color: var(--text);
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.logo-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 400;
  letter-spacing: 0.01em;
}

.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  color: var(--text-muted);
  transition: all 0.15s;
}

.github-link:hover {
  color: var(--text);
  background: var(--bg);
}

/* Navigation */
.nav {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 16px;
}

.nav-inner {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.nav-tab {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-tab:hover {
  color: var(--text);
}

.nav-tab.active {
  color: var(--text);
  border-bottom-color: var(--text);
}

/* Content */
.content {
  padding: 24px 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.page {
  display: none;
}

.page.active {
  display: block;
}

/* Section title */
.page-title {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 24px;
}

/* Stats cards - Dashboard */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
}

.stat-value.success { color: var(--success); }

/* Card */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.card + .card {
  margin-top: 16px;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header h3 {
  font-size: 14px;
  font-weight: 600;
}

.card-header p {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: auto;
}

/* Form items */
.form-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-light);
}

.form-item:last-child {
  border-bottom: none;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-icon {
  width: 32px;
  height: 32px;
  background: var(--bg);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
}

.form-text h4 {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 2px;
}

.form-text p {
  font-size: 12px;
  color: var(--text-subtle);
}

/* Toggle */
.toggle {
  position: relative;
  width: 40px;
  height: 22px;
  background: var(--border);
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.2s;
  -webkit-appearance: none;
  appearance: none;
  border: none;
  outline: none;
  flex-shrink: 0;
}

.toggle:checked {
  background: var(--text);
}

.toggle::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.toggle:checked::after {
  transform: translateX(18px);
}

/* Slider */
.slider-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  width: 140px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--text);
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid var(--surface);
  box-shadow: 0 0 0 1px var(--border);
}

.slider-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  min-width: 32px;
  text-align: right;
}

/* Number input */
.number-input {
  width: 72px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
  text-align: center;
  background: var(--surface);
  color: var(--text);
  outline: none;
}

.number-input:focus {
  border-color: var(--text-muted);
}

/* Events table */
.events-table {
  width: 100%;
  font-size: 13px;
}

.events-table th {
  text-align: left;
  padding: 12px 20px;
  font-weight: 500;
  color: var(--text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border-light);
}

.events-table td {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-muted);
}

.events-table tr:last-child td {
  border-bottom: none;
}

.events-table .event-name {
  color: var(--text);
  font-weight: 500;
  text-transform: capitalize;
}

.events-table .saved {
  color: var(--success);
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-subtle);
}

.empty-state p {
  margin-top: 8px;
  font-size: 13px;
}

/* Save bar */
.save-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  display: flex;
  justify-content: center;
  gap: 8px;
  z-index: 100;
  transform: translateY(100%);
  transition: transform 0.3s;
}

.save-bar.show {
  transform: translateY(0);
}

.btn {
  padding: 8px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  outline: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-primary {
  background: var(--text);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-light);
}

.btn-ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn-ghost:hover {
  color: var(--text);
  background: var(--bg);
}

/* Toast */
.toast {
  position: fixed;
  top: 72px;
  right: 16px;
  background: var(--text);
  color: white;
  padding: 10px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s;
  pointer-events: none;
  z-index: 200;
}

.toast.show {
  opacity: 1;
  transform: translateY(0);
}

/* Responsive */
@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  .nav-tab span {
    display: none;
  }
}
</style>
</head>
<body>

<!-- Topbar -->
<div class="topbar">
  <div class="topbar-inner">
    <div class="logo">
      <div class="logo-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.17 7.83 2 22"/><path d="M4.02 12a2.827 2.827 0 1 1 3.81-4.17A2.827 2.827 0 1 1 12 4.02a2.827 2.827 0 1 1 4.17 3.81A2.827 2.827 0 1 1 19.98 12a2.827 2.827 0 1 1-3.81 4.17A2.827 2.827 0 1 1 12 19.98a2.827 2.827 0 1 1-4.17-3.81A1 1 0 1 1 4 12"/><path d="m7.83 7.83 8.34 8.34"/></svg>
      </div>
      <div>
        <div class="logo-text">Pangkas</div>
        <div class="logo-subtitle">Token optimizer</div>
      </div>
    </div>
    <a href="https://github.com/sukirman1901/pangkas" target="_blank" class="github-link" title="GitHub">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
    </a>
  </div>
</div>

<!-- Navigation -->
<div class="nav">
  <div class="nav-inner">
    <button class="nav-tab active" data-page="dashboard" onclick="showPage('dashboard')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
      <span>Dashboard</span>
    </button>
    <button class="nav-tab" data-page="compression" onclick="showPage('compression')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
      <span>Compression</span>
    </button>
    <button class="nav-tab" data-page="history" onclick="showPage('history')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <span>History</span>
    </button>
    <button class="nav-tab" data-page="pipeline" onclick="showPage('pipeline')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
      <span>Pipeline</span>
    </button>
    <button class="nav-tab" data-page="events" onclick="showPage('events')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      <span>Events</span>
    </button>
  </div>
</div>

<!-- Content -->
<div class="content">

  <!-- Dashboard Page -->
  <div class="page active" id="page-dashboard">
    <h1 class="page-title">Dashboard</h1>
    <p class="page-subtitle">Overview of your token savings</p>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Tokens Saved</div>
        <div class="stat-value success" id="stat-saved">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Savings Rate</div>
        <div class="stat-value" id="stat-rate">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Events</div>
        <div class="stat-value" id="stat-events">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Original Tokens</div>
        <div class="stat-value" id="stat-original">-</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        <h3>Token Context</h3>
      </div>
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 13px; color: var(--text-muted);">Context Usage</span>
          <span style="font-size: 13px; font-weight: 600;" id="context-percent">0%</span>
        </div>
        <div style="width: 100%; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
          <div id="context-bar" style="height: 100%; width: 0%; background: var(--text); border-radius: 4px; transition: width 0.5s ease;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <span style="font-size: 12px; color: var(--text-subtle);" id="context-used">0 tokens</span>
          <span style="font-size: 12px; color: var(--text-subtle);" id="context-limit">200,000 limit</span>
        </div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: var(--text-muted);">Extra Space from Pangkas</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--success);" id="extra-space">+0 tokens</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        <h3>Event Breakdown</h3>
      </div>
      <div id="event-breakdown">
        <div class="empty-state">
          <p>No data yet</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Compression Page -->
  <div class="page" id="page-compression">
    <h1 class="page-title">Compression</h1>
    <p class="page-subtitle">Control how tokens are optimized</p>
    
    <div class="card">
      <div class="form-item">
        <div class="form-label">
          <div class="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/></svg>
          </div>
          <div class="form-text">
            <h4>Compression Level</h4>
            <p>0 = none, 1 = maximum</p>
          </div>
        </div>
        <div class="slider-wrap">
          <input type="range" class="slider" id="compressionLevel" min="0" max="1" step="0.1">
          <span class="slider-value" id="compressionLevel-val">0.3</span>
        </div>
      </div>
      <div class="form-item">
        <div class="form-label">
          <div class="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 13-2 2 2 2"/><path d="m15 13 2 2-2 2"/></svg>
          </div>
          <div class="form-text">
            <h4>System Prompt</h4>
            <p>Compress system instructions</p>
          </div>
        </div>
        <input type="checkbox" class="toggle" id="pruneSystemPrompt">
      </div>
      <div class="form-item">
        <div class="form-label">
          <div class="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="form-text">
            <h4>User Messages</h4>
            <p>Compress your inputs</p>
          </div>
        </div>
        <input type="checkbox" class="toggle" id="pruneUserMessages">
      </div>
      <div class="form-item">
        <div class="form-label">
          <div class="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
          </div>
          <div class="form-text">
            <h4>Assistant Messages</h4>
            <p>Compress AI responses</p>
          </div>
        </div>
        <input type="checkbox" class="toggle" id="pruneAssistantMessages">
      </div>
    </div>
  </div>

  <!-- History Page -->
  <div class="page" id="page-history">
    <h1 class="page-title">History</h1>
    <p class="page-subtitle">Manage conversation history limits</p>
    
    <div class="card">
      <div class="form-item">
        <div class="form-label">
          <div class="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
          </div>
          <div class="form-text">
            <h4>Max Messages</h4>
            <p>Keep last N messages (0 = unlimited)</p>
          </div>
        </div>
        <input type="number" class="number-input" id="maxHistoryMessages" min="0" max="100">
      </div>
      <div class="form-item">
        <div class="form-label">
          <div class="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18.1H3"/></svg>
          </div>
          <div class="form-text">
            <h4>Summarization</h4>
            <p>Summarize dropped messages</p>
          </div>
        </div>
        <input type="checkbox" class="toggle" id="useSummarization">
      </div>
    </div>
  </div>

  <!-- Pipeline Page -->
  <div class="page" id="page-pipeline">
    <h1 class="page-title">Pipeline v3</h1>
    <p class="page-subtitle">Advanced context-aware compression</p>
    
    <div class="card">
      <div class="form-item">
        <div class="form-label">
          <div class="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="6" ry="6"/><circle cx="16" cy="12" r="2"/></svg>
          </div>
          <div class="form-text">
            <h4>Use Pipeline v3</h4>
            <p>Smart chunking & scoring</p>
          </div>
        </div>
        <input type="checkbox" class="toggle" id="usePipeline">
      </div>
      <div class="form-item">
        <div class="form-label">
          <div class="form-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          </div>
          <div class="form-text">
            <h4>Dedup Threshold</h4>
            <p>Similarity for duplicate removal</p>
          </div>
        </div>
        <div class="slider-wrap">
          <input type="range" class="slider" id="dedupThreshold" min="0" max="1" step="0.05">
          <span class="slider-value" id="dedupThreshold-val">0.85</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Events Page -->
  <div class="page" id="page-events">
    <h1 class="page-title">Events</h1>
    <p class="page-subtitle">Recent compression activity</p>
    
    <div class="card" id="events-card">
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-subtle)"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <p>No events yet. Start chatting to see stats.</p>
      </div>
    </div>
  </div>

</div>

<!-- Save Bar -->
<div class="save-bar" id="save-bar">
  <button class="btn btn-ghost" onclick="resetChanges()">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
    Reset
  </button>
  <button class="btn btn-primary" onclick="saveSettings()">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    Save Changes
  </button>
</div>

<!-- Toast -->
<div class="toast" id="toast">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
  Settings saved
</div>

<script>


let originalConfig = {};
let currentConfig = {};

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector('[data-page="' + page + '"]').classList.add('active');
}

async function loadConfig() {
  const res = await fetch('/api/config');
  originalConfig = await res.json();
  currentConfig = {...originalConfig};
  applyConfig();
}

function applyConfig() {
  document.getElementById('compressionLevel').value = currentConfig.compressionLevel;
  document.getElementById('compressionLevel-val').textContent = currentConfig.compressionLevel;
  document.getElementById('maxHistoryMessages').value = currentConfig.maxHistoryMessages;
  document.getElementById('pruneSystemPrompt').checked = currentConfig.pruneSystemPrompt;
  document.getElementById('pruneUserMessages').checked = currentConfig.pruneUserMessages;
  document.getElementById('pruneAssistantMessages').checked = currentConfig.pruneAssistantMessages;
  document.getElementById('useSummarization').checked = currentConfig.useSummarization;
  document.getElementById('usePipeline').checked = currentConfig.usePipeline;
  document.getElementById('dedupThreshold').value = currentConfig.dedupThreshold;
  document.getElementById('dedupThreshold-val').textContent = currentConfig.dedupThreshold;
}

function hasChanges() {
  return JSON.stringify(originalConfig) !== JSON.stringify(currentConfig);
}

function updateSaveBar() {
  document.getElementById('save-bar').classList.toggle('show', hasChanges());
}

function bindInputs() {
  document.getElementById('compressionLevel').addEventListener('input', (e) => {
    currentConfig.compressionLevel = parseFloat(e.target.value);
    document.getElementById('compressionLevel-val').textContent = e.target.value;
    updateSaveBar();
  });
  document.getElementById('dedupThreshold').addEventListener('input', (e) => {
    currentConfig.dedupThreshold = parseFloat(e.target.value);
    document.getElementById('dedupThreshold-val').textContent = e.target.value;
    updateSaveBar();
  });
  document.getElementById('maxHistoryMessages').addEventListener('input', (e) => {
    currentConfig.maxHistoryMessages = parseInt(e.target.value) || 0;
    updateSaveBar();
  });
  ['pruneSystemPrompt','pruneUserMessages','pruneAssistantMessages','useSummarization','usePipeline'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      currentConfig[id] = e.target.checked;
      updateSaveBar();
    });
  });
}

async function saveSettings() {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(currentConfig)
  });
  if (res.ok) {
    originalConfig = {...currentConfig};
    updateSaveBar();
    showToast();
  }
}

function resetChanges() {
  currentConfig = {...originalConfig};
  applyConfig();
  updateSaveBar();
}

function showToast() {
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function loadStats() {
  const res = await fetch('/api/stats');
  const data = await res.json();
  
  document.getElementById('stat-saved').textContent = data.totalSaved.toLocaleString();
  document.getElementById('stat-rate').textContent = data.savingsPercent + '%';
  document.getElementById('stat-events').textContent = data.totalEvents.toLocaleString();
  document.getElementById('stat-original').textContent = data.totalOriginal.toLocaleString();
  
  // Context usage (dynamic limit from config)
  const contextLimit = data.contextLimit || 200000;
  const contextUsed = data.totalOriginal;
  const contextPercent = Math.min((contextUsed / contextLimit) * 100, 100);
  const extraSpace = data.totalSaved;
  
  document.getElementById('context-percent').textContent = contextPercent.toFixed(1) + '%';
  document.getElementById('context-bar').style.width = contextPercent + '%';
  document.getElementById('context-used').textContent = contextUsed.toLocaleString() + ' tokens';
  document.getElementById('context-limit').textContent = contextLimit.toLocaleString() + ' limit';
  document.getElementById('extra-space').textContent = '+' + extraSpace.toLocaleString() + ' tokens';
  
  // Event breakdown
  const breakdown = document.getElementById('event-breakdown');
  if (Object.keys(data.eventCounts).length > 0) {
    let html = '<table class="events-table"><thead><tr><th>Event</th><th>Count</th></tr></thead><tbody>';
    for (const [event, count] of Object.entries(data.eventCounts)) {
      html += '<tr><td class="event-name">' + event.replace(/_/g, ' ') + '</td><td>' + count + '</td></tr>';
    }
    html += '</tbody></table>';
    breakdown.innerHTML = html;
  }
  
  // Events page
  const eventsCard = document.getElementById('events-card');
  if (data.recentEvents.length > 0) {
    let html = '<table class="events-table"><thead><tr><th>Event</th><th>Time</th><th>Saved</th></tr></thead><tbody>';
    for (const e of data.recentEvents) {
      const time = new Date(e.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      const saved = e.data.savedTokens ? '<span class="saved">+' + e.data.savedTokens + '</span>' : '-';
      html += '<tr><td class="event-name">' + e.data.event.replace(/_/g, ' ') + '</td><td>' + time + '</td><td>' + saved + '</td></tr>';
    }
    html += '</tbody></table>';
    eventsCard.innerHTML = html;
  }
}

loadConfig();
bindInputs();
loadStats();
setInterval(loadStats, 2000);
</script>

</body>
</html>`;

export function startDashboard(port = 8765) {
  // If server exists but is closed, reset it so we can create a new one
  if (server) {
    // Check if server is still listening by checking its internal state
    // A closed server has no address
    try {
      if (server.listening) {
        console.log(`[Pangkas] Dashboard already running on port ${port}`);
        return;
      }
    } catch {
      // If we can't check, assume it's dead and recreate
    }
    // Server exists but not listening, reset it
    server = null;
  }

  server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/api/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readConfig()));
      return;
    }

    if (req.url === '/api/config' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const config = JSON.parse(body);
          if (saveConfig(config)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to save' }));
          }
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (req.url === '/api/stats') {
      const logs = readLogs();
      const currentConfig = readConfig();
      const stats = calculateStats(logs, currentConfig);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }

    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(port, () => {
    console.log(`[Pangkas] Dashboard: http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Pangkas] Dashboard port ${port} already in use`);
    } else {
      console.log(`[Pangkas] Dashboard error on port ${port}:`, err.message);
    }
    // Reset server so we can try again later
    server = null;
  });
}

export function stopDashboard() {
  if (server) {
    server.close();
    server = null;
  }
}
