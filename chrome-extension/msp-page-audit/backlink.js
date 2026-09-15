"use strict";

var STORAGE_KEY = "mspBingApiKey";
var HOST_PERMISSION = { origins: ["https://ssl.bing.com/*"] };

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}

async function getApiKey() {
  var data = await chrome.storage.local.get(STORAGE_KEY);
  return data && data[STORAGE_KEY] ? data[STORAGE_KEY] : "";
}

function showError(message) {
  document.getElementById("mspSetupForm").hidden = false;
  document.getElementById("mspLoading").hidden = true;
  document.getElementById("mspErrorState").hidden = false;
  document.getElementById("mspErrorText").textContent = message;
}

/**
 * fetch() yang gagal karena diblokir CORS oleh browser muncul sebagai
 * TypeError generik "Failed to fetch" -- tidak ada cara membedakannya
 * secara program dari kegagalan jaringan biasa. Karena dukungan CORS
 * Bing Webmaster API belum terverifikasi (lihat catatan di bing-model.js),
 * pesan error untuk skenario ini menyebutkan kemungkinan itu secara
 * eksplisit, bukan cuma "gagal terhubung" yang tidak actionable.
 */
function describeNetworkError(err) {
  var msg = (err && err.message) || String(err);
  if (msg.indexOf("Failed to fetch") !== -1 || msg.indexOf("NetworkError") !== -1) {
    return "Gagal terhubung ke Bing Webmaster Tools API. Ini bisa berarti masalah jaringan biasa, ATAU browser memblokir permintaannya (CORS) -- dukungan itu belum terverifikasi untuk API ini. Kalau terus terjadi meski koneksi internet normal, kemungkinan besar ini penyebabnya, dan fitur ini butuh penyesuaian arsitektur (server perantara) untuk bisa jalan.";
  }
  return msg;
}

function renderTable(items) {
  var tbody = document.querySelector("#mspBacklinkTable tbody");
  var emptyEl = document.getElementById("mspBacklinkEmpty");
  if (!items.length) {
    emptyEl.hidden = false;
    tbody.innerHTML = "";
    return;
  }
  emptyEl.hidden = true;
  tbody.innerHTML = items.map(function (item, idx) {
    return (
      "<tr>" +
        '<td class="msp-url-cell"><a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.url) + "</a></td>" +
        "<td>" + item.linkCount + "</td>" +
        '<td><button class="msp-link-btn msp-detail-btn" data-idx="' + idx + '" type="button">Lihat rincian</button></td>' +
      "</tr>" +
      '<tr class="msp-detail-row" data-detail-for="' + idx + '" hidden><td colspan="3"><div class="msp-detail-content"></div></td></tr>'
    );
  }).join("");
}

function renderResults(summary, siteUrl, generatedAt) {
  document.getElementById("mspSetupForm").hidden = true;
  document.getElementById("mspLoading").hidden = true;
  document.getElementById("mspErrorState").hidden = true;
  document.getElementById("mspResults").hidden = false;
  document.getElementById("mspDownloadPdf").hidden = false;

  document.getElementById("mspResultSite").textContent = siteUrl;
  document.getElementById("mspResultDate").textContent = formatDate(generatedAt);

  var tiles = [
    { label: "Total Backlink", value: summary.totalBacklinks },
    { label: "Halaman Bertaut", value: summary.pagesWithLinks }
  ];
  document.getElementById("mspBacklinkStatTiles").innerHTML = tiles.map(function (t) {
    return (
      '<div class="msp-stat-tile">' +
        '<div class="msp-stat-tile-label">' + escapeHtml(t.label) + "</div>" +
        '<div class="msp-stat-tile-value">' + t.value + "</div>" +
      "</div>"
    );
  }).join("");

  renderTable(summary.topPages);

  var hostname = siteUrl;
  try { hostname = new URL(siteUrl).hostname; } catch (e) { /* biarkan default */ }
  document.title = "Laporan Backlink - " + hostname;
}

async function handleDetailClick(e) {
  var btn = e.target.closest(".msp-detail-btn");
  if (!btn) { return; }
  var idx = btn.getAttribute("data-idx");
  var row = document.querySelector('.msp-detail-row[data-detail-for="' + idx + '"]');
  var contentEl = row.querySelector(".msp-detail-content");

  if (!row.hidden) {
    row.hidden = true;
    return;
  }

  var pageUrl = btn.closest("tr").querySelector(".msp-url-cell a").href;
  var siteUrl = document.getElementById("mspTargetUrl").value.trim();
  var apiKey = await getApiKey();

  row.hidden = false;
  contentEl.innerHTML = '<p class="msp-detail-loading">Memuat rincian&hellip;</p>';

  try {
    var url = mspBuildBingUrlLinksUrl(siteUrl, pageUrl, apiKey);
    var resp = await fetch(url);
    var data = await resp.json().catch(function () { return null; });
    var links = mspParseBingUrlLinksResponse(data, resp.status);
    if (!links.length) {
      contentEl.innerHTML = '<p class="msp-detail-loading">Tidak ada rincian tautan ditemukan.</p>';
      return;
    }
    contentEl.innerHTML = "<ul>" + links.map(function (l) {
      return '<li><a href="' + escapeHtml(l) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(l) + "</a></li>";
    }).join("") + "</ul>";
  } catch (err) {
    contentEl.innerHTML = '<p class="msp-detail-loading">Gagal memuat rincian: ' + escapeHtml(describeNetworkError(err)) + "</p>";
  }
}

async function runCheck() {
  var targetInput = document.getElementById("mspTargetUrl");
  var targetUrl = targetInput.value.trim();

  if (!targetUrl) {
    targetInput.focus();
    return;
  }
  try {
    var parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") { throw new Error("bukan http/https"); }
  } catch (e) {
    alert("URL tidak valid. Contoh yang benar: https://www.msp.web.id");
    return;
  }

  var apiKey = await getApiKey();
  if (!apiKey) {
    document.getElementById("mspSetupForm").hidden = true;
    document.getElementById("mspNoKeyState").hidden = false;
    return;
  }

  // Diminta di sini (bukan saat init) supaya dialog izin muncul sebagai
  // respons langsung atas aksi pengguna -- sama pola dengan crawl.js.
  // Ini juga jaring pengaman kalau ternyata Bing TIDAK mengizinkan CORS:
  // host permission yang benar-benar di-grant membuat Chrome melewati
  // pembatasan CORS untuk origin itu, beda dari PSI/Gemini yang terbukti
  // tidak butuh ini (lihat catatan di bing-model.js/README).
  var granted = false;
  try {
    granted = await chrome.permissions.request(HOST_PERMISSION);
  } catch (e) {
    granted = false;
  }
  if (!granted) {
    alert("Izin akses ssl.bing.com tidak diberikan, jadi Cek Backlink dibatalkan. Fitur lain ekstensi tetap berfungsi normal.");
    return;
  }

  document.getElementById("mspSetupForm").hidden = true;
  document.getElementById("mspErrorState").hidden = true;
  document.getElementById("mspLoading").hidden = false;

  try {
    var url = mspBuildBingLinkCountsUrl(targetUrl, apiKey);
    var resp = await fetch(url);
    var data = await resp.json().catch(function () { return null; });
    var items = mspParseBingLinkCountsResponse(data, resp.status);
    var summary = mspSummarizeBingLinkCounts(items);
    var generatedAt = new Date().toISOString();

    await chrome.storage.local.set({
      mspLastBacklinkCheck: { targetUrl: targetUrl, generatedAt: generatedAt, summary: summary }
    });

    renderResults(summary, targetUrl, generatedAt);
  } catch (err) {
    showError(describeNetworkError(err));
  }
}

async function init() {
  var lastAuditData = await chrome.storage.local.get("mspLastAudit");
  var targetInput = document.getElementById("mspTargetUrl");
  if (lastAuditData && lastAuditData.mspLastAudit && lastAuditData.mspLastAudit.url) {
    try {
      targetInput.value = new URL(lastAuditData.mspLastAudit.url).origin;
    } catch (e) { /* biarkan kosong */ }
  }

  var apiKey = await getApiKey();
  if (!apiKey) {
    document.getElementById("mspNoKeyState").hidden = false;
    document.getElementById("mspSetupForm").hidden = true;
  }

  document.getElementById("mspGoToOptions").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById("mspOpenOptions").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById("mspRunCheck").addEventListener("click", runCheck);
  document.getElementById("mspRetry").addEventListener("click", function () {
    document.getElementById("mspErrorState").hidden = true;
    document.getElementById("mspSetupForm").hidden = false;
  });
  document.getElementById("mspNewCheck").addEventListener("click", function () {
    document.getElementById("mspResults").hidden = true;
    document.getElementById("mspDownloadPdf").hidden = true;
    document.getElementById("mspSetupForm").hidden = false;
  });
  document.getElementById("mspBacklinkTable").addEventListener("click", handleDetailClick);
  document.getElementById("mspDownloadPdf").addEventListener("click", function () {
    window.open("report.html?autoprint=1", "_blank");
  });
}

init();
