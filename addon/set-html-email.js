browser.runtime.onMessage.addListener((message) => {
  setHtml(message.html);
});

function setHtml(html) {
  let editableEl = document.querySelector("div.editable[contenteditable]");
  if (!editableEl) {
    setTimeout(setHtml.bind(this, html), 100);
    return;
  }
  editableEl.innerHTML = html + "\n<br />" + editableEl.innerHTML; // eslint-disable-line no-unsanitized/property
  // Gmail does a fixup on paste, so we have to simulate a paste to make it fix the images we inserted:
  let paste = new Event("paste");
  paste = paste.wrappedJSObject;
  paste.clipboardData = cloneInto({getData: function() {}}, window, {cloneFunctions: true});
  editableEl.dispatchEvent(paste);
}
