"use strict";

/* ============================================================
   MODEL PEMANGGILAN & PARSING GEMINI API (fitur berbasis AI, opsional)
   Sama seperti speed-model.js: semua fungsi di sini murni (menerima data
   sebagai parameter, tidak menyentuh DOM/chrome.*) supaya mudah diuji
   tanpa Chrome sungguhan, dan supaya jelas tidak ada API key yang
   tertanam di dalamnya -- key selalu diambil dari chrome.storage.local
   (diisi pengguna sendiri lewat halaman Options) oleh pemanggil (report.js).
   ============================================================ */

var MSP_GEMINI_MODEL = "gemini-2.5-flash";
var MSP_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + MSP_GEMINI_MODEL + ":generateContent";

function mspBuildGeminiUrl(apiKey) {
  return MSP_GEMINI_ENDPOINT + "?key=" + encodeURIComponent(apiKey);
}

/**
 * "responseSchema" (controlled generation) dipakai di semua fitur di sini
 * alih-alih instruksi teks "balas dalam JSON" -- supaya keluaran Gemini
 * selalu berupa JSON valid sesuai skema, bukan rawan terbungkus blok
 * markdown ```json yang gagal di-parse.
 */
function mspBuildGeminiRequestBody(promptText, responseSchema) {
  return {
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.3
    }
  };
}

function mspExtractGeminiText(data) {
  var candidate = data && data.candidates && data.candidates[0];
  var parts = candidate && candidate.content && candidate.content.parts;
  var text = parts && parts[0] && parts[0].text;
  if (!text) {
    var blockReason = data && data.promptFeedback && data.promptFeedback.blockReason;
    if (blockReason) {
      throw new Error("Gemini menolak permintaan (" + blockReason + ").");
    }
    var finishReason = candidate && candidate.finishReason;
    if (finishReason && finishReason !== "STOP") {
      throw new Error("Gemini menghentikan respons sebelum selesai (" + finishReason + ").");
    }
    throw new Error("Respons Gemini tidak berisi teks yang diharapkan.");
  }
  return text;
}

function mspParseGeminiJson(data, requiredKeys) {
  var text = mspExtractGeminiText(data);
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error("Gagal membaca hasil analisis AI (format tidak sesuai).");
  }
  var missing = requiredKeys.filter(function (k) { return !(k in parsed); });
  if (missing.length) {
    throw new Error("Hasil analisis AI tidak lengkap (field hilang: " + missing.join(", ") + ").");
  }
  return parsed;
}

/* ============================================================
   FITUR 1: Kualitas Title & Meta Description + Konsistensi Bahasa
   Kategori laporan: SEO On-Page
   ============================================================ */

var MSP_GEMINI_TITLE_META_SCHEMA = {
  type: "object",
  properties: {
    titleQualityScore: { type: "integer" },
    titleFeedback: { type: "string" },
    titleSuggestions: { type: "array", items: { type: "string" } },
    descriptionQualityScore: { type: "integer" },
    descriptionFeedback: { type: "string" },
    descriptionSuggestions: { type: "array", items: { type: "string" } },
    languageConsistency: {
      type: "object",
      properties: {
        detectedContentLang: { type: "string" },
        matches: { type: "boolean" }
      },
      required: ["detectedContentLang", "matches"]
    }
  },
  required: [
    "titleQualityScore", "titleFeedback", "titleSuggestions",
    "descriptionQualityScore", "descriptionFeedback", "descriptionSuggestions",
    "languageConsistency"
  ]
};

function mspBuildTitleMetaPrompt(rawSignals) {
  return [
    "Anda adalah konsultan SEO. Nilai title tag dan meta description halaman web berikut, lalu periksa apakah bahasa kontennya cocok dengan atribut lang HTML yang dideklarasikan.",
    "",
    "Bahasa yang dideklarasikan (atribut lang HTML): " + (rawSignals.lang || "(tidak diset)"),
    "Title tag saat ini: " + JSON.stringify(rawSignals.title || ""),
    "Meta description saat ini: " + JSON.stringify(rawSignals.metaDescription || ""),
    "Cuplikan isi konten halaman (konteks saja, jangan dinilai langsung): " + JSON.stringify(rawSignals.bodyTextExcerpt || ""),
    "",
    "Tugas Anda:",
    "1. Nilai kualitas title (skor 1-5, 5=sangat baik) dari sisi daya tarik klik, kejelasan, dan relevansi dengan isi halaman. Beri feedback singkat (1-2 kalimat) dalam Bahasa Indonesia. Beri maksimal 3 saran judul alternatif DALAM BAHASA YANG SAMA DENGAN KONTEN HALAMAN (bukan harus Bahasa Indonesia).",
    "2. Nilai kualitas meta description dengan cara yang sama (skor 1-5, feedback Bahasa Indonesia, maksimal 3 saran alternatif dalam bahasa konten).",
    "3. Deteksi bahasa aktual dari cuplikan konten di atas (kode bahasa singkat, mis. \"id\" atau \"en\"), lalu bandingkan dengan atribut lang yang dideklarasikan.",
    "",
    "Jawab HANYA sesuai skema JSON yang diberikan, tanpa teks lain di luar JSON."
  ].join("\n");
}

function mspParseTitleMetaResponse(rawGeminiJson) {
  return mspParseGeminiJson(rawGeminiJson, [
    "titleQualityScore", "titleFeedback", "titleSuggestions",
    "descriptionQualityScore", "descriptionFeedback", "descriptionSuggestions",
    "languageConsistency"
  ]);
}

/* ============================================================
   FITUR 2: Ringkasan Eksekutif Laporan
   Level: laporan (bukan kategori tertentu)
   ============================================================ */

var MSP_GEMINI_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    topPriorities: { type: "array", items: { type: "string" } }
  },
  required: ["summary", "topPriorities"]
};

/**
 * Susun data ringkas (bukan raw HTML) dari hasil evaluasi yang sudah ada
 * untuk dijadikan bahan prompt -- audit/crawl/speed yang tersedia saja
 * yang disertakan. mspAggregateCrawl() dipakai lagi di sini supaya angka
 * broken link/skor situs identik dengan yang ditampilkan di bagian Crawl
 * Situs pada laporan yang sama.
 */
function mspBuildExecSummaryInput(auditModel, crawlData, speedData) {
  var input = {};
  if (auditModel) {
    input.onPage = {
      url: auditModel.url,
      overallScore: auditModel.overall.score,
      categories: auditModel.categories.map(function (cat) {
        var topIssues = cat.rows
          .filter(function (r) { return r.status === "warn" || r.status === "fail"; })
          .map(function (r) { return r.label + (r.detail ? ": " + r.detail : ""); })
          .slice(0, 3);
        return { title: cat.title, score: cat.score, topIssues: topIssues };
      })
    };
  }
  if (crawlData && crawlData.result) {
    var agg = mspAggregateCrawl(crawlData.result);
    input.crawl = {
      origin: crawlData.result.origin,
      pagesCrawled: crawlData.result.pages.length,
      siteScore: agg.score,
      brokenLinkCount: agg.brokenLinks.length,
      blockedPageCount: agg.blockedPages.length
    };
  }
  if (speedData && speedData.parsed) {
    input.speed = {
      targetUrl: speedData.targetUrl,
      categories: speedData.parsed.categories
    };
  }
  return input;
}

function mspBuildExecSummaryPrompt(findingsInput) {
  return [
    "Anda adalah konsultan digital yang menjelaskan hasil audit teknis situs web ke PEMILIK BISNIS yang TIDAK paham istilah teknis.",
    "",
    "Data hasil audit (JSON):",
    JSON.stringify(findingsInput, null, 2),
    "",
    "Tugas: tulis ringkasan 3-5 kalimat dalam Bahasa Indonesia yang mudah dipahami orang awam -- hindari istilah teknis (mis. \"HSTS\", \"canonical\", \"JSON-LD\"), jelaskan DAMPAKNYA ke bisnis, bukan istilahnya. Lalu beri maksimal 3 prioritas perbaikan paling penting, diurutkan dari paling mendesak, juga dalam bahasa awam.",
    "",
    "Jawab HANYA sesuai skema JSON yang diberikan, tanpa teks lain di luar JSON."
  ].join("\n");
}

function mspParseExecSummaryResponse(rawGeminiJson) {
  return mspParseGeminiJson(rawGeminiJson, ["summary", "topPriorities"]);
}
