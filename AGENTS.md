# 🤖 AGENTS.md — Kiosk Desktop Viewer Knowledge Base

Dokumen ini berisi catatan arsitektur, panduan pengkodean, serta pembelajaran teknis (*key learnings*) dari pengembangannya untuk membantu agen AI dan pengembang di masa mendatang.

---

## 📌 1. Aturan Pengembangan & Git (User Rules)

1. **Commit & Push**: Jangan melakukan `git commit` atau `git push` secara otomatis. Hanya eksekusi perintah Git commit/push saat pengguna meminta secara eksplisit.
2. **File `.env`**: Jangan membaca atau mengekspos isi file `.env`.
3. **Target OS Primary**: Aplikasi difokuskan khusus untuk **Windows Desktop (MSI Installer)**. Asset platform lain (`ios/`, `android/`, `.icns`, `Square*.png`) dibersihkan dari direktori icons.

---

## 🖥️ 2. Arsitektur Multi-Profile & Desktop Shortcut Generator

### A. Dual Profile Modes
- **Mode Default (Tunggal)**: Digunakan jika PC hanya menampilkan 1 URL utama secara umum. Tombol modal footer: `Simpan & Tampilkan`.
- **Mode Multi Profile**: Digunakan jika 1 PC fisik dipakai bergantian oleh banyak pengguna/profil (contoh: Poli Dokter A, Poli Dokter B, Apotek). Tombol modal footer: `Simpan & Buat Shortcut Desktop`.

### B. Pembuatan Shortcut Windows (`.lnk`) via PowerShell
Pembuatan file shortcut `.lnk` di Desktop Windows dilakukan via command Rust dengan memanggil PowerShell WScript.Shell COM:

```rust
let ps_script = format!(
    "$desktop = [System.Environment]::GetFolderPath('Desktop'); \
     $s = (New-Object -ComObject WScript.Shell).CreateShortcut(\"$desktop\\{}.lnk\"); \
     $s.TargetPath = '{}'; \
     $s.IconLocation = '{},0'; \
     $s.Arguments = '--profile ' + [char]34 + '{}' + [char]34; \
     $s.Save()",
    clean_name, exe_path, exe_path, profile_id
);
```

**Pembelajaran Penting (Pencegahan Error):**
1. **Aturan Escaping Quote PowerShell**: Gunakan `[char]34` untuk merepresentasikan karakter tanda petik ganda (`"`) di dalam perintah PowerShell agar tidak menimbulkan parser error `UnexpectedToken`.
2. **Memaksa Icon Binary (`IconLocation`)**: Selalu sertakan `$s.IconLocation = '$exe_path,0'` agar Windows Explorer memuat icon yang tertanam di dalam binary `.exe` secara presisi tanpa terkecoh cache ikon lama.
3. **Perilaku Overwrite**: Pembuatan shortcut berbasis nama profil (`<Nama_Profil>.lnk`). Menyimpan ulang profil yang sama akan **menimpa (*overwrite*)** file shortcut di Desktop tanpa membuat duplikat.

---

## 🎨 3. Desain & Pemprosesan Icon Transparan (Windows Taskbar)

1. **Auto-Cropping Transparent Padding**:
   - Gambar sumber icon tidak boleh memiliki margin transparan kosong yang terlalu luas di sekeliling logonya.
   - Semua margin kosong dipotong (*auto-cropped*) hingga menyisakan margin proporsional (4%) agar icon terlihat **sama besar, tegas, dan sejajar** dengan aplikasi Windows native lainnya pada Taskbar dan Desktop.
2. **Multi-Resolution Windows ICO**:
   - File `icon.ico` di-generate menyertakan resolusi `32x32`, `48x48`, `64x64`, `128x128`, dan `256x256` dengan alpha channel RGBA murni.

---

## ⚡ 4. Optimasi Kecepatan Kompilasi (Build & Cargo Speed-Up)

### A. LLD Linker untuk Windows (`.cargo/config.toml`)
Linker bawaan MSVC diganti dengan `rust-lld.exe` untuk mempercepat proses linking hingga **3x - 5x lebih cepat**:

```toml
[target.x86_64-pc-windows-msvc]
linker = "rust-lld.exe"
```

### B. Optimasi Profile Development (`Cargo.toml`)
Mematikan generasi debug info berukuran besar saat development untuk mempercepat `cargo check` dan build dev:

```toml
[profile.dev]
opt-level = 0
debug = 0
incremental = true

[profile.dev.package."*"]
opt-level = 1
```

---

## ⚙️ 5. Automated CI/CD GitHub Actions (`release.yml`)

1. **Trigger Tag & Release**: Workflow berjalan otomatis saat Git Tag `v*` di-push atau rilis baru dipublikasikan.
2. **Opsi Release Automation (`tauri-action`)**:
   Sertakan `releaseName` dan `releaseBody` pada `tauri-action` agar runner dapat otomatis membuat halaman GitHub Release dan mengunggah installer `.msi`:
   ```yaml
   with:
     tagName: v__VERSION__
     releaseName: 'Kiosk Desktop Viewer v__VERSION__'
     releaseBody: 'Release otomatis Kiosk Desktop Viewer v__VERSION__ (Installer .msi Windows).'
     releaseDraft: false
     prerelease: false
     args: --target x86_64-pc-windows-msvc --bundles msi
   ```
3. **Caching**: Menggunakan `swatinem/rust-cache@v2` dan `cache: 'pnpm'` pada Node.js 24 untuk menghemat waktu kompilasi rilis di cloud.
4. **Updater Signing Keys**: `tauri-action` membaca `TAURI_SIGNING_PRIVATE_KEY` dan `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` dari GitHub Repository Secrets untuk menandatangani bundel installer dan meng-generate file `latest.json` secara otomatis.

---

## 🔄 6. Arsitektur In-App Auto Updater (Tauri v2)

1. **Plugin Updater**: Menggunakan plugin `tauri-plugin-updater = "2"`.
2. **Kriptografi & Verifikasi**:
   - Private key (`src-tauri/updater.key`) diabaikan oleh `.gitignore` dan wajib dimasukkan ke GitHub Secrets (`TAURI_SIGNING_PRIVATE_KEY`).
   - Public key dikonfigurasi di `tauri.conf.json` pada `plugins.updater.pubkey`.
   - Endpoint updater mengarah ke GitHub Release: `https://github.com/yudistirasd/kiosk-desktop-viewer/releases/latest/download/latest.json`.
3. **UI & User Experience**:
   - Tersedia menu **Setting &rarr; Periksa Pembaruan...** pada window menu serta tombol periksa pembaruan di modal Setting.
   - Pengecekan otomatis berjalan tanpa memblokir startup (background check setelah 3.5 detik).
   - Dialog pembaruan interaktif dilengkapi badge versi saat ini vs terbaru, catatan rilis (*release notes*), serta progress bar unduhan *real-time*.
