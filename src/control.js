import { invoke } from '@tauri-apps/api/core';

// DOM Elements
const toggleSettingBtn = document.getElementById('toggleSettingBtn');
const settingToolbarPanel = document.getElementById('settingToolbarPanel');
const urlInput = document.getElementById('urlInput');
const loadBtn = document.getElementById('loadBtn');
const monitorList = document.getElementById('monitorList');
const refreshMonitorsBtn = document.getElementById('refreshMonitorsBtn');
const currentUrlDisplay = document.getElementById('currentUrlDisplay');
const currentMonitorDisplay = document.getElementById('currentMonitorDisplay');
const toast = document.getElementById('toast');
const presetChips = document.querySelectorAll('.preset-chip');

let state = {
  last_url: '',
  last_monitor_index: 0,
  monitors: []
};

// Show Toast Notification
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// URL Validation and Prefix Formatting
function formatUrl(rawUrl) {
  let url = rawUrl.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

// Load Preserved Config
async function loadSavedConfig() {
  try {
    const config = await invoke('load_config');
    if (config) {
      state.last_url = config.last_url || '';
      state.last_monitor_index = config.last_monitor_index || 0;

      if (state.last_url) {
        urlInput.value = state.last_url;
        currentUrlDisplay.textContent = state.last_url;
      }
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

// Save Config
async function saveConfig() {
  try {
    const configPayload = {
      last_url: state.last_url,
      last_monitor_index: state.last_monitor_index,
      window_position: null,
      window_size: null
    };
    await invoke('save_config', { config: configPayload });
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Fetch & Render Monitors
async function fetchMonitors() {
  try {
    monitorList.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">Mendeteksi monitor...</div>`;
    const monitors = await invoke('get_monitors');
    state.monitors = monitors || [];

    if (state.monitors.length === 0) {
      monitorList.innerHTML = `<div style="color: var(--danger); font-size: 0.85rem;">Tidak ada monitor terdeteksi.</div>`;
      return;
    }

    monitorList.innerHTML = '';
    state.monitors.forEach((mon) => {
      const isSelected = mon.index === state.last_monitor_index;
      if (isSelected) {
        currentMonitorDisplay.textContent = `${mon.name} (${mon.width}x${mon.height})`;
      }

      const item = document.createElement('div');
      item.className = `monitor-item ${isSelected ? 'selected' : ''}`;
      
      const badgeHtml = mon.is_primary 
        ? '<span class="primary-badge">PRIMARY</span>' 
        : '<span class="secondary-badge">SECONDARY</span>';

      item.innerHTML = `
        <div class="monitor-info">
          <div class="monitor-name">
            ${mon.name}
            ${badgeHtml}
          </div>
          <div class="monitor-details">${mon.width} x ${mon.height} px (pos: ${mon.x}, ${mon.y})</div>
        </div>
        <button class="btn ${isSelected ? 'btn-secondary' : ''} send-monitor-btn" data-index="${mon.index}">
          ${isSelected ? 'Active Screen' : `Kirim ke Screen [${mon.index + 1}]`}
        </button>
      `;

      item.querySelector('.send-monitor-btn').addEventListener('click', () => {
        sendViewerToMonitor(mon.index, mon.name);
      });

      monitorList.appendChild(item);
    });
  } catch (err) {
    console.error('Error fetching monitors:', err);
    monitorList.innerHTML = `<div style="color: var(--danger); font-size: 0.85rem;">Gagal memuat monitor: ${err}</div>`;
  }
}

// Navigate Viewer Window
async function navigateViewer() {
  const formattedUrl = formatUrl(urlInput.value);
  if (!formattedUrl) {
    showToast('Masukkan URL yang valid');
    return;
  }

  try {
    urlInput.value = formattedUrl;
    await invoke('navigate_viewer', { url: formattedUrl });
    state.last_url = formattedUrl;
    currentUrlDisplay.textContent = formattedUrl;
    showToast('URL berhasil dikirim ke Viewer');
    await saveConfig();
  } catch (err) {
    console.error('Error navigating viewer:', err);
    showToast('Gagal navigasi viewer: ' + err);
  }
}

// Send Viewer to Selected Monitor
async function sendViewerToMonitor(index, name) {
  try {
    await invoke('move_viewer_to_monitor', { monitorIndex: index });
    state.last_monitor_index = index;
    currentMonitorDisplay.textContent = `${name || 'Screen ' + (index + 1)}`;
    showToast(`Viewer dikirim ke Screen [${index + 1}]`);
    await saveConfig();
    await fetchMonitors(); // re-render selected state
  } catch (err) {
    console.error('Error moving viewer:', err);
    showToast('Gagal memindahkan viewer: ' + err);
  }
}

// Toggle Setting Panel Toolbar
toggleSettingBtn.addEventListener('click', () => {
  const isHidden = settingToolbarPanel.classList.toggle('hidden');
  toggleSettingBtn.classList.toggle('active', !isHidden);
});

// Event Listeners
loadBtn.addEventListener('click', navigateViewer);

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    navigateViewer();
  }
});

refreshMonitorsBtn.addEventListener('click', () => {
  fetchMonitors();
  showToast('Daftar monitor diperbarui');
});

presetChips.forEach(chip => {
  chip.addEventListener('click', () => {
    urlInput.value = chip.getAttribute('data-url');
    navigateViewer();
  });
});

// Initialization
async function init() {
  await loadSavedConfig();
  await fetchMonitors();
}

init();
