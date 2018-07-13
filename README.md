# Email Tabs

This is an experimental extension for Firefox that composes a Gmail email with information from a bunch of tabs in it.

Note that only Gmail is supported, because there's no general standard for composing HTML emails.

## Installing

[**Install add-on with this link**](https://testpilot.firefox.com/files/email-tabs@mozilla.org/signed-addon.xpi)

That will install the latest version of the add-on built from the [production branch](https://github.com/mozilla/email-tabs/tree/production).

### Using the add-on

Once you've installed the add-on you'll see an icon in your toolbar: ![icon](https://raw.githubusercontent.com/mozilla/email-tabs/master/addon/emailtabs.svg)

If you click on the icon you'll be able to select one or more of your open tabs. After you've selected tabs, an email composition tab will open up and we'll put in links to each of the pages, along with the page title, and a screenshot. If you have selected some text then that text selection will also be included.

## Developing

To install and test out:

```sh
git clone https://github.com/mozilla/email-tabs.git
cd email-tabs
npm install
npm start
```

You must login to gmail.com before sending an email.

If you are developing, note that the `.jsx` file will not trigger a reload on its own. To enable this reloading, in a separate terminal window run:

```sh
npm run watch
```

### Code layout

The popup UI is in [addon/popup.jsx](./addon/popup.jsx).

The email templates are in [addon/emailTemplates.jsx](./addon/emailTemplates.jsx).

The content script [addon/capture-data.js](./addon/capture-data.js) is loaded into any tabs being sent, and captures the screenshot and some metadata.

The content script [addon/set-html-mail.js](./addon/set-html-email.js) is loaded into the Gmail compose window, and effectively pastes in the HTML.

Overall things are managed with the [addon/background.js](./addon/background.js) script.

### Contact & Contribution

You can email us at [team-email-tabs@mozilla.com](mailto:team-email-tabs@mozilla.com).

IRC is the best way to communicate, via `#testpilot` on irc.mozilla.org (you can use [this link](https://kiwiirc.com/nextclient/irc.mozilla.org/testpilot) for chat access via the web if you do not otherwise use IRC). You might want to ping `ianbicking` or `JSON_voorhees`.

We label some of our bugs with [good first issue](https://github.com/mozilla/email-tabs/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22).
