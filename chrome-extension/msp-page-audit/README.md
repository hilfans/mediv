# MSP Page Audit — Ekstensi Chrome

Ekstensi audit SEO on-page, keamanan header, dan caching untuk halaman yang
sedang dibuka di tab aktif. Dibangun dari nol (bukan hasil bongkar ekstensi
pihak ketiga mana pun) — lihat catatan lisensi di bagian bawah.

## Cakupan v1

- **SEO on-page**: title, meta description, H1 & urutan heading, canonical,
  meta robots, meta viewport, jumlah kata, jumlah tautan internal/eksternal.
- **Sosial & data terstruktur**: Open Graph, Twitter Card, deteksi ringan
  JSON-LD (jumlah blok + tipe schema.org yang ditemukan).
- **Gambar**: total gambar & yang tanpa atribut `alt`.
- **Keamanan**: HTTPS, HSTS, X-Content-Type-Options, proteksi clickjacking
  (X-Frame-Options / CSP frame-ancestors), Content-Security-Policy.
- **Performa & caching**: Cache-Control/Expires, Content-Encoding (kompresi).
- **Robots & sitemap**: keberadaan `robots.txt` (+ entri Sitemap, deteksi
  `Disallow: /` yang memblokir semua crawler), keberadaan `/sitemap.xml`.
- **Laporan lengkap & ekspor PDF**: dashboard skor keseluruhan (ring chart),
  skor per kategori dengan progress bar, kartu ringkasan Lolos/Perhatian/
  Bermasalah, dan rincian semua pemeriksaan — dibuka di tab baru
  (`report.html`) lewat tombol di popup. Ada kolom opsional "Disiapkan
  untuk" (nama klien) untuk laporan yang mau dikirim ke prospek. Tombol
  "Unduh sebagai PDF" memicu dialog cetak browser (`window.print()`) —
  pilih tujuan **Simpan sebagai PDF**, tanpa perlu library PDF tambahan.

Semua pengecekan di atas berjalan hanya untuk **tab yang sedang aktif**,
dipicu saat ikon ekstensi diklik.

## Cakupan v2 — Crawl Situs & Broken Link Checker

Dibuka lewat tombol **"Crawl Situs & Cek Broken Link"** di popup atau
laporan lengkap (`crawl.html`):

- Menjelajahi situs target mulai dari `sitemap.xml` (ikut satu tingkat ke
  dalam bila berupa sitemap index), dengan fallback ke penelusuran tautan
  internal apabila sitemap tidak ada.
- Menghormati `robots.txt` (`Disallow` untuk `User-agent: *`) — path yang
  di-*disallow* tidak ikut di-crawl. **Penyederhanaan yang disengaja**:
  pencocokan aturan pakai *prefix match* biasa, tanpa wildcard `*`/`$`
  seperti spesifikasi robots.txt lengkap.
- Mengaudit tiap halaman HTML yang ditemukan (memakai logika evaluasi yang
  sama dengan audit satu halaman) dan mendeteksi **redirect** (301/302, dsb).
- Memeriksa status semua tautan yang ditemukan (internal & eksternal) untuk
  mencari **broken link** (4xx/5xx atau gagal terhubung).
- 4 tingkatan yang bisa dipilih pengguna: Light (50 halaman), Medium (200),
  Heavy (500), Ultra (1000) — dengan modal konfirmasi wajib disetujui
  sebelum crawl jalan, karena aktivitas ini membebani server situs target.
- Hasil crawl bisa diekspor ke PDF juga (`window.print()`, sama seperti
  laporan satu halaman).

**Izin tambahan**: fitur ini butuh akses ke domain di luar tab aktif, jadi
`http://*/*` dan `https://*/*` didaftarkan sebagai **optional host
permission** — Chrome baru menampilkan dialog persetujuan saat pengguna
benar-benar mengklik "Setuju & Lanjutkan" pada modal konfirmasi, BUKAN saat
ekstensi pertama kali dipasang. Kalau pengguna menolak, fitur crawl
dibatalkan tapi audit satu halaman di popup tetap berfungsi normal.

## Izin yang dipakai

- `activeTab`, `scripting`, `storage` — wajib, terpasang sejak instalasi,
  tanpa dialog peringatan khusus.
- `http://*/*`, `https://*/*` — **opsional**, baru diminta saat pengguna
  mengaktifkan fitur Crawl Situs (lihat di atas).

## Arsitektur kode

- `report-model.js` — logika inti audit satu halaman (ekstraksi DOM lewat
  `chrome.scripting`, pengecekan header/robots.txt, evaluasi & skoring).
  Dipakai bersama oleh `popup.js` dan `report.js`.
- `crawl-engine.js` — mesin crawl BFS + pengecek broken link, berjalan di
  konteks `crawl.html` sendiri (bukan disuntik ke tab manapun), memakai
  `fetch` langsung karena sudah punya optional host permission. Memakai
  ulang `mspEvaluate()` dari `report-model.js` untuk menilai tiap halaman
  hasil crawl secara konsisten dengan audit satu halaman.

## Cara memasang untuk pengujian (mode developer)

1. Buka `chrome://extensions` di Chrome.
2. Aktifkan **Developer mode** (kanan atas).
3. Klik **Load unpacked**, pilih folder `chrome-extension/msp-page-audit/`.
4. Ikon MSP Page Audit akan muncul di toolbar. Buka halaman apa pun
   (misalnya `https://www.msp.web.id`), klik ikonnya untuk menjalankan audit.

Untuk publish ke Chrome Web Store nanti, folder ini tinggal di-zip dan
diunggah lewat Chrome Web Store Developer Dashboard (perlu akun developer
terdaftar, ada biaya pendaftaran satu kali dari Google).

## Batasan yang disengaja

- **DA (Domain Authority), backlink, dan traffic** sengaja tidak
  disertakan — data ini hanya ada di database proprietary Moz/Ahrefs/SEMrush
  dan butuh API berbayar pihak ketiga (sudah dibahas terpisah).
- Deteksi JSON-LD bersifat ringan (jumlah blok & tipe), bukan validator
  penuh terhadap spesifikasi schema.org.
- Crawl v2 bukan crawler penuh ala mesin pencari: konkurensi & jeda antar
  request dibuat tetap (bukan makin agresif di tingkat Heavy/Ultra — cuma
  jumlah halamannya yang beda), dan link ke aset non-HTML (PDF, gambar,
  dst.) yang ditemukan lewat `<a href>` tetap di-GET penuh sebelum ketahuan
  bukan halaman (potensi boros bandwidth untuk aset besar) — cukup untuk
  situs skala UKM/menengah, belum dioptimalkan untuk crawl skala besar.

## Soal asal-usul kode

Ekstensi ini ditulis ulang dari nol berdasarkan konsep pemeriksaan SEO/teknis
yang bersifat umum dan standar industri (title/meta length, broken link,
robots.txt, header keamanan, dsb. — konsep yang sama dipakai Lighthouse,
Screaming Frog, dan tools SEO lain). Tidak ada kode dari ekstensi pihak
ketiga manapun yang disalin ke dalam proyek ini.
