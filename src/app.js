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
const landingOpenSettingsBtn = document.getElementById('landingOpenSettingsBtn');
const profileSelect = document.getElementById('profileSelect');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');
const profileNameInput = document.getElementById('profileNameInput');
const urlInput = document.getElementById('urlInput');
const createShortcutBtn = document.getElementById('createShortcutBtn');
const saveAndLoadBtn = document.getElementById('saveAndLoadBtn');
const viewerFrame = document.getElementById('viewerFrame');
const blankLanding = document.getElementById('blankLanding');
const toast = document.getElementById('toast');

let state = {
  last_url: '',
  last_monitor_index: 0,
  active_profile_id: '',
  profiles: [],
  monitors: []
};

// Show Toast Notification
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
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
  renderProfileDropdown();
  settingsModal.classList.remove('hidden');
  profileNameInput.focus();
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
}

// Render Profiles in Dropdown
function renderProfileDropdown() {
  profileSelect.innerHTML = '<option value="new">+ Tambah Profil Baru (Dokter / Poli Baru)</option>';
  
  state.profiles.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.url})`;
    if (p.id === state.active_profile_id) {
      opt.selected = true;
    }
    profileSelect.appendChild(opt);
  });

  handleProfileSelectChange();
}

// Handle Profile Dropdown Change
function handleProfileSelectChange() {
  const selectedId = profileSelect.value;
  if (selectedId === 'new') {
    profileNameInput.value = '';
    urlInput.value = state.last_url || '';
    deleteProfileBtn.classList.add('hidden');
  } else {
    const prof = state.profiles.find((p) => p.id === selectedId);
    if (prof) {
      profileNameInput.value = prof.name;
      urlInput.value = prof.url;
      deleteProfileBtn.classList.remove('hidden');
    }
  }
}

// Save Current Profile
function saveCurrentProfile() {
  const name = profileNameInput.value.trim() || 'Display Poli Kiosk';
  const rawUrl = urlInput.value.trim();
  const formattedUrl = formatUrl(rawUrl);

  if (!formattedUrl) {
    showToast('Masukkan URL yang valid');
    return null;
  }

  let selectedId = profileSelect.value;
  if (selectedId === 'new') {
    selectedId = 'profile_' + Date.now();
    const newProfile = {
      id: selectedId,
      name: name,
      url: formattedUrl,
      monitor_index: state.last_monitor_index
    };
    state.profiles.push(newProfile);
  } else {
    const prof = state.profiles.find((p) => p.id === selectedId);
    if (prof) {
      prof.name = name;
      prof.url = formattedUrl;
      prof.monitor_index = state.last_monitor_index;
    }
  }

  state.active_profile_id = selectedId;
  state.last_url = formattedUrl;
  saveConfig();
  renderProfileDropdown();

  return { id: selectedId, name: name, url: formattedUrl };
}

// Delete Profile
function deleteCurrentProfile() {
  const selectedId = profileSelect.value;
  if (selectedId === 'new') return;

  state.profiles = state.profiles.filter((p) => p.id !== selectedId);
  if (state.active_profile_id === selectedId) {
    state.active_profile_id = '';
  }
  saveConfig();
  renderProfileDropdown();
  showToast('Profil berhasil dihapus');
}

// Save Config to Store
async function saveConfig() {
  try {
    const configPayload = {
      last_url: state.last_url,
      last_monitor_index: state.last_monitor_index,
      active_profile_id: state.active_profile_id,
      profiles: state.profiles,
      always_show_toolbar: false,
      window_position: null,
      window_size: null
    };
    await safeInvoke('save_config', { config: configPayload });
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Load Saved Config
async function loadSavedConfig() {
  try {
    const config = await safeInvoke('load_config');
    if (config) {
      state.last_url = config.last_url || '';
      state.last_monitor_index = config.last_monitor_index || 0;
      state.active_profile_id = config.active_profile_id || '';
      state.profiles = config.profiles || [];
    }
  } catch (err) {
    console.error('Error loading config:', err);
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
    showToast('URL berhasil dimuat & ditampilkan');
  }
}

// Handle Desktop Shortcut Creation
async function handleCreateDesktopShortcut() {
  const prof = saveCurrentProfile();
  if (!prof) return;

  try {
    const result = await safeInvoke('create_desktop_shortcut', {
      name: prof.name,
      profileId: prof.id
    });
    showToast(result || `Shortcut "${prof.name}" dibuat di Desktop!`);
  } catch (err) {
    console.error('Error creating shortcut:', err);
    showToast('Gagal membuat shortcut: ' + err);
  }
}

// Handle Startup CLI Arguments (when launched from Desktop Shortcut)
async function handleCliArgumentsOnStartup() {
  try {
    const args = await safeInvoke('get_cli_args');
    if (args) {
      if (args.profile) {
        const prof = state.profiles.find(
          (p) => p.id === args.profile || p.name.toLowerCase() === args.profile.toLowerCase()
        );
        if (prof) {
          state.active_profile_id = prof.id;
          state.last_url = prof.url;
          if (prof.monitor_index !== undefined) {
            state.last_monitor_index = prof.monitor_index;
            await safeInvoke('move_to_monitor', { monitorIndex: prof.monitor_index });
          }
          loadUrlIntoFrame(prof.url);
          showToast(`Mode Kiosk: Profil "${prof.name}" diaktifkan`);
          return true;
        }
      }

      if (args.url) {
        if (args.monitor !== undefined && args.monitor !== null) {
          state.last_monitor_index = args.monitor;
          await safeInvoke('move_to_monitor', { monitorIndex: args.monitor });
        }
        loadUrlIntoFrame(args.url);
        showToast(`Mode Kiosk: Memuat URL dari shortcut`);
        return true;
      }
    }
  } catch (err) {
    console.error('Error reading CLI args:', err);
  }
  return false;
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
profileSelect.addEventListener('change', handleProfileSelectChange);
deleteProfileBtn.addEventListener('click', deleteCurrentProfile);
createShortcutBtn.addEventListener('click', handleCreateDesktopShortcut);

saveAndLoadBtn.addEventListener('click', () => {
  const prof = saveCurrentProfile();
  if (prof) {
    loadUrlIntoFrame(prof.url, true);
    closeSettingsModal();
  }
});

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const prof = saveCurrentProfile();
    if (prof) {
      loadUrlIntoFrame(prof.url, true);
      closeSettingsModal();
    }
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
      safeInvoke('exit_fullscreen');
    }
  } else if (e.key === 'F11') {
    safeInvoke('toggle_fullscreen');
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    openSettingsModal();
  }
});

// Initialization
async function init() {
  await loadSavedConfig();
  const launchedViaShortcut = await handleCliArgumentsOnStartup();
  
  if (!launchedViaShortcut) {
    if (state.last_url) {
      loadUrlIntoFrame(state.last_url);
    } else {
      openSettingsModal();
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
