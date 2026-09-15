"use strict";

/* ============================================================
   MODEL PEMANGGILAN & PARSING BING WEBMASTER TOOLS API (fitur Cek
   Backlink, opsional). Sama seperti speed-model.js/gemini-model.js:
   semua fungsi di sini murni (menerima data sebagai parameter, tidak
   menyentuh DOM/chrome.*) supaya mudah diuji tanpa Chrome sungguhan,
   dan supaya jelas tidak ada API key yang tertanam di dalamnya.

   CATATAN PENTING soal keterbatasan pengetahuan: bentuk response JSON
   di bawah ini disusun dari dokumentasi publik Bing Webmaster API,
   BUKAN hasil verifikasi langsung ke API sungguhan (endpoint ini tidak
   bisa diakses dari lingkungan pengembangan ekstensi ini). Kalau field
   respons ternyata beda casing/struktur dari dugaan di sini, cukup
   sesuaikan mspParseBingLinkCountsResponse() -- bagian pemanggil
   (backlink.js) tidak perlu diubah selama fungsi ini tetap
   mengembalikan bentuk {url, linkCount} yang sama.

   Beda dari PSI & Gemini yang API-nya milik Google dan sudah terverifikasi
   mendukung fetch() langsung dari browser (header CORS mengizinkan origin
   chrome-extension://), dukungan CORS Bing Webmaster API JUGA belum
   terverifikasi -- endpoint ini bergaya WCF/SOAP lama (".svc") yang
   secara historis lebih sering dibangun untuk dipanggil server-ke-server.
   Kalau ternyata browser memblokir permintaannya karena CORS, itu akan
   muncul sebagai TypeError generik "Failed to fetch" dari fetch() --
   backlink.js menangani skenario ini dengan pesan yang menjelaskan
   kemungkinan itu, bukan cuma "gagal" tanpa konteks.
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

/**
 * Sebagian API gaya ASMX/WCF lama Microsoft membungkus payload JSON-nya
 * dalam properti "d" (konvensi ASP.NET AJAX). Fungsi ini menerima kedua
 * kemungkinan (dibungkus "d" atau array langsung) supaya tidak rapuh
 * terhadap detail yang belum terverifikasi itu.
 */
function mspUnwrapBingPayload(raw) {
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
  if (raw && typeof raw === "object" && (raw.ErrorCode || raw.Message)) {
    throw new Error("Bing Webmaster Tools API error: " + (raw.Message || raw.ErrorCode) +
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
