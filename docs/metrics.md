# Email Tabs Metrics

Metrics collections and analysis plan for Email Tabs as part of the [Firefox Test Pilot program](https://testpilot.firefox.com).

## Analysis

Data collected in this experiment will be used to answer the following high-level questions:

* How often do users email tabs to others?
* How often do users email tabs to themselves?
* Are people who use Email Tabs heavy tab users?



## Collection
Data will be collected with Google Analytics and follow [Test Pilot standards](https://github.com/mozilla/testpilot/blob/master/docs/experiments/ga.md) for reporting.

## Custom Metrics
*none*

### Custom Dimensions

* `cd1` - The number of open tabs across all windows.  An integer
* `cd2` - The number of tabs selected to send.  An integer
* `cd3` - If the user is sending the current tab ("true" or "false")
* `cd4` - The name of the template used
* `cd5` - Count of email recipients
* `cd6` - Is user sending all tabs? ("true" or "false")
* `cd7` - The mail provider ("gmail", "yahoo" or "outlook")

### Events

#### Startup / errors

##### When add-on starts up (browser restart or new installation)

Called each time the add-on starts up

```
ec: startup,
ea: startup,
ni: true
```

Note `ni` (not-interactive) will keep these events from being grouped under user activity.

#### `Interface`

##### When the user opens the panel using the browserAction button

```
ec: interface,
ea: expand-panel,
el: browser-action,
cd1,
cd7
```

##### When the user is shown the forced mail preference screen

```
ec: interface,
ea: provider-preference,
el: first-time,
cd1
```

###### When the user is shown the mail preference due to selecting settings

```
ec: interface,
ea: provider-preference,
el: settings,
cd1,
cd7: previous provider
```

###### When the user selects a mail preference

```
ec: interface,
ea: provider-select,
el: gmail, yahoo, or outlook
cd1,
cd7: previous provider (or null)
```

###### When the user asks to "learn more" about mail preference

```
ec: interface,
ea: provider-learn-more
cd1,
cd7: previous provider (or null)
```

###### When the user cancels mail preference change

```
ec: interface,
ea: provider-cancel
cd1,
cd7: previous provider
```

##### When the user clicks select all

```
ec: interface,
ea: select-all,
el: browser-action,
cd1,
cd7
```

##### When the user clicks the feedback button
```
ec: interface,
ea: button-click,
el: feedback,
cd1,
cd2,
cd3,
cd7
```

##### When the user Clicks the Copy Tabs to Clipboard button
```
ec: interface,
ea: button-click,
el: copy-tabs-to-clipboard,
cd1,
cd2,
cd3,
cd7
```

##### When the user Clicks the Email Tabs button
```
ec: interface,
ea: button-click,
el: email-tabs,
cd1,
cd2,
cd3,
cd6,
cd7
```

###### When the user uses the context menu to email tabs

```
ec: interface
ea: context-menu,
el: email-tabs,
cd1,
cd2,
cd3,
cd6,
cd7
```

####### If the context menu failed because no mail provider was selected

```
ec: interface,
ea: context-menu-failed-pref,
ni: true
```

###### When the user is not logged in, or encounters a compose window error
`el` will be `account` if we believe the user encountered a login form, or `error` if there's some other problem encountered.

```
ec: interface
ea: compose-window-error
el: account or error,
cd1,
cd2,
cd3,
cd6,
cd7
```

###### When the user chooses the template
Note `cd4` here is the template chosen

```
ec: interface
ea: button-click
el: choose-template,
cd1,
cd2,
cd3,
cd4,
cd6,
cd7
```

###### When `capture-data.js` encounters a non-fatal error
Sometimes the capturing can fail, though we will still attempt to compose the email with incomplete information. We will attempt to get the schema (e.g., http, https, file, about) of the failing tab.

```
ec: interface
ea: collect-info-error
el: tab-url-scheme
cd1,
cd2,
cd3,
cd4,
cd6,
cd7
```

##### When the compose window is finished uploading images
```
ec: interface,
ea: compose-pasted,
cd1,
cd2,
cd3,
cd4,
cd6,
cd7,
ni: true
```

##### If auto-pasting fails
This only applies to some providers (currently Yahoo), we use `document.execCommand("paste")`, which is not always reliable:

```
ec: interface
ea: paste-failed,
cd1,
cd2,
cd3,
cd4,
cd6,
cd7,
ni: true
```

##### When the email is sent
`el` will be `send-to-self` if the user sent the email back to themselves, and `send-to-other` if not.

```
ec: interface,
ea: compose-sent,
el: send-to-self or send-to-other
cd1,
cd2,
cd3,
cd4,
cd5,
cd6,
cd7
```

##### The user cancels or closes the email before sending it

```
ec: interface,
ea: compose-cancelled
cd1,
cd2,
cd3,
cd4,
cd5,
cd6,
cd7
```

##### The user cancels the email at template chooser screen

```
ec: interface,
ea: template-cancelled
cd1,
cd2,
cd3,
cd6,
cd7
```

##### After email sent, "done" chosen
```
ec: interface,
ea: button-click,
el: compose-done-close,
cd1,
cd2,
cd3,
cd4,
cd6,
cd7
```

##### After email sent, "Close n tabs" chosen
```
ec: interface,
ea: button-click,
el: compose-done-close-all,
cd1,
cd2,
cd3,
cd4,
cd6,
cd7
```
