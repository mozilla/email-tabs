/* globals cloneInto */

browser.runtime.onMessage.addListener((message) => {
  setHtml(message.html);
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
  // This saves all the attribues on any images. These attributes would typically have been
  // set in the EmailTab.render method. The attributes will be lost during upload, and reapplied
  // further down in this file:
  for (let image of images) {
    let parent = image.parentNode;
    let fixupAttributes = [];
    for (let attr of image.attributes) {
      if (["src", "height", "width"].includes(attr.name)) {
        continue;
      }
      fixupAttributes.push([attr.name, attr.value]);
    }
    if (fixupAttributes.length) {
      parent.setAttribute("data-fixup", JSON.stringify(fixupAttributes));
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
  // This code waits for the images to get uploaded, then reapplies any attributes that were
  // left out during the upload (specifically alt is of interest):
  let fixupInterval = setInterval(() => {
    let surlImages = document.querySelectorAll("img[data-surl]");
    if (surlImages.length <= prevImages) {
      return;
    }
    // FIXME: if there are no good images in the email, then this will never be reached
    // (which is okay, nothing to fixup then, but )
    for (let image of surlImages) {
      let parent = image.parentNode;
      while (parent && parent !== editableEl && !parent.hasAttribute("data-fixup")) {
        parent = parent.parentNode;
      }
      if (!parent.hasAttribute("data-fixup")) {
        continue;
      }
      let fixupAttributes = JSON.parse(parent.getAttribute("data-fixup"));
      parent.removeAttribute("data-fixup");
      for (let attrPair of fixupAttributes) {
        image.setAttribute(attrPair[0], attrPair[1]);
      }
      delete parent.fixupAttributes;
    }
    clearTimeout(fixupInterval);
  }, 100);
}
