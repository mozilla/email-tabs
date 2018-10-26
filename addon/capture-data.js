/* globals captureText, Readability */

(function () {
  const SCREENSHOT_WIDTH = 540;

  let title = document.title;
  for (let el of document.querySelectorAll("meta[name='twitter:title'], meta[name='og:title']")) {
    title = el.getAttribute("content") || title;
  }
  let url = location.href;
  for (let el of document.querySelectorAll("link[rel='canonical']")) {
    url = el.getAttribute("href") || url;
  }

  let selection = null;

  if (window.getSelection()) {
    selection = String(window.getSelection());
  }

  function screenshotBox(box, scale) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    box.width = box.width || box.right - box.left;
    box.height = box.height || box.bottom - box.top;
    let canvasWidth = Math.floor(box.width * scale);
    let canvasHeight = Math.floor(box.height * scale);
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.scale(scale, scale);
    ctx.drawWindow(window, box.left, box.top, box.width, box.height, "#fff");
    return {
      url: canvas.toDataURL(),
      height: canvasHeight,
      width: canvasWidth,
    };
  }

  async function onMessage(message) {
    if (message.type !== "getData") {
      console.warn("Unexpected message type:", message.type);
      return undefined;
    }
    browser.runtime.onMessage.removeListener(onMessage);
    let data = {
      title,
      url,
      selection,
    };
    if (message.wantsScreenshots) {
      if (document.contentType.startsWith("image/")) {
        let img = document.querySelector("img");
        data.title = `Original image from ${location.hostname}`;
        data.screenshot = {
          url: location.href,
          height: img.height,
          width: img.width,
        };
      } else {
        data.screenshot = screenshotBox({left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight}, SCREENSHOT_WIDTH / window.innerWidth);
        data.screenshotAltText = captureText.getText(captureText.getViewportBox());
      }
    }

    if (message.wantsReadability) {
      if (document.contentType.startsWith("image/")) {
        let img = document.querySelector("img");
        data.title = `Original image from ${location.hostname}`;
        data.readability = {
          title: data.title,
          content: `<div>${img.outerHTML}</div>`,
          length: 0,
        };
      } else {
        try {
          let documentClone = document.cloneNode(true);
          if (new Readability(documentClone).isProbablyReaderable()) {
            data.readability = new Readability(documentClone).parse();
          } else {
            // not article, we'll just do a screenshot
            data.screenshot = screenshotBox({left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight}, SCREENSHOT_WIDTH / window.innerWidth);
            data.screenshotAltText = captureText.getText(captureText.getViewportBox());
          }
        } catch (e) {
          console.error("Error extracting readable version:", String(e), e.stack);
          browser.runtime.sendMessage(Object.assign, {}, message.customDimensions, {
            type: "sendEvent",
            ec: "interface",
            ea: "collect-info-error",
            el: (new URL(location.href)).protocol,
            cd4: "readability",
          });
        }
      }
    }
    return data;
  }

  browser.runtime.onMessage.addListener(onMessage);

})();
