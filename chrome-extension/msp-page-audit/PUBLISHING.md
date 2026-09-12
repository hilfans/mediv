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
fitur Crawl Situs, Cek Kecepatan, dan fitur AI Gemini).

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
   permission (`activeTab`, `scripting`, `storage`, dan ketiga optional
   host permission) — jelaskan singkat sesuai fungsinya masing-masing
   (lihat README.md bagian "Izin yang dipakai" sebagai referensi).

## 5. Aktifkan HTTP referrer restriction untuk KEDUA API key

Langkah ini sama persis untuk API key **PageSpeed Insights** dan API key
**Gemini** — keduanya perlu dibatasi terpisah (masing-masing adalah key
yang berbeda, dibuat di tempat berbeda: PSI dari Google Cloud Console,
Gemini biasanya dari Google AI Studio, tapi Application restriction
diatur dari tempat yang sama: Google Cloud Console → Credentials, karena
Google AI Studio membuat key di bawah proyek Google Cloud juga).

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

## Catatan tambahan

- Kalau suatu saat ekstensi di-upload ulang sebagai *item baru* (bukan
  update dari item yang sama), ID-nya akan berbeda dan referrer di
  Google Cloud Console (untuk KEDUA key) perlu diperbarui.
- Restriction ini independen dari status publish (Public/Unlisted/
  Private testers) — begitu ID diketahui dari langkah 3, langkah 5 bisa
  langsung dikerjakan kapan saja, tidak perlu menunggu review Google
  selesai.
- Fitur Gemini murni opsional (lihat README.md) — kalaupun API key
  Gemini belum/tidak pernah diisi pengguna, seluruh fitur lain ekstensi
  tetap berfungsi normal.
