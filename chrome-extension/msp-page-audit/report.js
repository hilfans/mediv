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

function renderRow(r) {
  var extraHtml = "";
  if (r.extra && r.extra.type === "heading-outline") {
    extraHtml = renderHeadingOutline(r.extra.items);
  } else if (r.extra && r.extra.type === "link-breakdown") {
    extraHtml = renderLinkBreakdown(r.extra);
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

async function init() {
  var data = await chrome.storage.local.get("mspLastAudit");
  var model = data && data.mspLastAudit;

  if (!model) {
    document.getElementById("mspEmptyState").hidden = false;
    return;
  }

  document.getElementById("mspReportRoot").hidden = false;
  document.getElementById("mspReportUrl").textContent = model.url;
  document.getElementById("mspReportDate").textContent = formatDate(model.generatedAt);

  renderScoreRing(model.overall.score);
  renderCategoryScores(model.categories);
  renderStatTiles(model.overall.counts);
  renderDetailSections(model.categories);

  // Judul dokumen dipakai browser sebagai nama file default saat "Simpan sebagai PDF".
  var hostname = "halaman";
  try { hostname = new URL(model.url).hostname; } catch (e) { /* biarkan default */ }
  document.title = "Laporan Audit - " + hostname;

  var clientInput = document.getElementById("mspClientName");
  var clientRow = document.getElementById("mspReportClientRow");
  var clientCell = document.getElementById("mspReportClient");
  clientInput.addEventListener("input", function () {
    var val = clientInput.value.trim();
    clientRow.hidden = !val;
    clientCell.textContent = val;
    document.title = "Laporan Audit - " + hostname + (val ? " - " + val : "");
  });

  document.getElementById("mspDownloadPdf").addEventListener("click", function () {
    window.print();
  });
}

init();
