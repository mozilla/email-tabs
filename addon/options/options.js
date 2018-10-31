function saveOptions(e) {
  browser.storage.local.set({
    showAdditionalProviders: document.querySelector("#provider").checked
  });
  e.preventDefault();
}

function restoreOptions() {
  const gettingItem = browser.storage.local.get('showAdditionalProviders');
  gettingItem.then((res) => {
    document.querySelector("#provider").checked = res.showAdditionalProviders;
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
