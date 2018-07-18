/* globals React, ReactDOM, ReactDOMServer, templateMetadata */

let activeTabLi;
let selected = new Map();
let isChoosingTemplate = false;
let selectedTemplate = templateMetadata.defaultTemplateName;
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

class Popup extends React.Component {
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
          <button onClick={this.chooseTemplate.bind(this)}>Change template ({selectedTemplate})</button>
        </div>
      </div>
      <div className="separator"></div>
      <div className="tabList">
        <TabList tabs={this.props.tabs} selected={this.props.selected} />
      </div>

      <footer className="panel-footer toggle-enabled">
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
    window.close();
  }

  async copyTabs() {
    let sendTabs = this.props.tabs.filter(tab => this.props.selected.get(tab.id));
    sendTabs = sendTabs.map(tab => tab.id);
    await browser.runtime.sendMessage({
      type: "copyTabHtml",
      tabIds: sendTabs
    });
    setTimeout(() => {
      window.close();
    }, 300);
  }

  chooseTemplate() {
    isChoosingTemplate = true;
    render();
  }
}

class LoginError extends React.Component {
  render() {
    return <div id="login-error">
      Last attempt to send an email failed, probably because you weren&#39;t logged into your email.
      Please make sure you are logged in, then try again.
    </div>;
  }
}

class TemplateChooser extends React.Component {
  render() {
    let templates = templateMetadata.metadata.map(template => {
      return <TemplateItem key={template.name} selected={template.name === selectedTemplate} {...template} />;
    });
    return <div>
      <ul>
        { templates }
      </ul>
      <footer className="panel-footer toggle-enabled">
        <button onClick={this.onCancel.bind(this)}>
          Cancel
        </button>
      </footer>
    </div>;
  }

  onCancel() {
    isChoosingTemplate = false;
    render();
  }
}

class TemplateItem extends React.Component {
  render() {
    let className = "";
    if (this.props.selected) {
      className += " selected";
    }
    return <li className={className} onClick={this.selectTemplate.bind(this)} role="button">
      {this.props.title}
    </li>;
  }

  selectTemplate() {
    setSelectedTemplate(this.props.name);
    isChoosingTemplate = false;
    render();
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
  let page;
  if (isChoosingTemplate) {
    page = <TemplateChooser />;
  } else {
    page = <Popup selected={selected} tabs={tabs} showLoginError={showLoginError} />;
  }
  ReactDOM.render(page, document.getElementById("panel"));
  if (firstRun) {
    activeTabLi.scrollIntoView({
      behavior: "instant",
      block: "center"
    });
  }
}

const selectionCache = {
  timeout: 30 * 60 * 1000, // 30 minutes

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

async function setSelectedTemplate(name) {
  selectedTemplate = name;
  await browser.runtime.sendMessage({type: "setSelectedTemplate", name});
}

async function init() {
  selectedTemplate = await browser.runtime.sendMessage({type: "getSelectedTemplate"});
  render(true);
}

init();
