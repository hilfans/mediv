"use strict";

/* ============================================================
   MESIN CRAWL SITUS & PENGECEK BROKEN LINK (v2)
   ------------------------------------------------------------
   Berbeda dari report-model.js: file ini TIDAK disuntikkan ke tab
   manapun. Semua fetch di sini berjalan langsung di konteks
   ekstensi (crawl.html), yang hanya bisa fetch lintas-origin SETELAH
   pengguna menyetujui optional host permission (lihat crawl.js).
   Karena itu semua fungsi di sini murni (menerima fetchImpl sebagai
   parameter) supaya mudah diuji tanpa Chrome sungguhan.
   ============================================================ */

function mspNormalizeUrl(url) {
  try {
    var u = new URL(url);
    u.hash = "";
    return u.href;
  } catch (e) {
    return url;
  }
}

function mspParseRobotsTxt(text) {
  var lines = text.split(/\r?\n/);
  var sitemaps = [];
  var disallowRules = [];
  var wildcardAgent = false;

  lines.forEach(function (line) {
    var l = line.trim();
    var lower = l.toLowerCase();
    if (lower.indexOf("sitemap:") === 0) {
      sitemaps.push(l.substring(8).trim());
      return;
    }
    if (lower.indexOf("user-agent:") === 0) {
      wildcardAgent = lower.indexOf("*") !== -1;
      return;
    }
    if (wildcardAgent && lower.indexOf("disallow:") === 0) {
      var rule = l.substring(9).trim();
      if (rule) { disallowRules.push(rule); }
    }
  });

  return { sitemaps: sitemaps, disallowRules: disallowRules };
}

/**
 * Pencocokan disallow disederhanakan jadi "prefix match" biasa (tanpa
 * wildcard * atau $ ala spesifikasi robots.txt penuh). Cukup untuk
 * kasus umum (mis. "Disallow: /admin" atau "Disallow: /"), didokumentasikan
 * sebagai batasan yang disengaja di README.
 */
function mspIsDisallowed(pathname, disallowRules) {
  return disallowRules.some(function (rule) {
    return rule === "/" ? true : pathname.indexOf(rule) === 0;
  });
}

async function mspFetchRobotsAndSitemap(origin, fetchImpl) {
  var result = { sitemaps: [], disallowRules: [], robotsPresent: false };
  try {
    var resp = await fetchImpl(origin + "/robots.txt", { cache: "no-store" });
    if (resp.ok) {
      result.robotsPresent = true;
      var text = await resp.text();
      var parsed = mspParseRobotsTxt(text);
      result.sitemaps = parsed.sitemaps;
      result.disallowRules = parsed.disallowRules;
    }
  } catch (e) { /* robots.txt tidak wajib ada */ }
  return result;
}

/**
 * Ambil daftar URL dari satu sitemap.xml. Bila berupa sitemap index,
 * ikuti satu tingkat ke dalam saja (cukup untuk situs skala UKM/menengah,
 * mencegah rekursi tak terbatas).
 */
async function mspFetchSitemapUrls(sitemapUrl, fetchImpl, depth) {
  depth = depth || 0;
  var urls = [];
  try {
    var resp = await fetchImpl(sitemapUrl, { cache: "no-store" });
    if (!resp.ok) { return urls; }
    var text = await resp.text();
    var doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) { return urls; }

    var sitemapNodes = doc.querySelectorAll("sitemapindex > sitemap > loc");
    if (sitemapNodes.length > 0 && depth < 1) {
      for (var i = 0; i < sitemapNodes.length; i += 1) {
        var childUrls = await mspFetchSitemapUrls(sitemapNodes[i].textContent.trim(), fetchImpl, depth + 1);
        urls = urls.concat(childUrls);
      }
      return urls;
    }

    var locNodes = doc.querySelectorAll("urlset > url > loc");
    locNodes.forEach(function (node) {
      var loc = (node.textContent || "").trim();
      if (loc) { urls.push(loc); }
    });
  } catch (e) { /* sitemap.xml tidak wajib ada / boleh gagal parse */ }
  return urls;
}

function mspExtractLinks(doc, baseUrl) {
  var links = [];
  var seen = {};
  var anchors = doc.querySelectorAll("a[href]");
  anchors.forEach(function (a) {
    var href = a.getAttribute("href") || "";
    var lower = href.toLowerCase();
    if (!href || lower.indexOf("#") === 0 || lower.indexOf("javascript:") === 0 ||
        lower.indexOf("mailto:") === 0 || lower.indexOf("tel:") === 0) {
      return;
    }
    try {
      var abs = new URL(href, baseUrl).href;
      if (!seen[abs]) { seen[abs] = true; links.push(abs); }
    } catch (e) { /* URL tidak valid, dilewati */ }
  });
  return links;
}

/**
 * Versi mspExtractDomSignals (report-model.js) yang menerima Document +
 * URL sebagai parameter, karena halaman hasil crawl adalah string HTML
 * yang di-parse (DOMParser), bukan tab hidup dengan `document`/`location`
 * global. Struktur hasilnya sengaja disamakan persis dengan
 * mspExtractDomSignals supaya bisa dipakai bergantian oleh mspEvaluate().
 */
function mspExtractSignalsFromDocument(doc, pageUrl) {
  function metaByName(name) {
    var el = doc.querySelector('meta[name="' + name + '" i]');
    return el ? (el.getAttribute("content") || "") : "";
  }
  function metaByProperty(prop) {
    var el = doc.querySelector('meta[property="' + prop + '"]');
    return el ? (el.getAttribute("content") || "") : "";
  }

  var origin = new URL(pageUrl).origin;
  var title = (doc.querySelector("title") && doc.querySelector("title").textContent) || "";
  var metaDescription = metaByName("description");
  var canonicalEl = doc.querySelector('link[rel="canonical" i]');
  var canonical = canonicalEl ? (canonicalEl.getAttribute("href") || "") : "";
  var robotsContent = metaByName("robots");
  var hasViewport = !!doc.querySelector('meta[name="viewport" i]');
  var lang = doc.documentElement ? (doc.documentElement.getAttribute("lang") || "") : "";

  var h1s = doc.querySelectorAll("h1");
  var headingNodes = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  var headingOutline = [];
  var lastLevel = 0;
  var skippedHeadingLevel = false;
  headingNodes.forEach(function (h) {
    var level = parseInt(h.tagName.substring(1), 10);
    headingOutline.push({ level: level, text: (h.textContent || "").trim().slice(0, 80) });
    if (lastLevel > 0 && level - lastLevel > 1) { skippedHeadingLevel = true; }
    lastLevel = level;
  });

  var images = doc.querySelectorAll("img");
  var missingAltCount = 0;
  images.forEach(function (img) {
    var alt = img.getAttribute("alt");
    if (alt === null || alt.trim() === "") { missingAltCount += 1; }
  });

  var og = {
    title: metaByProperty("og:title"),
    description: metaByProperty("og:description"),
    image: metaByProperty("og:image"),
    type: metaByProperty("og:type")
  };
  var twitterCard = metaByName("twitter:card");

  var jsonLdNodes = doc.querySelectorAll('script[type="application/ld+json"]');
  var jsonLdTypes = [];
  var jsonLdErrors = 0;
  jsonLdNodes.forEach(function (node) {
    try {
      var data = JSON.parse(node.textContent);
      var items = Array.isArray(data) ? data : [data];
      items.forEach(function (item) {
        if (item && item["@graph"] && Array.isArray(item["@graph"])) {
          item["@graph"].forEach(function (g) { if (g && g["@type"]) { jsonLdTypes.push(g["@type"]); } });
        } else if (item && item["@type"]) {
          jsonLdTypes.push(item["@type"]);
        }
      });
    } catch (e) { jsonLdErrors += 1; }
  });

  // Dokumen hasil parse DOMParser tidak punya layout, jadi innerText selalu
  // kosong di sini (beda dengan mspExtractDomSignals yang jalan di tab
  // hidup) — textContent yang dibersihkan dari <script>/<style> dipakai
  // langsung sebagai pendekatan yang konsisten untuk halaman hasil crawl.
  var bodyClone = doc.body ? doc.body.cloneNode(true) : null;
  var bodyText = "";
  if (bodyClone) {
    var junk = bodyClone.querySelectorAll("script, style, noscript, template");
    junk.forEach(function (n) { n.remove(); });
    bodyText = bodyClone.textContent || "";
  }
  var trimmed = bodyText.trim();
  var wordCount = trimmed.length ? trimmed.split(/\s+/).length : 0;

  var allLinks = mspExtractLinks(doc, pageUrl);
  var internalLinks = 0;
  var externalLinks = 0;
  allLinks.forEach(function (href) {
    try {
      var u = new URL(href);
      if (u.origin === origin) { internalLinks += 1; } else { externalLinks += 1; }
    } catch (e) { /* dilewati */ }
  });

  return {
    url: pageUrl,
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

function mspHeadersFromResponse(resp) {
  return {
    strictTransportSecurity: resp.headers.get("strict-transport-security"),
    xContentTypeOptions: resp.headers.get("x-content-type-options"),
    xFrameOptions: resp.headers.get("x-frame-options"),
    contentSecurityPolicy: resp.headers.get("content-security-policy"),
    cacheControl: resp.headers.get("cache-control"),
    expires: resp.headers.get("expires"),
    contentEncoding: resp.headers.get("content-encoding"),
    contentType: resp.headers.get("content-type")
  };
}

/**
 * Fetch + analisis satu halaman. siteRobots dipakai supaya kategori
 * "Robots & Sitemap" pada evaluasi tiap halaman konsisten dengan hasil
 * pengecekan robots.txt di level situs (dicek sekali, bukan per halaman).
 */
async function mspFetchAndAnalyzePage(url, siteRobots, fetchImpl) {
  var resp = await fetchImpl(url, { redirect: "follow", cache: "no-store" });
  var finalUrl = resp.url || url;
  var redirected = !!resp.redirected || finalUrl !== url;
  var status = resp.status;
  var contentType = resp.headers.get("content-type") || "";

  var page = {
    url: url,
    finalUrl: finalUrl,
    redirected: redirected,
    status: status,
    contentType: contentType,
    doc: null,
    dom: null,
    evaluation: null,
    robotsDisallowed: false, // diisi pemanggil (mspRunCrawl) berdasarkan robots.txt
    hasNoindex: false
  };

  if (status >= 200 && status < 300 && contentType.toLowerCase().indexOf("html") !== -1) {
    var html = await resp.text();
    var doc = new DOMParser().parseFromString(html, "text/html");
    var dom = mspExtractSignalsFromDocument(doc, finalUrl);
    var headers = mspHeadersFromResponse(resp);
    var net = {
      isHttps: finalUrl.toLowerCase().indexOf("https://") === 0,
      status: status,
      headers: headers,
      headerFetchError: null,
      robotsTxt: {
        checked: true,
        present: siteRobots.robotsPresent,
        sitemaps: siteRobots.sitemaps,
        disallowsAll: siteRobots.disallowRules.indexOf("/") !== -1,
        error: null
      },
      sitemapXml: { checked: true, present: siteRobots.sitemaps.length > 0, error: null }
    };
    page.doc = doc;
    page.dom = dom;
    page.evaluation = mspEvaluate(dom, net);
    page.hasNoindex = /noindex/i.test(dom.robotsContent || "");
  }

  return page;
}

function mspSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * Crawl BFS dari satu situs, dibatasi maxPages.
 * options: { startUrl, maxPages, concurrency, politeDelayMs, fetchImpl }
 * hooks: { onPageDone(page, doneCount, targetCount), onPhase(phaseName) }
 */
async function mspRunCrawl(options, hooks) {
  hooks = hooks || {};
  var fetchImpl = options.fetchImpl || fetch;
  var maxPages = options.maxPages || 50;
  var concurrency = Math.max(1, options.concurrency || 4);
  var politeDelayMs = typeof options.politeDelayMs === "number" ? options.politeDelayMs : 200;

  var startUrl = new URL(options.startUrl);
  var origin = startUrl.origin;

  if (hooks.onPhase) { hooks.onPhase("robots"); }
  var siteRobots = await mspFetchRobotsAndSitemap(origin, fetchImpl);

  if (hooks.onPhase) { hooks.onPhase("sitemap"); }
  var seedUrls = [];
  for (var i = 0; i < siteRobots.sitemaps.length && seedUrls.length < maxPages; i += 1) {
    var fromSitemap = await mspFetchSitemapUrls(siteRobots.sitemaps[i], fetchImpl);
    seedUrls = seedUrls.concat(fromSitemap);
  }
  if (seedUrls.length === 0) {
    var guessed = await mspFetchSitemapUrls(origin + "/sitemap.xml", fetchImpl);
    seedUrls = seedUrls.concat(guessed);
  }
  if (seedUrls.length === 0) {
    seedUrls = [startUrl.href];
  }

  if (hooks.onPhase) { hooks.onPhase("crawling"); }

  function isUrlDisallowed(urlStr) {
    try {
      var u = new URL(urlStr);
      return mspIsDisallowed(u.pathname, siteRobots.disallowRules);
    } catch (e) { return false; }
  }

  // Catatan penting: halaman yang dilarang robots.txt TETAP di-crawl (tidak
  // di-skip) supaya webmaster bisa segera tahu kalau ada halaman penting
  // yang ternyata ke-block robots.txt/noindex secara tidak sengaja. Yang
  // membedakan hanyalah page.robotsDisallowed dipakai untuk memberi catatan
  // di laporan, dan halaman semacam ini tidak dipakai sebagai sumber
  // penemuan tautan baru (supaya crawl tidak melebar ke area yang memang
  // sengaja diblokir, misalnya /admin).
  var visited = {};
  var queue = []; // {url, disallowed}
  seedUrls.forEach(function (u) {
    var norm = mspNormalizeUrl(u);
    var parsed;
    try { parsed = new URL(norm); } catch (e) { return; }
    if (parsed.origin !== origin) { return; }
    if (!visited[norm]) {
      visited[norm] = true;
      queue.push({ url: norm, disallowed: isUrlDisallowed(norm) });
    }
  });

  var pages = [];         // semua percobaan fetch (termasuk redirect), dipakai untuk link-check & laporan redirect
  var auditedPages = [];  // halaman UNIK (berdasarkan URL akhir setelah redirect) yang benar-benar dihitung ke kuota maxPages
  var visitedFinal = {};  // normalisasi URL akhir yang kontennya sudah dianalisis, mencegah halaman sama terhitung dobel
  var redirects = [];     // {from, to, status}
  var linkSources = {};   // url -> Set(halaman yang mereferensikan)
  var cursor = 0;
  var active = 0;
  var stopped = false;

  function recordLink(link, fromPage) {
    if (!linkSources[link]) { linkSources[link] = {}; }
    linkSources[link][fromPage] = true;
  }

  async function worker() {
    while (!stopped) {
      if (auditedPages.length >= maxPages) { stopped = true; return; }
      if (cursor >= queue.length) {
        if (active === 0) { return; }
        await mspSleep(30);
        continue;
      }
      var entry = queue[cursor];
      var url = entry.url;
      cursor += 1;
      active += 1;
      try {
        var page = await mspFetchAndAnalyzePage(url, siteRobots, fetchImpl);
        page.robotsDisallowed = entry.disallowed;
        pages.push(page);

        if (page.redirected) {
          redirects.push({ from: page.url, to: page.finalUrl, status: page.status });
        }

        var finalNorm = mspNormalizeUrl(page.finalUrl);
        var alreadyAudited = !!visitedFinal[finalNorm];

        if (!alreadyAudited) {
          visitedFinal[finalNorm] = true;
          auditedPages.push(page);
          if (hooks.onPageDone) {
            hooks.onPageDone(page, auditedPages.length, Math.min(maxPages, queue.length || maxPages));
          }

          // Halaman yang dilarang robots.txt tidak dipakai sumber penemuan
          // tautan baru, supaya crawl tidak melebar ke area yang sengaja
          // diblokir pemiliknya (lihat catatan di atas).
          if (page.doc && auditedPages.length < maxPages && !entry.disallowed) {
            var links = mspExtractLinks(page.doc, page.finalUrl);
            links.forEach(function (link) {
              recordLink(link, page.finalUrl);
              var parsedLink;
              try { parsedLink = new URL(link); } catch (e) { return; }
              if (parsedLink.origin !== origin) { return; }
              var norm = mspNormalizeUrl(link);
              if (visited[norm]) { return; }
              if (queue.length >= maxPages * 3) { return; }
              visited[norm] = true;
              queue.push({ url: norm, disallowed: isUrlDisallowed(norm) });
            });
          }
        }
      } catch (e) {
        pages.push({ url: url, finalUrl: url, status: 0, error: String((e && e.message) || e), doc: null, dom: null, evaluation: null });
      } finally {
        active -= 1;
        if (politeDelayMs > 0) { await mspSleep(politeDelayMs); }
      }
    }
  }

  var workers = [];
  for (var w = 0; w < concurrency; w += 1) { workers.push(worker()); }
  await Promise.all(workers);

  if (hooks.onPhase) { hooks.onPhase("links"); }
  var crawledByUrl = {};
  pages.forEach(function (p) { crawledByUrl[mspNormalizeUrl(p.finalUrl)] = p; });

  var brokenLinkResults = await mspCheckBrokenLinks(linkSources, crawledByUrl, fetchImpl, concurrency, hooks.onLinkChecked);

  if (hooks.onPhase) { hooks.onPhase("done"); }

  return {
    origin: origin,
    siteRobots: siteRobots,
    pages: auditedPages,
    redirects: redirects,
    linkChecks: brokenLinkResults
  };
}

async function mspCheckBrokenLinks(linkSources, crawledByUrl, fetchImpl, concurrency, onLinkChecked) {
  var urls = Object.keys(linkSources);
  var results = [];
  var cursor = 0;
  var done = 0;

  async function worker() {
    while (cursor < urls.length) {
      var url = urls[cursor];
      cursor += 1;
      var foundOnPages = Object.keys(linkSources[url]);
      var norm = mspNormalizeUrl(url);
      var entry;

      if (crawledByUrl[norm]) {
        var p = crawledByUrl[norm];
        entry = {
          url: url,
          status: p.status,
          ok: p.status >= 200 && p.status < 400,
          fromCrawl: true,
          foundOnPages: foundOnPages
        };
      } else {
        try {
          var resp = await fetchImpl(url, { method: "HEAD", redirect: "follow", cache: "no-store" });
          if (resp.status === 405 || resp.status === 501) {
            resp = await fetchImpl(url, { method: "GET", redirect: "follow", cache: "no-store" });
          }
          entry = { url: url, status: resp.status, ok: resp.ok, fromCrawl: false, foundOnPages: foundOnPages };
        } catch (e) {
          entry = { url: url, status: 0, ok: false, error: String((e && e.message) || e), fromCrawl: false, foundOnPages: foundOnPages };
        }
      }

      results.push(entry);
      done += 1;
      if (onLinkChecked) { onLinkChecked(entry, done, urls.length); }
    }
  }

  var workers = [];
  for (var i = 0; i < Math.max(1, concurrency); i += 1) { workers.push(worker()); }
  await Promise.all(workers);
  return results;
}
