/* globals React, ReactDOM */

let searchTerm;
let activeTabLi;
let selected = new Map();

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
    render();
  }
}

class TabList extends React.Component {
  render() {
    let tabElements = this.props.tabs.map(
      tab => <Tab tab={tab} key={tab.id} selected={this.props.selected} />
    );
    return <div className="tabs-wrapper">
      <section className="tabs-section" style={{display: "flex"}}>
        <h2 className="tabs-section__title">Tabs</h2>
        <ul className="tabs-section__list" role="navigation">{tabElements}</ul>
      </section>
    </div>;
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
      <div className="controls">
        <div>
          <input type="text" id="search" placeholder="Search" value={this.props.searchTerm} onChange={this.onChangeSearch.bind(this)} ref={search => this.search = search} />
        </div>
        <div>
          <label htmlFor="allCheckbox">
            <input checked={allChecked} ref={allCheckbox => this.allCheckbox = allCheckbox} type="checkbox" id="allCheckbox" onChange={this.onClickCheckAll.bind(this)} />
            All
          </label>
          <button onClick={this.sendEmail.bind(this)}>✉ Send email</button>
        </div>
      </div>
      <div className="tabList">
        <TabList tabs={this.props.tabs} selected={this.props.selected} />
      </div>
    </div>;
  }

  componentDidMount() {
    this.allCheckbox.indeterminate = this.indeterminate;
  }

  componentDidUpdate() {
    this.componentDidMount();
  }

  onChangeSearch() {
    searchTerm = this.search.value;
    render();
  }

  onClickCheckAll() {
    let allChecked = true;
    for (let tab of this.props.tabs) {
      allChecked = allChecked && this.props.selected.get(tab.id);
    }
    for (let tab of this.props.tabs) {
      selected.set(tab.id, !allChecked);
    }
    render();
  }

  async sendEmail() {
    let sendTabs = this.props.tabs.filter(tab => this.props.selected.get(tab.id));
    sendTabs = sendTabs.map(tab => tab.id);
    await browser.runtime.sendMessage({
      type: "sendEmail",
      tabIds: sendTabs,
    });
    setTimeout(() => {
      window.close();
    }, 300);
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
      img = <section>
        <div style={{display: "inline-block", boxShadow: "7px 7px 20px #999"}}>
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

function searchTermMatches(tab, searchTerm) {
  let caseInsensitive = searchTerm.toLowerCase() === searchTerm;
  let match;
  if (caseInsensitive) {
    match = (a) => a.toLowerCase().includes(searchTerm);
  } else {
    match = (a) => a.includes(searchTerm);
  }
  return match(tab.title) || match(tab.url);
}

async function render(firstRun) {
  let tabs = await browser.tabs.query({currentWindow: true});
  if (firstRun) {
    for (let tab of tabs) {
      if (tab.active) {
        selected.set(tab.id, true);
      }
    }
  }
  if (searchTerm) {
    tabs = tabs.filter(tab => searchTermMatches(tab, searchTerm));
  }
  let page = <Page selected={selected} searchTerm={searchTerm} tabs={tabs} />;
  ReactDOM.render(page, document.getElementById("panel"));
  if (firstRun) {
    activeTabLi.scrollIntoView({
      behavior: "instant",
      block: "center"
    });
  }
}

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
  if (message.type == "renderRequest") {
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
});

if (location.hash === "#popup") {
  document.body.classList.add("popup");
}

render(true);
