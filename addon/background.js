/* globals TestPilotGA, emailTemplates, templateMetadata, DOMPurify, providerMetadata */

browser.runtime.onMessage.addListener((message, source) => {
  if (message.type === "sendEmail") {
    sendEmail(message.tabIds, message.mailProvider, message.customDimensions).catch((e) => {
      // FIXME: maybe we should abort the email in this case?
      console.error("Error sending email:", e, String(e), e.stack);
    });
    // Note we don't need the popup to wait for us to send the email, so we return immediately:
    return Promise.resolve();
  } else if (message.type === "copyTabHtml") {
    localStorage.removeItem("selectionCache");
    return copyTabHtml(message.tabIds, message.customDimensions);
  } else if (message.type === "clearSelectionCache") {
    localStorage.removeItem("selectionCache");
    return null;
  } else if (message.type === "sendFailed") {
    loginInterrupt(message.customDimensions, source.tab.id);
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
  ni: true,
});

browser.contextMenus.create({
  id: "email-tab",
  title: "Email Tab",
  contexts: ["page", "tab"],
  documentUrlPatterns: ["<all_urls>"],
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  let mailProvider = (await browser.storage.local.get("mailProvider")).mailProvider;
  if (!mailProvider) {
    browser.notifications.create("error-no-preference", {
      type: "basic",
      title: "Email Tabs",
      message: "You must first set your mail provider using the toolbar button",
    });
    sendEvent({
      ec: "interface",
      ea: "context-menu-failed-pref",
      ni: true,
    });
    return;
  }
  let customDimensions = {
    cd1: await browser.tabs.query({currentWindow: true}).length,
    cd2: 1,
    cd3: tab.active,
    cd6: false,
    cd7: mailProvider,
  };
  sendEvent(Object.assign({
    ec: "interface",
    ea: "context-menu",
    el: "email-tabs",
  }, customDimensions));
  sendEmail([tab.id], mailProvider, customDimensions);
});

function pause(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

async function getReloadedTab(discardedTab) {
  // Sometimes when you reload a tab and then use tabs.get to refresh its data,
  // you'll get back about:blank. We don't want that, so this pauses a bit in that
  // case
  if (!discardedTab.discarded) {
    throw new Error("getReloadedTab should only be used on discarded tabs");
  }
  await browser.tabs.reload(discardedTab.id);
  let retryLimit = 600;
  while (true) {
    let newTab = await browser.tabs.get(discardedTab.id);
    if (newTab.url !== "about:blank" || discardedTab.url === "about:blank") {
      // Even after all this, the tab might not be entirely reloaded
      // Typically this will cause screenshot and article extraction to fail, and a message
      // about host permissions missing (because it'll appear we're loading a script onto
      // an about:blank page)
      while (true) {
        try {
          await browser.tabs.executeScript(newTab.id, {
            code: "null",
          });
        } catch (e) {
          continue;
        }
        return newTab;
      }
    }
    retryLimit--;
    if (retryLimit <= 0) {
      return newTab;
    }
    await pause(100);
  }
}

async function getTabInfo(tabIds, {wantsScreenshots, wantsReadability}, customDimensions) {
  let allTabs = await browser.tabs.query({currentWindow: true});
  let tabInfo = {};
  for (let tab of allTabs) {
    if (tabIds.includes(tab.id)) {
      if (tab.discarded) {
        console.info("Reloading discarded tab", tab.id, tab.url);
        tab = await getReloadedTab(tab);
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
      let data = await browser.tabs.sendMessage(tabId, {type: "getData", wantsScreenshots, wantsReadability, customDimensions});
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

async function renderTabs(tabInfo, templateName, copying) {
  let TemplateComponent = emailTemplates[templateMetadata.getTemplate(templateName).componentName];
  if (!TemplateComponent) {
    throw new Error(`No component found for template: ${templateName}`);
  }
  let html = emailTemplates.renderEmail(tabInfo, TemplateComponent, copying);
  let subject = emailTemplates.renderSubject(tabInfo);
  return { html, subject };
}

async function sendEmail(tabIds, mailProvider, customDimensions) {
  let currentTabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  let openerTabId;
  if (currentTabs && currentTabs.length) {
    openerTabId = currentTabs[0].id;
  }
  let tabList = Array.from(await browser.tabs.query({})).filter(t => tabIds.includes(t.id));
  let subject = emailTemplates.renderSubject(tabList);
  let newTab = await browser.tabs.create({
    url: providerMetadata.providers[mailProvider].composeUrl(subject),
    openerTabId,
  });
  setTimeout(async () => {
    let currentTab = await browser.tabs.get(newTab.id);
    if (providerMetadata.providers[mailProvider].isLoginPage(currentTab.url)) {
      // We have a login form
      loginInterrupt(customDimensions, currentTab.id);
    }
  }, 1000);
  // Note that we let the other handlers load on the page while we collect data (i.e., we don't await getTabInfo)
  let tabInfo = getTabInfo(tabIds, {wantsScreenshots: true, wantsReadability: true}, customDimensions);
  await browser.tabs.executeScript(newTab.id, {
    file: "templateMetadata.js",
    runAt: "document_start",
  });
  await browser.tabs.executeScript(newTab.id, {
    file: "providerMetadata.js",
    runAt: "document_start",
  });
  await browser.tabs.executeScript(newTab.id, {
    file: "set-html-email.js",
    runAt: "document_start",
  });
  // Here we block on actually getting the info:
  tabInfo = await tabInfo;
  await browser.tabs.sendMessage(newTab.id, {
    type: "sendTabInfo",
    thisTabId: newTab.id,
    tabInfo,
    customDimensions,
  });
}

async function copyTabHtml(tabIds, customDimensions) {
  let tabInfo = await getTabInfo(tabIds, {wantsScreenshots: false, wantsReadability: false}, customDimensions);
  // this is passed as a prop to the email template in order to exclude the signature on copy
  const copying = true;
  let { html } = await renderTabs(tabInfo, "clipboard_links", copying);
  copyHtmlToClipboard(html);

  browser.notifications.create("notify-copied", {
    type: "basic",
    title: "Email Tabs",
    message: "Tabs copied to clipboard",
  });
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

async function loginInterrupt(customDimensions, tabId) {
  await pause(100);
  try {
    await browser.tabs.get(tabId);
  } catch (e) {
    // This will fail when the tab has been closed. In that case the user has closed
    // the tab, and this isn't a login failure
    return;
  }
  // Note: this is a dumb flag for the popup:
  if (loginInterruptedTime && Date.now() - loginInterruptedTime < 30 * 1000) {
    // We notified the user recently
    return;
  }
  loginInterruptedTime = Date.now();
  localStorage.setItem("loginInterrupt", String(Date.now()));
  browser.notifications.create("notify-no-login", {
    type: "basic",
    title: "Email Tabs",
    message: "Sign in to your email account to start using Email Tabs.",
  });

  sendEvent(Object.assign({}, customDimensions, {
    ec: "interface",
    ea: "compose-window-error",
    el: "account",
  }));
}

async function closeManyTabs(composeTabId, otherTabInfo) {
  let tabs = await browser.tabs.query({currentWindow: true});

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
