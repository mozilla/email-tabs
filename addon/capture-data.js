(function () {
  let title = document.title;
  for (let el of document.querySelectorAll("meta[name='twitter:title'], meta[name='og:title']")) {
    title = el.getAttribute("content") || title;
  }
  let url = location.href;
  for (let el of document.querySelectorAll("link[rel='canonical']")) {
    url = el.getAttribute("href") || url;
  }

  function screenshotBox(box) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    box.width = box.width || box.right - box.left;
    box.height = box.height || box.bottom - box.top;
    canvas.width = box.width * window.devicePixelRatio;
    canvas.height = box.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.drawWindow(window, box.left, box.top, box.width, box.height, "#fff");
    return {
      url: canvas.toDataURL(),
      height: box.height,
      width: box.width,
    };
  }

  return {
    title,
    url,
    screenshot: screenshotBox({left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight})
  };
})()
