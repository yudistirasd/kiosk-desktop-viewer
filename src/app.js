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
const modalTitle = document.getElementById('modalTitle');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const landingOpenSettingsBtn = document.getElementById('landingOpenSettingsBtn');
const shortcutNoticeBanner = document.getElementById('shortcutNoticeBanner');
const modeSwitcherGroup = document.getElementById('modeSwitcherGroup');
const modeDefaultBtn = document.getElementById('modeDefaultBtn');
const modeMultiBtn = document.getElementById('modeMultiBtn');
const multiProfileSection = document.getElementById('multiProfileSection');
const profileSelectGroup = document.getElementById('profileSelectGroup');
const profileSelect = document.getElementById('profileSelect');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');
const profileNameGroup = document.getElementById('profileNameGroup');
const profileLockedBadge = document.getElementById('profileLockedBadge');
const profileNameNotice = document.getElementById('profileNameNotice');
const profileNameInput = document.getElementById('profileNameInput');
const urlInput = document.getElementById('urlInput');
const autoMonitorToggle = document.getElementById('autoMonitorToggle');
const monitorSelectSection = document.getElementById('monitorSelectSection');
const autoMonitorSelect = document.getElementById('autoMonitorSelect');
const saveAndLoadBtn = document.getElementById('saveAndLoadBtn');
const saveBtnIcon = document.getElementById('saveBtnIcon');
const saveBtnSpinner = document.getElementById('saveBtnSpinner');
const saveBtnText = document.getElementById('saveBtnText');
const viewerFrame = document.getElementById('viewerFrame');
const blankLanding = document.getElementById('blankLanding');
const toast = document.getElementById('toast');

let state = {
  profile_mode: 'default', // 'default' | 'multi'
  is_shortcut_session: false,
  shortcut_profile_name: '',
  shortcut_profile_id: '',
  last_url: '',
  last_monitor_index: 0,
  auto_monitor: false,
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

// Refresh Monitors from Rust Tauri Backend
async function refreshMonitorsList() {
  try {
    const list = await safeInvoke('get_monitors');
    if (Array.isArray(list) && list.length > 0) {
      state.monitors = list;
    } else {
      state.monitors = [{ index: 0, name: 'Display 1', width: 1920, height: 1080, is_primary: true }];
    }
  } catch (err) {
    console.error('Failed to get monitors:', err);
    state.monitors = [{ index: 0, name: 'Display 1', width: 1920, height: 1080, is_primary: true }];
  }

  // Populate autoMonitorSelect options
  const currentVal = parseInt(autoMonitorSelect.value, 10);
  autoMonitorSelect.innerHTML = '';
  state.monitors.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.index;
    const type = m.is_primary ? 'Layar Utama' : 'Layar Sekunder';
    opt.textContent = `Screen ${m.index + 1} (${type}) - ${m.width}x${m.height} px`;
    autoMonitorSelect.appendChild(opt);
  });

  if (!isNaN(currentVal) && state.monitors.some((m) => m.index === currentVal)) {
    autoMonitorSelect.value = currentVal;
  }
}

// Switch Mode (Default vs Multi)
function setProfileMode(mode) {
  state.profile_mode = mode;
  if (state.is_shortcut_session) {
    // In shortcut session, keep profile mode locked to active profile
    return;
  }

  if (mode === 'default') {
    modeDefaultBtn.classList.add('active');
    modeMultiBtn.classList.remove('active');
    multiProfileSection.classList.add('hidden');
    saveBtnText.textContent = 'Simpan & Tampilkan';
    modalTitle.textContent = 'Setting Kiosk Webview';
    autoMonitorToggle.checked = !!state.auto_monitor;
    if (state.auto_monitor) {
      monitorSelectSection.classList.remove('hidden');
      autoMonitorSelect.value = state.last_monitor_index || 0;
    } else {
      monitorSelectSection.classList.add('hidden');
    }
  } else {
    modeMultiBtn.classList.add('active');
    modeDefaultBtn.classList.remove('active');
    multiProfileSection.classList.remove('hidden');
    saveBtnText.textContent = 'Simpan & Buat Shortcut Desktop';
    modalTitle.textContent = 'Setting Kiosk Multi Profile';
    renderProfileDropdown();
  }
}

// Modal Control
async function openSettingsModal() {
  await refreshMonitorsList();

  if (state.is_shortcut_session) {
    // Active Profile mode via Shortcut
    modalTitle.textContent = `Setting Profile [${state.shortcut_profile_name}]`;
    shortcutNoticeBanner.classList.remove('hidden');
    modeSwitcherGroup.classList.add('hidden');
    multiProfileSection.classList.remove('hidden');
    profileSelectGroup.classList.add('hidden');

    profileNameInput.value = state.shortcut_profile_name;
    profileNameInput.disabled = true;
    profileLockedBadge.classList.remove('hidden');
    profileNameNotice.classList.remove('hidden');

    const prof = state.profiles.find((p) => p.id === state.shortcut_profile_id);
    if (prof) {
      urlInput.value = prof.url || '';
      autoMonitorToggle.checked = !!prof.auto_monitor;
      if (prof.monitor_index !== undefined) {
        autoMonitorSelect.value = prof.monitor_index;
      }
    } else {
      urlInput.value = state.last_url || '';
    }

    if (autoMonitorToggle.checked) {
      monitorSelectSection.classList.remove('hidden');
    } else {
      monitorSelectSection.classList.add('hidden');
    }

    saveBtnText.textContent = 'Simpan Pengaturan Profil';
    settingsModal.classList.remove('hidden');
    urlInput.focus();
    return;
  }

  // Normal mode (non-shortcut)
  shortcutNoticeBanner.classList.add('hidden');
  modeSwitcherGroup.classList.remove('hidden');
  profileSelectGroup.classList.remove('hidden');
  profileNameInput.disabled = false;
  profileLockedBadge.classList.add('hidden');
  profileNameNotice.classList.add('hidden');

  setProfileMode(state.profile_mode || 'default');
  settingsModal.classList.remove('hidden');

  if (state.profile_mode === 'multi') {
    profileNameInput.focus();
  } else {
    urlInput.focus();
  }
}

function closeSettingsModal() {
  settingsModal.classList.add('hidden');
}

// Render Profiles in Dropdown
function renderProfileDropdown() {
  profileSelect.innerHTML = '<option value="new">+ Tambah Profil Baru</option>';

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
    autoMonitorToggle.checked = false;
    monitorSelectSection.classList.add('hidden');
    deleteProfileBtn.classList.add('hidden');
  } else {
    const prof = state.profiles.find((p) => p.id === selectedId);
    if (prof) {
      profileNameInput.value = prof.name;
      urlInput.value = prof.url;
      autoMonitorToggle.checked = !!prof.auto_monitor;
      if (prof.monitor_index !== undefined) {
        autoMonitorSelect.value = prof.monitor_index;
      }
      if (prof.auto_monitor) {
        monitorSelectSection.classList.remove('hidden');
      } else {
        monitorSelectSection.classList.add('hidden');
      }
      deleteProfileBtn.classList.remove('hidden');
    }
  }
}

// Save Current Config & Profile
function saveCurrentProfile() {
  const rawUrl = urlInput.value.trim();
  const formattedUrl = formatUrl(rawUrl);

  if (!formattedUrl) {
    showToast('Masukkan URL yang valid');
    return null;
  }

  const isAutoMonitor = autoMonitorToggle.checked;
  const chosenMonitorIndex = parseInt(autoMonitorSelect.value, 10) || 0;

  // Case 1: Active Shortcut Profile session
  if (state.is_shortcut_session) {
    const prof = state.profiles.find((p) => p.id === state.shortcut_profile_id);
    if (prof) {
      prof.url = formattedUrl;
      prof.auto_monitor = isAutoMonitor;
      prof.monitor_index = chosenMonitorIndex;
    }
    state.last_url = formattedUrl;
    if (isAutoMonitor) {
      state.last_monitor_index = chosenMonitorIndex;
      safeInvoke('move_to_monitor', { monitorIndex: chosenMonitorIndex });
    }
    saveConfig();
    return {
      id: state.shortcut_profile_id,
      name: state.shortcut_profile_name,
      url: formattedUrl,
      isShortcut: true
    };
  }

  // Case 2: Multi Profile mode (non-shortcut)
  if (state.profile_mode === 'multi') {
    const name = profileNameInput.value.trim() || 'Display Kiosk';
    let selectedId = profileSelect.value;

    if (selectedId === 'new') {
      selectedId = 'profile_' + Date.now();
      const newProfile = {
        id: selectedId,
        name: name,
        url: formattedUrl,
        monitor_index: chosenMonitorIndex,
        auto_monitor: isAutoMonitor
      };
      state.profiles.push(newProfile);
    } else {
      const prof = state.profiles.find((p) => p.id === selectedId);
      if (prof) {
        prof.name = name;
        prof.url = formattedUrl;
        prof.monitor_index = chosenMonitorIndex;
        prof.auto_monitor = isAutoMonitor;
      }
    }

    state.active_profile_id = selectedId;
    state.last_url = formattedUrl;
    if (isAutoMonitor) {
      state.last_monitor_index = chosenMonitorIndex;
      safeInvoke('move_to_monitor', { monitorIndex: chosenMonitorIndex });
    }
    saveConfig();
    renderProfileDropdown();

    return { id: selectedId, name: name, url: formattedUrl, isShortcut: false };
  } else {
    // Case 3: Default mode
    state.last_url = formattedUrl;
    state.auto_monitor = isAutoMonitor;
    state.last_monitor_index = chosenMonitorIndex;
    if (isAutoMonitor) {
      safeInvoke('move_to_monitor', { monitorIndex: chosenMonitorIndex });
    }
    saveConfig();
    return { id: 'default', name: 'Default', url: formattedUrl, isShortcut: false };
  }
}

// Delete Selected Profile
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
      profile_mode: state.profile_mode,
      last_url: state.last_url,
      last_monitor_index: state.last_monitor_index,
      auto_monitor: state.auto_monitor,
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
      state.profile_mode = config.profile_mode || 'default';
      state.last_url = config.last_url || '';
      state.last_monitor_index = config.last_monitor_index || 0;
      state.auto_monitor = typeof config.auto_monitor === 'boolean' ? config.auto_monitor : false;
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
          state.is_shortcut_session = true;
          state.shortcut_profile_id = prof.id;
          state.shortcut_profile_name = prof.name;
          state.active_profile_id = prof.id;
          state.last_url = prof.url;

          // Update Window Menu title
          await safeInvoke('update_menu_profile_name', { profileName: prof.name });

          // Auto move to monitor if enabled for this profile
          if (prof.auto_monitor) {
            const targetMonitor = prof.monitor_index !== undefined ? prof.monitor_index : 0;
            state.last_monitor_index = targetMonitor;
            await safeInvoke('move_to_monitor', { monitorIndex: targetMonitor });
          }

          loadUrlIntoFrame(prof.url);
          showToast(`Mode Kiosk: Profil "${prof.name}" aktif`);
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
  autoMonitorSelect.value = index;
  saveConfig();
  showToast(`Window dipindahkan ke Display Screen [${index + 1}]`);
});

// Event Listeners
modeDefaultBtn.addEventListener('click', () => setProfileMode('default'));
modeMultiBtn.addEventListener('click', () => setProfileMode('multi'));
landingOpenSettingsBtn.addEventListener('click', openSettingsModal);
closeSettingsBtn.addEventListener('click', closeSettingsModal);
profileSelect.addEventListener('change', handleProfileSelectChange);
deleteProfileBtn.addEventListener('click', deleteCurrentProfile);

autoMonitorToggle.addEventListener('change', () => {
  if (autoMonitorToggle.checked) {
    monitorSelectSection.classList.remove('hidden');
  } else {
    monitorSelectSection.classList.add('hidden');
  }
});

// Notification on clicking locked profile input
profileNameGroup.addEventListener('click', (e) => {
  if (state.is_shortcut_session) {
    showToast(`Nama profil "${state.shortcut_profile_name}" terkunci mengikuti shortcut desktop`);
  }
});

// Helper for Save Button Loading State
function setSaveButtonLoading(isLoading, customText = 'Membuat Shortcut Desktop...') {
  if (isLoading) {
    saveAndLoadBtn.disabled = true;
    if (saveBtnIcon) saveBtnIcon.classList.add('hidden');
    if (saveBtnSpinner) saveBtnSpinner.classList.remove('hidden');
    saveBtnText.textContent = customText;
  } else {
    saveAndLoadBtn.disabled = false;
    if (saveBtnSpinner) saveBtnSpinner.classList.add('hidden');
    if (saveBtnIcon) saveBtnIcon.classList.remove('hidden');
    if (state.is_shortcut_session) {
      saveBtnText.textContent = 'Simpan Pengaturan Profil';
    } else if (state.profile_mode === 'multi') {
      saveBtnText.textContent = 'Simpan & Buat Shortcut Desktop';
    } else {
      saveBtnText.textContent = 'Simpan & Tampilkan';
    }
  }
}

saveAndLoadBtn.addEventListener('click', async () => {
  const prof = saveCurrentProfile();
  if (!prof) return;

  loadUrlIntoFrame(prof.url, false);

  if (prof.isShortcut) {
    showToast(`Pengaturan profil "${prof.name}" berhasil disimpan!`);
    closeSettingsModal();
  } else if (state.profile_mode === 'multi') {
    setSaveButtonLoading(true, 'Membuat Shortcut Desktop...');
    try {
      const result = await safeInvoke('create_desktop_shortcut', {
        name: prof.name,
        profileId: prof.id
      });
      showToast(result || `Profil "${prof.name}" disimpan & Shortcut dibuat!`);
    } catch (err) {
      console.error('Error creating shortcut:', err);
      showToast(`Profil "${prof.name}" disimpan (Gagal buat shortcut: ${err})`);
    } finally {
      setSaveButtonLoading(false);
      closeSettingsModal();
    }
  } else {
    showToast('Pengaturan URL & Monitor berhasil disimpan!');
    closeSettingsModal();
  }
});

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveAndLoadBtn.click();
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
  await refreshMonitorsList();

  const launchedViaShortcut = await handleCliArgumentsOnStartup();

  if (!launchedViaShortcut) {
    // Mode Default auto monitor check on startup
    if (state.auto_monitor && state.last_monitor_index !== undefined) {
      try {
        await safeInvoke('move_to_monitor', { monitorIndex: state.last_monitor_index });
      } catch (err) {
        console.warn('Gagal otomatis pindah monitor saat startup:', err);
      }
    }

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
