/* globals cloneInto */

browser.runtime.onMessage.addListener((message) => {
  thisTabId = message.thisTabId;
  closeTabInfo = message.tabInfo;
  setHtml(message.html);
});

let completed = false;
let thisTabId;
let closeTabInfo;

window.addEventListener("beforeunload", () => {
  if (completed) {
    // Actually everything worked out just fine
    return;
  }
  if (location.href.includes("accounts.google.com")) {
    // We've been attached to the wrong page anyway
    return;
  }
  browser.runtime.sendMessage({
    type: "sendFailed"
  });
  console.error("beforeunload");
});

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
  for (let image of images) {
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
    getData() {}
  }, window, {cloneFunctions: true});
  editableEl.dispatchEvent(paste);
  // Now that we've successfully sent an mail, we don't have to persist the selection from before:
  browser.runtime.sendMessage({
    type: "clearSelectionCache"
  });
  completed = true;
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
    for (let i=0; i<surlImages.length; i++) {
      let image = surlImages[i];
      let savedAttributes = imageAttributeFixups[i];
      if (!savedAttributes || !savedAttributes.length) {
        continue;
      }
      for (let attrPair of savedAttributes) {
        image.setAttribute(attrPair[0], attrPair[1]);
      }
    }
    clearTimeout(fixupInterval);
  }, 100);
}

let completedTimeout = setInterval(() => {
  let viewMessageEl = document.getElementById("link_vsm");
  if (viewMessageEl) {
    clearTimeout(completedTimeout);
    showCloseButtons();
  }
}, 300);

function showCloseButtons() {
  let html = `<div style="
    position: absolute;
    top: 50%;
    left: 50%;
    margin-left: -200px;
    margin-top: -50px;
    width: 400px;
  ">

    <button class="done">Done</button> <br>
    <button class="close-all-tabs">Close ${Object.keys(closeTabInfo).length} tabs</button>

  </div>
  `;
  let div = document.createElement("div");
  div.innerHTML = html;
  div = div.childNodes[0];
  let doneButton = div.querySelector(".done");
  let closeAllTabsButton = div.querySelector(".close-all-tabs");
  doneButton.addEventListener("click", async () => {
    await browser.runtime.sendMessage({
      type: "closeComposeTab",
      tabId: thisTabId,
    });
  });
  closeAllTabsButton.addEventListener("click", async () => {
    await browser.runtime.sendMessage({
      type: "closeTabs",
      closeTabInfo,
      composeTabId: thisTabId
    })
  });
  document.body.appendChild(div);
}
