/* globals cloneInto, providerMetadata */

let provider = providerMetadata.detectProvider();

function resolveablePromise() {
  let _resolve, _reject;
  let promise = new Promise((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });
  promise.resolve = _resolve;
  promise.reject = _reject;
  return promise;
}

browser.runtime.onMessage.addListener((message) => {
  try {
    thisTabId = message.thisTabId;
    tabInfo.resolve(message.tabInfo);
    customDimensions = message.customDimensions;
  } catch (e) {
    console.error("Error getting tabInfo:", String(e), e.stack);
    throw e;
  }
});

let completed = false;
let customDimensions = {};
let thisTabId;
let tabInfo = resolveablePromise();

window.addEventListener("beforeunload", async () => {
  if (completed) {
    // Actually everything worked out just fine
    return;
  }
  if (providerMetadata.providers[provider] && providerMetadata.providers[provider].isLoginPage(location.href)) {
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

const providers = {

  gmail: {
    setSubject(subject) {
      let input = document.querySelector("input[name='subjectbox']");
      if (!input) {
        setTimeout(this.setSubject.bind(this, subject), 100);
        return;
      }
      input.value = subject;
    },

    loginRequired() {
      return false;
    },

    setHtml(html) {
      let editableEl = document.querySelector("div.editable[contenteditable]");
      if (!editableEl) {
        setTimeout(this.setHtml.bind(this, html), 100);
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
          hideIframe();
          // While some images have been uploaded, it's possible all images haven't been uploaded.
          // The user can edit the email, but we'll wait until everything is uploaded to try to
          // fix up the image attributes
          if (surlImages.length < imageAttributeFixups.length) {
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
        }, 100);
      } else {
        hideIframe();
      }
    },

    setup() {
      let completedInterval = setInterval(() => {
        let viewMessageEl = document.getElementById("link_vsm");
        if (viewMessageEl) {
          clearInterval(completedInterval);

          let selfEmailAddress = extractEmailAddress(document.title);
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
    },
  },

  yahoo: {
    setSubject(subject) {
      // Note we rely on the compose URL to set the subject, because Yahoo makes it very hard
      // to update that field.
    },

    loginRequired() {
      return false;
    },

    setHtml(html) {
      let editableEl = document.querySelector("[aria-label='Message body']");
      if (!editableEl) {
        setTimeout(this.setHtml.bind(this, html), 100);
        return;
      }
      completed = true;
      pasteHtml(html, editableEl);
      hideIframe();
    },

    setup() {
      let completedInterval = setInterval(() => {
        // The To addresses aren't there after you send, so we save any To addresses we find in this.toAddresses
        // and check it against the self address when the document is actually sent
        let toAddressField = document.querySelector("div[data-test-id='compose-header-field-to']");
        if (toAddressField && toAddressField.textContent) {
          let toAddresses = Array.from(toAddressField.querySelectorAll("[data-test-id='pill']"));
          toAddresses = toAddresses.map(el => extractEmailAddress(el.getAttribute("title")));
          toAddresses = toAddresses.filter(a => a);
          if (toAddresses.length) {
            this.toAddresses = toAddresses;
          }
        }

        // An example success message looks like this:
        /*
          <div class=\"em_N D_F P_Z2baRGn A_6EWk i_6Mbr C_Z281SGl o_h r_BN\"><span>Your <a href=\"/d/folders/2/messages/35?mrdparam=HFwiFMAYeagMubHHVdKk2WO37dPXDxluQjhI.NaS3_aHrCt.HJSs6wQ1lZ4crwpKwdVmZCZKaUd3ExqD0lYNzwzIwR.GSQ7CQ2oi_Vz5VXacqone~A\" class=\"C_Z2aVTcY r_P\" data-test-id=\"navigate-button\"><span>message</span></a> has been sent.</span></div>
        */
        let successMessageEl = document.querySelector("div > span > a[href^='/d/folders/'][data-test-id='navigate-button'] > span");
        if (successMessageEl) {
          clearInterval(completedInterval);
          let selfEmailAddress = extractEmailAddress(document.title);
          const selfSend = this.toAddresses && this.toAddresses.includes(selfEmailAddress);
          browser.runtime.sendMessage(Object.assign({}, customDimensions, {
            type: "sendEvent",
            ec: "interface",
            ea: "compose-sent",
            el: selfSend ? "send-to-self" : "send-to-other",
            cd5: self.toAddresses ? self.toAddresses.length : null,
          }));

          showCloseButtons();
        }
      }, 300);
    },

  },

  outlook: {
    zIndex: 999999,
    setSubject(subject) {
      let input = document.querySelector("input[role='textbox'][autoid='_mcp_c']");
      if (!input) {
        setTimeout(this.setSubject.bind(this, subject), 100);
        return;
      }
      input.value = subject;
      let event = new Event("change");
      input.dispatchEvent(event);
    },
    setHtml(html) {
      let editableEl = document.querySelector("div[autoid='_z_l'] div[contenteditable]");
      if (!editableEl) {
        setTimeout(this.setHtml.bind(this, html), 100);
        return;
      }
      editableEl.innerHTML = html + editableEl.innerHTML; // eslint-disable-line no-unsanitized/property
      completed = true;
      hideIframe();
    },
    setup() {
      let completedInterval = setInterval(() => {
        // The To addresses aren't there after you send, so we save any To addresses we find in this.toAddresses
        // and check it against the self address when the document is actually sent
        let toAddresses = document.querySelectorAll(".PersonaPaneLauncher span[autoid='_pe_d']");
        if (toAddresses.length) {
          toAddresses = Array.from(toAddresses).map(el => extractEmailAddress(el.innerText)).filter(x => x);
          this.toAddresses = toAddresses;
        }
        // Outlook doesn't have any success message or indicator
        let editableEl = document.querySelector("div[autoid='_z_l'] div[contenteditable]");
        if (editableEl) {
          this.hasSeenEditable = true;
        }
        if (!editableEl && this.hasSeenEditable) {
          // This doesn't distinguish between canceling the composition and sending the mail
          clearInterval(completedInterval);
          let selfEmailAddress = extractEmailAddress(document.title);
          const selfSend = this.toAddresses && this.toAddresses.includes(selfEmailAddress);
          browser.runtime.sendMessage(Object.assign({}, customDimensions, {
            type: "sendEvent",
            ec: "interface",
            ea: "compose-sent",
            el: selfSend ? "send-to-self" : "send-to-other",
            cd5: self.toAddresses ? self.toAddresses.length : null,
          }));

          showCloseButtons();
        }
      }, 300);
    },
    loginRequired() {
      let el = document.querySelector("a.linkButtonFixedHeader.office-signIn");
      return !!el;
    },
  },
};

/** Attempts to extract an email address using a regular expression, otherwise null
 * Note: this isn't very accurate, but is good enough for the metrics where we use it
*/
function extractEmailAddress(text) {
  if (!text) {
    return null;
  }
  let match = text.match(/([^\s<>()[\]]+@[a-z0-9.-]+)/);
  return match ? match[1] : null;
}

async function pasteHtml(html, destination) {
  // If we could use the clipboard APIs:
  /*
  let previous = await navigator.clipboard.read();
  let htmlTransfer = new DataTransfer();
  htmlTransfer.setData("text/html", html);
  await navigator.clipboard.write(htmlTransfer);
  destination.focus();
  document.execCommand("paste");
  await navigator.clipboard.write(previous);
  */
  // But we have to do it this way because those APIs are hidden behind a pref...
  let div = document.createElement("div");
  div.setAttribute("contenteditable", "true");
  div.innerHTML = html; // eslint-disable-line no-unsanitized/property
  document.body.appendChild(div);
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(div);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("copy");
  destination.focus();
  let pasteSucceeded = document.execCommand("paste");
  if (!pasteSucceeded) {
    // FIXME: sendEvent here about paste failure
    // (execCommand("paste") should be reliable in this add-on context, but in experience it isn't always)
    browser.runtime.sendMessage(Object.assign({}, customDimensions, {
      type: "sendEvent",
      ec: "interface",
      ea: "paste-failed",
      ni: true,
    }));
    const pasteSymbol = (window.navigator.platform.match(/Mac/i)) ? "\u2318" : "Ctrl";
    browser.notifications.create("paste-failed", {
      type: "basic",
      title: "Email Tabs",
      message: `Please use ${pasteSymbol}+V to add the email contents`,
    });
  }
  document.body.removeChild(div);
}

async function showCloseButtons() {
  showIframe("#done-container");
  let done = iframeDocument.querySelector("#done");
  let doneMsg = iframeDocument.querySelector("#done-message");
  let closeAllTabs = iframeDocument.querySelector("#close-all-tabs");
  let numTabs = (await tabInfo).length;
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
      closeTabInfo: await tabInfo,
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
      tabInfo: await tabInfo,
    });
    providers[provider].setSubject(subject);
    providers[provider].setHtml(html);
  };
}

function showTemplateSelector() {
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
const initPromise = resolveablePromise();
let iframeDocument = null;

function createIframe() {
  if (!document.body) {
    setTimeout(createIframe, 50);
    return;
  }
  let iframeUrl = browser.extension.getURL("gmail-iframe.html");
  iframe = document.createElement("iframe");
  iframe.id = "mozilla-email-tabs";
  iframe.src = iframeUrl;
  iframe.style.zIndex = providers[provider].zIndex || "2";
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
  // If the "load" event doesn't fire after 3 seconds, we put a warning in the console
  let loadTimeoutId = setTimeout(() => {
    console.warn("Iframe failed to load in 3 seconds");
    console.warn("Iframe:", iframe && iframe.outerHTML);
    console.warn("Iframe parent:", String(iframe.parentNode));
  }, 3000);
  iframe.addEventListener("load", () => {
    try {
      clearTimeout(loadTimeoutId);
      if (iframe.contentDocument.documentURI !== iframeUrl) {
        // This check protects against certain attacks on the iframe that quickly change src
        console.error("iframe URL does not match expected URL", iframe.contentDocument.documentURI);
        throw new Error("iframe URL does not match expected URL");
      }
      iframeDocument = iframe.contentDocument;
      initPromise.resolve();
    } catch (e) {
      initPromise.reject(e);
    }
  });
}

let keepIframeFocusedTimer;

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
  iframe.contentWindow.focus();
  let textareaFocusCounter = 3;
  keepIframeFocusedTimer = setInterval(() => {
    if (document.activeElement.tagName === "TEXTAREA") {
      textareaFocusCounter--;
      // The textarea tries to get an autofocus
      iframe.contentWindow.focus();
      if (textareaFocusCounter <= 0) {
        clearInterval(keepIframeFocusedTimer);
        keepIframeFocusedTimer = null;
      }
    }
  }, 100);
}

function hideIframe() {
  iframe.style.display = "none";
  clearInterval(keepIframeFocusedTimer);
  keepIframeFocusedTimer = null;
}

createIframe();

initPromise.then(() => {
  if (providers[provider].loginRequired()) {
    browser.runtime.sendMessage({
      type: "sendFailed",
    });
    return;
  }
  if (!providerMetadata.providers[provider].isLoginPage(location.href)) {
    showTemplateSelector();
    providers[provider].setup();
  }
});
