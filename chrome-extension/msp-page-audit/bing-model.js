"use strict";

/* ============================================================
   MODEL PEMANGGILAN & PARSING BING WEBMASTER TOOLS API (fitur Cek
   Backlink, opsional). Sama seperti speed-model.js/gemini-model.js:
   semua fungsi di sini murni (menerima data sebagai parameter, tidak
   menyentuh DOM/chrome.*) supaya mudah diuji tanpa Chrome sungguhan,
   dan supaya jelas tidak ada API key yang tertanam di dalamnya.

   STATUS VERIFIKASI (diperbarui setelah pengujian nyata pengguna, respons
   asli GetLinkCounts untuk situs tanpa backlink):
     {"d":{"__type":"LinkCounts:#Microsoft.Bing.Webmaster.Api","Links":[],"TotalPages":0}}

   Jadi pembungkusnya BUKAN "d": [...] (array langsung) seperti dugaan
   awal, tapi "d": { Links: [...], TotalPages: N, __type: "..." } --
   array-nya satu tingkat lebih dalam, di properti "Links". Sudah
   diperbaiki di mspUnwrapBingPayload() di bawah, dengan fallback ke
   bentuk lain (siapa tahu endpoint GetUrlLinks beda) supaya tetap
   defensif.

   TEMUAN KEDUA (bug lanjutan setelah temuan di atas): situs yang sudah
   diverifikasi TETAP menampilkan 0 backlink kalau string `siteUrl` yang
   dikirim tidak PERSIS sama dengan yang terdaftar di akun Bing Webmaster
   Tools -- API ini tidak fuzzy-match domain, dan yang lebih menjebak:
   kalau tidak cocok, API TIDAK melempar error, cuma diam-diam
   mengembalikan Links: [] seolah situsnya memang tidak punya backlink.
   Respons GetUserSites asli (dari akun pengguna, contoh URL yang
   diverifikasi):
     {"d":[{"__type":"Site:#...","Url":"https://msp.web.id/","IsVerified":true}, ...]}
   Polanya SELALU <skema>://<host>/ dengan trailing slash, tanpa
   kecuali, di antara 17 situs pada akun tersebut. Perhatikan juga:
   GetUserSites membungkus array-nya LANGSUNG di "d" (bukan "d.Links"
   seperti GetLinkCounts) -- API ini TIDAK konsisten bentuk pembungkusnya
   antar endpoint, jadi mspUnwrapBingPayload() sengaja mengecek kedua
   kemungkinan itu.

   Solusinya BUKAN menormalisasi tebakan sendiri (nambah trailing slash,
   dst.) karena itu tidak menyelesaikan kasus host yang salah sama
   sekali (mis. mengetik "www.msp.web.id" padahal yang terdaftar cuma
   "msp.web.id" tanpa www -- kasus nyata yang juga terjadi). Sebagai
   gantinya, mspFindRegisteredBingSite() di bawah memanggil GetUserSites
   dulu, mencocokkan berdasar HOSTNAME (case-insensitive, mengabaikan
   skema/trailing-slash, DAN mengabaikan prefix "www." -- lihat
   mspStripWwwPrefix()) terhadap input pengguna, lalu memakai STRING ASLI
   dari GetUserSites (bukan hasil normalisasi tebakan) untuk panggilan
   GetLinkCounts/GetUrlLinks berikutnya -- dijamin cocok persis karena
   memang berasal dari sumbernya. Kalau tidak ada yang cocok, pemanggil
   (backlink.js) menampilkan pesan eksplisit "situs ini tidak terdaftar
   di akun Anda" berikut daftar situs yang benar terdaftar -- bukan
   diam-diam menunjukkan 0 yang menyesatkan seperti sebelumnya.

   TEMUAN KETIGA -- MASALAH TERKONFIRMASI DI SISI BING, BUKAN BUG KODE
   INI: setelah temuan kedua di atas diperbaiki (siteUrl sudah dijamin
   cocok persis lewat GetUserSites), pengguna menguji dua situs
   terverifikasi berbeda yang KEDUANYA punya backlink nyata dan terlihat
   di dashboard Bing Webmaster Tools ("Backlinks" -> "Backlinks For Your
   Site"), tapi GetLinkCounts tetap mengembalikan `Links: [], TotalPages:
   0` untuk keduanya -- termasuk saat dipanggil LANGSUNG lewat browser
   (bukan lewat ekstensi ini), jadi bukan masalah CORS/fetch/parsing.
   Pencarian web mengonfirmasi ini BUKAN kasus terisolasi: thread
   Microsoft Q&A "Bing Webmaster Tools API GetLinkCounts and GetUrlLinks
   return empty results for verified site"
   (https://learn.microsoft.com/en-us/answers/questions/5939109/bing-webmaster-tools-api-getlinkcounts-and-geturll)
   melaporkan gejala PERSIS SAMA (situs terverifikasi, konfirmasi lewat
   GetUserSites, tapi GetLinkCounts & GetUrlLinks mengembalikan HTTP 200
   dengan Links/Details kosong) -- pertanyaan yang belum terjawab di
   thread itu termasuk apakah endpoint ini butuh autentikasi OAuth
   Bearer (bukan API key) untuk mengembalikan data, dan apakah endpoint
   ini memang bersumber dari data yang sama dengan UI dashboard Bing.
   Jawaban resmi Microsoft di thread itu menyarankan membuka support
   request ke tim Bing Webmaster untuk konfirmasi, bukan menyebutkan
   solusi pasti. Pencarian lain juga menyebutkan legacy SOAP/POX API
   Bing Webmaster (kemungkinan termasuk endpoint `.svc/json/` yang
   dipakai di sini) dijadwalkan pensiun 31 Agustus 2026.

   IMPLIKASI: fitur Cek Backlink saat ini **tidak bisa diandalkan**
   untuk memastikan situs benar-benar tanpa backlink -- hasil "0" bisa
   berarti situsnya memang belum punya backlink terindeks Bing, ATAU
   bisa berarti keterbatasan/bug endpoint ini yang belum diperbaiki
   Microsoft. UI (backlink.html/report.html) sudah diberi catatan
   eksplisit soal ini supaya pengguna tidak salah menyimpulkan. Kalau
   Microsoft memperbaiki/mengklarifikasi ini di masa depan (mis. lewat
   support request atau update dokumentasi resmi), catatan ini dan
   pesan UI terkait perlu ditinjau ulang.

   MASIH BELUM TERVERIFIKASI (menunggu kasus nyata dengan Links berisi
   data -- kedua situs yang diuji sejauh ini selalu kembali kosong
   karena masalah di atas, jadi bentuk tiap ITEM di dalam "Links" saat
   benar-benar berisi data belum pernah dilihat):
   - Nama field per-item untuk GetLinkCounts (dugaan sekarang: "Url" +
     "LinkCount") dan untuk GetUrlLinks (dugaan sekarang: "Url").
   - Field "TotalPages" mengindikasikan respons ini KEMUNGKINAN
     dipaginasi untuk situs dengan banyak halaman bertaut -- kode di sini
     BELUM mengimplementasikan pengambilan halaman berikutnya (parameter
     paging API ini juga belum diketahui namanya).

   Kalau field per-item ternyata beda casing/struktur dari dugaan di
   sini, cukup sesuaikan mspParseBingLinkCountsResponse() --  bagian
   pemanggil (backlink.js) tidak perlu diubah selama fungsi ini tetap
   mengembalikan bentuk {url, linkCount} yang sama.

   Dukungan CORS Bing Webmaster API: pengujian di atas dilakukan lewat
   navigasi langsung ke URL-nya di tab baru (bukan fetch() dari origin
   chrome-extension://), jadi TIDAK membuktikan apa pun soal CORS --
   masih belum terverifikasi. Kalau ternyata browser memblokir
   permintaannya karena CORS, itu akan muncul sebagai TypeError generik
   "Failed to fetch" dari fetch() -- backlink.js menangani skenario ini
   dengan pesan yang menjelaskan kemungkinan itu, bukan cuma "gagal"
   tanpa konteks.
   ============================================================ */

var MSP_BING_ENDPOINT = "https://ssl.bing.com/webmaster/api.svc/json";

function mspBuildBingLinkCountsUrl(siteUrl, apiKey) {
  var params = new URLSearchParams();
  params.set("siteUrl", siteUrl);
  params.set("apikey", apiKey);
  return MSP_BING_ENDPOINT + "/GetLinkCounts?" + params.toString();
}

function mspBuildBingUrlLinksUrl(siteUrl, pageUrl, apiKey) {
  var params = new URLSearchParams();
  params.set("siteUrl", siteUrl);
  params.set("page", pageUrl);
  params.set("apikey", apiKey);
  return MSP_BING_ENDPOINT + "/GetUrlLinks?" + params.toString();
}

function mspBuildBingUserSitesUrl(apiKey) {
  var params = new URLSearchParams();
  params.set("apikey", apiKey);
  return MSP_BING_ENDPOINT + "/GetUserSites?" + params.toString();
}

/**
 * Bentuk asli terverifikasi (lihat catatan di atas file):
 *   {"d": {"__type": "...", "Links": [...], "TotalPages": N}}
 * Array-nya ada di raw.d.Links, bukan raw.d langsung. Fallback ke
 * raw.d sebagai array atau raw sebagai array tetap dipertahankan untuk
 * jaga-jaga kalau GetUrlLinks ternyata beda bentuk dari GetLinkCounts.
 */
function mspUnwrapBingPayload(raw) {
  if (raw && raw.d && Array.isArray(raw.d.Links)) { return raw.d.Links; }
  if (raw && Array.isArray(raw.d)) { return raw.d; }
  if (Array.isArray(raw)) { return raw; }
  return null;
}

/**
 * Bing Webmaster API menolak permintaan untuk key tidak valid ATAU untuk
 * domain yang belum diverifikasi kepemilikannya di akun pemilik key --
 * dua penyebab yang berbeda tapi gejalanya bisa serupa (401/403, atau
 * 200 dengan objek error di body). Pesannya dibuat menyebutkan kemungkinan
 * verifikasi domain secara eksplisit, karena ini penyebab yang paling
 * sering terjadi dan paling membingungkan kalau tidak dijelaskan.
 */
function mspCheckBingApiError(raw, status) {
  if (status === 401 || status === 403) {
    throw new Error("Bing Webmaster Tools menolak permintaan -- pastikan API key benar dan domain ini sudah diverifikasi kepemilikannya di akun Bing Webmaster Tools yang API key-nya Anda pakai.");
  }
  // Sekarang sudah terverifikasi bahwa respons sukses selalu dibungkus
  // "d" (lihat catatan di atas file) -- error kemungkinan besar dibungkus
  // sama, jadi dicek di kedua tempat (raw langsung DAN raw.d) supaya
  // tidak terlewat kalau ternyata error juga dibungkus.
  var errObj = (raw && raw.d && typeof raw.d === "object" && (raw.d.ErrorCode || raw.d.Message)) ? raw.d : raw;
  if (errObj && typeof errObj === "object" && (errObj.ErrorCode || errObj.Message)) {
    throw new Error("Bing Webmaster Tools API error: " + (errObj.Message || errObj.ErrorCode) +
      " -- kemungkinan domain ini belum ditambahkan/diverifikasi di akun Bing Webmaster Tools Anda.");
  }
}

function mspParseBingLinkCountsResponse(raw, status) {
  mspCheckBingApiError(raw, status);
  var list = mspUnwrapBingPayload(raw);
  if (!list) {
    throw new Error("Format respons Bing Webmaster Tools tidak sesuai dugaan -- skema respons API ini belum terverifikasi langsung, lihat catatan di bing-model.js.");
  }
  var items = list.map(function (item) {
    return {
      url: item.Url || item.url || "",
      linkCount: typeof item.LinkCount === "number" ? item.LinkCount :
        (typeof item.linkCount === "number" ? item.linkCount : 0)
    };
  }).filter(function (item) { return item.url; });
  items.sort(function (a, b) { return b.linkCount - a.linkCount; });
  return items;
}

function mspParseBingUrlLinksResponse(raw, status) {
  mspCheckBingApiError(raw, status);
  var list = mspUnwrapBingPayload(raw);
  if (!list) {
    throw new Error("Format respons Bing Webmaster Tools tidak sesuai dugaan -- skema respons API ini belum terverifikasi langsung, lihat catatan di bing-model.js.");
  }
  return list.map(function (item) {
    return item.Url || item.url || "";
  }).filter(Boolean);
}

function mspParseBingUserSitesResponse(raw, status) {
  mspCheckBingApiError(raw, status);
  var list = mspUnwrapBingPayload(raw);
  if (!list) {
    throw new Error("Format respons Bing Webmaster Tools (daftar situs) tidak sesuai dugaan -- lihat catatan di bing-model.js.");
  }
  return list.map(function (item) {
    return {
      url: item.Url || item.url || "",
      isVerified: !!(item.IsVerified || item.isVerified)
    };
  }).filter(function (item) { return item.url; });
}

/**
 * Bing Webmaster API mensyaratkan `siteUrl` cocok PERSIS (skema +
 * trailing slash) dengan salah satu situs terdaftar di akun -- kalau
 * tidak, diam-diam mengembalikan hasil kosong tanpa error (lihat catatan
 * di atas file). Daripada menebak-nebak normalisasi (trailing slash,
 * http vs https, www vs non-www), fungsi ini mencocokkan input pengguna
 * terhadap daftar situs SUNGGUHAN dari GetUserSites berdasarkan hostname
 * (case-insensitive, mengabaikan skema/trailing-slash pada input), lalu
 * mengembalikan entri aslinya -- string URL yang dipakai untuk panggilan
 * berikutnya jadi dijamin cocok karena memang berasal dari sumbernya,
 * bukan hasil tebakan.
 */
/**
 * "www.example.com" dan "example.com" dianggap situs yang sama untuk
 * keperluan pencocokan -- banyak situs redirect satu ke yang lain, dan
 * Bing Webmaster Tools sendiri memperlakukan keduanya sebagai satu
 * properti (mendaftarkan versi www bisa "diserap" jadi non-www kalau
 * itu tujuan redirect-nya). Cukup lepas prefix "www." sebelum
 * dibandingkan, tidak perlu deteksi redirect sungguhan.
 */
function mspStripWwwPrefix(hostname) {
  return hostname.indexOf("www.") === 0 ? hostname.slice(4) : hostname;
}

function mspFindRegisteredBingSite(targetUrl, sites) {
  var targetHostname;
  try { targetHostname = mspStripWwwPrefix(new URL(targetUrl).hostname.toLowerCase()); } catch (e) { return null; }
  for (var i = 0; i < sites.length; i++) {
    var siteHostname;
    try { siteHostname = mspStripWwwPrefix(new URL(sites[i].url).hostname.toLowerCase()); } catch (e) { continue; }
    if (siteHostname === targetHostname) { return sites[i]; }
  }
  return null;
}

/**
 * Ringkasan situs dari daftar per-halaman GetLinkCounts -- dipakai untuk
 * kartu ringkasan (total backlink, jumlah halaman bertaut) tanpa
 * pemanggil (backlink.js) perlu menghitungnya sendiri.
 */
function mspSummarizeBingLinkCounts(items) {
  var totalLinks = items.reduce(function (sum, it) { return sum + it.linkCount; }, 0);
  return {
    totalBacklinks: totalLinks,
    pagesWithLinks: items.length,
    topPages: items.slice(0, 20)
  };
}
