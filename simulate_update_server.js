import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8080;
const TAURI_CONF_PATH = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
const BACKUP_CONF_PATH = path.join(__dirname, 'src-tauri', 'tauri.conf.json.backup');
const KEY_PATH = path.join(__dirname, 'src-tauri', 'updater.key');
const MOCK_MSI_PATH = path.join(__dirname, 'mock-installer.msi');
const MOCK_SIG_PATH = path.join(__dirname, 'mock-installer.msi.sig');

let originalConfContent = null;

// Cleanup & restore tauri.conf.json on exit
function cleanup() {
  console.log('\n[Simulasi] Membersihkan file sementara & mengembalikan tauri.conf.json...');
  try {
    if (originalConfContent && fs.existsSync(TAURI_CONF_PATH)) {
      fs.writeFileSync(TAURI_CONF_PATH, originalConfContent, 'utf-8');
      console.log('[Simulasi] tauri.conf.json berhasil dikembalikan ke konfigurasi GitHub Release.');
    }
    if (fs.existsSync(BACKUP_CONF_PATH)) {
      fs.unlinkSync(BACKUP_CONF_PATH);
    }
    if (fs.existsSync(MOCK_MSI_PATH)) {
      fs.unlinkSync(MOCK_MSI_PATH);
    }
    if (fs.existsSync(MOCK_SIG_PATH)) {
      fs.unlinkSync(MOCK_SIG_PATH);
    }
  } catch (err) {
    console.error('[Simulasi] Gagal membersihkan:', err.message);
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

async function main() {
  console.log('====================================================');
  console.log('  🚀 Kiosk Desktop Viewer - Local Update Simulator');
  console.log('====================================================\n');

  // 1. Check updater private key
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`[Error] File private key ${KEY_PATH} tidak ditemukan!`);
    process.exit(1);
  }

  // 2. Generate a mock installer payload (~8 MB)
  console.log('[1/4] Membuat mock installer payload (~8 MB)...');
  const buffer = Buffer.alloc(8 * 1024 * 1024, 0xAA);
  // Header marker
  buffer.write('MOCK_KIOSK_VIEWER_MSI_PACKAGE_V0_3_0', 0, 'utf-8');
  fs.writeFileSync(MOCK_MSI_PATH, buffer);

  // 3. Sign the mock installer using Tauri CLI
  console.log('[2/4] Menandatangani mock installer dengan private key...');
  try {
    // Run signer with empty password env
    execSync(`pnpm tauri signer sign -f "${KEY_PATH}" "${MOCK_MSI_PATH}"`, {
      stdio: 'pipe',
      env: {
        ...process.env,
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ''
      }
    });
  } catch (err) {
    console.warn('[Peringatan] Signer command output:', err.stdout?.toString() || err.message);
  }

  let signature = '';
  if (fs.existsSync(MOCK_SIG_PATH)) {
    signature = fs.readFileSync(MOCK_SIG_PATH, 'utf-8').trim();
    console.log('[✓] Signature berhasil dibuat!');
  } else {
    console.error('[Error] Gagal mendapatkan file signature .sig');
    cleanup();
    process.exit(1);
  }

  // 4. Update tauri.conf.json endpoint to localhost
  console.log('[3/4] Mengatur endpoint updater di tauri.conf.json ke localhost...');
  originalConfContent = fs.readFileSync(TAURI_CONF_PATH, 'utf-8');
  fs.writeFileSync(BACKUP_CONF_PATH, originalConfContent, 'utf-8');

  try {
    const conf = JSON.parse(originalConfContent);
    if (!conf.plugins) conf.plugins = {};
    if (!conf.plugins.updater) conf.plugins.updater = {};
    conf.plugins.updater.endpoints = [`http://127.0.0.1:${PORT}/latest.json`];
    fs.writeFileSync(TAURI_CONF_PATH, JSON.stringify(conf, null, 2), 'utf-8');
    console.log(`[✓] Endpoint sementara diatur ke http://127.0.0.1:${PORT}/latest.json`);
  } catch (err) {
    console.error('[Error] Gagal memperbarui tauri.conf.json:', err);
    cleanup();
    process.exit(1);
  }

  // 5. Start HTTP server
  console.log('[4/4] Memulai HTTP server simulasi...');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (pathname === '/latest.json') {
      console.log(`[HTTP GET] ${pathname} -> Mengirim manifest pembaruan versi v0.3.0`);
      const payload = {
        version: '0.3.0',
        notes: "🚀 Pembaruan Simulasi Kiosk Desktop Viewer v0.3.0:\n• Peningkatan kecepatan rendering webview\n• Fitur buka otomatis di monitor tertentu (Layar 1 / 2)\n• Loading state saat membuat shortcut desktop\n• Perbaikan stabilitas memori aplikasi",
        pub_date: new Date().toISOString(),
        platforms: {
          'windows-x86_64': {
            signature: signature,
            url: `http://127.0.0.1:${PORT}/kiosk-desktop-viewer_0.3.0_x64_en-US.msi`
          }
        }
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload, null, 2));
      return;
    }

    if (pathname === '/kiosk-desktop-viewer_0.3.0_x64_en-US.msi') {
      console.log(`[HTTP GET] ${pathname} -> Mengalirkan file installer (~8 MB) dengan simulasi kecepatan unduh...`);
      const stat = fs.statSync(MOCK_MSI_PATH);
      res.writeHead(200, {
        'Content-Type': 'application/x-msi',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="kiosk-desktop-viewer_0.3.0_x64_en-US.msi"'
      });

      // Stream file with small throttle so user can see progress bar increment
      const stream = fs.createReadStream(MOCK_MSI_PATH, { highWaterMark: 256 * 1024 }); // 256 KB chunks
      let sentBytes = 0;

      const sendNextChunk = () => {
        const chunk = stream.read();
        if (chunk !== null) {
          sentBytes += chunk.length;
          res.write(chunk);
          // 40ms delay per 256KB ≈ ~6 MB/s realistic download speed
          setTimeout(sendNextChunk, 40);
        }
      };

      stream.on('readable', sendNextChunk);
      stream.on('end', () => {
        res.end();
        console.log(`[HTTP DONE] Pengunduhan installer selesai (${(sentBytes / (1024 * 1024)).toFixed(1)} MB terkirim)!`);
      });

      stream.on('error', (err) => {
        console.error('[HTTP ERROR] Gagal streaming file:', err);
        res.destroy(err);
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n====================================================`);
    console.log(`  ✅ Server Simulasi Update Aktif di:`);
    console.log(`     👉 http://127.0.0.1:${PORT}/latest.json`);
    console.log(`====================================================`);
    console.log(`\n💡 CARA MENCOBA:`);
    console.log(`1. Biarkan terminal ini tetap berjalan.`);
    console.log(`2. Buka terminal baru lalu jalankan aplikasi:`);
    console.log(`   pnpm dev`);
    console.log(`3. Di aplikasi, buka menu "Setting" -> "Periksa Pembaruan...":`);
    console.log(`   - Dialog update akan langsung muncul mendeteksi v0.3.0.`);
    console.log(`   - Klik "Unduh & Pasang Sekarang" untuk melihat animasi progress bar & persentase unduhan real-time!`);
    console.log(`\n(Tekan Ctrl+C di terminal ini kapan saja untuk menutup server & otomatis mengembalikan tauri.conf.json)\n`);
  });
}

main().catch((err) => {
  console.error('[Error]:', err);
  cleanup();
});
