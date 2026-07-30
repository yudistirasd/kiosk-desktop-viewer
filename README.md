# 🖥️ Kiosk Desktop Viewer

> Aplikasi Desktop Webview Kiosk berbasis **Tauri 2** & **Rust** yang ringan, cepat, dan intuitif untuk menampilkan konten web/dashboard pada monitor tunggal maupun **multi-screen / secondary display**.

![Tauri 2](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)
![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Fitur Utama

- 🗂️ **Preset / Profile Manager**: Simpan banyak profil display (contoh: *Poli Dokter Agus*, *Poli Dokter Budi*, *Display Apotek*) dengan nama dan URL masing-masing.
- 🔗 **Generator Shortcut Desktop (.lnk)**: Buat file shortcut spesifik di Desktop Windows untuk masing-masing profil/dokter hanya dengan 1 klik tombol!
- 📺 **Dukungan Multi-Screen / Secondary Monitor**: Pindahkan tampilan Kiosk secara instan ke layar/monitor sekunder pilihan Anda melalui Window Menu.
- ⚡ **Ringan & Performa Tinggi**: Dibuat menggunakan Tauri 2 & WebView2 native Windows, menghemat penggunaan RAM dan CPU secara signifikan dibandingkan Electron.
- 🎯 **Native Window Menu & Dialog**:
  - `Setting` &rarr; `Setting URL & Profil...` (`Ctrl + S`): Modal kelola profil, URL, dan pembuatan shortcut.
  - `Display` &rarr; Pilih layar tujuan secara langsung (misal: *Screen 1 (Layar Utama)*, *Screen 2 (Layar Sekunder)*).
- 🖥️ **Mode Maximize & Fullscreen**: Otomatis tampil terbuka maksimal (*Maximized*) saat dibuka, mendukung mode borderless fullscreen.
- 💾 **Penyimpanan Konfigurasi Otomatis**: Otomatis menyimpan URL, daftar profil, dan posisi monitor terakhir yang digunakan.
- 🔒 **Bypass Self-Signed SSL Certificate**: Mendukung akses ke IP internal/HTTPS lokal tanpa terhalang peringatan sertifikat SSL.
- 📦 **Installer `.msi` Otomatis**: Installer bawaan Windows yang secara otomatis membuat **Desktop Shortcut Icon** dan menu di Start Menu.

---

## ⌨️ Shortcut Keyboard

| Shortcut | Aksi |
|---|---|
| `Ctrl + S` | Membuka Dialog Setting URL |
| `Esc` | Keluar dari mode Fullscreen |
| `F11` | Toggle Fullscreen |
| `Ctrl + Q` | Keluar dari Aplikasi |

---

## 🚀 Panduan Penggunaan (End-User)

1. **Download Installer**: Unduh file `.msi` terbaru dari halaman **[Releases](../../releases)**.
2. **Install Aplikasi**: Jalankan file `.msi` yang telah diunduh. Shortcut aplikasi akan otomatis dibuat di Desktop.
3. **Pengaturan URL**:
   - Saat aplikasi pertama kali dibuka, jendela **Setting URL** akan otomatis muncul.
   - Masukkan alamat URL (contoh: `https://example.com/kiosk/display` atau `https://google.com`).
   - Klik **Simpan & Load**.
4. **Memindahkan ke Secondary Monitor**:
   - Klik menu **Display** pada baris menu atas (*Window Menu*).
   - Pilih monitor yang ingin digunakan (contoh: `Screen 2 (Layar Sekunder)`).
   - Aplikasi akan otomatis berpindah dan tampil penuh di monitor tersebut.

---

## 🛠️ Pengembangan & Build (Developer)

### Prasyarat System

- [Node.js](https://nodejs.org/) (v18 atau lebih baru)
- [PNPM](https://pnpm.io/) / NPM / Yarn
- [Rust Toolchain](https://www.rust-lang.org/tools/install) (MSVC target untuk Windows)
- C++ Build Tools (VS Community dengan komponen *Desktop development with C++*)

### Menjalankan Mode Development

```bash
# Clone repositori
git clone https://github.com/yudistirasd/kiosk-desktop-viewer.git
cd kiosk-desktop-viewer

# Install dependensi
pnpm install

# Jalankan dalam mode development
pnpm tauri dev
```

### Membangun File Installer (.msi) Lokal

```bash
pnpm tauri build --bundles msi
```

Hasil installer `.msi` dapat ditemukan di folder:
`src-tauri/target/release/bundle/msi/`

---

## ⚙️ Automated GitHub Actions Release

Repositori ini telah dilengkapi dengan CI/CD otomatis (`.github/workflows/release.yml`). Setiap kali Anda mempublikasikan **Release** baru di GitHub:

1. GitHub Actions akan otomatis melakukan kompilasi aplikasi di runner Windows.
2. Membangun installer **`.msi`**.
3. Mengunggah file `.msi` secara otomatis ke halaman Release GitHub.

---

## 👤 Author

**Yudistira**
- GitHub: [@yudistirasd](https://github.com/yudistirasd)

---

## 📄 Lisensi

Proyek ini dirilis di bawah lisensi [MIT License](LICENSE).
