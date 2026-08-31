"use strict";

var STORAGE_KEY = "mspPsiApiKey";

function showStatus(message, isError) {
  var el = document.getElementById("mspStatus");
  el.textContent = message;
  el.className = "msp-status " + (isError ? "error" : "ok");
  el.hidden = false;
}

async function init() {
  var data = await chrome.storage.local.get(STORAGE_KEY);
  var input = document.getElementById("mspApiKey");
  if (data && data[STORAGE_KEY]) {
    input.value = data[STORAGE_KEY];
  }

  document.getElementById("mspToggleKey").addEventListener("click", function (e) {
    var showing = input.type === "text";
    input.type = showing ? "password" : "text";
    e.target.textContent = showing ? "Tampilkan" : "Sembunyikan";
  });

  document.getElementById("mspSaveKey").addEventListener("click", async function () {
    var value = input.value.trim();
    if (!value) {
      showStatus("API key kosong — isi dulu sebelum menyimpan.", true);
      return;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: value });
    showStatus("API key tersimpan di perangkat ini.", false);
  });

  document.getElementById("mspClearKey").addEventListener("click", async function () {
    await chrome.storage.local.remove(STORAGE_KEY);
    input.value = "";
    showStatus("API key dihapus dari perangkat ini.", false);
  });
}

init();
