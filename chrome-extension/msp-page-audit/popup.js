"use strict";

/* ============================================================
   FUNGSI YANG DISUNTIKKAN KE HALAMAN AKTIF (via chrome.scripting)
   Ditulis sebagai function biasa (bukan arrow/const import) karena
   chrome.scripting.executeScript men-serialize fungsi ini sendiri
   ke konteks halaman target — tidak boleh mengacu closure di luar dirinya.
   ============================================================ */

function mspExtractDomSignals() {
  function metaByName(name) {
    var el = document.querySelector('meta[name="' + name + '" i]');
    return el ? (el.getAttribute("content") || "") : "";
  }
  function metaByProperty(prop) {
    var el = document.querySelector('meta[property="' + prop + '"]');
    return el ? (el.getAttribute("content") || "") : "";
  }

  var title = document.title || "";
  var metaDescription = metaByName("description");
  var canonicalEl = document.querySelector('link[rel="canonical" i]');
  var canonical = canonicalEl ? (canonicalEl.getAttribute("href") || "") : "";
  var robotsContent = metaByName("robots");
  var hasViewport = !!document.querySelector('meta[name="viewport" i]');
  var lang = document.documentElement.getAttribute("lang") || "";

  var h1s = document.querySelectorAll("h1");
  var headingNodes = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
  var headingOutline = [];
  var lastLevel = 0;
  var skippedHeadingLevel = false;
  headingNodes.forEach(function (h) {
    var level = parseInt(h.tagName.substring(1), 10);
    headingOutline.push({ level: level, text: (h.textContent || "").trim().slice(0, 80) });
    if (lastLevel > 0 && level - lastLevel > 1) {
      skippedHeadingLevel = true;
    }
    lastLevel = level;
  });

  var images = document.querySelectorAll("img");
  var missingAltCount = 0;
  images.forEach(function (img) {
    var alt = img.getAttribute("alt");
    if (alt === null || alt.trim() === "") {
      missingAltCount += 1;
    }
  });

  var og = {
    title: metaByProperty("og:title"),
    description: metaByProperty("og:description"),
    image: metaByProperty("og:image"),
    type: metaByProperty("og:type")
  };
  var twitterCard = metaByName("twitter:card");

  var jsonLdNodes = document.querySelectorAll('script[type="application/ld+json"]');
  var jsonLdTypes = [];
  var jsonLdErrors = 0;
  jsonLdNodes.forEach(function (node) {
    try {
      var data = JSON.parse(node.textContent);
      var items = Array.isArray(data) ? data : [data];
      items.forEach(function (item) {
        if (item && item["@graph"] && Array.isArray(item["@graph"])) {
          item["@graph"].forEach(function (g) {
            if (g && g["@type"]) { jsonLdTypes.push(g["@type"]); }
          });
        } else if (item && item["@type"]) {
          jsonLdTypes.push(item["@type"]);
        }
      });
    } catch (e) {
      jsonLdErrors += 1;
    }
  });

  // innerText butuh layout render (akurat & mengabaikan <script>/<style>/elemen
  // tersembunyi). Fallback ke textContent-yang-dibersihkan hanya jika innerText
  // tidak tersedia, supaya kode JS/CSS tidak ikut terhitung sebagai kata.
  var bodyText = "";
  if (document.body) {
    if (typeof document.body.innerText === "string" && document.body.innerText.length > 0) {
      bodyText = document.body.innerText;
    } else {
      var bodyClone = document.body.cloneNode(true);
      var junkNodes = bodyClone.querySelectorAll("script, style, noscript, template");
      junkNodes.forEach(function (n) { n.remove(); });
      bodyText = bodyClone.textContent || "";
    }
  }
  var trimmed = bodyText.trim();
  var wordCount = trimmed.length ? trimmed.split(/\s+/).length : 0;

  var anchors = document.querySelectorAll("a[href]");
  var internalLinks = 0;
  var externalLinks = 0;
  var origin = location.origin;
  anchors.forEach(function (a) {
    var href = a.getAttribute("href") || "";
    var lower = href.toLowerCase();
    if (!href || lower.indexOf("#") === 0 || lower.indexOf("javascript:") === 0 ||
        lower.indexOf("mailto:") === 0 || lower.indexOf("tel:") === 0) {
      return;
    }
    try {
      var url = new URL(href, location.href);
      if (url.origin === origin) { internalLinks += 1; } else { externalLinks += 1; }
    } catch (e) { /* URL tidak valid, dilewati */ }
  });

  return {
    url: location.href,
    origin: origin,
    title: title,
    metaDescription: metaDescription,
    canonical: canonical,
    robotsContent: robotsContent,
    hasViewport: hasViewport,
    lang: lang,
    h1Count: h1s.length,
    h1Text: h1s.length ? (h1s[0].textContent || "").trim().slice(0, 120) : "",
    headingOutline: headingOutline,
    skippedHeadingLevel: skippedHeadingLevel,
    totalImages: images.length,
    missingAltCount: missingAltCount,
    og: og,
    twitterCard: twitterCard,
    jsonLdCount: jsonLdNodes.length,
    jsonLdTypes: jsonLdTypes,
    jsonLdErrors: jsonLdErrors,
    wordCount: wordCount,
    internalLinks: internalLinks,
    externalLinks: externalLinks
  };
}

async function mspCheckSameOriginNetwork(pageUrl) {
  var origin = "";
  try { origin = new URL(pageUrl).origin; } catch (e) { /* biarkan kosong */ }

  var result = {
    isHttps: pageUrl.toLowerCase().indexOf("https://") === 0,
    status: null,
    headers: null,
    headerFetchError: null,
    robotsTxt: { checked: false, present: false, sitemaps: [], disallowsAll: false, error: null },
    sitemapXml: { checked: false, present: false, error: null }
  };

  try {
    // GET dipakai (bukan HEAD) karena sebagian server tidak mengirim
    // header keamanan yang sama pada respons HEAD.
    var resp = await fetch(pageUrl, { method: "GET", cache: "no-store", credentials: "same-origin" });
    result.status = resp.status;
    result.headers = {
      strictTransportSecurity: resp.headers.get("strict-transport-security"),
      xContentTypeOptions: resp.headers.get("x-content-type-options"),
      xFrameOptions: resp.headers.get("x-frame-options"),
      contentSecurityPolicy: resp.headers.get("content-security-policy"),
      cacheControl: resp.headers.get("cache-control"),
      expires: resp.headers.get("expires"),
      contentEncoding: resp.headers.get("content-encoding"),
      contentType: resp.headers.get("content-type")
    };
  } catch (e) {
    result.headerFetchError = String((e && e.message) || e);
  }

  if (origin) {
    try {
      var r = await fetch(origin + "/robots.txt", { cache: "no-store" });
      result.robotsTxt.checked = true;
      if (r.ok) {
        result.robotsTxt.present = true;
        var text = await r.text();
        var lines = text.split(/\r?\n/);
        var sitemaps = [];
        var wildcardAgent = false;
        var disallowAllForWildcard = false;
        lines.forEach(function (line) {
          var l = line.trim();
          var lower = l.toLowerCase();
          if (lower.indexOf("sitemap:") === 0) {
            sitemaps.push(l.substring(8).trim());
          }
          if (lower.indexOf("user-agent:") === 0) {
            wildcardAgent = lower.indexOf("*") !== -1;
          }
          if (wildcardAgent && lower.indexOf("disallow:") === 0) {
            if (l.substring(9).trim() === "/") { disallowAllForWildcard = true; }
          }
        });
        result.robotsTxt.sitemaps = sitemaps;
        result.robotsTxt.disallowsAll = disallowAllForWildcard;
      }
    } catch (e) {
      result.robotsTxt.error = String((e && e.message) || e);
    }

    try {
      var sm = await fetch(origin + "/sitemap.xml", { method: "HEAD", cache: "no-store" });
      result.sitemapXml.checked = true;
      result.sitemapXml.present = sm.ok;
    } catch (e) {
      result.sitemapXml.error = String((e && e.message) || e);
    }
  }

  return result;
}

/* ============================================================
   LOGIKA POPUP (berjalan di konteks ekstensi, bukan halaman target)
   ============================================================ */

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

function row(status, label, detailHtml) {
  return (
    '<div class="msp-row">' +
      '<div class="msp-badge ' + status + '">' + badgeSymbol(status) + "</div>" +
      '<div class="msp-row-body">' +
        '<div class="msp-row-label">' + escapeHtml(label) + "</div>" +
        (detailHtml ? '<div class="msp-row-detail">' + detailHtml + "</div>" : "") +
      "</div>" +
    "</div>"
  );
}

function section(title, rowsHtml) {
  return (
    '<div class="msp-section">' +
      '<div class="msp-section-title">' + escapeHtml(title) + "</div>" +
      rowsHtml +
    "</div>"
  );
}

/**
 * Menyusun seluruh laporan (array baris {status,...}) dari sinyal DOM + jaringan.
 * Mengembalikan { sectionsHtml, counts: {pass,warn,fail} }.
 */
function buildReport(dom, net) {
  var counts = { pass: 0, warn: 0, fail: 0 };
  var sections = [];

  function pushRow(rows, status, label, detailHtml) {
    if (status !== "info") { counts[status] += 1; }
    rows.push(row(status, label, detailHtml));
  }

  // --- SEO On-Page ---
  var seoRows = [];
  var titleLen = dom.title.length;
  if (!dom.title) {
    pushRow(seoRows, "fail", "Title", "Halaman tidak memiliki tag <code>&lt;title&gt;</code>.");
  } else if (titleLen < 30 || titleLen > 60) {
    pushRow(seoRows, "warn", "Title (" + titleLen + " karakter)",
      "Idealnya 30&ndash;60 karakter. Isi saat ini: &ldquo;" + escapeHtml(dom.title) + "&rdquo;");
  } else {
    pushRow(seoRows, "pass", "Title (" + titleLen + " karakter)", escapeHtml(dom.title));
  }

  var descLen = dom.metaDescription.length;
  if (!dom.metaDescription) {
    pushRow(seoRows, "fail", "Meta description", "Tidak ditemukan meta description.");
  } else if (descLen < 70 || descLen > 160) {
    pushRow(seoRows, "warn", "Meta description (" + descLen + " karakter)",
      "Idealnya 70&ndash;160 karakter.");
  } else {
    pushRow(seoRows, "pass", "Meta description (" + descLen + " karakter)", "");
  }

  if (dom.h1Count === 0) {
    pushRow(seoRows, "fail", "Heading H1", "Halaman tidak memiliki H1.");
  } else if (dom.h1Count > 1) {
    pushRow(seoRows, "warn", "Heading H1 (" + dom.h1Count + " ditemukan)",
      "Sebaiknya hanya ada satu H1 per halaman.");
  } else {
    pushRow(seoRows, "pass", "Heading H1", escapeHtml(dom.h1Text));
  }

  if (dom.headingOutline.length > 0) {
    pushRow(seoRows, dom.skippedHeadingLevel ? "warn" : "pass",
      "Urutan heading (" + dom.headingOutline.length + " ditemukan)",
      dom.skippedHeadingLevel ? "Ada level heading yang dilompati (mis. H2 langsung ke H4)." : "Urutan heading berjenjang dengan baik.");
  }

  pushRow(seoRows, dom.canonical ? "pass" : "warn", "Canonical tag",
    dom.canonical ? escapeHtml(dom.canonical) : "Tidak ditemukan tag canonical.");

  var robotsLower = dom.robotsContent.toLowerCase();
  if (robotsLower.indexOf("noindex") !== -1) {
    pushRow(seoRows, "fail", "Meta robots", "Berisi <code>noindex</code> &mdash; halaman diblokir dari indeks mesin pencari.");
  } else if (dom.robotsContent) {
    pushRow(seoRows, "pass", "Meta robots", escapeHtml(dom.robotsContent));
  } else {
    pushRow(seoRows, "pass", "Meta robots", "Tidak ada pembatasan (default: index, follow).");
  }

  pushRow(seoRows, dom.hasViewport ? "pass" : "fail", "Meta viewport (mobile-friendly)",
    dom.hasViewport ? "" : "Tidak ditemukan &mdash; halaman berisiko tidak responsif di mobile.");

  if (dom.wordCount < 300) {
    pushRow(seoRows, "warn", "Jumlah kata (&asymp; " + dom.wordCount + ")",
      "Konten tergolong tipis (di bawah 300 kata). Wajar untuk halaman non-artikel.");
  } else {
    pushRow(seoRows, "pass", "Jumlah kata (&asymp; " + dom.wordCount + ")", "");
  }

  pushRow(seoRows, "pass", "Tautan pada halaman",
    dom.internalLinks + " internal &middot; " + dom.externalLinks + " eksternal");

  sections.push(section("SEO On-Page", seoRows.join("")));

  // --- Sosial & Data Terstruktur ---
  var socialRows = [];
  var ogFound = [dom.og.title, dom.og.description, dom.og.image].filter(Boolean).length;
  pushRow(socialRows, ogFound === 3 ? "pass" : "warn", "Open Graph (" + ogFound + "/3 tag utama)",
    "og:title, og:description, og:image untuk tampilan saat dibagikan ke media sosial.");
  pushRow(socialRows, dom.twitterCard ? "pass" : "warn", "Twitter Card",
    dom.twitterCard ? escapeHtml(dom.twitterCard) : "Tidak ditemukan meta twitter:card.");

  if (dom.jsonLdErrors > 0) {
    pushRow(socialRows, "fail", "Data terstruktur (JSON-LD)",
      dom.jsonLdErrors + " blok JSON-LD gagal di-parse (format tidak valid).");
  } else if (dom.jsonLdCount === 0) {
    pushRow(socialRows, "warn", "Data terstruktur (JSON-LD)", "Tidak ditemukan markup schema.org.");
  } else {
    var typesLabel = dom.jsonLdTypes.length ? dom.jsonLdTypes.slice(0, 6).join(", ") : "tipe tidak terbaca";
    pushRow(socialRows, "pass", "Data terstruktur (" + dom.jsonLdCount + " blok)", escapeHtml(typesLabel));
  }
  sections.push(section("Sosial &amp; Data Terstruktur", socialRows.join("")));

  // --- Gambar ---
  var imgRows = [];
  if (dom.totalImages === 0) {
    pushRow(imgRows, "pass", "Gambar", "Tidak ada elemen &lt;img&gt; pada halaman.");
  } else if (dom.missingAltCount > 0) {
    pushRow(imgRows, "warn", "Atribut alt gambar",
      dom.missingAltCount + " dari " + dom.totalImages + " gambar tanpa atribut alt.");
  } else {
    pushRow(imgRows, "pass", "Atribut alt gambar", "Semua " + dom.totalImages + " gambar memiliki alt.");
  }
  sections.push(section("Gambar", imgRows.join("")));

  // --- Keamanan ---
  var secRows = [];
  pushRow(secRows, net.isHttps ? "pass" : "fail", "HTTPS", net.isHttps ? "" : "Halaman tidak dimuat lewat HTTPS.");

  if (net.headerFetchError) {
    pushRow(secRows, "warn", "Header respons", "Tidak dapat memeriksa header: " + escapeHtml(net.headerFetchError));
  } else if (net.headers) {
    var h = net.headers;
    if (net.isHttps) {
      pushRow(secRows, h.strictTransportSecurity ? "pass" : "warn", "Strict-Transport-Security (HSTS)",
        h.strictTransportSecurity ? escapeHtml(h.strictTransportSecurity) : "Header HSTS tidak ditemukan.");
    }
    pushRow(secRows, h.xContentTypeOptions === "nosniff" ? "pass" : "warn", "X-Content-Type-Options",
      h.xContentTypeOptions ? escapeHtml(h.xContentTypeOptions) : "Tidak ditemukan (disarankan: nosniff).");
    var hasFrameProtection = !!h.xFrameOptions || (h.contentSecurityPolicy && h.contentSecurityPolicy.indexOf("frame-ancestors") !== -1);
    pushRow(secRows, hasFrameProtection ? "pass" : "warn", "Proteksi Clickjacking",
      hasFrameProtection ? "X-Frame-Options / CSP frame-ancestors aktif." : "Tidak ditemukan X-Frame-Options maupun CSP frame-ancestors.");
    pushRow(secRows, h.contentSecurityPolicy ? "pass" : "warn", "Content-Security-Policy",
      h.contentSecurityPolicy ? "Header CSP ditemukan." : "Header CSP tidak ditemukan.");
  }
  sections.push(section("Keamanan", secRows.join("")));

  // --- Performa & Caching ---
  var perfRows = [];
  if (net.headers) {
    var hasCaching = !!(net.headers.cacheControl || net.headers.expires);
    pushRow(perfRows, hasCaching ? "pass" : "warn", "Cache-Control / Expires",
      hasCaching ? escapeHtml(net.headers.cacheControl || net.headers.expires) : "Tidak ditemukan header caching pada dokumen utama.");
    pushRow(perfRows, net.headers.contentEncoding ? "pass" : "warn", "Kompresi (Content-Encoding)",
      net.headers.contentEncoding ? escapeHtml(net.headers.contentEncoding) : "Tidak terkompresi (gzip/br tidak terdeteksi).");
  } else {
    pushRow(perfRows, "warn", "Header performa", "Tidak dapat diperiksa untuk halaman ini.");
  }
  sections.push(section("Performa &amp; Caching", perfRows.join("")));

  // --- Robots & Sitemap ---
  var robotsRows = [];
  if (!net.robotsTxt.checked) {
    pushRow(robotsRows, "warn", "robots.txt", "Tidak dapat diperiksa untuk halaman ini.");
  } else if (!net.robotsTxt.present) {
    pushRow(robotsRows, "warn", "robots.txt", "Tidak ditemukan di " + escapeHtml(dom.origin) + "/robots.txt");
  } else if (net.robotsTxt.disallowsAll) {
    pushRow(robotsRows, "fail", "robots.txt", "Memblokir SELURUH crawler (Disallow: /) untuk User-agent: *");
  } else {
    pushRow(robotsRows, "pass", "robots.txt",
      net.robotsTxt.sitemaps.length
        ? net.robotsTxt.sitemaps.length + " entri Sitemap terdaftar."
        : "Ditemukan, tapi tidak ada entri Sitemap.");
  }

  if (net.sitemapXml.checked) {
    pushRow(robotsRows, net.sitemapXml.present ? "pass" : "warn", "sitemap.xml (/sitemap.xml)",
      net.sitemapXml.present ? "" : "Tidak ditemukan di path standar (mungkin memakai nama/lokasi lain).");
  }
  sections.push(section("Robots &amp; Sitemap", robotsRows.join("")));

  return { sectionsHtml: sections.join(""), counts: counts };
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

  loadingEl.hidden = false;
  errorEl.hidden = true;
  reportEl.hidden = true;

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

    var report = buildReport(dom, net);
    document.getElementById("mspSummary").innerHTML = renderSummary(report.counts);
    document.getElementById("mspSections").innerHTML = report.sectionsHtml;

    loadingEl.hidden = true;
    reportEl.hidden = false;
  } catch (err) {
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorTextEl.textContent = (err && err.message) || "Terjadi kesalahan saat memindai halaman.";
  }
}

document.getElementById("mspRefresh").addEventListener("click", runAudit);
runAudit();
