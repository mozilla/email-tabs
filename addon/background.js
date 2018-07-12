browser.runtime.onMessage.addListener((message, source) => {
  if (message.type === "sendEmail") {
    return sendEmail(message.tabIds);
  } else if (message.type == "copyTabHtml") {
    return copyTabHtml(message.tabIds);
  } else if (message.type === "clearSelectionCache") {
    localStorage.removeItem("selectionCache");
    return null;
  } else if (message.type == "sendFailed") {
    loginInterrupt();
    return null;
  } else if (message.type === "closeComposeTab") {
    return browser.tabs.remove(message.tabId);
  } else if (message.type === "closeTabs") {
    return closeManyTabs(message.composeTabId, message.closeTabInfo);
  }
  console.error("Unexpected message type:", message.type);
  return null;
});

async function getTabInfo(tabIds) {
  let allTabs = await browser.tabs.query({});
  let tabInfo = {};
  for (let tab of allTabs) {
    if (tabIds.includes(tab.id)) {
      if (tab.discarded) {
        console.info("Reloading discarded tab", tab.id, tab.url);
        await browser.tabs.reload(tab.id);
        tab = await browser.tabs.get(tab.id);
      }
      tabInfo[tab.id] = {url: tab.url, urlBar: tab.url, title: tab.title, favIcon: tab.favIconUrl, id: tab.id};
    }
  }
  for (let tabId of tabIds) {
    try {
      let data = await browser.tabs.executeScript(tabId, {
        file: "capture-data.js",
      });
      Object.assign(tabInfo[tabId], data[0]);
    } catch (e) {
      console.warn("Error getting info for tab", tabId, tabInfo[tabId].url, ":", String(e));
    }
  }
  return tabInfo;
}

async function sendEmail(tabIds) {
  let tabInfo = await getTabInfo(tabIds);
  let html = emailTemplates.renderEmail(tabIds.map(id => tabInfo[id]), emailTemplates.Email);
  let currentTabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  let openerTabId;
  if (currentTabs && currentTabs.length) {
    openerTabId = currentTabs[0].id;
  }
  let newTab = await browser.tabs.create({
    url: "https://mail.google.com/mail/?view=cm&fs=1&tf=1&source=mailto&to=",
    openerTabId,
  });
  setTimeout(async () => {
    let currentTab = await browser.tabs.get(newTab.id);
    if (currentTab.url.includes("accounts.google.com")) {
      // We have a login form
      loginInterrupt();
    }
  }, 1000);
  await browser.tabs.executeScript(newTab.id, {
    file: "set-html-email.js",
  });
  await browser.tabs.sendMessage(newTab.id, {
    type: "setHtml",
    html,
    thisTabId: newTab.id,
    tabInfo
  });
}

async function copyTabHtml(tabIds) {
  let tabInfo = await getTabInfo(tabIds);
  let html = emailTemplates.renderEmail(tabIds.map(id => tabInfo[id]), emailTemplates.Email);
  copyHtmlToClipboard(html);
}

function copyHtmlToClipboard(html) {
  let container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  window.getSelection().removeAllRanges();
  let range = document.createRange();
  range.selectNode(container);
  window.getSelection().addRange(range)
  document.execCommand('copy');
}

let loginInterruptedTime;

function loginInterrupt() {
  // Note: this is a dumb flag for the popup:
  if (loginInterruptedTime && Date.now() - loginInterruptedTime < 30*1000) {
    // We notified the user recently
    return;
  }
  loginInterruptedTime = Date.now();
  localStorage.setItem("loginInterrupt", String(Date.now()));
  return browser.notifications.create("notify-no-login", {
    type: "basic",
    // iconUrl: "...",
    title: "Email sending failed",
    message: "Please try again after logging into your email"
  });
  console.error("Sending failed, probably due to login");
}

async function closeManyTabs(composeTabId, otherTabInfo) {
  let tabs = await browser.tabs.query({});
  let toClose = [composeTabId];
  for (let tab of tabs) {
    // Note that .url might be the canonical URL, but .urlBar is what shows up in the URL bar
    // and the tab API
    if (otherTabInfo[tab.id] && otherTabInfo[tab.id].urlBar === tab.url) {
      toClose.push(tab.id);
    }
  }
  await browser.tabs.remove(toClose);
}
