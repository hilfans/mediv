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
  ketiga bagian yang datanya tersimpan di perangkat — Audit SEO On-Page,
  Crawl Situs (`mspLastCrawl`), dan Cek Kecepatan (`mspLastSpeedCheck`) —
  sebagai satu laporan berurutan, bukan tiga PDF terpisah. Klik "Unduh
  sebagai PDF" di halaman **Crawl Situs** atau **Cek Kecepatan** membuka
  `report.html?autoprint=1` di tab baru, yang otomatis memicu dialog cetak
  begitu semua bagian selesai dirender — jadi hasilnya tetap satu PDF
  gabungan meski dipicu dari halaman fitur mana pun. Bagian yang datanya
  belum ada (mis. belum pernah crawl) otomatis disembunyikan, bukan
  ditampilkan kosong.

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

Model yang dipakai: `gemini-2.5-flash`, dengan
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
- `options.html`/`options.js` — halaman Options standar Chrome untuk
  menyimpan API key PSI dan API key Gemini (dua field terpisah) di
  `chrome.storage.local`, lewat satu fungsi `setupKeyField()` yang
  dipakai ulang untuk kedua key supaya logikanya tidak ditulis dua kali.

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
