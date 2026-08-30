"use strict";

var PRESETS = {
  light: { maxPages: 50, label: "Light (50 halaman)" },
  medium: { maxPages: 200, label: "Medium (200 halaman)" },
  heavy: { maxPages: 500, label: "Heavy (500 halaman)" },
  ultra: { maxPages: 1000, label: "Ultra (1000 halaman)" }
};

var HOST_PERMISSIONS = { origins: ["http://*/*", "https://*/*"] };

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectedPreset() {
  var checked = document.querySelector('input[name="mspPreset"]:checked');
  return (checked && checked.value) || "light";
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}

function showModal(presetKey) {
  var preset = PRESETS[presetKey];
  document.getElementById("mspModalBody").textContent =
    "Anda akan meng-crawl hingga " + preset.maxPages + " halaman (tingkat " + preset.label + "). " +
    "Ekstensi akan meminta izin tambahan untuk mengakses domain di luar tab aktif, khusus untuk fitur ini.";
  document.getElementById("mspConfirmModal").hidden = false;
}

function hideModal() {
  document.getElementById("mspConfirmModal").hidden = true;
}

function setProgress(phaseLabel, done, target, logEntry) {
  document.getElementById("mspProgressPhase").textContent = phaseLabel;
  var pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  document.getElementById("mspProgressFill").style.width = pct + "%";
  document.getElementById("mspProgressCount").textContent = done + " dari perkiraan " + target + " halaman";
  if (logEntry) {
    var log = document.getElementById("mspProgressLog");
    var li = document.createElement("li");
    li.className = logEntry.cls || "";
    li.textContent = logEntry.text;
    log.insertBefore(li, log.firstChild);
    while (log.children.length > 60) { log.removeChild(log.lastChild); }
  }
}

function phaseLabel(phase) {
  var labels = {
    robots: "Memeriksa robots.txt situs target…",
    sitemap: "Mengambil daftar URL dari sitemap.xml…",
    crawling: "Meng-crawl halaman…",
    links: "Memeriksa tautan (broken link check)…",
    done: "Selesai."
  };
  return labels[phase] || phase;
}

function aggregateCrawl(crawlResult) {
  var overall = { pass: 0, warn: 0, fail: 0 };
  crawlResult.pages.forEach(function (p) {
    if (p.evaluation) {
      overall.pass += p.evaluation.overall.counts.pass;
      overall.warn += p.evaluation.overall.counts.warn;
      overall.fail += p.evaluation.overall.counts.fail;
    }
  });
  var score = mspScoreFromCounts(overall);
  var brokenLinks = crawlResult.linkChecks.filter(function (l) { return !l.ok; });
  return { overall: overall, score: score, brokenLinks: brokenLinks };
}

function renderResults(crawlResult, generatedAt) {
  document.getElementById("mspSetupForm").hidden = true;
  document.getElementById("mspProgressSection").hidden = true;
  document.getElementById("mspResults").hidden = false;
  document.getElementById("mspDownloadPdf").hidden = false;

  document.getElementById("mspResultOrigin").textContent = crawlResult.origin;
  document.getElementById("mspResultDate").textContent = formatDate(generatedAt);

  var agg = aggregateCrawl(crawlResult);

  var tiles = [
    { label: "Halaman Di-crawl", value: crawlResult.pages.length, cls: "" },
    { label: "Skor Situs", value: agg.score + "%", cls: agg.score >= 90 ? "pass" : (agg.score >= 50 ? "warn" : "fail") },
    { label: "Broken Link", value: agg.brokenLinks.length, cls: agg.brokenLinks.length > 0 ? "fail" : "pass" },
    { label: "Redirect", value: crawlResult.redirects.length, cls: crawlResult.redirects.length > 0 ? "warn" : "pass" },
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
    return (
      "<tr>" +
        '<td class="msp-url-cell"><a href="' + escapeHtml(p.finalUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(p.finalUrl) + "</a></td>" +
        '<td><span class="msp-status-chip ' + statusCls + '">' + p.status + "</span></td>" +
        "<td>" + scoreCell + "</td>" +
      "</tr>"
    );
  }).join("");
  document.querySelector("#mspPagesTable tbody").innerHTML = pagesBody;

  document.getElementById("mspBrokenCount").textContent = agg.brokenLinks.length;
  if (agg.brokenLinks.length === 0) {
    document.getElementById("mspBrokenEmpty").hidden = false;
    document.querySelector("#mspBrokenTable tbody").innerHTML = "";
  } else {
    document.getElementById("mspBrokenEmpty").hidden = true;
    document.querySelector("#mspBrokenTable tbody").innerHTML = agg.brokenLinks.map(function (l) {
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

  document.getElementById("mspRedirectCount").textContent = crawlResult.redirects.length;
  if (crawlResult.redirects.length === 0) {
    document.getElementById("mspRedirectEmpty").hidden = false;
    document.querySelector("#mspRedirectTable tbody").innerHTML = "";
  } else {
    document.getElementById("mspRedirectEmpty").hidden = true;
    document.querySelector("#mspRedirectTable tbody").innerHTML = crawlResult.redirects.map(function (r) {
      return (
        "<tr>" +
          '<td class="msp-url-cell">' + escapeHtml(r.from) + "</td>" +
          '<td class="msp-url-cell">' + escapeHtml(r.to) + "</td>" +
          '<td><span class="msp-status-chip warn">' + r.status + "</span></td>" +
        "</tr>"
      );
    }).join("");
  }

  var hostname = crawlResult.origin;
  try { hostname = new URL(crawlResult.origin).hostname; } catch (e) { /* biarkan default */ }
  document.title = "Laporan Crawl - " + hostname;
}

async function runCrawlFlow(targetUrl, presetKey) {
  document.getElementById("mspSetupForm").hidden = true;
  document.getElementById("mspProgressSection").hidden = false;
  document.getElementById("mspProgressLog").innerHTML = "";

  var maxPages = PRESETS[presetKey].maxPages;

  var crawlResult = await mspRunCrawl({
    startUrl: targetUrl,
    maxPages: maxPages,
    concurrency: 4,
    politeDelayMs: 200
  }, {
    onPhase: function (phase) {
      setProgress(phaseLabel(phase), 0, maxPages);
    },
    onPageDone: function (page, done, target) {
      var cls = page.status >= 200 && page.status < 400 ? "status-ok" : "status-fail";
      setProgress(phaseLabel("crawling"), done, target, {
        cls: cls,
        text: "[" + page.status + "] " + page.finalUrl
      });
    }
  });

  var generatedAt = new Date().toISOString();
  await chrome.storage.local.set({
    mspLastCrawl: { result: crawlResult, generatedAt: generatedAt }
  });

  renderResults(crawlResult, generatedAt);
}

async function handleStartCrawl() {
  var targetInput = document.getElementById("mspTargetUrl");
  var targetUrl = targetInput.value.trim();

  if (!targetUrl) {
    targetInput.focus();
    return;
  }
  try {
    var parsed = new URL(targetUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") { throw new Error("bukan http/https"); }
  } catch (e) {
    alert("URL tidak valid. Contoh yang benar: https://www.msp.web.id");
    return;
  }

  showModal(selectedPreset());
}

async function init() {
  var targetInput = document.getElementById("mspTargetUrl");
  var lastAuditData = await chrome.storage.local.get("mspLastAudit");
  if (lastAuditData && lastAuditData.mspLastAudit && lastAuditData.mspLastAudit.url) {
    try {
      targetInput.value = new URL(lastAuditData.mspLastAudit.url).origin;
    } catch (e) { /* biarkan kosong */ }
  }

  var lastCrawlData = await chrome.storage.local.get("mspLastCrawl");
  if (lastCrawlData && lastCrawlData.mspLastCrawl) {
    document.getElementById("mspLastCrawlNotice").hidden = false;
    document.getElementById("mspShowLastCrawl").addEventListener("click", function () {
      renderResults(lastCrawlData.mspLastCrawl.result, lastCrawlData.mspLastCrawl.generatedAt);
    });
  }

  document.getElementById("mspStartCrawl").addEventListener("click", handleStartCrawl);
  document.getElementById("mspModalCancel").addEventListener("click", hideModal);

  document.getElementById("mspModalConfirm").addEventListener("click", async function () {
    var presetKey = selectedPreset();
    hideModal();

    var granted = false;
    try {
      granted = await chrome.permissions.request(HOST_PERMISSIONS);
    } catch (e) {
      granted = false;
    }

    if (!granted) {
      alert("Izin akses situs lain tidak diberikan, jadi crawl dibatalkan. Audit satu halaman tetap bisa dipakai seperti biasa dari popup ekstensi.");
      return;
    }

    var targetUrl = document.getElementById("mspTargetUrl").value.trim();
    try {
      await runCrawlFlow(targetUrl, presetKey);
    } catch (err) {
      document.getElementById("mspProgressSection").hidden = true;
      document.getElementById("mspSetupForm").hidden = false;
      alert("Crawl gagal: " + ((err && err.message) || err));
    }
  });

  document.getElementById("mspNewCrawl").addEventListener("click", function () {
    document.getElementById("mspResults").hidden = true;
    document.getElementById("mspDownloadPdf").hidden = true;
    document.getElementById("mspSetupForm").hidden = false;
  });

  document.getElementById("mspDownloadPdf").addEventListener("click", function () {
    window.print();
  });
}

init();
