// Safe resolution for Tauri API without ES Module bundler
function getInvoke() {
  if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
    return window.__TAURI__.core.invoke;
  }
  if (window.__TAURI__ && typeof window.__TAURI__.invoke === 'function') {
    return window.__TAURI__.invoke;
  }
  if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
    return window.__TAURI_INTERNALS__.invoke;
  }
  console.warn('Tauri API invoke not detected on window.');
  return null;
}

async function safeInvoke(cmd, args = {}) {
  const invoke = getInvoke();
  if (invoke) {
    return await invoke(cmd, args);
  } else {
    console.warn(`[Mock Invoke] ${cmd}`, args);
    return null;
  }
}

// DOM Elements
const appToolbar = document.getElementById('appToolbar');
const toggleToolbarBtn = document.getElementById('toggleToolbarBtn');
const floatingControls = document.getElementById('floatingControls');
const floatingShowBtn = document.getElementById('floatingShowBtn');
const floatingExitFsBtn = document.getElementById('floatingExitFsBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');
const urlInput = document.getElementById('urlInput');
const loadBtn = document.getElementById('loadBtn');
const viewerFrame = document.getElementById('viewerFrame');
const blankLanding = document.getElementById('blankLanding');
const monitorSelectBtn = document.getElementById('monitorSelectBtn');
const activeMonitorLabel = document.getElementById('activeMonitorLabel');
const monitorDropdownMenu = document.getElementById('monitorDropdownMenu');
const monitorDropdownItems = document.getElementById('monitorDropdownItems');
const monitorDropdownWrapper = document.querySelector('.monitor-dropdown-wrapper');
const statusText = document.getElementById('statusText');
const toast = document.getElementById('toast');

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

// URL Validation and Formatting
function formatUrl(rawUrl) {
  let url = rawUrl.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

// Exit Fullscreen Command
async function handleExitFullscreen() {
  try {
    await safeInvoke('exit_fullscreen');
    showToast('Keluar dari mode Fullscreen');
  } catch (err) {
    console.error('Error exiting fullscreen:', err);
    showToast('Gagal keluar dari Fullscreen: ' + err);
  }
}

// Toolbar Collapse / Expand
function collapseToolbar() {
  appToolbar.classList.add('collapsed');
  floatingControls.classList.remove('hidden');
}

function expandToolbar() {
  appToolbar.classList.remove('collapsed');
  floatingControls.classList.add('hidden');
}

// Load Preserved Config
async function loadSavedConfig() {
  try {
    const config = await safeInvoke('load_config');
    if (config) {
      state.last_url = config.last_url || '';
      state.last_monitor_index = config.last_monitor_index || 0;

      if (state.last_url) {
        urlInput.value = state.last_url;
        loadUrlIntoFrame(state.last_url);
        // Automatically hide toolbar if setting/URL already exists
        collapseToolbar();
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
    await safeInvoke('save_config', { config: configPayload });
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Load URL into Viewer Frame
function loadUrlIntoFrame(rawUrl) {
  const formattedUrl = formatUrl(rawUrl);
  if (!formattedUrl) {
    showToast('Masukkan URL yang valid');
    return;
  }

  urlInput.value = formattedUrl;
  viewerFrame.src = formattedUrl;
  blankLanding.classList.add('hidden');
  
  state.last_url = formattedUrl;
  statusText.textContent = `Active: ${formattedUrl}`;
  saveConfig();
}

// Fetch & Render Monitors in Secondary Monitor Dropdown
async function fetchMonitors() {
  try {
    monitorDropdownItems.innerHTML = `<div class="dropdown-loading" style="padding:8px; font-size:0.75rem; color:var(--text-muted);">Mendeteksi monitor...</div>`;
    const monitors = await safeInvoke('get_monitors');
    state.monitors = monitors || [];

    if (state.monitors.length === 0) {
      monitorDropdownItems.innerHTML = `<div style="padding:8px; font-size:0.75rem; color:var(--danger);">Tidak ada monitor terdeteksi</div>`;
      return;
    }

    monitorDropdownItems.innerHTML = '';
    state.monitors.forEach((mon) => {
      const isSelected = mon.index === state.last_monitor_index;
      if (isSelected) {
        activeMonitorLabel.textContent = `Screen [${mon.index + 1}]: ${mon.name}`;
      }

      const item = document.createElement('div');
      item.className = `dropdown-item ${isSelected ? 'active' : ''}`;
      
      const badgeHtml = mon.is_primary 
        ? '<span class="primary-badge">PRIMARY</span>' 
        : '<span class="secondary-badge">SECONDARY</span>';

      item.innerHTML = `
        <div class="item-info">
          <div class="item-title">
            ${mon.name} ${badgeHtml}
          </div>
          <div class="item-sub">${mon.width}x${mon.height} px (pos: ${mon.x}, ${mon.y})</div>
        </div>
        <button class="btn btn-secondary btn-icon-only" style="font-size:0.7rem; padding:4px 8px;">
          ${isSelected ? 'Active' : 'Kirim'}
        </button>
      `;

      item.addEventListener('click', () => {
        sendToMonitor(mon.index, mon.name);
        monitorDropdownMenu.classList.add('hidden');
      });

      monitorDropdownItems.appendChild(item);
    });
  } catch (err) {
    console.error('Error fetching monitors:', err);
    monitorDropdownItems.innerHTML = `<div style="padding:8px; font-size:0.75rem; color:var(--danger);">Gagal: ${err}</div>`;
  }
}

// Send Window to Selected Monitor
async function sendToMonitor(index, name) {
  try {
    await safeInvoke('move_to_monitor', { monitorIndex: index });
    state.last_monitor_index = index;
    activeMonitorLabel.textContent = `Screen [${index + 1}]: ${name || 'Monitor'}`;
    showToast(`App dikirim ke Screen [${index + 1}] (${name || 'Monitor'})`);
    await saveConfig();
    await fetchMonitors();
  } catch (err) {
    console.error('Error moving to monitor:', err);
    showToast('Gagal memindahkan monitor: ' + err);
  }
}

toggleToolbarBtn.addEventListener('click', collapseToolbar);
floatingShowBtn.addEventListener('click', expandToolbar);
exitFullscreenBtn.addEventListener('click', handleExitFullscreen);
floatingExitFsBtn.addEventListener('click', handleExitFullscreen);

// Keyboard Shortcuts: Esc or F11 to exit/toggle fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'F11') {
    handleExitFullscreen();
  }
});

// Monitor Dropdown Toggle
monitorSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isHidden = monitorDropdownMenu.classList.toggle('hidden');
  if (!isHidden) {
    fetchMonitors();
  }
});

// Close Dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (monitorDropdownWrapper && !monitorDropdownWrapper.contains(e.target)) {
    monitorDropdownMenu.classList.add('hidden');
  }
});

// Event Listeners for URL Loading
loadBtn.addEventListener('click', () => loadUrlIntoFrame(urlInput.value));

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loadUrlIntoFrame(urlInput.value);
  }
});

// Initialization
async function init() {
  await loadSavedConfig();
  await fetchMonitors();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
