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
  Laporan lengkap menampilkan detail yang bisa dipakai admin mengecek typo
  langsung, bukan cuma ringkasan lolos/tidak:
  - **Open Graph**: nilai asli tiap tag (`og:title`, `og:description`,
    `og:image`, `og:url`, `og:site_name`, `og:type`) ditampilkan apa
    adanya, dengan peringatan otomatis kalau `og:image` memakai URL
    relatif (berisiko gagal dibaca Facebook/LinkedIn) atau `og:title`
    berbeda dari tag `<title>` halaman.
  - **JSON-LD**: dipecah per blok (bukan digabung), menampilkan properti
    kunci sesuai tipenya (`name`, `url`, `logo`, `author`, `address`, dst.),
    mendeteksi **typo kapitalisasi pada `@type`** (mis. `organization`
    yang mestinya `Organization` — schema.org sensitif huruf besar/kecil),
    dan kalau ada blok yang gagal di-parse, menunjukkan nomor bloknya
    plus pesan error `JSON.parse` yang sebenarnya supaya mudah dilacak.
  - **Crawler AI Bot (robots.txt)**: mengecek apakah `robots.txt`
    memblokir crawler AI utama (`GPTBot`, `ChatGPT-User`, `ClaudeBot`,
    `anthropic-ai`, `PerplexityBot`, `CCBot`, `Google-Extended`,
    `Bytespider`, `Applebot-Extended`) — baik lewat aturan spesifik agen
    maupun lewat `Disallow: /` di `User-agent: *` yang tidak dikecualikan
    untuk bot tersebut. Relevan karena ini menentukan apakah situs bisa
    dikutip ChatGPT/Perplexity/dll saat pengguna bertanya tentang bisnis
    terkait.
  - **Profil Google Business / Maps**: heuristik yang mencari tautan ke
    Google Maps/Business Profile (pola URL `g.page`, `maps.app.goo.gl`,
    `goo.gl/maps`, `google.com/maps`, `business.google.com`) di antara
    link keluar halaman maupun di properti `sameAs` pada JSON-LD.
    **Bukan pengecekan resmi ke Google** — tidak ada API gratis untuk
    "cek apakah URL ini punya profil GMB", jadi ini cuma mendeteksi
    apakah situsnya sendiri menaut ke profilnya. Kalau ditemukan,
    dihitung sebagai `pass` (skor naik); kalau tidak ditemukan, statusnya
    `info` dan **tidak mengurangi skor**, karena bisa saja bisnisnya
    sudah punya profil tapi belum menautkannya di situs (false negative).
- **Gambar**: total gambar & yang tanpa atribut `alt`. Kalau ada temuan,
  laporan lengkap menampilkan daftar gambar yang bermasalah (URL gambar +
  "bagian" halaman tempat gambar itu berada, diambil dari `figcaption`
  atau heading terdekat sebelumnya) supaya admin tidak perlu menebak
  gambar mana yang dimaksud — dibatasi 40 entri per halaman biar laporan
  tidak membengkak di halaman dengan ratusan gambar. Untuk **Crawl
  Situs**, temuan ini digabung lintas halaman jadi satu tabel (URL
  halaman + URL gambar + bagian) baik di layar `crawl.html` maupun di
  laporan PDF gabungan, supaya langsung kelihatan gambar mana ada di
  halaman mana.
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
  description di bagian atas laporan. Daftar skor kategori di widget ring
  chart juga menampilkan baris **"Cek Kecepatan (Google Lighthouse)"**
  setelah baris Robots & Sitemap — berisi skor Performance kalau fitur
  Cek Kecepatan sudah pernah dijalankan untuk URL ini, atau notifikasi
  **"Belum dilakukan tes"** kalau belum, supaya admin langsung tahu tanpa
  perlu membuka bagian Cek Kecepatan secara terpisah.
- **Satu PDF gabungan untuk semua fitur**: `report.html` selalu merender
  keempat bagian yang datanya tersimpan di perangkat — Audit SEO On-Page,
  Crawl Situs (`mspLastCrawl`), Cek Kecepatan (`mspLastSpeedCheck`), dan
  Cek Backlink (`mspLastBacklinkCheck`) — sebagai satu laporan berurutan,
  bukan PDF terpisah-terpisah. Klik "Unduh sebagai PDF" di halaman
  **Crawl Situs**, **Cek Kecepatan**, atau **Cek Backlink** membuka
  `report.html?autoprint=1` di tab baru, yang otomatis memicu dialog cetak
  begitu semua bagian selesai dirender — jadi hasilnya tetap satu PDF
  gabungan meski dipicu dari halaman fitur mana pun. Bagian yang datanya
  belum ada (mis. belum pernah crawl) otomatis disembunyikan, bukan
  ditampilkan kosong.
- **Filter domain otomatis**: karena Audit On-Page, Crawl Situs, Cek
  Kecepatan, dan Cek Backlink masing-masing punya halaman fiturnya sendiri
  yang menimpa storage-nya sendiri secara independen, keempatnya bisa saja
  menyimpan hasil untuk **domain yang berbeda-beda** dari sesi-sesi
  sebelumnya (mis. audit satu halaman baru saja dijalankan untuk domain A,
  padahal hasil Crawl Situs yang tersimpan masih dari domain B yang
  di-scan kemarin). `report.html` memilih domain acuan dari hasil yang
  **paling baru dibuat** (`generatedAt`), lalu menyembunyikan bagian mana
  pun yang domainnya tidak cocok — bukan ikut menampilkannya tercampur
  begitu saja — dan menunjukkan catatan kuning di atas laporan yang
  menyebutkan bagian mana yang disembunyikan dan kenapa. Lihat
  `mspFilterByReferenceDomain()` di `report.js`.

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
- Hasil crawl bisa diekspor ke PDF juga — tombolnya membuka laporan
  gabungan (`report.html`, lihat bagian "Satu PDF gabungan" di atas)
  alih-alih mencetak `crawl.html` sendirian.

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
- Diekspor ke PDF lewat laporan gabungan yang sama dengan Audit On-Page
  dan Crawl Situs (lihat bagian "Satu PDF gabungan" di atas).

Sesuai namanya, fitur ini ditujukan untuk **landing page/homepage**
(satu URL), bukan crawl banyak halaman — memanggil PSI API untuk ratusan
halaman sekaligus akan sangat lambat dan boros kuota API.

### API Key (wajib disiapkan sendiri oleh pengguna)

Fitur ini butuh API key PageSpeed Insights pribadi, diatur lewat halaman
**Options** ekstensi (klik kanan ikon ekstensi &rarr; Options, atau tombol
"Atur API Key" di `speed.html`). Kartu "API Key Belum Diatur" di
`speed.html` menyertakan tautan ke tata cara lengkap membuat API key:
[Cara Dapat API Key PageSpeed Insights](https://www.msp.web.id/2020/02/cara-dapat-api-key-pagespeed-insights.html)
di blog msp.web.id. **API key TIDAK PERNAH ditulis di kode
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

## Cakupan v4 — Fitur AI (Gemini, opsional)

Dua fitur berbasis **Gemini API** milik Google, keduanya opsional (tidak
mengisi API key Gemini = fitur ini tidak muncul/tidak aktif, seluruh
fitur lain tetap berfungsi normal seperti biasa) dan dipicu manual lewat
tombol — tidak pernah jalan otomatis di setiap audit:

- **Analisis AI: Judul & Meta Description** (di laporan lengkap, bagian
  Audit SEO On-Page) — menilai daya tarik & kejelasan title/meta
  description (skor 1-5 + feedback), memberi hingga 3 saran alternatif
  dalam bahasa konten halaman (bukan selalu Bahasa Indonesia), dan
  mengecek apakah bahasa isi konten cocok dengan atribut `lang` HTML
  yang dideklarasikan.
- **Ringkasan Eksekutif (AI)** (di bagian atas laporan lengkap) —
  merangkum seluruh temuan (skor & masalah utama dari Audit On-Page,
  Crawl Situs, dan/atau Cek Kecepatan yang tersedia) jadi 3-5 kalimat
  bahasa awam tanpa jargon teknis, plus maksimal 3 prioritas perbaikan
  — ditujukan untuk laporan yang dikirim ke pemilik bisnis non-teknis.

Berbeda dari fitur Cek Kecepatan (yang cuma mengirim URL), fitur AI ini
mengirim **cuplikan teks halaman** (title, meta description, hingga
±1.500 karakter isi konten) atau **ringkasan skor/temuan hasil audit**
langsung dari browser pengguna ke Gemini API — dijelaskan eksplisit di
kartu Options dan di [`PRIVACY.md`](./PRIVACY.md).

Model yang dipakai: `gemini-3.6-flash` (diperbarui dari `gemini-2.5-flash`
setelah Google men-deprecate model itu untuk pengguna baru — ganti model
cukup ubah `MSP_GEMINI_MODEL` di `gemini-model.js`, tidak ada bagian lain
yang perlu disentuh selama bentuk respons `generateContent` tidak
berubah), dengan
[controlled generation](https://ai.google.dev/gemini-api/docs/structured-output)
(`responseSchema`) supaya keluaran selalu JSON valid sesuai skema yang
diharapkan — bukan mengandalkan instruksi teks "balas dalam JSON" yang
rawan terbungkus blok markdown dan gagal di-parse.

### API Key Gemini (opsional, terpisah dari API key PSI)

Diatur lewat halaman **Options**, kartu terpisah dari API key PageSpeed
Insights. Buat gratis lewat
[Google AI Studio &rarr; Get API Key](https://aistudio.google.com/apikey)
(tersedia tingkat gratis/free tier dengan batas kuota dari Google). Sama
seperti key PSI: **tidak pernah ditulis di kode sumber**, disimpan hanya
di `chrome.storage.local` milik pengguna, dan dipakai langsung dari
browser ke Gemini API — tidak lewat server PT MSP. Disarankan dibatasi
di Google Cloud Console ke **Generative Language API** saja, dan
**sebelum publish ke Chrome Web Store** ditambahkan juga
**Application restriction &rarr; HTTP referrers** — langkah lengkapnya
ada di [`PUBLISHING.md`](./PUBLISHING.md).

### Ketahanan terhadap error

`gemini-model.js` memvalidasi setiap respons secara strict (field wajib
harus ada, sesuai skema) sebelum dipakai merender apa pun — respons yang
terpotong, diblokir filter keamanan Google (`promptFeedback.blockReason`),
kehabisan token (`finishReason` bukan `STOP`), atau tidak lengkap akan
menampilkan pesan error yang jelas di kartu terkait, bukan gagal diam-diam
atau merender data rusak. Error HTTP 429 (kuota habis) dan 400/403 (key
ditolak) juga dibedakan pesannya supaya pengguna tahu harus berbuat apa.

### Hasil audit lama (sebelum fitur ini ada)

Field `rawSignals` (title/meta/lang/cuplikan teks mentah) baru mulai
disimpan di `mspLastAudit` sejak fitur ini ditambahkan. Laporan dari
hasil audit yang tersimpan SEBELUM update ini tidak punya field tersebut
— tombol "Analisis dengan AI (Gemini)" untuk Judul & Meta akan otomatis
nonaktif dengan pesan yang meminta audit ulang dari popup, bukan gagal
tanpa penjelasan.

## Cakupan v5 — Cek Backlink (Bing Webmaster Tools, opsional)

Dibuka lewat tombol **"Cek Backlink (Bing Webmaster Tools)"** di popup atau
laporan lengkap (`backlink.html`). Memanggil **Bing Webmaster Tools API**
milik Microsoft untuk menampilkan jumlah & daftar halaman yang menaut ke
situs target — data yang selama ini sengaja tidak disertakan di ekstensi
ini (lihat riwayat di bagian "Batasan yang disengaja" versi-versi
sebelumnya) karena data backlink umumnya hanya tersedia lewat database
proprietary Moz/Ahrefs/SEMrush berbayar. Bing Webmaster Tools menyediakan
data serupa secara gratis, tapi dengan **batasan cakupan yang penting**
di bawah.

- Total backlink & jumlah halaman bertaut, ditampilkan sebagai stat tile.
- Tabel halaman dengan backlink terbanyak, dengan tombol "Lihat rincian"
  per baris untuk memuat daftar URL yang benar-benar menaut ke halaman
  itu (memanggil endpoint `GetUrlLinks` on-demand, bukan dimuat semua di
  awal supaya tidak boros kuota API untuk situs dengan banyak halaman).
- Diekspor ke PDF lewat laporan gabungan yang sama dengan Audit On-Page,
  Crawl Situs, dan Cek Kecepatan (lihat bagian "Satu PDF gabungan" di
  atas) — laporan gabungan menampilkan ringkasan (stat tile + tabel
  halaman terbanyak) tanpa tombol rincian per baris, karena itu butuh
  panggilan API baru yang tidak cocok untuk laporan statis/cetak.

### Keterbatasan cakupan (WAJIB dibaca sebelum pakai)

**Bing Webmaster Tools API HANYA mengembalikan data untuk situs yang
sudah ditambahkan & diverifikasi kepemilikannya** di akun Bing Webmaster
Tools yang API key-nya dipakai — beda fundamental dari Cek Kecepatan
(PSI) yang bisa dipakai untuk URL siapa pun secara bebas. Kalau domain
yang diaudit belum diverifikasi di akun itu, fitur ini menampilkan pesan
error yang menjelaskan hal ini beserta daftar situs yang sebenarnya
terdaftar, bukan data kosong atau bug. Ini bukan "cek backlink kompetitor
secara bebas" seperti Ahrefs/SEMrush — cuma untuk situs yang memang
dikelola sendiri oleh pemilik API key.

Pengguna **tidak perlu mengetik URL persis sama** seperti yang terdaftar
di akun Bing Webmaster Tools (dengan/tanpa `www`, dengan/tanpa garis
miring di akhir, `http` vs `https`) — `backlink.js` memanggil
`GetUserSites` dulu untuk mendapat daftar situs sungguhan di akun
tersebut, mencocokkan berdasar **hostname** (case-insensitive) terhadap
input pengguna lewat `mspFindRegisteredBingSite()` di `bing-model.js`,
lalu memakai string URL ASLI dari hasil pencocokan itu (bukan tebakan
normalisasi sendiri) untuk panggilan `GetLinkCounts`/`GetUrlLinks`
berikutnya. Ini menutup celah nyata yang ditemukan lewat pengujian
pengguna: **Bing Webmaster API tidak melempar error untuk `siteUrl` yang
tidak cocok persis — diam-diam mengembalikan hasil kosong**, yang tanpa
pencocokan proaktif ini akan terlihat identik dengan "situs memang belum
punya backlink" padahal sebenarnya cuma salah ketik/format URL.

### Ketidakpastian teknis — status setelah pengujian nyata pertama

Saat fitur ini pertama dibangun, domain `ssl.bing.com` diblokir oleh
kebijakan jaringan lingkungan pengembangan (`curl` ke domain itu gagal
dengan `403 CONNECT` di level gateway), jadi dua hal berikut tidak bisa
diverifikasi langsung. Setelah pengujian nyata seorang pengguna, satu
di antaranya sudah terkonfirmasi:

1. **Skema respons JSON API ini — SUDAH TERKONFIRMASI sebagian.**
   Respons asli `GetLinkCounts` untuk situs tanpa backlink:
   ```json
   {"d":{"__type":"LinkCounts:#Microsoft.Bing.Webmaster.Api","Links":[],"TotalPages":0}}
   ```
   Bukan `{"d": [...]}` (array langsung) seperti dugaan awal dari
   dokumentasi publik, tapi `{"d": {Links: [...], TotalPages: N,
   __type: "..."}}` — array-nya satu tingkat lebih dalam di properti
   `Links`. `mspUnwrapBingPayload()` di `bing-model.js` sudah diperbaiki
   sesuai temuan ini. Yang **masih belum terverifikasi**: nama field per
   item di dalam `Links` saat benar-benar berisi data (contoh nyata di
   atas kebetulan array-nya kosong), dan makna `TotalPages` — kalau ini
   memang paginasi seperti dugaan, situs dengan banyak halaman bertaut
   bisa jadi cuma menampilkan halaman pertama karena paginasi belum
   diimplementasikan (parameter paging-nya juga belum diketahui).
2. **Dukungan CORS API ini** — **masih belum terverifikasi.** Pengujian
   nyata di atas dilakukan lewat navigasi langsung ke URL API-nya di tab
   baru, bukan `fetch()` dari origin `chrome-extension://`, jadi belum
   membuktikan apa pun soal CORS. Sebagai jaring pengaman, `backlink.js`
   secara eksplisit meminta **optional host permission**
   `https://ssl.bing.com/*` lewat `chrome.permissions.request()` sebelum
   panggilan API pertama — host permission yang benar-benar di-grant
   membuat Chrome **melewati** pembatasan CORS untuk origin itu, apa pun
   header CORS yang dikirim API-nya. Kalau ternyata caranya tetap gagal
   (`fetch()` melempar `TypeError: Failed to fetch`), `backlink.js`
   menampilkan pesan error yang menyebutkan kemungkinan ini secara
   eksplisit (lihat `describeNetworkError()`), termasuk bahwa
   perbaikannya butuh penyesuaian arsitektur (server perantara) — bukan
   sesuatu yang bisa diperbaiki dari sisi ekstensi murni client-side.

**Kalau Anda menguji fitur ini lagi dengan situs yang sudah punya
backlink sungguhan** (bukan 0 seperti pengujian pertama), laporkan
bentuk data yang tampil (khususnya apakah jumlah/URL-nya masuk akal)
supaya ketidakpastian nomor 1 yang tersisa (nama field per-item &
paginasi) bisa diperbaiki berdasarkan data nyata juga.

### API Key Bing Webmaster Tools (opsional, terpisah dari key PSI & Gemini)

Diatur lewat halaman **Options**, kartu ketiga terpisah dari API key PSI
dan Gemini. Buat lewat
[Bing Webmaster Tools](https://www.bing.com/webmasters) — tambahkan &
verifikasi situs Anda dulu, lalu buat API key lewat menu
**Settings &rarr; API Access**, atau ikuti tata cara lengkapnya di
[Cara Mendapatkan API Key Bing Webmaster (Backlink)](https://www.msp.web.id/2026/09/cara-mendapatkan-api-key-bing-webmaster-backlink.html)
di blog msp.web.id. Sama seperti key lain: **tidak pernah
ditulis di kode sumber**, disimpan hanya di `chrome.storage.local` milik
pengguna, dan dipakai langsung dari browser ke Bing Webmaster Tools API —
tidak lewat server PT MSP.

**Beda penting dari API key Google**: Bing Webmaster Tools **tidak
menyediakan** mekanisme pembatasan HTTP referrer seperti Google Cloud
Console. Kalau key ini bocor, satu-satunya cara memulihkannya adalah
membuat key baru dari dashboard Bing Webmaster Tools dan menghapus yang
lama — tidak ada langkah "Application restriction" tambahan yang bisa
ditambahkan sebelum publish seperti pada key PSI/Gemini. Lihat
[`PUBLISHING.md`](./PUBLISHING.md) untuk detail lengkapnya.

## Izin yang dipakai

- `activeTab`, `scripting`, `storage` — wajib, terpasang sejak instalasi,
  tanpa dialog peringatan khusus.
- `http://*/*`, `https://*/*` — **opsional**, baru diminta saat pengguna
  mengaktifkan fitur Crawl Situs.
- `https://www.googleapis.com/*`, `https://generativelanguage.googleapis.com/*`
  — **opsional**, didaftarkan untuk PSI API dan Gemini API. Dalam praktiknya
  kedua endpoint Google ini mengirim header CORS yang mengizinkan origin
  `chrome-extension://`, jadi `fetch()` ke keduanya berhasil walau
  permission ini tidak pernah benar-benar diminta lewat
  `chrome.permissions.request()` — tetap didaftarkan sebagai dokumentasi
  transparan endpoint mana saja yang dihubungi ekstensi ini (dipakai juga
  sebagai acuan isi `PRIVACY.md`), bukan karena secara teknis wajib.
- `https://ssl.bing.com/*` — **opsional**, untuk Bing Webmaster Tools API
  (fitur Cek Backlink). Berbeda dari dua endpoint Google di atas, dukungan
  CORS endpoint ini **belum terverifikasi** (lihat "Cakupan v5" di atas),
  jadi `backlink.js` secara aktif meminta permission ini lewat
  `chrome.permissions.request()` sebelum panggilan API pertama — bukan
  cuma didaftarkan sebagai dokumentasi seperti endpoint Google.

## Arsitektur kode

- `report-model.js` — logika inti audit satu halaman (ekstraksi DOM lewat
  `chrome.scripting`, pengecekan header/robots.txt, evaluasi & skoring),
  plus `mspAggregateCrawl()` untuk menghitung skor/broken-link/halaman
  bermasalah dari hasil crawl. Dipakai bersama oleh `popup.js`, `crawl.js`,
  dan `report.js` supaya angka yang ditampilkan konsisten di semua tempat.
- `crawl-engine.js` — mesin crawl BFS + pengecek broken link, berjalan di
  konteks `crawl.html` sendiri (bukan disuntik ke tab manapun), memakai
  `fetch` langsung karena sudah punya optional host permission. Memakai
  ulang `mspEvaluate()` dari `report-model.js` untuk menilai tiap halaman
  hasil crawl secara konsisten dengan audit satu halaman.
- `speed-model.js` — fungsi murni untuk menyusun URL permintaan PSI API
  dan mem-parsing responsnya (skor kategori, metrik lab/lapangan, daftar
  opportunity). Tidak menyentuh DOM/chrome.* sama sekali, supaya mudah
  diuji dan supaya jelas tidak ada API key yang tertanam di dalamnya.
- `gemini-model.js` — fungsi murni untuk menyusun prompt & `responseSchema`
  tiap fitur AI, memanggil endpoint Gemini, dan memvalidasi/mem-parsing
  responsnya. Pola sama persis dengan `speed-model.js` (tidak menyentuh
  DOM/chrome.*, tidak ada API key tertanam). Dipakai oleh `report.js`.
- `bing-model.js` — fungsi murni untuk menyusun URL permintaan Bing
  Webmaster Tools API (`GetLinkCounts`, `GetUrlLinks`) dan mem-parsing
  responsnya, termasuk penanganan defensif untuk kemungkinan pembungkus
  `{"d": [...]}` ala ASP.NET AJAX dan pesan error khusus untuk situs yang
  belum diverifikasi kepemilikannya. Pola sama persis dengan
  `speed-model.js`/`gemini-model.js`. Dipakai oleh `backlink.js`.
- `backlink.js`/`backlink.html`/`backlink.css` — halaman fitur Cek
  Backlink, berjalan di konteksnya sendiri (bukan disuntik ke tab
  manapun), meminta optional host permission `ssl.bing.com` lewat
  `chrome.permissions.request()` sebelum panggilan API pertama sebagai
  jaring pengaman CORS. Menyimpan hasil ke `mspLastBacklinkCheck` di
  `chrome.storage.local`, dibaca ulang oleh `report.js` untuk laporan
  gabungan.
- `options.html`/`options.js` — halaman Options standar Chrome untuk
  menyimpan API key PSI, Gemini, dan Bing Webmaster Tools (tiga field
  terpisah) di `chrome.storage.local`, lewat satu fungsi
  `setupKeyField()` yang dipakai ulang untuk ketiga key supaya logikanya
  tidak ditulis tiga kali.

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

Semua file CSS (`popup.css`, `report.css`, `crawl.css`, `speed.css`,
`backlink.css`) punya aturan global
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

- **DA (Domain Authority) dan traffic** sengaja tidak disertakan — data
  ini hanya ada di database proprietary Moz/Ahrefs/SEMrush dan butuh API
  berbayar pihak ketiga. **Backlink** sudah dicakup sejak v5 lewat Bing
  Webmaster Tools API (gratis, tapi dengan keterbatasan cakupan yang
  signifikan — lihat "Cakupan v5" di atas), jadi bukan lagi batasan mutlak
  seperti DA/traffic.
- Fitur Cek Backlink (v5) hanya bisa menampilkan data untuk situs yang
  sudah diverifikasi kepemilikannya di akun Bing Webmaster Tools pemilik
  API key — bukan pengecekan backlink bebas untuk situs siapa pun seperti
  Ahrefs/SEMrush (lihat "Keterbatasan cakupan" di bagian Cakupan v5).
- Deteksi JSON-LD menampilkan properti kunci per blok dan mendeteksi typo
  kapitalisasi `@type` terhadap daftar tipe umum (`MSP_KNOWN_SCHEMA_TYPES`
  di `report-model.js`, sekitar 30 tipe paling sering dipakai) — bukan
  validator penuh terhadap seluruh spesifikasi schema.org (yang punya
  ratusan tipe). Tipe di luar daftar itu ditampilkan apa adanya, tidak
  otomatis dianggap salah.
- Deteksi crawler AI di robots.txt pakai daftar bot yang dikurasi manual
  (`MSP_AI_BOT_AGENTS`), bukan daftar lengkap semua bot AI yang pernah
  ada — dan pencocokan grup `User-agent` disederhanakan (satu agen per
  baris `User-agent`, bukan grup multi-agen penuh sesuai spesifikasi),
  konsisten dengan penyederhanaan `Disallow` prefix-match yang sudah ada.
- Deteksi "Profil Google Business / Maps" murni heuristik pencocokan pola
  URL (`MSP_GBP_LINK_PATTERN` di `report-model.js`) pada link halaman &
  `sameAs` JSON-LD — bukan pemanggilan API Google Business Profile/Places
  sungguhan (yang butuh API key + billing terpisah, di luar cakupan
  versi ini). Hasil "tidak ditemukan" tidak dihitung sebagai kesalahan
  di skor, persis karena heuristik ini bisa false negative.
- Crawl v2 bukan crawler penuh ala mesin pencari: konkurensi & jeda antar
  request dibuat tetap (bukan makin agresif di tingkat Heavy/Ultra — cuma
  jumlah halamannya yang beda), dan link ke aset non-HTML (PDF, gambar,
  dst.) yang ditemukan lewat `<a href>` tetap di-GET penuh sebelum ketahuan
  bukan halaman (potensi boros bandwidth untuk aset besar) — cukup untuk
  situs skala UKM/menengah, belum dioptimalkan untuk crawl skala besar.
- Fitur AI (Gemini) hasilnya **tidak di-cache/disimpan** antar kunjungan
  laporan — tiap kali halaman `report.html` dibuka ulang, tombol "Analisis
  dengan AI"/"Buat Ringkasan dengan AI" perlu diklik lagi (memanggil
  Gemini API lagi, memakai kuota lagi). Ini penyederhanaan yang disengaja
  untuk versi pertama, supaya tidak perlu logika invalidasi cache
  (kapan hasil AI dianggap basi kalau kontennya berubah, dsb.) — bisa
  ditambah di versi berikutnya kalau dibutuhkan.
- Fitur AI baru mencakup 2 dari daftar yang lebih panjang yang pernah
  didiskusikan (draft JSON-LD otomatis, draft alt text lewat Gemini
  Vision, deteksi konten generik/E-E-A-T, dst.) — sengaja dimulai dari
  yang paling murah & jelas manfaatnya dulu (lihat riwayat diskusi di
  percakapan pengembangan), bukan langsung semua sekaligus.

## Soal asal-usul kode

Ekstensi ini ditulis ulang dari nol berdasarkan konsep pemeriksaan SEO/teknis
yang bersifat umum dan standar industri (title/meta length, broken link,
robots.txt, header keamanan, dsb. — konsep yang sama dipakai Lighthouse,
Screaming Frog, dan tools SEO lain). Tidak ada kode dari ekstensi pihak
ketiga manapun yang disalin ke dalam proyek ini.
