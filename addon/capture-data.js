(function () {
  const SCREENSHOT_WIDTH = 350;

  let title = document.title;
  for (let el of document.querySelectorAll("meta[name='twitter:title'], meta[name='og:title']")) {
    title = el.getAttribute("content") || title;
  }
  let url = location.href;
  for (let el of document.querySelectorAll("link[rel='canonical']")) {
    url = el.getAttribute("href") || url;
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

  return {
    title,
    url,
    screenshot: screenshotBox({left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight}, SCREENSHOT_WIDTH / window.innerWidth)
  };
})();
