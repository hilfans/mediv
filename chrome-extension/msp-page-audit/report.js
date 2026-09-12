"use strict";

var GEMINI_STORAGE_KEY = "mspGeminiApiKey";

async function getGeminiApiKey() {
  var data = await chrome.storage.local.get(GEMINI_STORAGE_KEY);
  return data && data[GEMINI_STORAGE_KEY] ? data[GEMINI_STORAGE_KEY] : "";
}

/**
 * Wrapper generik pemanggilan Gemini API -- dipakai semua fitur AI di
 * halaman ini. Pesan error dibuat jelas untuk 3 skenario paling umum:
 * key belum diisi, key ditolak Google, dan kuota habis.
 */
async function callGemini(promptText, responseSchema) {
  var apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error("API key Gemini belum diatur. Buka halaman Options ekstensi (klik kanan ikon ekstensi → Options) untuk mengisinya -- gratis lewat Google AI Studio.");
  }
  var url = mspBuildGeminiUrl(apiKey);
  var resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mspBuildGeminiRequestBody(promptText, responseSchema))
  });
  var data = await resp.json();
  if (!resp.ok) {
    var msg = (data && data.error && data.error.message) || ("HTTP " + resp.status);
    if (resp.status === 429) {
      throw new Error("Kuota Gemini API harian/menit habis. Coba lagi nanti. (" + msg + ")");
    }
    if (resp.status === 400 || resp.status === 403) {
      throw new Error("API key Gemini ditolak Google: " + msg);
    }
    throw new Error("Gemini API error: " + msg);
  }
  return data;
}

function renderTitleMetaResult(parsed) {
  var titleSuggestionsHtml = parsed.titleSuggestions.length
    ? "<ul>" + parsed.titleSuggestions.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") + "</ul>"
    : "";
  var descSuggestionsHtml = parsed.descriptionSuggestions.length
    ? "<ul>" + parsed.descriptionSuggestions.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") + "</ul>"
    : "";
  var lc = parsed.languageConsistency;
  var langText = lc.matches
    ? "Bahasa konten (\"" + escapeHtml(lc.detectedContentLang) + "\") sudah cocok dengan atribut lang halaman."
    : "Bahasa konten terdeteksi sebagai \"" + escapeHtml(lc.detectedContentLang) + "\" -- kemungkinan tidak cocok dengan atribut lang yang dideklarasikan halaman. Periksa kembali.";

  document.getElementById("mspGeminiTitleMetaResult").innerHTML =
    '<div class="msp-gemini-block">' +
      '<div class="msp-gemini-score">Skor Title: ' + parsed.titleQualityScore + '/5</div>' +
      "<p>" + escapeHtml(parsed.titleFeedback) + "</p>" +
      titleSuggestionsHtml +
    "</div>" +
    '<div class="msp-gemini-block">' +
      '<div class="msp-gemini-score">Skor Meta Description: ' + parsed.descriptionQualityScore + '/5</div>' +
      "<p>" + escapeHtml(parsed.descriptionFeedback) + "</p>" +
      descSuggestionsHtml +
    "</div>" +
    '<div class="msp-gemini-block' + (lc.matches ? "" : " warn") + '">' +
      '<div class="msp-gemini-score">Konsistensi Bahasa</div>' +
      "<p>" + langText + "</p>" +
    "</div>";
}

async function handleTitleMetaAnalysis(rawSignals) {
  var btn = document.getElementById("mspGeminiTitleMetaBtn");
  var loadingEl = document.getElementById("mspGeminiTitleMetaLoading");
  var errorEl = document.getElementById("mspGeminiTitleMetaError");
  var resultEl = document.getElementById("mspGeminiTitleMetaResult");

  btn.disabled = true;
  errorEl.hidden = true;
  resultEl.hidden = true;
  loadingEl.hidden = false;

  try {
    var prompt = mspBuildTitleMetaPrompt(rawSignals);
    var raw = await callGemini(prompt, MSP_GEMINI_TITLE_META_SCHEMA);
    var parsed = mspParseTitleMetaResponse(raw);
    renderTitleMetaResult(parsed);
    resultEl.hidden = false;
  } catch (err) {
    errorEl.textContent = (err && err.message) || "Gagal menganalisis dengan AI.";
    errorEl.hidden = false;
  } finally {
    loadingEl.hidden = true;
    btn.disabled = false;
  }
}

function renderExecSummaryResult(parsed) {
  var prioritiesHtml = parsed.topPriorities.length
    ? "<ol>" + parsed.topPriorities.map(function (p) { return "<li>" + escapeHtml(p) + "</li>"; }).join("") + "</ol>"
    : "";
  document.getElementById("mspGeminiSummaryResult").innerHTML =
    '<p class="msp-gemini-summary-text">' + escapeHtml(parsed.summary) + "</p>" + prioritiesHtml;
}

async function handleExecSummary(auditModel, crawlData, speedData) {
  var btn = document.getElementById("mspGeminiSummaryBtn");
  var loadingEl = document.getElementById("mspGeminiSummaryLoading");
  var errorEl = document.getElementById("mspGeminiSummaryError");
  var resultEl = document.getElementById("mspGeminiSummaryResult");

  btn.disabled = true;
  errorEl.hidden = true;
  resultEl.hidden = true;
  loadingEl.hidden = false;

  try {
    var input = mspBuildExecSummaryInput(auditModel, crawlData, speedData);
    var prompt = mspBuildExecSummaryPrompt(input);
    var raw = await callGemini(prompt, MSP_GEMINI_SUMMARY_SCHEMA);
    var parsed = mspParseExecSummaryResponse(raw);
    renderExecSummaryResult(parsed);
    resultEl.hidden = false;
  } catch (err) {
    errorEl.textContent = (err && err.message) || "Gagal membuat ringkasan dengan AI.";
    errorEl.hidden = false;
  } finally {
    loadingEl.hidden = true;
    btn.disabled = false;
  }
}

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

function scoreBand(score) {
  if (score >= 90) return "pass";
  if (score >= 50) return "warn";
  return "fail";
}

function formatDate(iso) {
  try {
    var d = new Date(iso);
    return d.toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short"
    });
  } catch (e) {
    return iso;
  }
}

function renderScoreRing(score) {
  var circle = document.getElementById("mspScoreRingFg");
  var radius = 52;
  var circumference = 2 * Math.PI * radius;
  var offset = circumference * (1 - score / 100);
  circle.style.strokeDasharray = circumference.toFixed(2);
  circle.style.strokeDashoffset = offset.toFixed(2);
  circle.classList.remove("band-warn", "band-fail");
  var band = scoreBand(score);
  if (band === "warn") { circle.classList.add("band-warn"); }
  if (band === "fail") { circle.classList.add("band-fail"); }
  document.getElementById("mspOverallScore").textContent = score;
}

function renderCategoryScores(categories) {
  var html = categories.map(function (cat) {
    var band = scoreBand(cat.score);
    return (
      '<div class="msp-category-score-row">' +
        '<span class="msp-cat-name">' + escapeHtml(cat.title) + "</span>" +
        '<span class="msp-category-score-track">' +
          '<span class="msp-category-score-fill band-' + band + '" style="width:' + cat.score + '%"></span>' +
        "</span>" +
        '<span class="msp-cat-pct">' + cat.score + "%</span>" +
      "</div>"
    );
  }).join("");
  document.getElementById("mspCategoryScores").innerHTML = html;
}

/**
 * Baris tambahan di daftar skor kategori (di bawah ring skor keseluruhan)
 * untuk hasil Cek Kecepatan -- ditaruh di widget yang sama supaya admin
 * langsung lihat skor Performance Lighthouse tanpa scroll ke bagian
 * terpisah. Kalau belum pernah dijalankan, cukup tampilkan notifikasi
 * "Belum dilakukan tes" alih-alih bar kosong yang membingungkan.
 */
function renderSpeedCategoryRow(speedData) {
  var wrap = document.getElementById("mspCategoryScores");
  var row = document.createElement("div");
  var hasScore = speedData && speedData.parsed && speedData.parsed.categories &&
    typeof speedData.parsed.categories.performance === "number";
  if (hasScore) {
    var score = speedData.parsed.categories.performance;
    var band = scoreBand(score);
    row.className = "msp-category-score-row";
    row.innerHTML =
      '<span class="msp-cat-name">Cek Kecepatan (Google Lighthouse)</span>' +
      '<span class="msp-category-score-track">' +
        '<span class="msp-category-score-fill band-' + band + '" style="width:' + score + '%"></span>' +
      "</span>" +
      '<span class="msp-cat-pct">' + score + "%</span>";
  } else {
    row.className = "msp-category-score-row untested";
    row.innerHTML =
      '<span class="msp-cat-name">Cek Kecepatan (Google Lighthouse)</span>' +
      '<span class="msp-cat-pct msp-cat-untested">Belum dilakukan tes</span>';
  }
  wrap.appendChild(row);
}

function renderStatTiles(counts) {
  var total = counts.pass + counts.warn + counts.fail;
  var tiles = [
    { label: "Total Pemeriksaan", value: total, cls: "" },
    { label: "Lolos", value: counts.pass, cls: "pass" },
    { label: "Perhatian", value: counts.warn, cls: "warn" },
    { label: "Bermasalah", value: counts.fail, cls: "fail" }
  ];
  document.getElementById("mspStatTiles").innerHTML = tiles.map(function (t) {
    return (
      '<div class="msp-stat-tile ' + t.cls + '">' +
        '<div class="msp-stat-tile-label">' + escapeHtml(t.label) + "</div>" +
        '<div class="msp-stat-tile-value">' + t.value + "</div>" +
      "</div>"
    );
  }).join("");
}

function renderHeadingOutline(items) {
  var rows = items.map(function (h) {
    var indent = (h.level - 1) * 16;
    return (
      '<li style="margin-left:' + indent + 'px">' +
        '<span class="msp-heading-level">H' + h.level + "</span> " +
        escapeHtml(h.text || "(tanpa teks)") +
      "</li>"
    );
  }).join("");
  return '<ul class="msp-heading-outline">' + rows + "</ul>";
}

function renderLinkBreakdown(extra) {
  function list(urls) {
    if (!urls.length) { return '<p class="msp-link-empty">Tidak ada.</p>'; }
    return "<ul>" + urls.map(function (u) {
      return '<li><a href="' + escapeHtml(u) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(u) + "</a></li>";
    }).join("") + "</ul>";
  }
  return (
    '<details class="msp-link-breakdown">' +
      "<summary>Lihat rincian " + (extra.internal.length + extra.external.length) + " tautan</summary>" +
      '<div class="msp-link-columns">' +
        '<div><h4>Internal (' + extra.internal.length + ")</h4>" + list(extra.internal) + "</div>" +
        '<div><h4>Eksternal (' + extra.external.length + ")</h4>" + list(extra.external) + "</div>" +
      "</div>" +
    "</details>"
  );
}

// Tabel field OG yang ditampilkan urut prioritas -- title/description/image
// adalah 3 tag "utama" yang dipakai untuk skor pass/warn baris ini; url dan
// siteName ditampilkan sebagai info tambahan (sering typo/kelupaan).
var OG_FIELD_LABELS = [
  { key: "title", label: "og:title" },
  { key: "description", label: "og:description" },
  { key: "image", label: "og:image" },
  { key: "url", label: "og:url" },
  { key: "siteName", label: "og:site_name" },
  { key: "type", label: "og:type" }
];

function renderOgDetail(og) {
  var rows = OG_FIELD_LABELS.map(function (f) {
    var value = og[f.key];
    var cls = value ? "filled" : "empty";
    return (
      '<div class="msp-og-row ' + cls + '">' +
        '<span class="msp-og-tag">' + escapeHtml(f.label) + "</span>" +
        '<span class="msp-og-value">' + (value ? escapeHtml(value) : "(tidak ditemukan)") + "</span>" +
      "</div>"
    );
  }).join("");
  return '<div class="msp-og-detail">' + rows + "</div>";
}

// Field yang paling sering dicek admin per tipe schema.org -- lihat
// mspSummarizeSchemaItem() di report-model.js untuk daftar lengkap yang
// mungkin muncul di sini.
var JSONLD_FIELD_LABELS = {
  name: "name", url: "url", logo: "logo", image: "image", headline: "headline",
  author: "author", datePublished: "datePublished", telephone: "telephone",
  sameAs: "sameAs", address: "address"
};

function renderJsonLdDetail(blocks) {
  if (!blocks || !blocks.length) { return ""; }
  var html = blocks.map(function (block) {
    if (block.error) {
      return (
        '<div class="msp-jsonld-block has-error">' +
          '<div class="msp-jsonld-block-head">Blok #' + block.index + " -- gagal di-parse</div>" +
          '<div class="msp-jsonld-parse-error">' + escapeHtml(block.error) + "</div>" +
        "</div>"
      );
    }
    if (!block.items.length) {
      return (
        '<div class="msp-jsonld-block">' +
          '<div class="msp-jsonld-block-head">Blok #' + block.index + " -- tidak ada @type terbaca</div>" +
        "</div>"
      );
    }
    var itemsHtml = block.items.map(function (item) {
      var typeLabel = escapeHtml(item.type);
      var typoHtml = item.typoSuggestion
        ? ' <span class="msp-jsonld-typo">kemungkinan typo, mestinya "' + escapeHtml(item.typoSuggestion) + '"</span>'
        : "";
      var fieldKeys = Object.keys(item.fields || {});
      var fieldsHtml = fieldKeys.length
        ? '<dl class="msp-jsonld-fields">' + fieldKeys.map(function (k) {
            var label = JSONLD_FIELD_LABELS[k] || k;
            return "<div><dt>" + escapeHtml(label) + "</dt><dd>" + escapeHtml(item.fields[k]) + "</dd></div>";
          }).join("") + "</dl>"
        : '<p class="msp-jsonld-empty-fields">Tidak ada properti umum (name/url/dst.) yang terbaca pada item ini.</p>';
      return (
        '<div class="msp-jsonld-item">' +
          '<div class="msp-jsonld-item-type">' + typeLabel + typoHtml + "</div>" +
          fieldsHtml +
        "</div>"
      );
    }).join("");
    return (
      '<div class="msp-jsonld-block">' +
        '<div class="msp-jsonld-block-head">Blok #' + block.index + "</div>" +
        itemsHtml +
      "</div>"
    );
  }).join("");
  return '<details class="msp-jsonld-detail"><summary>Lihat rincian ' + blocks.length + " blok JSON-LD</summary>" + html + "</details>";
}

function renderMissingAltImages(extra) {
  var items = extra.items || [];
  if (!items.length) { return ""; }
  var rows = items.map(function (img) {
    return (
      "<li>" +
        '<a href="' + escapeHtml(img.src) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(img.src) + "</a>" +
        (img.section ? ' <span class="msp-missingalt-section">-- bagian: "' + escapeHtml(img.section) + '"</span>' : "") +
      "</li>"
    );
  }).join("");
  var truncatedNote = extra.total > items.length
    ? '<p class="msp-missingalt-truncated">Menampilkan ' + items.length + " dari " + extra.total + " gambar (dibatasi supaya laporan tidak terlalu panjang).</p>"
    : "";
  return (
    '<details class="msp-missingalt-detail">' +
      "<summary>Lihat " + items.length + " gambar tanpa alt</summary>" +
      "<ul>" + rows + "</ul>" +
      truncatedNote +
    "</details>"
  );
}

function renderRow(r) {
  var extraHtml = "";
  if (r.extra && r.extra.type === "heading-outline") {
    extraHtml = renderHeadingOutline(r.extra.items);
  } else if (r.extra && r.extra.type === "link-breakdown") {
    extraHtml = renderLinkBreakdown(r.extra);
  } else if (r.extra && r.extra.type === "og-detail") {
    extraHtml = renderOgDetail(r.extra.og);
  } else if (r.extra && r.extra.type === "jsonld-detail") {
    extraHtml = renderJsonLdDetail(r.extra.blocks);
  } else if (r.extra && r.extra.type === "missing-alt-images") {
    extraHtml = renderMissingAltImages(r.extra);
  }
  return (
    '<div class="msp-row">' +
      '<div class="msp-badge ' + r.status + '">' + badgeSymbol(r.status) + "</div>" +
      "<div>" +
        '<div class="msp-row-label">' + escapeHtml(r.label) + "</div>" +
        (r.detail ? '<div class="msp-row-detail">' + escapeHtml(r.detail) + "</div>" : "") +
        extraHtml +
      "</div>" +
    "</div>"
  );
}

function renderDetailSections(categories) {
  var html = categories.map(function (cat) {
    return (
      '<article class="msp-detail-card">' +
        '<div class="msp-detail-card-header">' +
          "<h2>" + escapeHtml(cat.title) + "</h2>" +
          '<span class="msp-cat-pct">' + cat.score + "%</span>" +
        "</div>" +
        cat.rows.map(renderRow).join("") +
      "</article>"
    );
  }).join("");
  document.getElementById("mspDetailSections").innerHTML = html;
}

/* ---------- Bagian Crawl Situs (dalam laporan gabungan) ---------- */

function renderCrawlSection(crawlData) {
  document.getElementById("mspCrawlSection").hidden = false;
  var crawlResult = crawlData.result;
  document.getElementById("mspCrawlOrigin").textContent = crawlResult.origin;
  document.getElementById("mspCrawlDate").textContent = formatDate(crawlData.generatedAt);

  var agg = mspAggregateCrawl(crawlResult);

  var tiles = [
    { label: "Halaman Di-crawl", value: crawlResult.pages.length, cls: "" },
    { label: "Skor Situs", value: agg.score + "%", cls: agg.score >= 90 ? "pass" : (agg.score >= 50 ? "warn" : "fail") },
    { label: "Broken Link", value: agg.brokenLinks.length, cls: agg.brokenLinks.length > 0 ? "fail" : "pass" },
    { label: "Redirect", value: crawlResult.redirects.length, cls: crawlResult.redirects.length > 0 ? "warn" : "pass" },
    { label: "Diblokir robots.txt/noindex", value: agg.blockedPages.length, cls: agg.blockedPages.length > 0 ? "warn" : "pass" },
    { label: "Pemeriksaan Bermasalah", value: agg.overall.fail, cls: agg.overall.fail > 0 ? "fail" : "pass" }
  ];
  document.getElementById("mspCrawlStatTiles").innerHTML = tiles.map(function (t) {
    return (
      '<div class="msp-stat-tile ' + t.cls + '">' +
        '<div class="msp-stat-tile-label">' + escapeHtml(t.label) + "</div>" +
        '<div class="msp-stat-tile-value">' + t.value + "</div>" +
      "</div>"
    );
  }).join("");

  var pagesBody = crawlResult.pages.map(function (p) {
    var score = p.evaluation ? p.evaluation.overall.score : null;
    var scoreCell = score === null ? "-" : score + "%";
    var statusCls = p.status >= 200 && p.status < 400 ? "ok" : "fail";
    var d = p.dom;

    var titleCell = "-";
    if (d) {
      var tLen = d.title.length;
      var tCls = !d.title ? "fail" : (tLen < 30 || tLen > 60 ? "warn" : "ok");
      titleCell = '<span class="msp-status-chip ' + tCls + '">' + tLen + "</span> " +
        escapeHtml(d.title ? (d.title.length > 45 ? d.title.slice(0, 45) + "…" : d.title) : "(kosong)");
    }

    var descCell = "-";
    if (d) {
      var dLen = d.metaDescription.length;
      var dCls = !d.metaDescription ? "fail" : (dLen < 70 || dLen > 160 ? "warn" : "ok");
      descCell = '<span class="msp-status-chip ' + dCls + '">' + dLen + "</span>";
    }

    var imgCell = "-";
    if (d) {
      var imgCls = d.missingAltCount === 0 ? "ok" : "warn";
      imgCell = '<span class="msp-status-chip ' + imgCls + '">' +
        (d.totalImages - d.missingAltCount) + "/" + d.totalImages + "</span>";
    }

    var notes = [];
    if (p.robotsDisallowed) { notes.push('<span class="msp-status-chip fail">Diblokir robots.txt</span>'); }
    if (p.hasNoindex) { notes.push('<span class="msp-status-chip fail">noindex</span>'); }
    var notesCell = notes.length ? notes.join(" ") : "-";

    return (
      "<tr>" +
        '<td class="msp-url-cell"><a href="' + escapeHtml(p.finalUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(p.finalUrl) + "</a></td>" +
        '<td><span class="msp-status-chip ' + statusCls + '">' + p.status + "</span></td>" +
        "<td>" + scoreCell + "</td>" +
        "<td>" + titleCell + "</td>" +
        "<td>" + descCell + "</td>" +
        "<td>" + imgCell + "</td>" +
        "<td>" + notesCell + "</td>" +
      "</tr>"
    );
  }).join("");
  document.querySelector("#mspCrawlPagesTable tbody").innerHTML = pagesBody;

  document.getElementById("mspCrawlBrokenCount").textContent = agg.brokenLinks.length;
  if (agg.brokenLinks.length === 0) {
    document.getElementById("mspCrawlBrokenEmpty").hidden = false;
    document.querySelector("#mspCrawlBrokenTable tbody").innerHTML = "";
  } else {
    document.getElementById("mspCrawlBrokenEmpty").hidden = true;
    document.querySelector("#mspCrawlBrokenTable tbody").innerHTML = agg.brokenLinks.map(function (l) {
      var found = l.foundOnPages || [];
      var foundLabel = found.slice(0, 2).map(escapeHtml).join(", ") + (found.length > 2 ? " +" + (found.length - 2) + " lainnya" : "");
      return (
        "<tr>" +
          '<td class="msp-url-cell"><a href="' + escapeHtml(l.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(l.url) + "</a></td>" +
          '<td><span class="msp-status-chip fail">' + (l.status || "Gagal") + "</span></td>" +
          "<td>" + foundLabel + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  document.getElementById("mspCrawlRedirectCount").textContent = crawlResult.redirects.length;
  if (crawlResult.redirects.length === 0) {
    document.getElementById("mspCrawlRedirectEmpty").hidden = false;
    document.querySelector("#mspCrawlRedirectTable tbody").innerHTML = "";
  } else {
    document.getElementById("mspCrawlRedirectEmpty").hidden = true;
    document.querySelector("#mspCrawlRedirectTable tbody").innerHTML = crawlResult.redirects.map(function (r) {
      return (
        "<tr>" +
          '<td class="msp-url-cell">' + escapeHtml(r.from) + "</td>" +
          '<td class="msp-url-cell">' + escapeHtml(r.to) + "</td>" +
          '<td><span class="msp-status-chip warn">' + r.status + "</span></td>" +
        "</tr>"
      );
    }).join("");
  }

  document.getElementById("mspCrawlMissingAltCount").textContent = agg.missingAltFindings.length;
  if (agg.missingAltFindings.length === 0) {
    document.getElementById("mspCrawlMissingAltEmpty").hidden = false;
    document.querySelector("#mspCrawlMissingAltTable tbody").innerHTML = "";
  } else {
    document.getElementById("mspCrawlMissingAltEmpty").hidden = true;
    document.querySelector("#mspCrawlMissingAltTable tbody").innerHTML = agg.missingAltFindings.map(function (f) {
      return (
        "<tr>" +
          '<td class="msp-url-cell"><a href="' + escapeHtml(f.page) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(f.page) + "</a></td>" +
          '<td class="msp-url-cell"><a href="' + escapeHtml(f.src) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(f.src) + "</a></td>" +
          "<td>" + (f.section ? escapeHtml(f.section) : "-") + "</td>" +
        "</tr>"
      );
    }).join("");
  }
}

/* ---------- Bagian Cek Kecepatan / Lighthouse (dalam laporan gabungan) ---------- */

var SPEED_METRIC_LABELS = {
  lcp: "LCP",
  cls: "CLS",
  tbt: "TBT",
  fcp: "FCP",
  speedIndex: "Speed Index",
  tti: "TTI"
};
var SPEED_FIELD_METRIC_LABELS = { lcp: "LCP", cls: "CLS", inp: "INP", fcp: "FCP" };

// PSI API memakai istilah good/ni/poor; laporan ini memakai istilah
// pass/warn/fail supaya konsisten secara visual dengan bagian On-Page & Crawl.
function speedRatingClass(rating) {
  if (rating === "good") return "pass";
  if (rating === "ni") return "warn";
  if (rating === "poor") return "fail";
  return "";
}

function speedFieldCategoryClass(category) {
  if (category === "FAST") return "pass";
  if (category === "AVERAGE") return "warn";
  if (category === "SLOW") return "fail";
  return "";
}

function renderSpeedDescription(description) {
  var segments = mspLinkifyDescription(description);
  return segments.map(function (seg) {
    if (seg.type === "link") {
      var safeUrl = /^https?:\/\//i.test(seg.url) ? seg.url : "#";
      return '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(seg.label) + "</a>";
    }
    return escapeHtml(seg.value);
  }).join("");
}

function renderSpeedSection(speedData) {
  document.getElementById("mspSpeedSection").hidden = false;
  var parsed = speedData.parsed;

  document.getElementById("mspSpeedUrl").textContent = parsed.finalUrl || speedData.targetUrl;
  document.getElementById("mspSpeedStrategy").textContent = speedData.strategy === "desktop" ? "Desktop" : "Mobile";
  document.getElementById("mspSpeedDate").textContent = formatDate(parsed.fetchTime || speedData.generatedAt);

  var catItems = [
    { label: "Performance", value: parsed.categories.performance },
    { label: "SEO", value: parsed.categories.seo },
    { label: "Accessibility", value: parsed.categories.accessibility },
    { label: "Best Practices", value: parsed.categories.bestPractices }
  ];
  document.getElementById("mspSpeedCategoryScores").innerHTML = catItems.map(function (it) {
    var band = it.value == null ? "" : scoreBand(it.value);
    return (
      '<div class="msp-speed-category-tile ' + band + '">' +
        '<div class="msp-speed-category-tile-score">' + (it.value == null ? "-" : it.value) + "</div>" +
        '<div class="msp-speed-category-tile-label">' + escapeHtml(it.label) + "</div>" +
      "</div>"
    );
  }).join("");

  document.getElementById("mspSpeedLabMetrics").innerHTML = Object.keys(SPEED_METRIC_LABELS).map(function (key) {
    var m = parsed.labMetrics[key];
    var cls = speedRatingClass(m.rating);
    return (
      '<div class="msp-metric-tile ' + cls + '">' +
        '<div class="msp-metric-name">' + escapeHtml(SPEED_METRIC_LABELS[key]) + "</div>" +
        '<div class="msp-metric-value">' + escapeHtml(m.displayValue) + "</div>" +
      "</div>"
    );
  }).join("");

  var fieldWrap = document.getElementById("mspSpeedFieldMetricsWrap");
  if (!parsed.fieldMetrics) {
    fieldWrap.innerHTML = '<p class="msp-field-empty">Data lapangan (dari pengguna nyata, Chrome UX Report) tidak tersedia untuk URL ini -- biasanya karena traffic situs belum cukup tercatat Google. Ini normal untuk situs skala kecil-menengah dan bukan tanda ada masalah.</p>';
  } else {
    var rows = Object.keys(SPEED_FIELD_METRIC_LABELS).map(function (key) {
      var m = parsed.fieldMetrics[key];
      if (!m) { return ""; }
      var cls = speedFieldCategoryClass(m.category);
      var unit = key === "cls" ? "" : " ms";
      return (
        '<div class="msp-metric-tile ' + cls + '">' +
          '<div class="msp-metric-name">' + escapeHtml(SPEED_FIELD_METRIC_LABELS[key]) + "</div>" +
          '<div class="msp-metric-value">' + m.percentile + unit + "</div>" +
        "</div>"
      );
    }).join("");
    fieldWrap.innerHTML = '<div class="msp-metrics-grid">' + rows + "</div>";
  }

  var oppWrap = document.getElementById("mspSpeedOpportunities");
  if (!parsed.opportunities.length) {
    oppWrap.innerHTML = '<p class="msp-opportunity-empty">Tidak ada peluang perbaikan performa signifikan yang terdeteksi. 🎉</p>';
  } else {
    oppWrap.innerHTML = parsed.opportunities.map(function (op) {
      return (
        '<div class="msp-opportunity">' +
          '<div class="msp-opportunity-head">' +
            "<span>" + escapeHtml(op.title) + "</span>" +
            '<span class="msp-opportunity-savings">' + escapeHtml(op.displayValue || "") + "</span>" +
          "</div>" +
          '<p class="msp-opportunity-desc">' + renderSpeedDescription(op.description) + "</p>" +
        "</div>"
      );
    }).join("");
  }
}

function mspHostnameOf(urlStr) {
  try { return new URL(urlStr).hostname; } catch (e) { return null; }
}

/**
 * Audit satu halaman, Crawl Situs, dan Cek Kecepatan masing-masing punya
 * halaman fiturnya sendiri yang menimpa storage-nya sendiri, independen
 * satu sama lain -- jadi kalau pengguna baru saja audit domain A tapi
 * sebelumnya pernah menjalankan Crawl Situs/Cek Kecepatan untuk domain B,
 * hasil lama domain B itu MASIH tersimpan dan tidak boleh ikut tercampur
 * ke laporan gabungan domain A begitu saja. Domain acuan dipilih dari
 * hasil yang paling baru dibuat (generatedAt); hasil lain yang domainnya
 * beda dianggap tidak ada untuk laporan yang sedang dibuka ini (datanya
 * tetap ada di storage apa adanya, cuma tidak dirender di sini).
 */
function mspFilterByReferenceDomain(auditModel, crawlData, speedData) {
  var entries = [];
  if (auditModel) { entries.push({ generatedAt: auditModel.generatedAt, hostname: mspHostnameOf(auditModel.url) }); }
  if (crawlData && crawlData.result) { entries.push({ generatedAt: crawlData.generatedAt, hostname: mspHostnameOf(crawlData.result.origin) }); }
  if (speedData && speedData.parsed) { entries.push({ generatedAt: speedData.generatedAt, hostname: mspHostnameOf(speedData.targetUrl) }); }

  if (entries.length < 2) {
    return { auditModel: auditModel, crawlData: crawlData, speedData: speedData, excluded: [] };
  }

  entries.sort(function (a, b) { return (b.generatedAt || "").localeCompare(a.generatedAt || ""); });
  var referenceHostname = entries[0].hostname;

  var excluded = [];
  var outAudit = auditModel;
  var outCrawl = crawlData;
  var outSpeed = speedData;

  if (outAudit && mspHostnameOf(outAudit.url) !== referenceHostname) {
    excluded.push({ label: "Audit SEO On-Page", hostname: mspHostnameOf(outAudit.url) });
    outAudit = null;
  }
  if (outCrawl && outCrawl.result && mspHostnameOf(outCrawl.result.origin) !== referenceHostname) {
    excluded.push({ label: "Crawl Situs", hostname: mspHostnameOf(outCrawl.result.origin) });
    outCrawl = null;
  }
  if (outSpeed && outSpeed.parsed && mspHostnameOf(outSpeed.targetUrl) !== referenceHostname) {
    excluded.push({ label: "Cek Kecepatan", hostname: mspHostnameOf(outSpeed.targetUrl) });
    outSpeed = null;
  }

  return { auditModel: outAudit, crawlData: outCrawl, speedData: outSpeed, excluded: excluded, referenceHostname: referenceHostname };
}

async function init() {
  var autoprint = new URLSearchParams(window.location.search).get("autoprint") === "1";

  var data = await chrome.storage.local.get(["mspLastAudit", "mspLastCrawl", "mspLastSpeedCheck"]);
  var filtered = mspFilterByReferenceDomain(data.mspLastAudit, data.mspLastCrawl, data.mspLastSpeedCheck);
  var auditModel = filtered.auditModel;
  var crawlData = filtered.crawlData;
  var speedData = filtered.speedData;

  if (!auditModel && !crawlData && !speedData) {
    document.getElementById("mspEmptyState").hidden = false;
    return;
  }

  document.getElementById("mspReportRoot").hidden = false;

  if (filtered.excluded.length) {
    var mismatchEl = document.getElementById("mspDomainMismatchNotice");
    mismatchEl.hidden = false;
    mismatchEl.textContent = "Catatan: hasil " +
      filtered.excluded.map(function (e) { return e.label + " (" + (e.hostname || "domain lain") + ")"; }).join(" dan ") +
      " tidak ditampilkan di laporan ini karena berasal dari domain berbeda dari data yang paling baru dibuat (" +
      filtered.referenceHostname + "). Jalankan ulang fitur terkait untuk domain ini kalau ingin digabungkan dalam satu laporan.";
  }

  var hostname = "halaman";

  if (auditModel) {
    document.getElementById("mspOnPageSection").hidden = false;
    document.getElementById("mspReportUrl").textContent = auditModel.url;
    document.getElementById("mspReportDate").textContent = formatDate(auditModel.generatedAt);
    renderScoreRing(auditModel.overall.score);
    renderCategoryScores(auditModel.categories);
    renderSpeedCategoryRow(speedData);
    renderStatTiles(auditModel.overall.counts);
    renderDetailSections(auditModel.categories);
    try { hostname = new URL(auditModel.url).hostname; } catch (e) { /* biarkan default */ }

    var titleMetaBtn = document.getElementById("mspGeminiTitleMetaBtn");
    if (auditModel.rawSignals) {
      titleMetaBtn.addEventListener("click", function () {
        handleTitleMetaAnalysis(auditModel.rawSignals);
      });
    } else {
      // Hasil audit lama (sebelum fitur AI ada) tidak menyimpan rawSignals --
      // minta audit ulang dari popup alih-alih gagal diam-diam.
      titleMetaBtn.disabled = true;
      titleMetaBtn.title = "Jalankan audit ulang dari popup ekstensi dulu untuk mengaktifkan fitur ini.";
      document.getElementById("mspGeminiTitleMetaError").hidden = false;
      document.getElementById("mspGeminiTitleMetaError").textContent =
        "Hasil audit ini dibuat sebelum fitur analisis AI ada -- jalankan audit ulang dari popup ekstensi untuk mengaktifkannya.";
    }
  }

  document.getElementById("mspGeminiSummaryBtn").addEventListener("click", function () {
    handleExecSummary(auditModel, crawlData, speedData);
  });

  if (crawlData && crawlData.result) {
    renderCrawlSection(crawlData);
    if (hostname === "halaman") {
      try { hostname = new URL(crawlData.result.origin).hostname; } catch (e) { /* biarkan default */ }
    }
  }

  if (speedData && speedData.parsed) {
    renderSpeedSection(speedData);
    if (hostname === "halaman") {
      try { hostname = new URL(speedData.targetUrl).hostname; } catch (e) { /* biarkan default */ }
    }
  }

  var generatedTimestamps = [
    auditModel && auditModel.generatedAt,
    crawlData && crawlData.generatedAt,
    speedData && speedData.generatedAt
  ].filter(Boolean).sort();
  document.getElementById("mspReportGeneratedDate").textContent =
    formatDate(generatedTimestamps.length ? generatedTimestamps[generatedTimestamps.length - 1] : new Date().toISOString());

  // Judul dokumen dipakai browser sebagai nama file default saat "Simpan sebagai PDF".
  document.title = "Laporan MSP Page Audit - " + hostname;

  var clientInput = document.getElementById("mspClientName");
  var clientRow = document.getElementById("mspReportClientRow");
  var clientCell = document.getElementById("mspReportClient");
  clientInput.addEventListener("input", function () {
    var val = clientInput.value.trim();
    clientRow.hidden = !val;
    clientCell.textContent = val;
    document.title = "Laporan MSP Page Audit - " + hostname + (val ? " - " + val : "");
  });

  document.getElementById("mspDownloadPdf").addEventListener("click", function () {
    window.print();
  });

  if (autoprint) {
    // Beri waktu render/layout settle dulu sebelum memicu dialog cetak,
    // supaya tabel/skor yang baru dirender tidak terpotong di PDF.
    window.setTimeout(function () { window.print(); }, 300);
  }
}

init();
