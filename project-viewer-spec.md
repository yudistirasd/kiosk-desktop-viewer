# Project Spec: Tauri Webview Viewer (Multi-Screen + Dynamic URL)

## 1. Ringkasan Project
Aplikasi desktop berbasis **Tauri** yang berfungsi sebagai **viewer** untuk menampilkan konten web (URL) di dalam webview. Fitur utama:
1. Input URL dinamis dari user (bisa diganti-ganti tanpa rebuild).
2. Kemampuan mengirim/menampilkan window viewer ke **secondary screen/monitor**.
3. Konfigurasi tersimpan (persist) agar URL terakhir & posisi window diingat.

Target platform: **Windows** (prioritas utama), tapi kode harus tetap valid untuk macOS/Linux jika memungkinkan.

---

## 2. Tech Stack
- **Tauri** v2 (gunakan API terbaru `@tauri-apps/api` v2 dan plugin resmi)
- **Rust** sebagai backend (main process)
- **Frontend**: HTML + vanilla JS (tidak perlu framework berat seperti React/Vue, agar simpel)
- **Plugin Tauri yang dibutuhkan**:
  - `tauri-plugin-store` — untuk menyimpan config (URL terakhir, posisi monitor)
  - Gunakan API bawaan Tauri `Monitor` (`availableMonitors()`, `currentMonitor()`) untuk deteksi multi-screen

---

## 3. Fitur Detail

### 3.1 Input URL Dinamis
- Sediakan **halaman kontrol/config** (window terpisah bernama `control`) berisi:
  - Input text field untuk memasukkan URL
  - Tombol "Load" / "Open" untuk mengirim URL ke window viewer
  - Validasi URL sederhana (harus diawali `http://` atau `https://`, jika tidak beri prefix otomatis)
- Window **viewer** (window terpisah bernama `viewer`) menampilkan konten dari URL yang diinput, menggunakan navigasi dinamis (bukan reload seluruh app).
- Simpan URL terakhir yang dibuka ke local store, agar saat app dibuka lagi otomatis load URL tersebut.

### 3.2 Kirim ke Secondary Screen
- Di halaman kontrol, tampilkan **daftar monitor yang terdeteksi** (nama/index + resolusi).
- Sediakan tombol "Send to Screen [N]" untuk masing-masing monitor yang terdeteksi.
- Saat tombol diklik:
  - Window `viewer` dipindahkan (`set_position`) ke koordinat monitor yang dipilih.
  - Ukuran window `viewer` diatur agar fullscreen/maximize di monitor tersebut (`set_size` sesuai resolusi monitor, atau gunakan `set_fullscreen(true)`).
- Simpan preferensi monitor terakhir yang dipakai ke local store (opsional tapi disarankan).

### 3.3 Konfigurasi Persisten
- Gunakan `tauri-plugin-store` untuk menyimpan file config (misal `config.json`) berisi:
  ```json
  {
    "last_url": "https://example.com",
    "last_monitor_index": 1,
    "window_position": { "x": 0, "y": 0 },
    "window_size": { "width": 1920, "height": 1080 }
  }
  ```
- Saat app start:
  - Baca config
  - Window `viewer` otomatis load `last_url` dan pindah ke `last_monitor_index` jika data tersedia.

---

## 4. Struktur Window
Buat **2 window terpisah** di Tauri:

| Window   | Label     | Fungsi                                      | Ukuran default        |
|----------|-----------|----------------------------------------------|------------------------|
| Control  | `control` | UI input URL, list monitor, tombol kontrol   | 400x600 (kecil, di layar utama) |
| Viewer   | `viewer`  | Menampilkan webview URL, dikirim ke monitor lain | Fullscreen / sesuai resolusi target |

Komunikasi antar window pakai **Tauri Event System** (`emit` dari `control` → `listen` di `viewer`), contoh event:
- `navigate-url` → payload: `{ url: string }`
- `move-to-monitor` → payload: `{ monitor_index: number }`

---

## 5. Struktur Project (Referensi)
```
project-viewer/
├── src-tauri/
│   ├── src/
│   │   └── main.rs          # setup window, commands, monitor detection
│   ├── tauri.conf.json      # definisi window control & viewer
│   └── Cargo.toml
├── src/
│   ├── control.html         # UI kontrol (input URL, list monitor)
│   ├── control.js
│   ├── viewer.html           # halaman viewer (bisa kosong/blank, karena viewer navigate ke URL eksternal)
│   └── style.css
└── package.json
```

---

## 6. Rust Backend — Kebutuhan Command
Buat Tauri commands berikut (di-expose ke frontend lewat `invoke`):

1. `get_monitors()` → return list monitor (index, name, position, size)
2. `move_viewer_to_monitor(monitor_index: usize)` → pindahkan & fullscreen-kan window `viewer` ke monitor terpilih
3. `navigate_viewer(url: String)` → navigasi window `viewer` ke URL baru
4. `save_config(config: ConfigStruct)` → simpan ke store
5. `load_config()` → baca dari store, dipanggil saat app start

---

## 7. Alur Kerja (User Flow)
1. User buka app → window `control` muncul di layar utama.
2. App otomatis load config terakhir (jika ada) → window `viewer` langsung tampil dengan `last_url` di `last_monitor_index`.
3. User bisa:
   - Ganti URL di input field → klik "Load" → window `viewer` navigasi ke URL baru.
   - Pilih monitor dari daftar → klik "Send to Screen [N]" → window `viewer` pindah & fullscreen ke monitor itu.
4. Setiap perubahan (URL / monitor) disimpan otomatis ke config.

---

## 8. Instruksi Implementasi untuk AI Coding Agent
> **Catatan untuk model/agent yang mengerjakan:**
> - Gunakan **Tauri v2** (bukan v1) — API window & monitor sudah berubah signifikan dari v1 ke v2, pastikan pakai import & syntax v2.
> - Jangan gunakan library UI framework tambahan (React/Vue/Svelte) — cukup HTML/JS vanilla agar setup minimal dan mudah di-debug.
> - Pastikan `tauri.conf.json` mendefinisikan 2 window (`control` dan `viewer`) sejak awal, bukan dibuat dinamis di runtime, kecuali diperlukan.
> - Gunakan `tauri-plugin-store` resmi (`@tauri-apps/plugin-store` untuk frontend, `tauri-plugin-store` di Cargo.toml untuk Rust) — jangan bikin sistem penyimpanan file manual kecuali plugin store tidak mencukupi.
> - Pastikan permission/capability di `tauri.conf.json` (v2 pakai sistem *capabilities*) sudah include akses ke: window management, monitor detection, store plugin, dan event system. Tanpa ini, command akan gagal karena permission ditolak.
> - Validasi semua input URL sebelum navigasi (hindari crash jika user input string kosong atau format salah).
> - Testing minimal: pastikan app bisa dijalankan dengan `npm run tauri dev` tanpa error, window `control` dan `viewer` sama-sama muncul, dan navigasi URL + pindah monitor berfungsi sebelum dianggap selesai.

---

## 9. Checklist Selesai (Definition of Done)
- [ ] Window `control` & `viewer` muncul saat app dijalankan
- [ ] Input URL di `control` berhasil menavigasi `viewer` ke URL tersebut
- [ ] Daftar monitor terdeteksi & ditampilkan dengan benar di `control`
- [ ] Tombol "Send to Screen" berhasil memindahkan & fullscreen-kan `viewer` ke monitor terpilih
- [ ] Config (URL & monitor terakhir) tersimpan dan otomatis di-restore saat app dibuka ulang
- [ ] Tidak ada error di console saat `npm run tauri dev`
