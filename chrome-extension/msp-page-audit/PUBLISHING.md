# Checklist Publish ke Chrome Web Store & Amankan API Key PSI

Panduan ini disiapkan supaya saat ekstensi ini siap di-publish, tinggal
diikuti tanpa perlu mikir ulang urutannya. **Tidak ada kode yang perlu
diubah untuk bagian keamanan API key** — semuanya pengaturan di Google
Cloud Console, dilakukan SETELAH ekstensi diupload (belum perlu publik).

## 1. Registrasi developer Chrome Web Store (kalau belum)

1. Buka [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Daftar dengan akun Google yang akan jadi pemilik ekstensi (sebaiknya
   akun organisasi PT MSP, bukan akun pribadi).
3. Bayar biaya registrasi satu kali (sekitar USD 5) kalau diminta.

## 2. Upload draft ekstensi (belum perlu publish publik)

1. Zip **isi** folder `chrome-extension/msp-page-audit/` (bukan folder
   induknya) — pastikan `manifest.json` ada di root file zip, bukan di
   dalam subfolder.
2. Di Developer Dashboard, klik **New Item**, upload file zip tadi.
3. Setelah upload berhasil, dashboard akan menampilkan **Extension ID**
   (contoh format: `abcdefghijklmnopabcdefghijklmnop`, 32 huruf kecil).
   **ID ini sudah tetap/final sejak upload pertama ini** — tidak berubah
   lagi meskipun listing-nya masih berstatus draft/belum di-review/belum
   publik. Catat ID ini.
4. Boleh langsung lanjut isi listing (deskripsi, screenshot, dsb.) atau
   tunda dulu — yang penting untuk langkah keamanan di bawah, ID-nya
   sudah cukup.

## 3. Aktifkan HTTP referrer restriction di Google Cloud Console

1. Buka [Google Cloud Console &rarr; APIs & Services &rarr; Credentials](https://console.cloud.google.com/apis/credentials).
2. Klik API key yang dipakai untuk PageSpeed Insights API (yang sudah
   Anda batasi ke PageSpeed Insights API saja).
3. Di bagian **Application restrictions**, pilih **Websites** /
   **HTTP referrers**.
4. Klik **Add an item**, isi dengan pola persis:
   ```
   chrome-extension://ID_EKSTENSI_DARI_LANGKAH_2/*
   ```
   Ganti `ID_EKSTENSI_DARI_LANGKAH_2` dengan ID asli dari langkah 2.
5. Klik **Save**.

Setelah ini, key HANYA mau dipakai kalau permintaan datang dari halaman
ekstensi ini sendiri (`speed.html` dkk.) — dicuri dan dipakai dari script
atau situs lain akan otomatis ditolak Google (respons error
`API_KEY_HTTP_REFERRER_BLOCKED` / sejenisnya).

## 4. Uji restriction-nya benar-benar aktif

1. Buka ekstensi yang sudah terpasang (dari hasil upload di atas, lewat
   mode developer/testing), jalankan fitur **Cek Kecepatan** seperti
   biasa — harus tetap berhasil seperti sebelumnya.
2. Untuk memastikan proteksinya benar-benar berfungsi (bukan cuma
   tersimpan di pengaturan tapi tidak dicek): coba salin URL permintaan
   PSI API yang sama (lihat di tab Network DevTools saat menjalankan cek
   kecepatan) lalu buka di tab browser biasa (bukan dari ekstensi) atau
   panggil lewat `curl`. Ini SEHARUSNYA gagal dengan error terkait
   referrer, membuktikan key sudah tidak bisa dipakai dari luar ekstensi.

## Catatan tambahan

- Kalau suatu saat ekstensi di-upload ulang sebagai *item baru* (bukan
  update dari item yang sama), ID-nya akan berbeda dan referrer di
  Google Cloud Console perlu diperbarui.
- Restriction ini independen dari status publish (Public/Unlisted/
  Private testers) — begitu ID diketahui dari langkah 2, langkah 3 bisa
  langsung dikerjakan kapan saja, tidak perlu menunggu review Google
  selesai.
