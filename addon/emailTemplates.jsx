/* globals React, ReactDOMServer */

const { Fragment } = React;

this.emailTemplates = (function () {
  let exports = {};
  const SELECTION_TEXT_LIMIT = 1000; // 1000 characters max

  /** Returns '"selection..."', with quotes added and ellipsis if needed */
  function selectionDisplay(text) {
    text = text.replace(/^\s*/, "");
    text = text.replace(/\s*$/, "");
    if (text.length > SELECTION_TEXT_LIMIT) {
      text = text.substr(0, SELECTION_TEXT_LIMIT) + "…";
    }
    return `“${text}”`;
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
          <img style={{border: "1px solid #999"}} height={tab.screenshot.height} width={tab.screenshot.width} src={tab.screenshot.url} alt={imgAlt} />
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
        let readability = "no readability";
        if (tab.readability && tab.readability.content) {
          let hr = index === this.props.tabs.length - 1 ? null : <hr />;
          readability = <Fragment><div dangerouslySetInnerHTML={{__html: tab.readability.content}} /> { hr }</Fragment>;
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
    if (tabs.length === 1) {
      return `“${tabs[0].title}”`;
    } else if (tabs.length === 2) {
      return `“${tabs[0].title}” and 1 other link`;
    }
    return `“${tabs[0].title}” and ${tabs.length - 1} other links`;
  };

  return exports;
})();
