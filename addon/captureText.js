this.captureText = (function() {
  const CAPTURE_WIGGLE = 10;
  const ELEMENT_NODE = document.ELEMENT_NODE;
  let exports = {};

  exports.getText = function(box) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const text = [];
    function traverse(el) {
      let elBox = el.getBoundingClientRect();
      elBox = {
        top: elBox.top + scrollY,
        bottom: elBox.bottom + scrollY,
        left: elBox.left + scrollX,
        right: elBox.right + scrollX
      };
      if (elBox.bottom < box.top ||
          elBox.top > box.bottom ||
          elBox.right < box.left ||
          elBox.left > box.right) {
        // Totally outside of the box
        return;
      }
      if (elBox.bottom > box.bottom + CAPTURE_WIGGLE ||
          elBox.top < box.top - CAPTURE_WIGGLE ||
          elBox.right > box.right + CAPTURE_WIGGLE ||
          elBox.left < box.left - CAPTURE_WIGGLE) {
        // Partially outside the box
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child.nodeType === ELEMENT_NODE) {
            traverse(child);
          }
        }
        return;
      }
      addText(el);
    }
    function addText(el) {
      let t;
      if (el.tagName === "IMG") {
        t = el.getAttribute("alt") || el.getAttribute("title");
      } else if (el.tagName === "A") {
        t = el.innerText;
        if (el.getAttribute("href") && !el.getAttribute("href").startsWith("#")) {
          t = `${t} (${el.href})`;
        }
      } else {
        t = el.innerText;
      }
      if (t) {
        text.push(t);
      }
    }
    traverse(document.body);
    if (text.length) {
      let result = text.join("\n");
      result = result.replace(/^\s+/, "");
      result = result.replace(/\s+$/, "");
      result = result.replace(/[ \t]+\n/g, "\n");
      return result;
    }
    return null;
  };

  exports.getViewportBox = function() {
    return {
      top: window.scrollY,
      left: window.scrollX,
      bottom: window.innerHeight + window.scrollY,
      right: window.innerWidth + window.scrollX,
    };
  };

  return exports;

})();
