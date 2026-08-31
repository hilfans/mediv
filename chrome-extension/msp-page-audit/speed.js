"use strict";

var STORAGE_KEY = "mspPsiApiKey";
var USAGE_STORAGE_KEY = "mspSpeedUsageV1";
var DAILY_LIMIT = 25;

/**
 * Batas 25x/hari ini murni penanda di sisi ekstensi (chrome.storage.local),
 * BUKAN penegakan yang benar-benar tidak bisa ditembus -- pengguna yang
 * tahu caranya bisa mereset lewat DevTools atau install ulang ekstensi.
 * Fungsinya sebagai pengingat/pendorong upgrade untuk pengguna umum, bukan
 * jaminan pendapatan dari pengguna yang berniat menghindar (itu perlu
 * penegakan di server, bukan di ekstensi -- sudah didiskusikan terpisah).
 */
function mspTodayKey() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

async function mspGetUsage() {
  var data = await chrome.storage.local.get(USAGE_STORAGE_KEY);
  var usage = data && data[USAGE_STORAGE_KEY];
  var today = mspTodayKey();
  if (!usage || usage.date !== today) {
    return { date: today, count: 0 };
  }
  return usage;
}

async function mspIncrementUsage() {
  var usage = await mspGetUsage();
  usage.count += 1;
  await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: usage });
  return usage;
}
var METRIC_LABELS = {
  lcp: "LCP",
  cls: "CLS",
  tbt: "TBT",
  fcp: "FCP",
  speedIndex: "Speed Index",
  tti: "TTI"
};
var FIELD_METRIC_LABELS = {
  lcp: "LCP",
  cls: "CLS",
  inp: "INP",
  fcp: "FCP"
};

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ratingClass(rating) {
  if (rating === "good") return "good";
  if (rating === "ni") return "ni";
  if (rating === "poor") return "poor";
  return "";
}

function categoryBand(score) {
  if (score == null) return "";
  if (score >= 90) return "good";
  if (score >= 50) return "ni";
  return "poor";
}

function fieldCategoryClass(category) {
  if (category === "FAST") return "good";
  if (category === "AVERAGE") return "ni";
  if (category === "SLOW") return "poor";
  return "";
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}

function renderCategoryScores(categories) {
  var items = [
    { label: "Performance", value: categories.performance },
    { label: "SEO", value: categories.seo },
    { label: "Accessibility", value: categories.accessibility },
    { label: "Best Practices", value: categories.bestPractices }
  ];
  document.getElementById("mspCategoryScores").innerHTML = items.map(function (it) {
    var band = categoryBand(it.value);
    return (
      '<div class="msp-category-tile ' + band + '">' +
        '<div class="msp-category-tile-score">' + (it.value == null ? "-" : it.value) + "</div>" +
        '<div class="msp-category-tile-label">' + escapeHtml(it.label) + "</div>" +
      "</div>"
    );
  }).join("");
}

function renderLabMetrics(labMetrics) {
  var html = Object.keys(METRIC_LABELS).map(function (key) {
    var m = labMetrics[key];
    var cls = ratingClass(m.rating);
    return (
      '<div class="msp-metric-tile ' + cls + '">' +
        '<div class="msp-metric-name">' + escapeHtml(METRIC_LABELS[key]) + "</div>" +
        '<div class="msp-metric-value">' + escapeHtml(m.displayValue) + "</div>" +
      "</div>"
    );
  }).join("");
  document.getElementById("mspLabMetrics").innerHTML = html;
}

function renderFieldMetrics(fieldMetrics) {
  var wrap = document.getElementById("mspFieldMetricsWrap");
  if (!fieldMetrics) {
    wrap.innerHTML = '<p class="msp-field-empty">Data lapangan (dari pengguna nyata, Chrome UX Report) tidak tersedia untuk URL ini -- biasanya karena traffic situs belum cukup tercatat Google. Ini normal untuk situs skala kecil-menengah dan bukan tanda ada masalah.</p>';
    return;
  }
  var rows = Object.keys(FIELD_METRIC_LABELS).map(function (key) {
    var m = fieldMetrics[key];
    if (!m) { return ""; }
    var cls = fieldCategoryClass(m.category);
    var unit = key === "cls" ? "" : " ms";
    return (
      '<div class="msp-metric-tile ' + cls + '">' +
        '<div class="msp-metric-name">' + escapeHtml(FIELD_METRIC_LABELS[key]) + "</div>" +
        '<div class="msp-metric-value">' + m.percentile + unit + "</div>" +
      "</div>"
    );
  }).join("");
  wrap.innerHTML = '<div class="msp-field-metrics">' + rows + "</div>";
}

function renderDescription(description) {
  var segments = mspLinkifyDescription(description);
  return segments.map(function (seg) {
    if (seg.type === "link") {
      var safeUrl = /^https?:\/\//i.test(seg.url) ? seg.url : "#";
      return '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(seg.label) + "</a>";
    }
    return escapeHtml(seg.value);
  }).join("");
}

function renderOpportunities(opportunities) {
  var wrap = document.getElementById("mspOpportunities");
  if (!opportunities.length) {
    wrap.innerHTML = '<p class="msp-opportunity-empty">Tidak ada peluang perbaikan performa signifikan yang terdeteksi. 🎉</p>';
    return;
  }
  wrap.innerHTML = opportunities.map(function (op) {
    return (
      '<div class="msp-opportunity">' +
        '<div class="msp-opportunity-head">' +
          "<span>" + escapeHtml(op.title) + "</span>" +
          '<span class="msp-opportunity-savings">' + escapeHtml(op.displayValue || "") + "</span>" +
        "</div>" +
        '<p class="msp-opportunity-desc">' + renderDescription(op.description) + "</p>" +
      "</div>"
    );
  }).join("");
}

function renderResults(parsed, targetUrl, strategy) {
  document.getElementById("mspSetupForm").hidden = true;
  document.getElementById("mspLoading").hidden = true;
  document.getElementById("mspErrorState").hidden = true;
  document.getElementById("mspResults").hidden = false;
  document.getElementById("mspDownloadPdf").hidden = false;

  document.getElementById("mspResultUrl").textContent = parsed.finalUrl || targetUrl;
  document.getElementById("mspResultStrategy").textContent = strategy === "desktop" ? "Desktop" : "Mobile";
  document.getElementById("mspResultDate").textContent = formatDate(parsed.fetchTime || new Date().toISOString());

  renderCategoryScores(parsed.categories);
  renderLabMetrics(parsed.labMetrics);
  renderFieldMetrics(parsed.fieldMetrics);
  renderOpportunities(parsed.opportunities);

  var hostname = targetUrl;
  try { hostname = new URL(targetUrl).hostname; } catch (e) { /* biarkan default */ }
  document.title = "Laporan Kecepatan - " + hostname;
}

function showError(message) {
  document.getElementById("mspSetupForm").hidden = false;
  document.getElementById("mspLoading").hidden = true;
  document.getElementById("mspErrorState").hidden = false;
  document.getElementById("mspErrorText").textContent = message;
}

async function getApiKey() {
  var data = await chrome.storage.local.get(STORAGE_KEY);
  return data && data[STORAGE_KEY] ? data[STORAGE_KEY] : "";
}

function renderUsageNote(usage) {
  var el = document.getElementById("mspUsageNote");
  if (!el) { return; }
  var remaining = Math.max(0, DAILY_LIMIT - usage.count);
  el.textContent = "Sisa cek kecepatan gratis hari ini: " + remaining + " dari " + DAILY_LIMIT + ".";
  el.classList.toggle("warn", remaining <= 5);
}

function showLimitState() {
  document.getElementById("mspNoKeyState").hidden = true;
  document.getElementById("mspSetupForm").hidden = true;
  document.getElementById("mspErrorState").hidden = true;
  document.getElementById("mspLoading").hidden = true;
  document.getElementById("mspLimitState").hidden = false;
}

async function showSetupFormIfAllowed() {
  var usage = await mspGetUsage();
  if (usage.count >= DAILY_LIMIT) {
    showLimitState();
    return;
  }
  document.getElementById("mspLimitState").hidden = true;
  document.getElementById("mspSetupForm").hidden = false;
  renderUsageNote(usage);
}

async function runCheck() {
  var targetInput = document.getElementById("mspTargetUrl");
  var targetUrl = targetInput.value.trim();
  var strategy = (document.querySelector('input[name="mspStrategy"]:checked') || {}).value || "mobile";

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

  var usage = await mspGetUsage();
  if (usage.count >= DAILY_LIMIT) {
    showLimitState();
    return;
  }

  var apiKey = await getApiKey();
  if (!apiKey) {
    document.getElementById("mspSetupForm").hidden = true;
    document.getElementById("mspNoKeyState").hidden = false;
    return;
  }

  document.getElementById("mspSetupForm").hidden = true;
  document.getElementById("mspErrorState").hidden = true;
  document.getElementById("mspLoading").hidden = false;

  try {
    var url = mspBuildPsiUrl(targetUrl, apiKey, strategy);
    var resp = await fetch(url);
    var data = await resp.json();
    if (!resp.ok) {
      var msg = (data && data.error && data.error.message) || ("HTTP " + resp.status);
      throw new Error(msg);
    }
    var parsed = mspParsePsiResponse(data);

    await mspIncrementUsage();

    await chrome.storage.local.set({
      mspLastSpeedCheck: { parsed: parsed, targetUrl: targetUrl, strategy: strategy, generatedAt: new Date().toISOString() }
    });

    renderResults(parsed, targetUrl, strategy);
  } catch (err) {
    showError((err && err.message) || "Gagal memanggil PageSpeed Insights API.");
  }
}

async function init() {
  var lastAuditData = await chrome.storage.local.get("mspLastAudit");
  var targetInput = document.getElementById("mspTargetUrl");
  if (lastAuditData && lastAuditData.mspLastAudit && lastAuditData.mspLastAudit.url) {
    targetInput.value = lastAuditData.mspLastAudit.url;
  }

  var apiKey = await getApiKey();
  if (!apiKey) {
    document.getElementById("mspNoKeyState").hidden = false;
    document.getElementById("mspSetupForm").hidden = true;
  } else {
    await showSetupFormIfAllowed();
  }

  document.getElementById("mspGoToOptions").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById("mspOpenOptions").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById("mspRunCheck").addEventListener("click", runCheck);
  document.getElementById("mspRetry").addEventListener("click", async function () {
    document.getElementById("mspErrorState").hidden = true;
    await showSetupFormIfAllowed();
  });
  document.getElementById("mspNewCheck").addEventListener("click", async function () {
    document.getElementById("mspResults").hidden = true;
    document.getElementById("mspDownloadPdf").hidden = true;
    await showSetupFormIfAllowed();
  });
  document.getElementById("mspDownloadPdf").addEventListener("click", function () {
    window.open("report.html?autoprint=1", "_blank");
  });
}

init();
