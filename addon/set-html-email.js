/* globals cloneInto, GLOBALS */

browser.runtime.onMessage.addListener((message) => {
  try {
    thisTabId = message.thisTabId;
    tabInfo = message.tabInfo;
    customDimensions = message.customDimensions;
  } catch (e) {
    console.error("Error getting tabInfo:", String(e), e.stack);
    throw e;
  }
});

let completed = false;
let customDimensions = {};
let selfEmailAddress;
let thisTabId;
let tabInfo;

window.addEventListener("beforeunload", async () => {
  if (completed) {
    // Actually everything worked out just fine
    return;
  }
  if (location.href.includes("accounts.google.com")) {
    // We've been attached to the wrong page anyway
    return;
  }

  browser.runtime.sendMessage(Object.assign({}, customDimensions, {
    type: "sendEvent",
    ec: "interface",
    ea: "compose-cancelled",
    cd5: document.querySelectorAll("span[email]").length,
  }));
  browser.runtime.sendMessage({
    type: "sendFailed",
    customDimensions,
  });
});

function setSubject(subject) {
  let input = document.querySelector("input[name='subjectbox']");
  if (!input) {
    setTimeout(setSubject.bind(this, subject), 100);
    return;
  }
  input.value = subject;
}

function setHtml(html) {
  let editableEl = document.querySelector("div.editable[contenteditable]");
  if (!editableEl) {
    setTimeout(setHtml.bind(this, html), 100);
    return;
  }
  let prevImages = editableEl.querySelectorAll("img[data-surl]").length;
  let oldHtml = editableEl.innerHTML;
  editableEl.innerHTML = html + "\n<br />" ; // eslint-disable-line no-unsanitized/property
  let images = editableEl.querySelectorAll("img");
  let imageAttributeFixups = [];
  // This saves all the attribues on any images. These attributes would typically have been
  // set in the EmailTab.render method. The attributes will be lost during upload, and reapplied
  // further down in this file:
  let anyDataImages = false;
  for (let image of images) {
    if (image.src.startsWith("data:")) {
      anyDataImages = true;
    }
    let savedAttributes = [];
    imageAttributeFixups.push(savedAttributes);
    for (let attr of image.attributes) {
      if (["src", "height", "width"].includes(attr.name)) {
        continue;
      }
      savedAttributes.push([attr.name, attr.value]);
    }
  }

  editableEl.innerHTML = editableEl.innerHTML + oldHtml; // eslint-disable-line no-unsanitized/property
  // Gmail does a fixup on paste, so we have to simulate a paste to make it fix the images we inserted:
  let paste = new Event("paste");
  paste = paste.wrappedJSObject;
  paste.clipboardData = cloneInto({
    getData() {},
  }, window, {cloneFunctions: true});
  editableEl.dispatchEvent(paste);
  // Now that we've successfully sent an mail, we don't have to persist the selection from before:
  browser.runtime.sendMessage({
    type: "clearSelectionCache",
  });
  completed = true;
  if (anyDataImages) {
    // This code waits for the images to get uploaded, then reapplies any attributes that were
    // left out during the upload (specifically alt is of interest):
    let fixupInterval = setInterval(() => {
      let surlImages = document.querySelectorAll("img[data-surl]");
      if (surlImages.length <= prevImages) {
        // No new images have appeared, so we'll wait for the next interval
        return;
      }
      // FIXME: if there are no good images in the email, then this will never be reached
      // (which is okay, nothing to fixup then, but...)
      for (let i = 0; i < surlImages.length; i++) {
        let image = surlImages[i];
        let savedAttributes = imageAttributeFixups[i];
        if (!savedAttributes || !savedAttributes.length) {
          continue;
        }
        for (let attrPair of savedAttributes) {
          image.setAttribute(attrPair[0], attrPair[1]);
        }
      }
      clearInterval(fixupInterval);
      browser.runtime.sendMessage(Object.assign({}, customDimensions, {
        type: "sendEvent",
        ec: "interface",
        ea: "compose-pasted",
        ni: true,
      }));
      hideIframe();
    }, 100);
  } else {
    hideIframe();
  }
}

let completedInterval = setInterval(() => {
  let viewMessageEl = document.getElementById("link_vsm");
  if (viewMessageEl) {
    clearInterval(completedInterval);
    const selfSend = Array.from(document.querySelectorAll("span[email]"))
          .map(el => el.getAttribute("email"))
          .includes(selfEmailAddress);

    browser.runtime.sendMessage(Object.assign({}, customDimensions, {
      type: "sendEvent",
      ec: "interface",
      ea: "compose-sent",
      el: selfSend ? "send-to-self" : "send-to-other",
      cd5: document.querySelectorAll("span[email]").length,
    }));

    showCloseButtons();
  }
}, 300);

function showCloseButtons() {
  showIframe("#done-container");
  let done = iframeDocument.querySelector("#done");
  let doneMsg = iframeDocument.querySelector("#done-message");
  let closeAllTabs = iframeDocument.querySelector("#close-all-tabs");
  let numTabs = tabInfo.length;
  if (numTabs === 1) {
    closeAllTabs.textContent = closeAllTabs.getAttribute("data-one-tab");
    doneMsg.textContent = doneMsg.getAttribute("data-one-tab");
  } else {
    closeAllTabs.textContent = closeAllTabs.getAttribute("data-many-tabs").replace("__NUMBER__", numTabs);
    doneMsg.textContent = doneMsg.getAttribute("data-many-tabs").replace("__NUMBER__", numTabs);
  }
  done.addEventListener("click", async () => {
    browser.runtime.sendMessage(Object.assign({}, customDimensions, {
      type: "sendEvent",
      ec: "interface",
      ea: "button-click",
      el: "compose-done-close",
    }));
    await browser.runtime.sendMessage({
      type: "closeComposeTab",
      tabId: thisTabId,
    });
  });
  closeAllTabs.addEventListener("click", async () => {
    browser.runtime.sendMessage(Object.assign({}, customDimensions, {
      type: "sendEvent",
      ec: "interface",
      ea: "button-click",
      el: "compose-done-close-all",
    }));
    await browser.runtime.sendMessage({
      type: "closeTabs",
      closeTabInfo: tabInfo,
      composeTabId: thisTabId,
    });
  });
}

function showLoading() {
  showIframe("#loading-container");
}

function getTemplateListener(selectedTemplate) {
  customDimensions.cd4 = selectedTemplate;
  return async () => {
    showLoading();
    browser.runtime.sendMessage(Object.assign({}, customDimensions, {
      type: "sendEvent",
      ec: "interface",
      ea: "button-click",
      el: "choose-template",
    }));

    let { html, subject } = await browser.runtime.sendMessage({
      type: "renderTemplate",
      selectedTemplate,
      tabInfo,
    });
    setSubject(subject);
    setHtml(html);
  };
}

function showTemplateSelector() {
  // need to set the users email address here to check for self sending
  // custom dimension once the send button is clicked. We lose GLOBALS
  // variable at that point.
  selfEmailAddress = GLOBALS[10];
  showIframe("#choose-template");
  let cancel = iframeDocument.querySelector("#choose-template-cancel");
  cancel.addEventListener("click", async () => {
    completed = true;
    browser.runtime.sendMessage(Object.assign({}, customDimensions, {
      type: "sendEvent",
      ec: "interface",
      ea: "template-cancelled",
    }));

    await browser.runtime.sendMessage({
      type: "closeComposeTab",
      tabId: thisTabId,
    });
  });

  let screenshotTemplate = iframeDocument.querySelector("#screenshot-template");
  screenshotTemplate.addEventListener("click",
                                getTemplateListener(screenshotTemplate.getAttribute("data-name")));
  let linkTemplate = iframeDocument.querySelector("#link-template");
  linkTemplate.addEventListener("click",
                                getTemplateListener(linkTemplate.getAttribute("data-name")));
  let readabilityTemplate = iframeDocument.querySelector("#readability-template");
  readabilityTemplate.addEventListener("click",
                                getTemplateListener(readabilityTemplate.getAttribute("data-name")));
}

let iframe = null;
let initPromise;
let iframeDocument = null;

function createIframe() {
  initPromise = new Promise((resolve, reject) => {
    let iframeUrl = browser.extension.getURL("gmail-iframe.html");
    iframe = document.createElement("iframe");
    iframe.id = "mozilla-email-tabs";
    iframe.src = iframeUrl;
    iframe.style.zIndex = "99999999999";
    iframe.style.border = "none";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.margin = "0";
    iframe.scrolling = "no";
    iframe.style.clip = "auto";
    iframe.style.display = "none";
    iframe.style.setProperty("position", "fixed", "important");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    document.body.appendChild(iframe);
    iframe.addEventListener("load", () => {
      try {
        if (iframe.contentDocument.documentURI !== iframeUrl) {
          // This check protects against certain attacks on the iframe that quickly change src
          console.error("iframe URL does not match expected URL", iframe.contentDocument.documentURI);
          throw new Error("iframe URL does not match expected URL");
        }
        iframeDocument = iframe.contentDocument;
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

function showIframe(container) {
  let containers = ["#loading-container", "#done-container", "#choose-template"];
  if (!containers.includes(container)) {
    throw new Error(`Unexpected container: ${container}`);
  }
  for (let c of containers) {
    if (c === container) {
      iframeDocument.querySelector(c).style.display = "";
    } else {
      iframeDocument.querySelector(c).style.display = "none";
    }
  }
  iframe.style.display = "";
}

function hideIframe() {
  iframe.style.display = "none";
}

createIframe();

initPromise.then(() => {
  showTemplateSelector();
});
