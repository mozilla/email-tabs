# Email Tabs

This is an experimental extension for Firefox that composes a Gmail email with information from a bunch of tabs in it.

Note that only Gmail is supported, because there's no general standard for composing HTML emails.

## Install

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

## Code layout

The popup UI is in [addon/popup.jsx](./addon/popup.jsx). The email template is *also* located in that file in the `Email` class.

The content script [addon/capture-data.js](./addon/capture-data.js) is loaded into any tabs being sent, and captures the screenshot and some metadata.

The content script [addon/set-html-mail.js](./addon/set-html-email.js) is loaded into the Gmail compose window, and effectively pastes in the HTML.
