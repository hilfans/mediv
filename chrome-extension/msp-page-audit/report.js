"use strict";

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

async function init() {
  var autoprint = new URLSearchParams(window.location.search).get("autoprint") === "1";

  var data = await chrome.storage.local.get(["mspLastAudit", "mspLastCrawl", "mspLastSpeedCheck"]);
  var auditModel = data.mspLastAudit;
  var crawlData = data.mspLastCrawl;
  var speedData = data.mspLastSpeedCheck;

  if (!auditModel && !crawlData && !speedData) {
    document.getElementById("mspEmptyState").hidden = false;
    return;
  }

  document.getElementById("mspReportRoot").hidden = false;

  var hostname = "halaman";

  if (auditModel) {
    document.getElementById("mspOnPageSection").hidden = false;
    document.getElementById("mspReportUrl").textContent = auditModel.url;
    document.getElementById("mspReportDate").textContent = formatDate(auditModel.generatedAt);
    renderScoreRing(auditModel.overall.score);
    renderCategoryScores(auditModel.categories);
    renderStatTiles(auditModel.overall.counts);
    renderDetailSections(auditModel.categories);
    try { hostname = new URL(auditModel.url).hostname; } catch (e) { /* biarkan default */ }
  }

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
