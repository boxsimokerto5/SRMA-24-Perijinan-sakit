# Panduan Build APK SRMA 24 Kediri via GitHub Actions

Aplikasi ini telah dikonfigurasi menggunakan **Capacitor** untuk diubah menjadi aplikasi Android (APK).

## Cara Menggunakan GitHub Actions:
1. **Push ke GitHub:** Pastikan semua file (termasuk `.github/workflows/android_build.yml` dan `capacitor.config.json`) sudah di-push ke repositori GitHub Anda.
2. **Jalankan Workflow:**
   - Buka tab **Actions** di repositori GitHub Anda.
   - Pilih workflow **"Build Android APK"**.
   - Klik **"Run workflow"**.
3. **Unduh APK:** Setelah proses selesai (sekitar 5-10 menit), file APK akan tersedia di bagian **Artifacts** di bawah hasil build.

## Tentang Keystore Otomatis:
Workflow ini telah dikonfigurasi untuk membuat **Keystore otomatis** menggunakan perintah `keytool`. 
- **Alias:** `srma-alias`
- **Password:** `mypassword`
- **Lokasi:** `release-key.keystore`

> **Catatan Keamanan:** Untuk rilis produksi ke Google Play Store, sangat disarankan untuk membuat keystore secara manual dan menyimpannya di **GitHub Secrets** daripada membuatnya secara otomatis di dalam script.

## Perintah Lokal (Jika ingin build di laptop sendiri):
1. `npm install`
2. `npm run build`
3. `npm run cap:add` (Hanya sekali)
4. `npm run cap:sync`
5. `npm run cap:open` (Membuka Android Studio)
