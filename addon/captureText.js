this.captureText = (function() {
  const CAPTURE_WIGGLE = 10;
  const ELEMENT_NODE = document.ELEMENT_NODE;
  let exports = {};

  exports.getText = function(box) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const text = [];
    function traverse(el) {
      let elStyle = getComputedStyle(el);
      if (elStyle.opacity === "0" || elStyle.opacity === 0) {
        return;
      }
      if (elStyle.display === "none") {
        return;
      }
      if (elStyle.visibility === "hidden") {
        return;
      }
      let clientRect = el.getBoundingClientRect();
      let elBox = {
        top: clientRect.top + scrollY,
        bottom: clientRect.bottom + scrollY,
        left: clientRect.left + scrollX,
        right: clientRect.right + scrollX,
      };
      if (elBox.bottom < box.top ||
          elBox.top > box.bottom ||
          elBox.right < box.left ||
          elBox.left > box.right) {
        // Totally outside of the box
        return;
      }
      let parent = el.parentNode;
      if (parent) {
        let parentStyle = getComputedStyle(parent);
        if (parentStyle.overflow === "hidden" || parentStyle.overflow === "scroll") {
          if (clientRect.left > parent.offsetWidth + parent.scrollLeft - CAPTURE_WIGGLE ||
            clientRect.right < parent.scrollLeft + CAPTURE_WIGGLE ||
            clientRect.top > parent.offsetHeight + parent.scrollTop - CAPTURE_WIGGLE ||
            clientRect.bottom < parent.scrollTop + CAPTURE_WIGGLE) {
            // el is scrolled out of view or truncated:
            return;
          }
        }
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
      result = result.replace(/\s+$/, " ");
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
