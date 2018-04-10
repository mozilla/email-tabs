browser.contextMenus.create({
  id: "email-tabs",
  title: "Email tabs...",
  contexts: ["page", "tab"],
  documentUrlPatterns: ["<all_urls>"]
});

browser.browserAction.onClicked.addListener(async () => {
  browser.sidebarAction.open();
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  browser.sidebarAction.open();
});

browser.runtime.onMessage.addListener((message, source) => {
  if (message.type === "sendEmail") {
    sendEmail(message.tabIds);
  } else {
    console.error("Unexpected message type:", message.type);
  }
});

async function sendEmail(tabIds) {
  let allTabs = await browser.tabs.query({});
  let tabInfo = {};
  for (let tab of allTabs) {
    if (tabIds.includes(tab.id)) {
      tabInfo[tab.id] = {url: tab.url, title: tab.title, favIcon: tab.favIconUrl, id: tab.id};
    }
  }
  for (let tabId of tabIds) {
    let data = await browser.tabs.executeScript(tabId, {
      file: "capture-data.js",
    });
    console.log("got data", data[0]);
    Object.assign(tabInfo[tabId], data[0]);
  }
  let html = await browser.runtime.sendMessage({
    type: "renderRequest",
    tabs: tabIds.map(id => tabInfo[id])
  });
  console.log("going to create new tab");
  let newTab = await browser.tabs.create({url: "https://mail.google.com/mail/?view=cm&fs=1&tf=1&source=mailto&to="});
  console.log("got it!", newTab.id);
  await browser.tabs.executeScript(newTab.id, {
    file: "set-html-email.js",
  });
  browser.tabs.sendMessage(newTab.id, {
    type: "setHtml",
    html
  });
  console.log("Result:", tabInfo);
  console.log("sending email for tabs...", tabIds);
}
