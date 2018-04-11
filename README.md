# Email Tabs

This is an experimental extension for Firefox that composes a Gmail email with information from a bunch of tabs in it.

Note that only Gmail is supported, because there's no general standard for composing HTML emails.

## Install

To install and test out:

```sh
$ git clone https://github.com/ianb/email-tabs.git
$ cd email-tabs
$ npm install
$ npm start
```

You must login to gmail.com before sending an email.

If you are developing, note that the `.jsx` file will not trigger a reload on its own. To enable this reloading, in a separate terminal window run:

```sh
$ npm run watch
```
