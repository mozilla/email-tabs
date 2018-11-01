function saveOptions(e) {
  browser.storage.local.set({
    showAdditionalProviders: document.querySelector("#provider").checked,
  });
  e.preventDefault();
}

async function restoreOptions() {
  const result = await browser.storage.local.get("showAdditionalProviders");
  document.querySelector("#provider").checked = result.showAdditionalProviders;
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
