/* globals TestPilotGA, emailTemplates, templateMetadata, DOMPurify */
browser.runtime.onMessage.addListener((message, source) => {
  if (message.type === "sendEmail") {
    sendEmail(message.tabIds).catch((e) => {
      // FIXME: maybe we should abort the email in this case?
      console.error("Error sending email:", e, String(e), e.stack);
    });
    // Note we don't need the popup to wait for us to send the email, so we return immediately:
    return Promise.resolve();
  } else if (message.type === "copyTabHtml") {
    localStorage.removeItem("selectionCache");
    return copyTabHtml(message.tabIds);
  } else if (message.type === "clearSelectionCache") {
    localStorage.removeItem("selectionCache");
    return null;
  } else if (message.type === "sendFailed") {
    loginInterrupt();
    return null;
  } else if (message.type === "closeComposeTab") {
    return browser.tabs.remove(message.tabId);
  } else if (message.type === "closeTabs") {
    return closeManyTabs(message.composeTabId, message.closeTabInfo);
  } else if (message.type === "sendEvent") {
    delete message.type;
    sendEvent(message);
    return Promise.resolve(null);
  } else if (message.type === "renderTemplate") {
    return renderTabs(message.tabInfo, message.selectedTemplate);
  }
  console.error("Unexpected message type:", message.type);
  return null;
});

const manifest = browser.runtime.getManifest();

const is_production = !manifest.version_name.includes("dev");

const ga = new TestPilotGA({
  an: "email-tabs",
  aid: manifest.applications.gecko.id,
  aiid: "testpilot",
  av: manifest.version,
  // cd19 could also be dev or stage:
  cd19: is_production ? "production" : "local",
  ds: "addon",
  tid: is_production ? "UA-124570950-1" : "",
});

async function sendEvent(args) {
  ga.sendEvent(args.ec, args.ea, args);
}

sendEvent({
  ec: "startup",
  ea: "startup",
  ni: true
});

async function getTabInfo(tabIds, {wantsScreenshots, wantsReadability}) {
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
      await browser.tabs.executeScript(tabId, {
        file: "captureText.js",
      });
      if (wantsReadability) {
        await browser.tabs.executeScript(tabId, {
          file: "build/Readability.js",
        });
      }
      await browser.tabs.executeScript(tabId, {
        file: "capture-data.js",
      });
      let data = await browser.tabs.sendMessage(tabId, {type: "getData", wantsScreenshots, wantsReadability});
      if (data.readability && data.readability.content) {
        data.readability.content = DOMPurify.sanitize(data.readability.content);
      }
      Object.assign(tabInfo[tabId], data);
    } catch (e) {
      console.error("Error getting info for tab", tabId, tabInfo[tabId].url, ":", String(e));
    }
  }
  return tabIds.map(id => tabInfo[id]);
}

async function renderTabs(tabInfo, templateName) {
  let TemplateComponent = emailTemplates[templateMetadata.getTemplate(templateName).componentName];
  if (!TemplateComponent) {
    throw new Error(`No component found for template: ${templateName}`);
  }
  let html = emailTemplates.renderEmail(tabInfo, TemplateComponent);
  let subject = emailTemplates.renderSubject(tabInfo);
  return { html, subject };
}

async function sendEmail(tabIds) {
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
  let tabInfo = await getTabInfo(tabIds, {wantsScreenshots: true, wantsReadability: true});
  await browser.tabs.executeScript(newTab.id, {
    file: "templateMetadata.js",
    runAt: "document_start",
  });
  await browser.tabs.executeScript(newTab.id, {
    file: "set-html-email.js",
    runAt: "document_start",
  });
  await browser.tabs.sendMessage(newTab.id, {
    type: "sendTabInfo",
    thisTabId: newTab.id,
    tabInfo
  });
}

async function copyTabHtml(tabIds) {
  let tabInfo = await getTabInfo(tabIds, {wantsScreenshots: false, wantsReadability: false});
  let { html } = await renderTabs(tabInfo, "just_links");
  copyHtmlToClipboard(html);
}

function copyHtmlToClipboard(html) {
  let container = document.createElement("div");
  container.innerHTML = html; // eslint-disable-line no-unsanitized/property
  document.body.appendChild(container);
  window.getSelection().removeAllRanges();
  let range = document.createRange();
  range.selectNode(container);
  window.getSelection().addRange(range);
  document.execCommand("copy");
  setTimeout(() => {
    document.body.removeChild(container);
  }, 100);
}

let loginInterruptedTime;

function loginInterrupt() {
  // Note: this is a dumb flag for the popup:
  if (loginInterruptedTime && Date.now() - loginInterruptedTime < 30 * 1000) {
    // We notified the user recently
    return;
  }
  loginInterruptedTime = Date.now();
  localStorage.setItem("loginInterrupt", String(Date.now()));
  browser.notifications.create("notify-no-login", {
    type: "basic",
    // iconUrl: "...",
    title: "Email sending failed",
    message: "Please try again after logging into your email"
  });
}

async function closeManyTabs(composeTabId, otherTabInfo) {
  let tabs = await browser.tabs.query({});

  let toClose = [composeTabId];
  let tabInfoById = {};
  for (let tabInfo of otherTabInfo) {
    tabInfoById[tabInfo.id] = tabInfo;
  }
  for (let tab of tabs) {
    // Note that .url might be the canonical URL, but .urlBar is what shows up in the URL bar
    // and the tab API
    if (tabInfoById[tab.id] && tabInfoById[tab.id].urlBar === tab.url && !tab.pinned) {
      toClose.push(tab.id);
    }
  }
  if (toClose.length === tabs.length) {
    // Then this would result in *all* the tabs being closed, so let's open a new tab:
    await browser.tabs.create({});
  }
  await browser.tabs.remove(toClose);
}
