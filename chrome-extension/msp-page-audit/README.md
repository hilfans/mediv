# MSP Page Audit — Ekstensi Chrome

Ekstensi audit SEO on-page, keamanan header, dan caching untuk halaman yang
sedang dibuka di tab aktif. Dibangun dari nol (bukan hasil bongkar ekstensi
pihak ketiga mana pun) — lihat catatan lisensi di bagian bawah.

## Cakupan v1

- **SEO on-page**: title (ideal 30&ndash;60 karakter), meta description
  (ideal 70&ndash;160 karakter), H1 & **hierarki heading lengkap**
  (ditampilkan berjenjang H1/H2/H3/dst., bukan cuma jumlahnya), canonical,
  meta robots, meta viewport, jumlah kata, dan **rincian tautan** internal
  maupun eksternal (daftar URL-nya, bisa dibuka lewat "Lihat rincian
  tautan" di laporan lengkap — bukan cuma angka jumlahnya).
- **Sosial, Data Terstruktur & AI Bot**: Open Graph (dipakai Facebook,
  LinkedIn, dan otomatis jadi fallback X/Twitter kalau `twitter:card` tidak
  dipasang — makanya Twitter Card tidak dicek terpisah), serta **JSON-LD
  (Schema Markup)** yang diperkuat: mengecek apakah tipe skema yang
  ditemukan termasuk tipe penting untuk bot AI (ChatGPT/Perplexity) dan
  Google seperti `Organization`, `WebSite`, `Article`, atau `Product`.
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
  Ada juga legenda badge (✓/!/✕/i) dan info batas karakter title/meta
  description di bagian atas laporan.

Semua pengecekan di atas berjalan hanya untuk **tab yang sedang aktif**,
dipicu saat ikon ekstensi diklik.

## Cakupan v2 — Crawl Situs & Broken Link Checker

Dibuka lewat tombol **"Crawl Situs & Cek Broken Link"** di popup atau
laporan lengkap (`crawl.html`):

- Menjelajahi situs target mulai dari `sitemap.xml` (ikut satu tingkat ke
  dalam bila berupa sitemap index), dengan fallback ke penelusuran tautan
  internal apabila sitemap tidak ada.
- **Halaman yang dilarang `robots.txt` atau ber-`noindex` TETAP di-crawl**
  (tidak di-skip), lalu diberi catatan "Diblokir robots.txt" / "noindex" di
  tabel hasil — supaya webmaster langsung ketahuan kalau ada halaman
  penting yang ternyata salah konfigurasi (ke-block/ke-noindex tanpa
  sengaja). Yang dibatasi hanya: halaman semacam ini tidak dipakai sebagai
  sumber penemuan tautan baru, supaya crawl tidak melebar ke area yang
  memang sengaja diblokir (mis. `/admin`). **Penyederhanaan yang
  disengaja**: pencocokan aturan `Disallow` pakai *prefix match* biasa,
  tanpa wildcard `*`/`$` seperti spesifikasi robots.txt lengkap.
- Mengaudit tiap halaman HTML yang ditemukan (memakai logika evaluasi yang
  sama dengan audit satu halaman — termasuk title, meta description, dan
  gambar tanpa `alt`, ditampilkan sebagai kolom tersendiri di tabel hasil)
  dan mendeteksi **redirect** (301/302, dsb).
- Memeriksa status semua tautan yang ditemukan (internal & eksternal) untuk
  mencari **broken link** (4xx/5xx atau gagal terhubung). Progres fase ini
  ditampilkan real-time ("Memeriksa tautan (X dari Y)…") supaya tidak
  terlihat seperti macet saat fase crawl-nya sendiri sudah selesai tapi
  pengecekan tautan (yang bisa berjumlah ratusan) masih berjalan.
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

## Cakupan v3 — Cek Kecepatan (Google Lighthouse asli)

Dibuka lewat tombol **"Cek Kecepatan (Google Lighthouse)"** di popup atau
laporan lengkap (`speed.html`). Berbeda dari audit v1/v2 yang memakai
heuristik internal ekstensi, fitur ini memanggil **PageSpeed Insights API
v5** milik Google secara langsung, sehingga hasilnya adalah skor Lighthouse
asli — persis seperti yang tampil di
[pagespeed.web.dev](https://pagespeed.web.dev).

- Skor 4 kategori (Performance, SEO, Accessibility, Best Practices).
- Core Web Vitals data lab (LCP, CLS, TBT, FCP, Speed Index, TTI) dengan
  status good/needs-improvement/poor sesuai ambang batas resmi Google.
- Core Web Vitals data lapangan (CrUX, dari pengguna nyata) kalau
  tersedia — situs dengan traffic kecil biasanya tidak punya data ini,
  dan itu wajar, bukan tanda kegagalan.
- Daftar peluang perbaikan performa terbesar (opportunities), diurutkan
  dari potensi penghematan waktu paling besar.
- Bisa pilih strategi Mobile atau Desktop.
- Diekspor ke PDF dengan cara yang sama (`window.print()`).

Sesuai namanya, fitur ini ditujukan untuk **landing page/homepage**
(satu URL), bukan crawl banyak halaman — memanggil PSI API untuk ratusan
halaman sekaligus akan sangat lambat dan boros kuota API.

### API Key (wajib disiapkan sendiri oleh pengguna)

Fitur ini butuh API key PageSpeed Insights pribadi, diatur lewat halaman
**Options** ekstensi (klik kanan ikon ekstensi &rarr; Options, atau tombol
"Atur API Key" di `speed.html`). **API key TIDAK PERNAH ditulis di kode
sumber ekstensi ini** — kalau ditulis di kode, key itu akan ikut ter-commit
ke repository dan terlihat oleh siapa pun yang membaca/meng-install
ekstensinya. Key disimpan hanya di `chrome.storage.local` milik masing-masing
pengguna, dan dipakai langsung dari browser mereka ke Google — tidak lewat
server PT MSP.

Disarankan membatasi API key di Google Cloud Console: aktifkan hanya
**PageSpeed Insights API**, dan tambahkan batasan kuota harian supaya
dampaknya terbatas kalau key sampai bocor.

**Sebelum publish ke Chrome Web Store**, tambahkan juga proteksi
**Application restriction &rarr; HTTP referrers** (`chrome-extension://<ID
ekstensi>/*`) supaya key hanya bisa dipakai dari ekstensi ini sendiri —
langkah lengkapnya (termasuk cara dapat ID ekstensi yang stabil) ada di
[`PUBLISHING.md`](./PUBLISHING.md).

### Batas 25x/hari (soft limit)

Fitur Cek Kecepatan dibatasi **25 pemakaian per hari per browser**, dilacak
lewat `chrome.storage.local` (kunci `mspSpeedUsageV1`, reset otomatis
begitu tanggal berganti). Kalau limit tercapai, `speed.html` menampilkan
kartu ajakan hubungi PT MSP untuk paket berlangganan tanpa batas harian,
alih-alih form cek kecepatan. Audit satu halaman (v1) dan Crawl Situs (v2)
**tidak** dibatasi karena keduanya tidak memakai API berbayar/berkuota
milik Google.

Ini murni **soft limit**, bukan penegakan yang benar-benar tidak bisa
ditembus: pengguna yang tahu caranya bisa mereset hitungan lewat DevTools
console atau install ulang ekstensi. Fungsinya sebagai pengingat/pendorong
upgrade untuk pengguna umum, bukan jaminan pendapatan dari pengguna yang
berniat menghindar — penegakan yang sungguh-sungguh butuh pelacakan +
lisensi di sisi server, di luar cakupan versi ini.

## Izin yang dipakai

- `activeTab`, `scripting`, `storage` — wajib, terpasang sejak instalasi,
  tanpa dialog peringatan khusus.
- `http://*/*`, `https://*/*` — **opsional**, baru diminta saat pengguna
  mengaktifkan fitur Crawl Situs.
- `https://www.googleapis.com/*` — **opsional**, baru diminta saat
  pengguna pertama kali menjalankan fitur Cek Kecepatan. Dipisah dari
  permission crawl di atas supaya tiap fitur punya jejak izin sendiri
  yang jelas alasannya.

## Arsitektur kode

- `report-model.js` — logika inti audit satu halaman (ekstraksi DOM lewat
  `chrome.scripting`, pengecekan header/robots.txt, evaluasi & skoring).
  Dipakai bersama oleh `popup.js` dan `report.js`.
- `crawl-engine.js` — mesin crawl BFS + pengecek broken link, berjalan di
  konteks `crawl.html` sendiri (bukan disuntik ke tab manapun), memakai
  `fetch` langsung karena sudah punya optional host permission. Memakai
  ulang `mspEvaluate()` dari `report-model.js` untuk menilai tiap halaman
  hasil crawl secara konsisten dengan audit satu halaman.
- `speed-model.js` — fungsi murni untuk menyusun URL permintaan PSI API
  dan mem-parsing responsnya (skor kategori, metrik lab/lapangan, daftar
  opportunity). Tidak menyentuh DOM/chrome.* sama sekali, supaya mudah
  diuji dan supaya jelas tidak ada API key yang tertanam di dalamnya.
- `options.html`/`options.js` — halaman Options standar Chrome untuk
  menyimpan API key PSI di `chrome.storage.local`.

## Cara memasang untuk pengujian (mode developer)

1. Buka `chrome://extensions` di Chrome.
2. Aktifkan **Developer mode** (kanan atas).
3. Klik **Load unpacked**, pilih folder `chrome-extension/msp-page-audit/`.
4. Ikon MSP Page Audit akan muncul di toolbar. Buka halaman apa pun
   (misalnya `https://www.msp.web.id`), klik ikonnya untuk menjalankan audit.

Untuk publish ke Chrome Web Store nanti, folder ini tinggal di-zip dan
diunggah lewat Chrome Web Store Developer Dashboard (perlu akun developer
terdaftar, ada biaya pendaftaran satu kali dari Google).

## Catatan implementasi penting

Semua file CSS (`popup.css`, `report.css`, `crawl.css`) punya aturan global
`[hidden] { display: none !important; }`. Tanpa ini, elemen yang diberi
`display: flex`/`grid` untuk kebutuhan layout (mis. modal konfirmasi,
`.msp-results`) akan **mengalahkan** gaya bawaan browser untuk atribut
`hidden` (aturan penulis/author selalu menang atas aturan user-agent,
terlepas dari spesifisitas) — sehingga `elemen.hidden = true` di JavaScript
terlihat seperti tidak berpengaruh. Ini gotcha CSS yang nyata pernah
terjadi di modal konfirmasi crawl (modal tidak pernah hilang setelah
disetujui). Kalau menambah elemen baru yang di-toggle lewat `.hidden`,
tidak perlu penanganan khusus lagi karena aturan global ini sudah menutupi
semua kasus.

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
