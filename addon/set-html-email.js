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
}
