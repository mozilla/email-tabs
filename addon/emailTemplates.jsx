/* globals React, ReactDOMServer */

const { Fragment } = React;

this.emailTemplates = (function () {
  let exports = {};
  const SELECTION_TEXT_LIMIT = 1000; // 1000 characters max

  /** Returns '"selection..."', with quotes added and ellipsis if needed */
  function selectionDisplay(text) {
    text = text.replace(/^\s*/, "");
    text = text.replace(/\s*$/, "");
    text = truncateText(text, SELECTION_TEXT_LIMIT, SELECTION_TEXT_LIMIT + 50);
    return `“${text}”`;
  }

  /* If necessary, truncates text after limit characters, at some word boundary, not to
   * exceed hardLimit characters
   */
  function truncateText(text, limit, hardLimit) {
    if (text.length <= limit) {
      return text;
    }
    let trunc = text.substr(0, limit) + text.substr(limit).split(/\s+/)[0] + "…";
    if (trunc.length > hardLimit) {
      // There's no words to split on
      trunc = text.substr(0, limit) + "…";
    }
    return trunc;
  }

  class TitleScreenshot extends React.Component {
    render() {
      let tabList = this.props.tabs.map(
        tab => <TitleScreenshotTab key={tab.id} tab={tab} />
      );
      // Note that <React.Fragment> elements do not show up in the final HTML
      return <Fragment>{tabList}</Fragment>;
    }
  }

  exports.TitleScreenshot = TitleScreenshot;

  class TitleScreenshotTab extends React.Component {
    render() {
      let tab = this.props.tab;
      let img = null;
      let selection = null;
      if (tab.selection) {
        selection = <Fragment>{selectionDisplay(tab.selection)} <br /></Fragment>;
      }
      if (tab.screenshot) {
        // Note: the alt attribute is searched by gmail, but the title attribute is NOT searched
        // Note: box-shadow is specifically filtered out by gmail, other styles may get through
        let imgAlt = tab.screenshotAltText;
        if (!imgAlt) {
          imgAlt = "Screenshot";
          let domain = (new URL(tab.url)).hostname;
          if (domain) {
            // If it doesn't have a domain, it's probably a file: URL, or something non-standard
            domain = domain.replace(/^www\d?\./i, "");
            imgAlt = `Screenshot of ${domain}`;
          }
        }
        img = <Fragment>
          <img style={{border: "1px solid rgba(12,12,13,0.10)"}} height={tab.screenshot.height} width={tab.screenshot.width} src={tab.screenshot.url} alt={imgAlt} />
          <br />
        </Fragment>;
      }
      return <Fragment>
        <a href={tab.url}>{tab.title}</a> <br />
        { selection }
        { img }
        <br />
      </Fragment>;
    }
  }

  class JustLinks extends React.Component {
    render() {
      let tabList = this.props.tabs.map((tab, index) => {
        let selection =  null;
        if (tab.selection) {
          selection = <Fragment>{selectionDisplay(tab.selection)} <br /><br /></Fragment>;
        }
        return <Fragment key={index}>
          <a href={tab.url}>{tab.title}</a> <br />
          { selection }
        </Fragment>;
      });
      return <Fragment>{tabList}</Fragment>;
    }
  }

  exports.JustLinks = JustLinks;

  class FullArticles extends React.Component {
    render() {
      let tabList = this.props.tabs.map((tab, index) => {
        let selection =  null;
        if (tab.selection) {
          selection = <Fragment>{selectionDisplay(tab.selection)} <br /><br /></Fragment>;
        }
        let readability = null;
        if (tab.readability && tab.readability.content) {
          let content = parseReadableDocument(tab.readability.content);
          for (let img of content.querySelectorAll("img")) {
            img.style.maxWidth = "600px";
            img.style.height = "auto";
          }
          let hr = index === this.props.tabs.length - 1 ? null : <hr />;
          readability = <Fragment><div style={{maxWidth: "600px", border: "2px solid #aaa", borderRadius: "3px", padding: "10px"}} dangerouslySetInnerHTML={{__html: content.outerHTML}} /> { hr }</Fragment>;
        }
        return <Fragment key={index}>
          <a href={tab.url}>{tab.title}</a> <br />
          { selection }
          { readability }
        </Fragment>;
      });
      return <Fragment>{tabList}</Fragment>;
    }
  }

  function parseReadableDocument(d) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(d, "text/html");
    if (doc.body.childNodes.length !== 1) {
      console.warn("Readable body did not have exactly one element:", doc.body.childNodes.length, "elements found");
    }
    return doc.body.childNodes[0];
  }

  exports.FullArticles = FullArticles;

  exports.renderEmail = function(tabs, BaseComponent) {
    let emailHtml = ReactDOMServer.renderToStaticMarkup(<BaseComponent tabs={tabs} />);
    let lastValue;
    while (lastValue !== emailHtml) {
      lastValue = emailHtml;
      emailHtml = emailHtml.trimRight();
      emailHtml = emailHtml.replace(/<br\s*\/?>$/i, "");
    }
    emailHtml = emailHtml.replace(/(<br\s*\/?>\s*)*/, "");
    return emailHtml;
  };

  exports.renderSubject = function(tabs) {
    let title = truncateText(tabs[0].title, 50, 65);
    if (tabs.length === 1) {
      return `“${title}”`;
    } else if (tabs.length === 2) {
      return `“${title}” and 1 other link`;
    }
    return `“${title}” and ${tabs.length - 1} other links`;
  };

  return exports;
})();
