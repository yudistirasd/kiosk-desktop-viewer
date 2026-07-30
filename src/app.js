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
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveAndCloseBtn = document.getElementById('saveAndCloseBtn');
const landingOpenSettingsBtn = document.getElementById('landingOpenSettingsBtn');
const exitFsModalBtn = document.getElementById('exitFsModalBtn');
const urlInput = document.getElementById('urlInput');
const loadBtn = document.getElementById('loadBtn');
const viewerFrame = document.getElementById('viewerFrame');
const blankLanding = document.getElementById('blankLanding');
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

// Modal Control
function openSettingsModal() {
  settingsModal.classList.remove('hidden');
  urlInput.focus();
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
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
      } else {
        openSettingsModal();
      }
    } else {
      openSettingsModal();
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
      always_show_toolbar: false,
      window_position: null,
      window_size: null
    };
    await safeInvoke('save_config', { config: configPayload });
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Load URL into Viewer Frame
function loadUrlIntoFrame(rawUrl, showToastMsg = false) {
  const formattedUrl = formatUrl(rawUrl);
  if (!formattedUrl) {
    showToast('Masukkan URL yang valid');
    return;
  }

  urlInput.value = formattedUrl;
  viewerFrame.src = formattedUrl;
  blankLanding.classList.add('hidden');
  
  state.last_url = formattedUrl;
  saveConfig();

  if (showToastMsg) {
    showToast('URL berhasil disimpan & dimuat');
  }
}

// Helper to Listen for Tauri Events
function listenTauriEvent(eventName, handler) {
  if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.listen === 'function') {
    window.__TAURI__.event.listen(eventName, handler);
  } else if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.listen === 'function') {
    window.__TAURI_INTERNALS__.listen(eventName, handler);
  }
}

listenTauriEvent('open-url-setting', () => openSettingsModal());
listenTauriEvent('open-settings', () => openSettingsModal());
listenTauriEvent('display-changed', (event) => {
  const index = typeof event.payload === 'number' ? event.payload : 0;
  state.last_monitor_index = index;
  saveConfig();
  showToast(`Window dipindahkan ke Display Screen [${index + 1}]`);
});

// Event Listeners
landingOpenSettingsBtn.addEventListener('click', openSettingsModal);
closeSettingsBtn.addEventListener('click', closeSettingsModal);
saveAndCloseBtn.addEventListener('click', closeSettingsModal);
exitFsModalBtn.addEventListener('click', handleExitFullscreen);

loadBtn.addEventListener('click', () => {
  loadUrlIntoFrame(urlInput.value, true);
  closeSettingsModal();
});

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    loadUrlIntoFrame(urlInput.value, true);
    closeSettingsModal();
  }
});

// Close modal when clicking outside modal-card
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    closeSettingsModal();
  }
});

// Keyboard Shortcuts: Esc or F11 or Ctrl+S
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!settingsModal.classList.contains('hidden')) {
      closeSettingsModal();
    } else {
      handleExitFullscreen();
    }
  } else if (e.key === 'F11') {
    handleExitFullscreen();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    openSettingsModal();
  }
});

// Initialization
async function init() {
  await loadSavedConfig();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
