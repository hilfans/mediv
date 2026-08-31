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

  // Twitter/X Card tidak dicek terpisah: kalau tidak dipasang, sistem X
  // otomatis fallback membaca tag Open Graph standar (og:image, og:title,
  // dst.) yang sudah dicek di bawah — jadi tidak ada risiko nyata yang
  // perlu diperingatkan untuk kasus ini.
  var og = {
    title: metaByProperty("og:title"),
    description: metaByProperty("og:description"),
    image: metaByProperty("og:image"),
    type: metaByProperty("og:type")
  };

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
  var internalLinksList = [];
  var externalLinksList = [];
  var seenLinks = {};
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
      var abs = url.href;
      if (seenLinks[abs]) { return; }
      seenLinks[abs] = true;
      if (url.origin === origin) { internalLinksList.push(abs); } else { externalLinksList.push(abs); }
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
    jsonLdCount: jsonLdNodes.length,
    jsonLdTypes: jsonLdTypes,
    jsonLdErrors: jsonLdErrors,
    wordCount: wordCount,
    internalLinks: internalLinksList.length,
    externalLinks: externalLinksList.length,
    internalLinksList: internalLinksList,
    externalLinksList: externalLinksList
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
   EVALUASI (murni, tanpa DOM/chrome.* — aman dipakai di popup
   maupun halaman laporan). Baris "detail" disimpan sebagai teks
   polos; pemanggil bertanggung jawab meng-escape saat merender HTML.

   Parameter "extra" (opsional) membawa data terstruktur untuk baris yang
   butuh tampilan lebih dari sekadar teks (mis. hierarki heading, daftar
   tautan) — hanya dipakai oleh halaman laporan lengkap (report.js), popup
   yang ringkas mengabaikannya.
   ============================================================ */

function mspRow(status, label, detail, extra) {
  var row = { status: status, label: label, detail: detail || "" };
  if (extra) { row.extra = extra; }
  return row;
}

// Tipe skema.org yang paling relevan untuk mesin pencari & AI crawler
// (ChatGPT/Perplexity, dll.) — dipakai untuk memberi saran kalau belum ada.
var MSP_KEY_SCHEMA_TYPES = ["Organization", "WebSite", "Article", "Product", "LocalBusiness", "BreadcrumbList", "FAQPage"];

function mspScoreFromCounts(counts) {
  var total = counts.pass + counts.warn + counts.fail;
  if (total === 0) { return 0; }
  return Math.round(((counts.pass + counts.warn * 0.5) / total) * 100);
}

function mspEvaluate(dom, net) {
  var overallCounts = { pass: 0, warn: 0, fail: 0 };
  var categories = [];

  function buildCategory(id, title, rows) {
    var counts = { pass: 0, warn: 0, fail: 0 };
    rows.forEach(function (r) {
      if (r.status !== "info") {
        counts[r.status] += 1;
        overallCounts[r.status] += 1;
      }
    });
    categories.push({
      id: id,
      title: title,
      rows: rows,
      counts: counts,
      score: mspScoreFromCounts(counts)
    });
  }

  // --- SEO On-Page ---
  var seoRows = [];
  var titleLen = dom.title.length;
  if (!dom.title) {
    seoRows.push(mspRow("fail", "Title", "Halaman tidak memiliki tag <title>."));
  } else if (titleLen < 30 || titleLen > 60) {
    seoRows.push(mspRow("warn", "Title (" + titleLen + " karakter)",
      "Idealnya 30-60 karakter. Isi saat ini: “" + dom.title + "”"));
  } else {
    seoRows.push(mspRow("pass", "Title (" + titleLen + " karakter)", dom.title));
  }

  var descLen = dom.metaDescription.length;
  if (!dom.metaDescription) {
    seoRows.push(mspRow("fail", "Meta description", "Tidak ditemukan meta description."));
  } else if (descLen < 70 || descLen > 160) {
    seoRows.push(mspRow("warn", "Meta description (" + descLen + " karakter)", "Idealnya 70-160 karakter."));
  } else {
    seoRows.push(mspRow("pass", "Meta description (" + descLen + " karakter)", ""));
  }

  if (dom.h1Count === 0) {
    seoRows.push(mspRow("fail", "Heading H1", "Halaman tidak memiliki H1."));
  } else if (dom.h1Count > 1) {
    seoRows.push(mspRow("warn", "Heading H1 (" + dom.h1Count + " ditemukan)", "Sebaiknya hanya ada satu H1 per halaman."));
  } else {
    seoRows.push(mspRow("pass", "Heading H1", dom.h1Text));
  }

  if (dom.headingOutline.length > 0) {
    seoRows.push(mspRow(dom.skippedHeadingLevel ? "warn" : "pass",
      "Urutan heading (" + dom.headingOutline.length + " ditemukan)",
      dom.skippedHeadingLevel ? "Ada level heading yang dilompati (mis. H2 langsung ke H4)." : "Urutan heading berjenjang dengan baik.",
      { type: "heading-outline", items: dom.headingOutline }));
  }

  seoRows.push(mspRow(dom.canonical ? "pass" : "warn", "Canonical tag",
    dom.canonical ? dom.canonical : "Tidak ditemukan tag canonical."));

  var robotsLower = dom.robotsContent.toLowerCase();
  if (robotsLower.indexOf("noindex") !== -1) {
    seoRows.push(mspRow("fail", "Meta robots", "Berisi noindex - halaman diblokir dari indeks mesin pencari."));
  } else if (dom.robotsContent) {
    seoRows.push(mspRow("pass", "Meta robots", dom.robotsContent));
  } else {
    seoRows.push(mspRow("pass", "Meta robots", "Tidak ada pembatasan (default: index, follow)."));
  }

  seoRows.push(mspRow(dom.hasViewport ? "pass" : "fail", "Meta viewport (mobile-friendly)",
    dom.hasViewport ? "" : "Tidak ditemukan - halaman berisiko tidak responsif di mobile."));

  if (dom.wordCount < 300) {
    seoRows.push(mspRow("warn", "Jumlah kata (≈ " + dom.wordCount + ")",
      "Konten tergolong tipis (di bawah 300 kata). Wajar untuk halaman non-artikel."));
  } else {
    seoRows.push(mspRow("pass", "Jumlah kata (≈ " + dom.wordCount + ")", ""));
  }

  seoRows.push(mspRow("info", "Tautan pada halaman", dom.internalLinks + " internal, " + dom.externalLinks + " eksternal",
    { type: "link-breakdown", internal: dom.internalLinksList || [], external: dom.externalLinksList || [] }));

  buildCategory("seo", "SEO On-Page", seoRows);

  // --- Sosial, Data Terstruktur & AI Bot ---
  // Twitter/X Card sengaja tidak dicek: kalau tidak dipasang, X otomatis
  // fallback membaca tag Open Graph standar di bawah ini, jadi tidak ada
  // risiko nyata yang perlu diperingatkan.
  var socialRows = [];
  var ogFound = [dom.og.title, dom.og.description, dom.og.image].filter(Boolean).length;
  socialRows.push(mspRow(ogFound === 3 ? "pass" : "warn", "Open Graph (" + ogFound + "/3 tag utama)",
    "og:title, og:description, og:image dipakai Facebook, LinkedIn, dan (lewat fallback) X saat tautan dibagikan."));

  if (dom.jsonLdErrors > 0) {
    socialRows.push(mspRow("fail", "JSON-LD (Schema Markup)", dom.jsonLdErrors + " blok JSON-LD gagal di-parse (format tidak valid)."));
  } else if (dom.jsonLdCount === 0) {
    socialRows.push(mspRow("warn", "JSON-LD (Schema Markup)",
      "Tidak ditemukan. Ini format data terstruktur paling penting untuk bot AI (ChatGPT, Perplexity) dan Google agar bisa memahami arti konten secara eksplisit. Disarankan menambah tipe seperti Organization, WebSite, Article, atau Product."));
  } else {
    var typesLabel = dom.jsonLdTypes.length ? dom.jsonLdTypes.join(", ") : "tipe tidak terbaca";
    var hasKeyType = dom.jsonLdTypes.some(function (t) {
      return MSP_KEY_SCHEMA_TYPES.indexOf(t) !== -1;
    });
    if (hasKeyType) {
      socialRows.push(mspRow("pass", "JSON-LD (" + dom.jsonLdCount + " blok)", "Tipe ditemukan: " + typesLabel));
    } else {
      socialRows.push(mspRow("warn", "JSON-LD (" + dom.jsonLdCount + " blok)",
        "Tipe ditemukan: " + typesLabel + ". Belum ada tipe umum seperti Organization/WebSite/Article/Product yang biasanya paling membantu bot AI & Google memahami halaman ini."));
    }
  }
  buildCategory("social", "Sosial, Data Terstruktur & AI Bot", socialRows);

  // --- Gambar ---
  var imgRows = [];
  if (dom.totalImages === 0) {
    imgRows.push(mspRow("pass", "Gambar", "Tidak ada elemen <img> pada halaman."));
  } else if (dom.missingAltCount > 0) {
    imgRows.push(mspRow("warn", "Atribut alt gambar", dom.missingAltCount + " dari " + dom.totalImages + " gambar tanpa atribut alt."));
  } else {
    imgRows.push(mspRow("pass", "Atribut alt gambar", "Semua " + dom.totalImages + " gambar memiliki alt."));
  }
  buildCategory("images", "Gambar", imgRows);

  // --- Keamanan ---
  var secRows = [];
  secRows.push(mspRow(net.isHttps ? "pass" : "fail", "HTTPS", net.isHttps ? "" : "Halaman tidak dimuat lewat HTTPS."));

  if (net.headerFetchError) {
    secRows.push(mspRow("warn", "Header respons", "Tidak dapat memeriksa header: " + net.headerFetchError));
  } else if (net.headers) {
    var h = net.headers;
    if (net.isHttps) {
      secRows.push(mspRow(h.strictTransportSecurity ? "pass" : "warn", "Strict-Transport-Security (HSTS)",
        h.strictTransportSecurity ? h.strictTransportSecurity : "Header HSTS tidak ditemukan."));
    }
    secRows.push(mspRow(h.xContentTypeOptions === "nosniff" ? "pass" : "warn", "X-Content-Type-Options",
      h.xContentTypeOptions ? h.xContentTypeOptions : "Tidak ditemukan (disarankan: nosniff)."));
    var hasFrameProtection = !!h.xFrameOptions || (h.contentSecurityPolicy && h.contentSecurityPolicy.indexOf("frame-ancestors") !== -1);
    secRows.push(mspRow(hasFrameProtection ? "pass" : "warn", "Proteksi Clickjacking",
      hasFrameProtection ? "X-Frame-Options / CSP frame-ancestors aktif." : "Tidak ditemukan X-Frame-Options maupun CSP frame-ancestors."));
    secRows.push(mspRow(h.contentSecurityPolicy ? "pass" : "warn", "Content-Security-Policy",
      h.contentSecurityPolicy ? "Header CSP ditemukan." : "Header CSP tidak ditemukan."));
  }
  buildCategory("security", "Keamanan", secRows);

  // --- Performa & Caching ---
  var perfRows = [];
  if (net.headers) {
    var hasCaching = !!(net.headers.cacheControl || net.headers.expires);
    perfRows.push(mspRow(hasCaching ? "pass" : "warn", "Cache-Control / Expires",
      hasCaching ? (net.headers.cacheControl || net.headers.expires) : "Tidak ditemukan header caching pada dokumen utama."));
    perfRows.push(mspRow(net.headers.contentEncoding ? "pass" : "warn", "Kompresi (Content-Encoding)",
      net.headers.contentEncoding ? net.headers.contentEncoding : "Tidak terkompresi (gzip/br tidak terdeteksi)."));
  } else {
    perfRows.push(mspRow("warn", "Header performa", "Tidak dapat diperiksa untuk halaman ini."));
  }
  buildCategory("performance", "Performa & Caching", perfRows);

  // --- Robots & Sitemap ---
  var robotsRows = [];
  if (!net.robotsTxt.checked) {
    robotsRows.push(mspRow("warn", "robots.txt", "Tidak dapat diperiksa untuk halaman ini."));
  } else if (!net.robotsTxt.present) {
    robotsRows.push(mspRow("warn", "robots.txt", "Tidak ditemukan di " + dom.origin + "/robots.txt"));
  } else if (net.robotsTxt.disallowsAll) {
    robotsRows.push(mspRow("fail", "robots.txt", "Memblokir SELURUH crawler (Disallow: /) untuk User-agent: *"));
  } else {
    robotsRows.push(mspRow("pass", "robots.txt",
      net.robotsTxt.sitemaps.length
        ? net.robotsTxt.sitemaps.length + " entri Sitemap terdaftar."
        : "Ditemukan, tapi tidak ada entri Sitemap."));
  }

  if (net.sitemapXml.checked) {
    robotsRows.push(mspRow(net.sitemapXml.present ? "pass" : "warn", "sitemap.xml (/sitemap.xml)",
      net.sitemapXml.present ? "" : "Tidak ditemukan di path standar (mungkin memakai nama/lokasi lain)."));
  }
  buildCategory("robots", "Robots & Sitemap", robotsRows);

  return {
    url: dom.url,
    generatedAt: new Date().toISOString(),
    overall: {
      counts: overallCounts,
      score: mspScoreFromCounts(overallCounts)
    },
    categories: categories
  };
}
