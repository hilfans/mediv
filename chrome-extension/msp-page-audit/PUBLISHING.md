# Checklist Publish ke Chrome Web Store & Amankan API Key

Panduan ini disiapkan supaya saat ekstensi ini siap di-publish, tinggal
diikuti tanpa perlu mikir ulang urutannya. **Tidak ada kode yang perlu
diubah untuk bagian keamanan API key** — semuanya pengaturan di Google
Cloud Console / Google AI Studio, dilakukan SETELAH ekstensi diupload
(belum perlu publik).

## 1. Registrasi developer Chrome Web Store (kalau belum)

1. Buka [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Daftar dengan akun Google yang akan jadi pemilik ekstensi (sebaiknya
   akun organisasi PT MSP, bukan akun pribadi).
3. Bayar biaya registrasi satu kali (sekitar USD 5) kalau diminta.

## 2. Publikasikan Kebijakan Privasi

Chrome Web Store **mewajibkan** URL kebijakan privasi yang bisa diakses
publik untuk ekstensi yang meminta host permission seperti ini (dipakai
fitur Crawl Situs, Cek Kecepatan, fitur AI Gemini, dan Cek Backlink Bing
Webmaster Tools).

1. Isi tanggal berlaku di `PRIVACY.md` (folder sumber ekstensi ini).
2. Publikasikan isinya sebagai halaman di **msp.web.id** (mis.
   `msp.web.id/privasi-msp-page-audit` atau URL lain yang mudah diingat)
   — hapus baris "Catatan penerbitan" di bagian atas file sebelum
   dipublikasikan.
3. Catat URL halaman tersebut, akan dibutuhkan di langkah 4.

## 3. Upload draft ekstensi (belum perlu publish publik)

1. Zip **isi** folder `chrome-extension/msp-page-audit/` (bukan folder
   induknya) — pastikan `manifest.json` ada di root file zip, bukan di
   dalam subfolder. **Jangan sertakan** `PUBLISHING.md`/`PRIVACY.md`
   dalam zip (file dokumentasi ini bukan bagian dari paket ekstensi).
2. Di Developer Dashboard, klik **New Item**, upload file zip tadi.
3. Setelah upload berhasil, dashboard akan menampilkan **Extension ID**
   (contoh format: `abcdefghijklmnopabcdefghijklmnop`, 32 huruf kecil).
   **ID ini sudah tetap/final sejak upload pertama ini** — tidak berubah
   lagi meskipun listing-nya masih berstatus draft/belum di-review/belum
   publik. Catat ID ini, dibutuhkan di langkah 5.

## 4. Isi listing & data usage disclosure

1. Isi deskripsi, screenshot, kategori, dsb. seperti biasa.
2. Di tab **Privacy practices**, tempel URL kebijakan privasi dari
   langkah 2, lalu centang jenis data yang diproses ekstensi sesuai
   `PRIVACY.md`: minimal **Website content** (konten halaman yang
   diaudit). Isi juga field **"Single purpose"** dan justifikasi tiap
   permission (`activeTab`, `scripting`, `storage`, dan keempat optional
   host permission, termasuk `https://ssl.bing.com/*` untuk fitur Cek
   Backlink) — jelaskan singkat sesuai fungsinya masing-masing (lihat
   README.md bagian "Izin yang dipakai" sebagai referensi).

## 5. Aktifkan HTTP referrer restriction untuk API key PageSpeed Insights & Gemini

Langkah ini sama persis untuk API key **PageSpeed Insights** dan API key
**Gemini** — keduanya perlu dibatasi terpisah (masing-masing adalah key
yang berbeda, dibuat di tempat berbeda: PSI dari Google Cloud Console,
Gemini biasanya dari Google AI Studio, tapi Application restriction
diatur dari tempat yang sama: Google Cloud Console → Credentials, karena
Google AI Studio membuat key di bawah proyek Google Cloud juga).

**Catatan: langkah ini TIDAK berlaku untuk API key Bing Webmaster
Tools** — lihat bagian "API key Bing Webmaster Tools tidak punya
proteksi referrer" di bawah untuk penjelasan & mitigasinya.

1. Buka [Google Cloud Console &rarr; APIs & Services &rarr; Credentials](https://console.cloud.google.com/apis/credentials).
2. Untuk **API key PageSpeed Insights** (sudah dibatasi ke PageSpeed
   Insights API saja):
   - Di bagian **Application restrictions**, pilih **Websites** /
     **HTTP referrers**.
   - Klik **Add an item**, isi dengan pola persis:
     ```
     chrome-extension://ID_EKSTENSI_DARI_LANGKAH_3/*
     ```
   - Klik **Save**.
3. Ulangi langkah yang sama untuk **API key Gemini** (pastikan API
   restriction key ini dibatasi ke **Generative Language API** saja
   terlebih dahulu, baru tambahkan HTTP referrer restriction dengan pola
   yang sama persis seperti di atas).

Setelah ini, kedua key HANYA mau dipakai kalau permintaan datang dari
halaman ekstensi ini sendiri (`speed.html`, `report.html`, dkk.) — dicuri
dan dipakai dari script atau situs lain akan otomatis ditolak Google
(respons error `API_KEY_HTTP_REFERRER_BLOCKED` / sejenisnya).

## 6. Uji restriction-nya benar-benar aktif

1. Buka ekstensi yang sudah terpasang (dari hasil upload di atas, lewat
   mode developer/testing), jalankan fitur **Cek Kecepatan** dan
   **Analisis dengan AI (Gemini)** seperti biasa — keduanya harus tetap
   berhasil seperti sebelumnya.
2. Untuk memastikan proteksinya benar-benar berfungsi (bukan cuma
   tersimpan di pengaturan tapi tidak dicek): coba salin URL/permintaan
   yang sama (lihat di tab Network DevTools saat menjalankan fitur
   terkait) lalu buka di tab browser biasa (bukan dari ekstensi) atau
   panggil lewat `curl`. Ini SEHARUSNYA gagal dengan error terkait
   referrer, membuktikan key sudah tidak bisa dipakai dari luar ekstensi.

## 7. API key Bing Webmaster Tools tidak punya proteksi referrer

Berbeda dari Google Cloud Console (yang punya **Application restriction
&rarr; HTTP referrers** seperti dipakai di langkah 5), **Bing Webmaster
Tools tidak menyediakan mekanisme pembatasan serupa** untuk API key-nya.
Ini bukan sesuatu yang bisa diperbaiki dari sisi konfigurasi ekstensi
atau kode — ini keterbatasan platform Bing Webmaster Tools sendiri.

Implikasinya, kalau API key Bing seorang pengguna bocor (mis. lewat
`chrome.storage.local` perangkat yang diakses pihak lain), key itu bisa
dipakai dari mana saja, tidak dibatasi hanya dari ekstensi ini seperti
key PSI/Gemini. Mitigasi yang tersedia hanya:

- **Sebelum publish**: jelaskan keterbatasan ini apa adanya ke pengguna —
  sudah tercermin di kartu Options (`options.html`, bagian API key Bing)
  dan `README.md` (bagian "Cakupan v5"), jangan dihapus/dilunakkan saat
  mengisi listing Chrome Web Store.
- **Kalau key bocor**: satu-satunya pemulihan adalah membuat key baru
  dari dashboard Bing Webmaster Tools (Settings &rarr; API Access) dan
  menghapus key lama — sampaikan ini ke pengguna kalau ditanya.
- Fitur ini tetap **sepenuhnya opsional** (sama seperti Gemini) — kalau
  pengguna tidak mengisi API key Bing, tidak ada key yang tersimpan sama
  sekali untuk berisiko bocor.

## Catatan tambahan

- Kalau suatu saat ekstensi di-upload ulang sebagai *item baru* (bukan
  update dari item yang sama), ID-nya akan berbeda dan referrer di
  Google Cloud Console (untuk key PSI & Gemini) perlu diperbarui. API
  key Bing tidak terpengaruh langkah ini karena memang tidak punya
  referrer restriction untuk diperbarui (lihat Bagian 7).
- Restriction ini independen dari status publish (Public/Unlisted/
  Private testers) — begitu ID diketahui dari langkah 3, langkah 5 bisa
  langsung dikerjakan kapan saja, tidak perlu menunggu review Google
  selesai.
- Fitur Gemini dan Cek Backlink (Bing Webmaster Tools) murni opsional
  (lihat README.md) — kalaupun API key-nya belum/tidak pernah diisi
  pengguna, seluruh fitur lain ekstensi tetap berfungsi normal.
