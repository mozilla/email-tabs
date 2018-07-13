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
* `cd3` - Is the user sending tabs to themselves.  Boolean

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

##### When the Email Tabs experiment succeeds in loading

Called at startup when the experiment loads

```
ec: startup
ea: loaded
ni: true
cd1
```

##### When the Email Tabs experiment fails to load

When the experiment fails to load. The experiment may fail to be present (some loading error), or may have an exception while running

```
ec: startup
ea: failed
el: not-present or exception
ni: true
cd1
```

##### When a user tries to add a disabled tab to the email list(about: or file urls)

```
ec: interface
ea: disabled-tab-type
el: bookmark or link
cd1,
cd2
```

#### `Interface`

##### When the user opens the panel using the pageAction button

```
ec: interface,
ea: expand panel,
el: page-action,
cd1
```

##### When the user clicks the feedback button
```
ec: interface,
ea: button-click,
el: feedback,
cd1,
cd2
```

##### When the user Clicks the Copy Tabs to Clipboard button
```
ec: interface,
ea: button-click,
el: copy-tabs-to-clipboard,
cd1,
cd2
```

##### When the user Email Tabs button
```
ec: interface,
ea: button-click,
el: email-tabs,
cd1,
cd2
```

##### When the compose window is finished uploading images
```
ec: interface,
ea: button-click,
el: email-tabs,
cd1,
cd2,
cd3
```

##### When the send button is pressed in the compose window
```
ec: interface,
ea: button-click,
el: email-tabs,
cd1,
cd2,
cd3
```

##### After email sent, "done" chosen
```
ec: interface,
ea: button-click,
el: email-tabs,
cd1,
cd2
```

##### After email sent, "Close n tabs" chosen
```
ec: interface,
ea: button-click,
el: email-tabs,
cd1,
cd2
```
