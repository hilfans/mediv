"use strict";

var STORAGE_KEY = "mspPsiApiKey";
var GEMINI_STORAGE_KEY = "mspGeminiApiKey";
var BING_STORAGE_KEY = "mspBingApiKey";

/**
 * Ketiga key (PSI, Gemini, Bing) diatur lewat pola yang identik, jadi
 * logikanya dipusatkan di sini dan dipanggil berkali-kali dengan ID
 * elemen + storage key yang berbeda -- daripada menulis ulang
 * save/toggle/clear untuk tiap key.
 */
function setupKeyField(config) {
  var input = document.getElementById(config.inputId);
  var statusEl = document.getElementById(config.statusId);

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.className = "msp-status " + (isError ? "error" : "ok");
    statusEl.hidden = false;
  }

  chrome.storage.local.get(config.storageKey).then(function (data) {
    if (data && data[config.storageKey]) {
      input.value = data[config.storageKey];
    }
  });

  document.getElementById(config.toggleId).addEventListener("click", function (e) {
    var showing = input.type === "text";
    input.type = showing ? "password" : "text";
    e.target.textContent = showing ? "Tampilkan" : "Sembunyikan";
  });

  document.getElementById(config.saveId).addEventListener("click", async function () {
    var value = input.value.trim();
    if (!value) {
      showStatus("API key kosong — isi dulu sebelum menyimpan.", true);
      return;
    }
    await chrome.storage.local.set({ [config.storageKey]: value });
    showStatus("API key tersimpan di perangkat ini.", false);
  });

  document.getElementById(config.clearId).addEventListener("click", async function () {
    await chrome.storage.local.remove(config.storageKey);
    input.value = "";
    showStatus("API key dihapus dari perangkat ini.", false);
  });
}

function init() {
  setupKeyField({
    storageKey: STORAGE_KEY,
    inputId: "mspApiKey",
    toggleId: "mspToggleKey",
    saveId: "mspSaveKey",
    clearId: "mspClearKey",
    statusId: "mspStatus"
  });

  setupKeyField({
    storageKey: GEMINI_STORAGE_KEY,
    inputId: "mspGeminiApiKey",
    toggleId: "mspToggleGeminiKey",
    saveId: "mspSaveGeminiKey",
    clearId: "mspClearGeminiKey",
    statusId: "mspGeminiStatus"
  });

  setupKeyField({
    storageKey: BING_STORAGE_KEY,
    inputId: "mspBingApiKey",
    toggleId: "mspToggleBingKey",
    saveId: "mspSaveBingKey",
    clearId: "mspClearBingKey",
    statusId: "mspBingStatus"
  });
}

init();
