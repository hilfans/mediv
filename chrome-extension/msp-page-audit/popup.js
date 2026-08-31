"use strict";

/* Logika ekstraksi/evaluasi ada di report-model.js (dimuat sebelum file ini
   lewat <script> di popup.html), supaya popup dan halaman laporan lengkap
   memakai satu sumber logika yang sama. */

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function badgeSymbol(status) {
  if (status === "pass") return "✓";
  if (status === "warn") return "!";
  if (status === "fail") return "✕";
  return "i";
}

function renderRow(r) {
  return (
    '<div class="msp-row">' +
      '<div class="msp-badge ' + r.status + '">' + badgeSymbol(r.status) + "</div>" +
      '<div class="msp-row-body">' +
        '<div class="msp-row-label">' + escapeHtml(r.label) + "</div>" +
        (r.detail ? '<div class="msp-row-detail">' + escapeHtml(r.detail) + "</div>" : "") +
      "</div>" +
    "</div>"
  );
}

function renderSection(category) {
  return (
    '<div class="msp-section">' +
      '<div class="msp-section-title">' + escapeHtml(category.title) + "</div>" +
      category.rows.map(renderRow).join("") +
    "</div>"
  );
}

function renderSummary(counts) {
  return (
    '<div class="msp-summary-stat pass"><span class="msp-summary-count">' + counts.pass + '</span><span class="msp-summary-label">Lolos</span></div>' +
    '<div class="msp-summary-stat warn"><span class="msp-summary-count">' + counts.warn + '</span><span class="msp-summary-label">Perhatian</span></div>' +
    '<div class="msp-summary-stat fail"><span class="msp-summary-count">' + counts.fail + '</span><span class="msp-summary-label">Bermasalah</span></div>'
  );
}

async function runAudit() {
  var loadingEl = document.getElementById("mspLoading");
  var errorEl = document.getElementById("mspErrorState");
  var errorTextEl = document.getElementById("mspErrorText");
  var reportEl = document.getElementById("mspReport");
  var urlEl = document.getElementById("mspUrl");
  var fullReportBtn = document.getElementById("mspFullReport");
  var crawlBtn = document.getElementById("mspCrawlSite");
  var speedBtn = document.getElementById("mspSpeedCheck");

  loadingEl.hidden = false;
  errorEl.hidden = true;
  reportEl.hidden = true;
  fullReportBtn.hidden = true;
  crawlBtn.hidden = true;
  speedBtn.hidden = true;

  try {
    var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    var tab = tabs[0];

    if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
      throw new Error("Halaman ini tidak dapat diaudit (bukan halaman http/https biasa).");
    }

    urlEl.textContent = tab.url;
    urlEl.title = tab.url;

    var domInjection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mspExtractDomSignals
    });
    var dom = domInjection && domInjection[0] && domInjection[0].result;
    if (!dom) { throw new Error("Gagal membaca konten halaman."); }

    var netInjection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: mspCheckSameOriginNetwork,
      args: [tab.url]
    });
    var net = netInjection && netInjection[0] && netInjection[0].result;
    if (!net) { throw new Error("Gagal memeriksa header jaringan halaman."); }

    var model = mspEvaluate(dom, net);

    document.getElementById("mspSummary").innerHTML = renderSummary(model.overall.counts);
    document.getElementById("mspSections").innerHTML = model.categories.map(renderSection).join("");

    await chrome.storage.local.set({ mspLastAudit: model });

    loadingEl.hidden = true;
    reportEl.hidden = false;
    fullReportBtn.hidden = false;
    crawlBtn.hidden = false;
    speedBtn.hidden = false;
  } catch (err) {
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorTextEl.textContent = (err && err.message) || "Terjadi kesalahan saat memindai halaman.";
  }
}

document.getElementById("mspRefresh").addEventListener("click", runAudit);
document.getElementById("mspFullReport").addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
});
document.getElementById("mspCrawlSite").addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("crawl.html") });
});
document.getElementById("mspSpeedCheck").addEventListener("click", function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("speed.html") });
});

runAudit();
