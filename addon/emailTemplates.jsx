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

  function selectionMarkup(text) {
    if (!text) {
      return null;
    }
    // When you hit Ctrl-] in Gmail it produces this markup:
    return <div style={{marginLeft: "40px"}}>{selectionDisplay(text)}</div>;
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

  class Signature extends React.Component {
    render() {
      return (<div>
              <br/>
              <p>Sent with <a href="https://testpilot.firefox.com/experiments/email-tabs?utm_source=email-tabs&utm_medium=email&utm_campaign=email-footer">Email Tabs</a>, a <a href="https://testpilot.firefox.com?utm_source=email-tabs&utm_medium=email&utm_campaign=email-footer">Firefox Test Pilot</a> experiment.
              </p></div>);
    }
  }

  class TitleScreenshot extends React.Component {
    render() {
      let tabList = this.props.tabs.map(
        tab => <TitleScreenshotTab key={tab.id} tab={tab} />
      );
      return <div style={{width: "600px"}}><br />{tabList}<Signature/></div>;
    }
  }

  exports.TitleScreenshot = TitleScreenshot;

  class TitleScreenshotTab extends React.Component {
    render() {
      let tab = this.props.tab;
      let img = null;
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
        img = <img width="540px" height="auto" src={tab.screenshot.url} alt={imgAlt} />;
      }
      return <div style={{ width: "540px", background: "#f9f9fa", borderBottom: "2px solid #ededf0", padding: "24px 30px", marginBottom: "24px", borderRadius: "3px" }}>
        { selectionMarkup(tab.selection) }
        { img }
        <br />
        <a href={tab.url} style={{ color: "#0060df", fontSize: "1.1em" }}>{tab.title}</a>
      </div>;
    }
  }

  class JustLinks extends React.Component {
    render() {
      let tabList = this.props.tabs.map((tab, index) => {
        return <Fragment key={index}>
          <a href={tab.url} style={{ color: "#0060df" }}>{tab.title}</a> <br />
          { selectionMarkup(tab.selection) }
        </Fragment>;
      });
      if (this.props.copying) {
        return <Fragment>{tabList}</Fragment>;
      }
      return <Fragment>{tabList}<Signature/></Fragment>;
    }
  }

  exports.JustLinks = JustLinks;

  class FullArticles extends React.Component {
    render() {
      let toc = null;
      if (this.props.tabs.length > 1) {
        toc = this.props.tabs.map((tab, index) => {
          let anchor = `email-tabs-article-${index}`;
          tab.anchorName = anchor;
          return <Fragment key={`toc-${index}`}><a href={`#${anchor}`} style={{ color: "#0060df"}}>Jump to {tab.title}</a> <br /></Fragment>;
        });
        toc.push(<br />);
      }
      let tabList = this.props.tabs.map((tab, index) => {
        let anchorTag = null;
        if (toc) {
           // eslint-disable-next-line jsx-a11y/anchor-is-valid, jsx-a11y/anchor-has-content
          anchorTag = <a name={tab.anchorName}></a>;
        }
        let readability, screenshot = null;
        if (tab.readability && tab.readability.content) {
          let content = parseReadableDocument(tab.readability.content);
          for (let img of content.querySelectorAll("img")) {
            img.style.maxWidth = "540px";
            img.style.height = "auto";
          }
          for (let a of content.querySelectorAll("a")) {
            a.style.color = "#0060df";
          }

          for (let figure of content.querySelectorAll("figure")) {
            figure.style.backgroundColor = "white";
            figure.style.border = "1px solid #ededf0";
            figure.style.borderBottomWidth = "2px";
            figure.style.borderRadius = "3px";
            figure.style.margin = "0 0 16px 0";
            figure.style.padding = "24px";
          }

          for (let figcaption of content.querySelectorAll("figcaption")) {
            figcaption.style.fontStyle = "italic";
          }

          for (let blockquote of content.querySelectorAll("blockquote")) {
            blockquote.style.borderLeft = "3px solid #ededf0";
            blockquote.style.margin = "16px";
            blockquote.style.padding = "24px";
          }

          for (let p of content.querySelectorAll("p")) {
            p.style.lineHeight = "1.56em";
            p.style.margin = "0 0 24px 0";
          }

          readability = <div dangerouslySetInnerHTML={{__html: content.outerHTML}} />;
        } else if (tab.screenshot) {
          screenshot = <TitleScreenshotTab tab={tab} />;
        }

        return <div key={index} style={{ maxWidth: "600px", background: "#f9f9fa", borderBottom: "2px solid #ededf0", padding: "24px", marginBottom: "24px", borderRadius: "3px" }}>
          { anchorTag }
          <h2 style={{ fontWeight: "normal", marginTop: "10px", fontSize: "28px" }}>{tab.title}</h2>
          <a href={tab.url} style={{ color: "#0060df" }}>Source</a>
          <br />
          <br />
          { selectionMarkup(tab.selection) }
          { readability }
          { screenshot }
        </div>;
      });
      // <span>&#8203;</span> is a zero-width space; if you insert characters before it in the editor, they will
      // not be <strong>
      return <div style={{fontSize: "1.1em"}}>
        {!!toc && <Fragment><span>&#8203;</span><strong>Table of Contents</strong><br /><br /></Fragment>}
        {!toc && <br />}
        {toc}
        {!!toc && <Fragment><strong>Full Text</strong></Fragment>}
        {tabList}
        <Signature/>
      </div>;
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

  exports.renderEmail = function(tabs, BaseComponent, copying) {
    if (!tabs) {
      console.trace();
      throw new Error("Cannot renderEmail without tabs");
    }
    let emailHtml = ReactDOMServer.renderToStaticMarkup(<BaseComponent tabs={tabs} copying={copying} />);
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
