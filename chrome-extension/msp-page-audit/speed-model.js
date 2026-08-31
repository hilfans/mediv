"use strict";

/* ============================================================
   MODEL PEMANGGILAN & PARSING PAGESPEED INSIGHTS API v5 (Lighthouse)
   Semua fungsi di sini murni (menerima data sebagai parameter, tidak
   menyentuh DOM/chrome.*) supaya mudah diuji tanpa Chrome sungguhan.
   ============================================================ */

var MSP_PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/**
 * Susun URL permintaan ke PSI API. API key TIDAK PERNAH ditulis sebagai
 * konstanta di kode ekstensi -- selalu diambil dari chrome.storage.local
 * (diisi pengguna sendiri lewat halaman Options) dan dipakai di sini
 * hanya saat runtime.
 */
function mspBuildPsiUrl(targetUrl, apiKey, strategy) {
  var params = new URLSearchParams();
  params.set("url", targetUrl);
  params.set("strategy", strategy === "desktop" ? "desktop" : "mobile");
  params.append("category", "performance");
  params.append("category", "seo");
  params.append("category", "accessibility");
  params.append("category", "best-practices");
  params.set("key", apiKey);
  return MSP_PSI_ENDPOINT + "?" + params.toString();
}

function mspCategoryScores(lighthouseResult) {
  function scoreOf(id) {
    var cat = lighthouseResult.categories && lighthouseResult.categories[id];
    return cat && typeof cat.score === "number" ? Math.round(cat.score * 100) : null;
  }
  return {
    performance: scoreOf("performance"),
    seo: scoreOf("seo"),
    accessibility: scoreOf("accessibility"),
    bestPractices: scoreOf("best-practices")
  };
}

// Ambang batas resmi Google untuk metrik lab Lighthouse (good/needs
// improvement/poor), dalam ms kecuali CLS (satuan skor tanpa unit).
var MSP_LAB_THRESHOLDS = {
  lcp: { good: 2500, ni: 4000 },
  cls: { good: 0.1, ni: 0.25 },
  tbt: { good: 200, ni: 600 },
  fcp: { good: 1800, ni: 3000 },
  speedIndex: { good: 3400, ni: 5800 },
  tti: { good: 3800, ni: 7300 }
};

function mspRatingFor(metricId, value) {
  if (value == null || isNaN(value)) { return null; }
  var t = MSP_LAB_THRESHOLDS[metricId];
  if (!t) { return null; }
  if (value <= t.good) { return "good"; }
  if (value <= t.ni) { return "ni"; }
  return "poor";
}

function mspExtractLabMetrics(lighthouseResult) {
  var audits = lighthouseResult.audits || {};
  function metric(id, auditId) {
    var audit = audits[auditId];
    if (!audit) { return { value: null, displayValue: "-", rating: null }; }
    var value = typeof audit.numericValue === "number" ? audit.numericValue : null;
    return {
      value: value,
      displayValue: audit.displayValue || "-",
      rating: mspRatingFor(id, value)
    };
  }
  return {
    lcp: metric("lcp", "largest-contentful-paint"),
    cls: metric("cls", "cumulative-layout-shift"),
    tbt: metric("tbt", "total-blocking-time"),
    fcp: metric("fcp", "first-contentful-paint"),
    speedIndex: metric("speedIndex", "speed-index"),
    tti: metric("tti", "interactive")
  };
}

/**
 * Data lapangan (CrUX, dari pengguna nyata) hanya tersedia kalau URL/origin
 * punya cukup traffic yang tercatat Chrome User Experience Report. Banyak
 * situs skala kecil-menengah TIDAK akan punya data ini -- itu wajar, bukan
 * kegagalan pemanggilan API.
 */
function mspExtractFieldMetrics(loadingExperience) {
  if (!loadingExperience || !loadingExperience.metrics) { return null; }
  var m = loadingExperience.metrics;
  function pick(key) {
    var entry = m[key];
    if (!entry) { return null; }
    return { percentile: entry.percentile, category: entry.category };
  }
  return {
    overallCategory: loadingExperience.overall_category || null,
    lcp: pick("LARGEST_CONTENTFUL_PAINT_MS"),
    cls: pick("CUMULATIVE_LAYOUT_SHIFT_SCORE"),
    inp: pick("INTERACTION_TO_NEXT_PAINT"),
    fcp: pick("FIRST_CONTENTFUL_PAINT_MS")
  };
}

/**
 * Pecah deskripsi audit Lighthouse (berformat markdown sederhana, contoh:
 * "teks LINKSTART label|url LINKEND teks") jadi array segmen bertipe
 * text/link. Renderer (speed.js) yang bertanggung jawab meng-escape tiap
 * segmen saat membangun HTML, supaya fungsi murni ini tidak pernah
 * menghasilkan string HTML mentah yang berisiko lupa di-escape.
 */
function mspLinkifyDescription(text) {
  var segments = [];
  var pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  var lastIndex = 0;
  var match;
  var str = String(text || "");
  while ((match = pattern.exec(str)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: str.slice(lastIndex, match.index) });
    }
    segments.push({ type: "link", label: match[1], url: match[2] });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < str.length) {
    segments.push({ type: "text", value: str.slice(lastIndex) });
  }
  return segments;
}

function mspExtractOpportunities(lighthouseResult, limit) {
  var audits = lighthouseResult.audits || {};
  var items = [];
  Object.keys(audits).forEach(function (key) {
    var audit = audits[key];
    if (!audit || !audit.details || audit.details.type !== "opportunity") { return; }
    if (typeof audit.score === "number" && audit.score >= 0.9) { return; }
    var savingsMs = (audit.details && audit.details.overallSavingsMs) || 0;
    if (savingsMs <= 0) { return; }
    items.push({
      id: key,
      title: audit.title,
      description: audit.description || "",
      displayValue: audit.displayValue || "",
      savingsMs: savingsMs
    });
  });
  items.sort(function (a, b) { return b.savingsMs - a.savingsMs; });
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

function mspParsePsiResponse(data) {
  var lr = data.lighthouseResult;
  if (!lr) {
    throw new Error("Respons PageSpeed Insights tidak berisi lighthouseResult.");
  }
  return {
    finalUrl: lr.finalUrl || lr.requestedUrl || "",
    fetchTime: lr.fetchTime || null,
    categories: mspCategoryScores(lr),
    labMetrics: mspExtractLabMetrics(lr),
    fieldMetrics: mspExtractFieldMetrics(data.loadingExperience),
    opportunities: mspExtractOpportunities(lr, 8)
  };
}
