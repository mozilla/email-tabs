/* globals React, ReactDOM, ReactDOMServer */

let activeTabLi;
let selected = new Map();
const LOGIN_ERROR_TIME = 90 * 1000; // 90 seconds

class Tab extends React.Component {
  render() {
    let tab = this.props.tab;
    let checkId = `checkbox-${this.props.tab.id}`;
    let isOkay = tab.url.startsWith("http");
    let checked = this.props.selected.get(tab.id);
    let liClass;
    if (tab.active) {
      liClass = "active";
    }
    let image = <span className="tab__image" style={{backgroundImage: `url(${tab.favIconUrl})`}} />;
    return <li className={liClass} ref={li => {
      if (this.props.tab.active) {
        activeTabLi = li;
      }
    }}>
      <label htmlFor={checkId} className="tab">
        { isOkay ? <input type="checkbox" value={tab.id} checked={checked}
        onChange={this.onChange.bind(this)} id={checkId} ref={checkbox => this.checkbox = checkbox} /> : <input type="checkbox" disabled /> }
        { image }
        <span className="tab__text">{tab.title}</span>
      </label>
    </li>;
  }

  onChange() {
    selected.set(this.props.tab.id, this.checkbox.checked);
    if (this.props.onChange) {
      this.props.onChange();
    }
    render();
  }
}

class TabList extends React.Component {
  render() {
    let tabElements = this.props.tabs.map(
      tab => <Tab tab={tab} key={tab.id} selected={this.props.selected} onChange={this.onChangeSelection.bind(this)} />
    );
    return <div className="tabs-wrapper">
      <section className="tabs-section" style={{display: "flex"}}>
        <ul className="tabs-section__list" role="navigation">{tabElements}</ul>
      </section>
    </div>;
  }
  onChangeSelection() {
    selectionCache.saveSelectedTabs(this.props.tabs);
  }
}

class Page extends React.Component {
  render() {
    let allChecked = true;
    this.indeterminate = false;
    for (let tab of this.props.tabs) {
      if (!this.props.selected.get(tab.id)) {
        allChecked = false;
      } else {
        this.indeterminate = true;
      }
    }
    if (allChecked) {
      this.indeterminate = false;
    }
    return <div>
      { this.props.showLoginError ? <LoginError /> : null }
      <div className="controls">
        <div>
          <label htmlFor="allCheckbox">
            <input checked={allChecked} ref={allCheckbox => this.allCheckbox = allCheckbox} type="checkbox" id="allCheckbox" onChange={this.onClickCheckAll.bind(this)} />
            Select All
          </label>
        </div>
      </div>
      <div className="separator"></div>
      <div className="tabList">
        <TabList tabs={this.props.tabs} selected={this.props.selected} />
      </div>

      <footer class="panel-footer toggle-enabled">
        <button onClick={this.copyTabs.bind(this)}>
          Copy Tabs to Clipboard
        </button>
        <button onClick={this.sendEmail.bind(this)}>
          Email Tabs
        </button>
      </footer>

    </div>;
  }

  componentDidMount() {
    this.allCheckbox.indeterminate = this.indeterminate;
  }

  componentDidUpdate() {
    this.componentDidMount();
  }

  onClickCheckAll() {
    let allChecked = true;
    for (let tab of this.props.tabs) {
      allChecked = allChecked && this.props.selected.get(tab.id);
    }
    for (let tab of this.props.tabs) {
      selected.set(tab.id, !allChecked);
    }
    selectionCache.clear();
    render();
  }

  async sendEmail() {
    let sendTabs = this.props.tabs.filter(tab => this.props.selected.get(tab.id));
    localStorage.removeItem("loginInterrupt");
    sendTabs = sendTabs.map(tab => tab.id);
    await browser.runtime.sendMessage({
      type: "sendEmail",
      tabIds: sendTabs,
    });
    setTimeout(() => {
      window.close();
    }, 300);
  }

  async copyTabs() {
    // FIXME: implement
  }
}

class Email extends React.Component {
  render() {
    let tabList = this.props.tabs.map(
      tab => <EmailTab key={tab.id} tab={tab} />
    );
    // Note for email HTML we remove <section> tags before inserting
    return <section>{tabList}</section>;
  }
}

class EmailTab extends React.Component {
  render() {
    let tab = this.props.tab;
    let img = null;
    if (tab.screenshot) {
      // Note: the alt attribute is searched by gmail, but the title attribute is NOT searched
      // Note: box-shadow is specifically filtered out by gmail, other styles may get through
      img = <section>
        <div style={{display: "inline-block", boxShadow: "7px 7px 20px #999", border: "1px solid #999"}}>
          <img height={tab.screenshot.height} width={tab.screenshot.width} src={tab.screenshot.url} />
        </div>
        <br />
      </section>;
    }
    return <section>
      <a href={tab.url}>{tab.title}</a> <br />
      { img }
      <br />
    </section>;
  }
}

class LoginError extends React.Component {
  render() {
    return <div id="login-error">
      Last attempt to send an email failed, probably because you weren't logged into your email.
      Please make sure you are logged in, then try again.
    </div>;
  }
}

async function render(firstRun) {
  let tabs = await browser.tabs.query({currentWindow: true});
  if (firstRun) {
    if (!selectionCache.loadSelectedTabs(tabs)) {
      for (let tab of tabs) {
        if (tab.active) {
          selected.set(tab.id, true);
        }
      }
    }
  }
  let showLoginError = parseInt(localStorage.getItem("loginInterrupt") || "0", 10);
  if (Date.now() - showLoginError > LOGIN_ERROR_TIME) {
    showLoginError = 0;
  }
  let page = <Page selected={selected} tabs={tabs} showLoginError={showLoginError} />;
  ReactDOM.render(page, document.getElementById("panel"));
  if (firstRun) {
    activeTabLi.scrollIntoView({
      behavior: "instant",
      block: "center"
    });
  }
}

const selectionCache = {
  timeout: 30*60*1000, // 30 minutes

  key: "selectionCache",

  load() {
    let value = localStorage.getItem(this.key);
    if (!value) {
      return null;
    }
    value = JSON.parse(value);
    if (Date.now() - value.time > this.timeout) {
      localStorage.removeItem(this.key);
      return null;
    }
    return value.cache;
  },

  loadSelectedTabs(tabs) {
    let value = this.load();
    if (!value) {
      return false;
    }
    let anyFound = false;
    for (let tab of tabs) {
      if (value[tab.id] && value[tab.id].url === tab.url) {
        anyFound = true;
        selected.set(tab.id, true);
      }
    }
    return anyFound;
  },

  save(value) {
    localStorage.setItem(this.key, JSON.stringify({
      cache: value,
      time: Date.now()
    }));
  },

  saveSelectedTabs(tabs) {
    let newValue = {};
    for (let tab of tabs) {
      if (selected.get(tab.id)) {
        newValue[tab.id] = {url: tab.url};
      }
    }
    this.save(newValue);
  },

  clear() {
    localStorage.removeItem(this.key);
  }
};

/** Calls render(), then calls it again soon */
function renderWithDelay() {
  render();
  setTimeout(render, 300);
}

for (let eventName of ["onAttached", "onCreated", "onDetached", "onMoved", "onUpdated"]) {
  browser.tabs[eventName].addListener(render);
}

browser.tabs.onRemoved.addListener(renderWithDelay);

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "renderRequest") {
    let emailHtml = ReactDOMServer.renderToStaticMarkup(<Email tabs={message.tabs} />);
    emailHtml = emailHtml.replace(/<\/?section>/gi, " ");
    let lastValue;
    while (lastValue !== emailHtml) {
      lastValue = emailHtml;
      emailHtml = emailHtml.trimRight();
      emailHtml = emailHtml.replace(/<br\s*\/?>$/i, "");
    }
    emailHtml = emailHtml.replace(/(<br\s*\/?>\s*)*/, "");
    return Promise.resolve(emailHtml);
  }
  return null;
});

if (location.hash === "#popup") {
  document.body.classList.add("popup");
}

render(true);
