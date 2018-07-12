this.emailTemplates = (function () {
  let exports = {};
  const SELECTION_TEXT_LIMIT = 1000; // 1000 characters max

  class Email extends React.Component {
    render() {
      let tabList = this.props.tabs.map(
        tab => <EmailTab key={tab.id} tab={tab} />
      );
      // Note for email HTML we remove <section> tags before inserting
      return <section>{tabList}</section>;
    }
  }

  exports.Email = Email;

  class EmailTab extends React.Component {
    render() {
      let tab = this.props.tab;
      let img = null;
      let selection = null;
      if (tab.selection) {
        let text = tab.selection;
        if (text.length > SELECTION_TEXT_LIMIT) {
          text = text.substr(0, SELECTION_TEXT_LIMIT) + "...";
        }
        text = `"${text}"`;
        selection = <section>{text} <br /></section>;
      }
      if (tab.screenshot) {
        // Note: the alt attribute is searched by gmail, but the title attribute is NOT searched
        // Note: box-shadow is specifically filtered out by gmail, other styles may get through
        let imgAlt = "Screenshot";
        let domain = (new URL(tab.url)).hostname;
        if (domain) {
          // If it doesn't have a domain, it's probably a file: URL, or something non-standard
          domain = domain.replace(/^www\d?\./i, "");
          imgAlt = `Screenshot of ${domain}`;
        }
        img = <section>
          <div style={{display: "inline-block", boxShadow: "7px 7px 20px #999", border: "1px solid #999"}}>
            <img height={tab.screenshot.height} width={tab.screenshot.width} src={tab.screenshot.url} alt={imgAlt} />
          </div>
          <br />
        </section>;
      }
      return <section>
        <a href={tab.url}>{tab.title}</a> <br />
        { selection }
        { img }
        <br />
      </section>;
    }
  }

  exports.renderEmail = function(tabs, BaseComponent) {
    let emailHtml = ReactDOMServer.renderToStaticMarkup(<BaseComponent tabs={tabs} />);
    emailHtml = emailHtml.replace(/<\/?section>/gi, " ");
    let lastValue;
    while (lastValue !== emailHtml) {
      lastValue = emailHtml;
      emailHtml = emailHtml.trimRight();
      emailHtml = emailHtml.replace(/<br\s*\/?>$/i, "");
    }
    emailHtml = emailHtml.replace(/(<br\s*\/?>\s*)*/, "");
    return emailHtml;
  };

  return exports;
})();
