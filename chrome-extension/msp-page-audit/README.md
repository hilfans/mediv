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

Semua pengecekan berjalan hanya untuk **tab yang sedang aktif**, dipicu saat
ikon ekstensi diklik. Tidak ada crawl banyak halaman dan tidak ada
pemeriksaan situs lain di luar tab aktif pada versi ini — jadi dashboard
skor di laporan lengkap merepresentasikan **satu halaman**, bukan hasil
crawl seluruh situs.

## Izin yang dipakai

`activeTab`, `scripting`, dan `storage` (untuk menyimpan sementara hasil
audit terakhir agar bisa dibaca ulang oleh halaman laporan). Tidak ada
`host_permissions` yang diminta saat instalasi, sehingga Chrome tidak
menampilkan peringatan "membaca dan mengubah data di semua situs".
Ekstensi hanya mendapat akses ke tab yang sedang aktif, dan hanya saat
ikonnya benar-benar diklik.

## Arsitektur kode

`report-model.js` berisi seluruh logika inti (ekstraksi DOM, pengecekan
header/robots.txt, evaluasi & skoring) dan dipakai bersama oleh `popup.js`
(ringkasan compact) dan `report.js` (dashboard lengkap), supaya keduanya
selalu konsisten dari satu sumber logika.

## Cara memasang untuk pengujian (mode developer)

1. Buka `chrome://extensions` di Chrome.
2. Aktifkan **Developer mode** (kanan atas).
3. Klik **Load unpacked**, pilih folder `chrome-extension/msp-page-audit/`.
4. Ikon MSP Page Audit akan muncul di toolbar. Buka halaman apa pun
   (misalnya `https://www.msp.web.id`), klik ikonnya untuk menjalankan audit.

Untuk publish ke Chrome Web Store nanti, folder ini tinggal di-zip dan
diunggah lewat Chrome Web Store Developer Dashboard (perlu akun developer
terdaftar, ada biaya pendaftaran satu kali dari Google).

## Batasan yang disengaja (v1)

- **Broken-link checker lintas domain** dan **crawl banyak halaman** belum
  ada di v1. Fitur ini butuh izin akses ke situs lain (`host_permissions`)
  yang sebaiknya diminta saat runtime (bukan dipaksa saat instalasi) —
  direncanakan sebagai v2.
- **DA (Domain Authority), backlink, dan traffic** sengaja tidak
  disertakan — data ini hanya ada di database proprietary Moz/Ahrefs/SEMrush
  dan butuh API berbayar pihak ketiga (sudah dibahas terpisah).
- Deteksi JSON-LD bersifat ringan (jumlah blok & tipe), bukan validator
  penuh terhadap spesifikasi schema.org.

## Soal asal-usul kode

Ekstensi ini ditulis ulang dari nol berdasarkan konsep pemeriksaan SEO/teknis
yang bersifat umum dan standar industri (title/meta length, broken link,
robots.txt, header keamanan, dsb. — konsep yang sama dipakai Lighthouse,
Screaming Frog, dan tools SEO lain). Tidak ada kode dari ekstensi pihak
ketiga manapun yang disalin ke dalam proyek ini.
