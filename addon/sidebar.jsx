/* globals React, ReactDOM */

let searchTerm;
let selected = new Map();

class Tab extends React.Component {
  render() {
    let tab = this.props.tab;
    let checkId = `checkbox-${this.props.tab.id}`;
    let isOkay = tab.url.startsWith("http");
    let checked = this.props.selected.get(tab.id);
    return <li>
      <label htmlFor={checkId}>
        { isOkay ? <input type="checkbox" value={tab.id} checked={checked}
        onChange={this.onChange.bind(this)} id={checkId} ref={checkbox => this.checkbox = checkbox} /> : null }
        <img height="16" width="16" src={tab.favIconUrl} />
        <span>{tab.title}</span>
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
    return <ul>{tabElements}</ul>;
  }
}

class Page extends React.Component {
  render() {
    return <div>
      <div>
        <input type="text" placeholder="Search" value={this.props.searchTerm} onChange={this.onChangeSearch.bind(this)} ref={search => this.search = search} />
        <button onClick={this.onClickCheckAll.bind(this)}>Check all/none</button>
        <button onClick={this.sendEmail.bind(this)}>Send email</button>
      </div>
      <TabList tabs={this.props.tabs} selected={this.props.selected} />
    </div>;
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

  sendEmail() {
    let sendTabs = this.props.tabs.filter(tab => this.props.selected.get(tab.id));
    sendTabs = sendTabs.map(tab => tab.id);
    browser.runtime.sendMessage({
      type: "sendEmail",
      tabIds: sendTabs,
    });
  }
}

class Email extends React.Component {
  render() {
    let tabList = this.props.tabs.map(
      tab => <EmailTab key={tab.id} tab={tab} />
    );
    return <div>{tabList}</div>;
  }
}

class EmailTab extends React.Component {
  render() {
    let tab = this.props.tab;
    return <div>
      <a href={tab.url}>{tab.title}</a> <br />
      <img height={tab.screenshot.height} width={tab.screenshot.width} src={tab.screenshot.url} />
    </div>;
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

async function render() {
  let tabs = await browser.tabs.query({});
  if (searchTerm) {
    tabs = tabs.filter(tab => searchTermMatches(tab, searchTerm));
  }
  let page = <Page selected={selected} searchTerm={searchTerm} tabs={tabs} />;
  ReactDOM.render(page, document.getElementById("container"));
}

for (let eventName of ["onAttached", "onCreated", "onDetached", "onMoved", "onUpdated"]) {
  browser.tabs[eventName].addListener(render);
}

browser.runtime.onMessage.addListener((message) => {
  if (message.type == "renderRequest") {
    let emailHtml = ReactDOMServer.renderToStaticMarkup(<Email tabs={message.tabs} />);
    return Promise.resolve(emailHtml);
  }
});

render();
