# Kebijakan Privasi — MSP Page Audit

**Berlaku sejak:** (isi tanggal saat dipublikasikan)
**Dikembangkan oleh:** PT Mitra Solusindo Pratama ([msp.web.id](https://www.msp.web.id/))
**Kontak:** lewat [msp.web.id](https://www.msp.web.id/) atau WhatsApp yang tercantum di situs

> **Catatan penerbitan (hapus baris ini saat dipublikasikan):** dokumen ini
> ditulis untuk dipublikasikan sebagai halaman statis di **msp.web.id**
> (bukan disimpan di dalam repo ekstensi), karena Chrome Web Store
> mewajibkan tautan kebijakan privasi yang bisa diakses publik lewat URL
> hidup, bukan file di dalam paket ekstensi. Isi tanggal berlaku di atas
> sebelum publish.

## Ringkasan singkat

Ekstensi **MSP Page Audit** memeriksa SEO, keamanan, performa, dan (opsional)
kualitas konten sebuah halaman web memakai kombinasi **pemeriksaan lokal di
perangkat Anda** dan **panggilan langsung dari browser Anda ke API resmi
Google** (PageSpeed Insights dan, kalau diaktifkan, Gemini). **Data yang
diproses ekstensi ini tidak pernah melewati atau disimpan di server PT
Mitra Solusindo Pratama** — semuanya berjalan lokal di perangkat pengguna
atau langsung ke Google memakai API key milik pengguna sendiri.

## 1. Data apa saja yang diakses ekstensi ini

| Fitur | Data yang diakses | Ke mana data itu pergi |
|---|---|---|
| Audit SEO On-Page (v1) | Konten halaman yang sedang aktif (title, meta tag, heading, gambar, data terstruktur JSON-LD, tautan) dan header respons jaringan halaman tersebut | Diproses 100% lokal di browser Anda. Tidak dikirim ke mana pun. |
| Crawl Situs & Broken Link Checker (v2) | Menjelajahi & mengambil isi banyak halaman dari situs yang Anda masukkan sendiri | Permintaan HTTP dikirim langsung dari browser Anda ke situs target (bukan lewat server PT MSP). Hasilnya diproses & disimpan lokal. |
| Cek Kecepatan / Google Lighthouse (v3) | URL halaman yang ingin dicek | Dikirim langsung dari browser Anda ke **PageSpeed Insights API** milik Google, memakai API key milik Anda sendiri (bukan milik PT MSP). |
| Analisis dengan AI (Gemini, opsional) | Title, meta description, dan **cuplikan teks isi halaman** (maksimal ±1.500 karakter), atau ringkasan skor/temuan hasil audit | Dikirim langsung dari browser Anda ke **Gemini API** milik Google, memakai API key milik Anda sendiri. Fitur ini sepenuhnya opsional — kalau Anda tidak mengisi API key Gemini, tidak ada data yang pernah dikirim ke Gemini. |

Ekstensi ini **tidak pernah** membaca isi tab lain selain tab yang aktif
saat Anda mengklik ikon ekstensi, dan **tidak** meminta akses ke
riwayat browsing, cookie situs lain, kata sandi, atau data formulir.

## 2. Di mana data disimpan

Semua hasil audit, pengaturan, dan API key (PageSpeed Insights maupun
Gemini) disimpan **hanya di penyimpanan lokal browser Anda**
(`chrome.storage.local`) — tersimpan di perangkat Anda sendiri, tidak
disinkronkan ke akun Google Anda, dan tidak pernah dikirim ke server PT
Mitra Solusindo Pratama atau pihak ketiga mana pun selain permintaan API
langsung yang dijelaskan di Bagian 1.

Menghapus ekstensi ini dari Chrome akan menghapus seluruh data yang
tersimpan tersebut secara otomatis.

## 3. Pihak ketiga yang menerima data, dan kenapa

- **Google PageSpeed Insights API** — menerima URL halaman yang ingin
  dicek kecepatannya. Dipanggil memakai API key yang Anda buat dan
  masukkan sendiri lewat halaman Options ekstensi. Tunduk pada
  [Kebijakan Privasi Google](https://policies.google.com/privacy) dan
  [persyaratan API PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/about).
- **Google Gemini API** (hanya kalau Anda mengaktifkan fitur "Analisis
  dengan AI") — menerima cuplikan teks halaman atau ringkasan hasil
  audit sebagaimana dijelaskan di Bagian 1. Dipanggil memakai API key
  yang Anda buat dan masukkan sendiri. Tunduk pada
  [Kebijakan Privasi Google](https://policies.google.com/privacy) dan
  [persyaratan Gemini API](https://ai.google.dev/gemini-api/terms).
- **Situs yang Anda audit/crawl sendiri** — saat memakai fitur Crawl
  Situs, browser Anda mengirim permintaan HTTP langsung ke situs target
  yang Anda masukkan, sama seperti membuka halaman itu secara manual.

PT Mitra Solusindo Pratama **tidak mengoperasikan server** yang menerima,
menyimpan, atau memproses salah satu dari data di atas.

## 4. Kontrol Anda atas data

- API key (PageSpeed Insights & Gemini) bisa dihapus kapan saja lewat
  halaman Options ekstensi (tombol "Hapus").
- Hasil audit tersimpan bisa dihapus dengan menjalankan audit baru
  (menimpa hasil lama) atau dengan mencopot pemasangan ekstensi.
- Fitur berbasis AI (Gemini) sepenuhnya opt-in — tidak berjalan otomatis,
  hanya saat Anda mengklik tombol "Analisis dengan AI" secara eksplisit.

## 5. Anak-anak

Ekstensi ini adalah alat teknis untuk admin/pengelola situs web dan tidak
ditujukan untuk anak-anak di bawah 13 tahun, serta tidak sengaja
mengumpulkan data dari mereka.

## 6. Perubahan kebijakan ini

Kebijakan ini bisa diperbarui sewaktu-waktu mengikuti perubahan fitur
ekstensi. Perubahan signifikan akan tercermin di halaman ini dengan
tanggal berlaku yang diperbarui.

## 7. Kontak

Pertanyaan seputar kebijakan privasi ini bisa disampaikan lewat
[msp.web.id](https://www.msp.web.id/) atau kontak resmi PT Mitra
Solusindo Pratama yang tercantum di situs tersebut.
