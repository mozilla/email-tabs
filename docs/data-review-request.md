# Request for data collection review form

**1) What questions will you answer with this data?**

* Do people make use of Email Tabs?
* Do the entry points into Email Tabs make sense?
* What kinds of emails do people prefer?
* Do people successfully complete the sending of an email?
* Do people use this to send themselves emails, or send to other people?

**2) Why does Mozilla need to answer these questions?  Are there benefits for users? Do we need this information to address product or business requirements?**

Email Tabs is an experimental/provisional features, so we need to know if it provides value to people, and further information to see if it needs more/less features or a different workflow.

**3) What alternative methods did you consider to answer these questions? Why were they not sufficient?**

We have a lot of qualitative data pointing to the importance of email, and we'll be doing small-scale user testing of the tool. But we want to see if it captures organic interest, and if it is useful in day-to-day work.

**4) Can current instrumentation answer these questions?**

No.

**5) List all proposed measurements and indicate the category of data collection for each measurement, using the Firefox [data collection categories](https://wiki.mozilla.org/Firefox/Data_Collection) on the Mozilla wiki.**

All data is listed in the Metrics document:

https://github.com/mozilla/email-tabs/blob/master/docs/metrics.md

The data falls under Category 2 (interaction data)

**6) How long will this data be collected?**

This data will be collected for the extent of the Test Pilot experiment (probably in the 6 month range, though there is no hard end-date).

**7) What populations will you measure?**

Test Pilot users who opt in to the experiment.

**Any other filters?  Please describe in detail below.**

This uses the TestPilotGA library: https://github.com/mozilla/testpilot-ga

This library uses the Do Not Track flag to disable data submission.

**8) If this data collection is default on, what is the opt-out mechanism for users?**

Do Not Track opts out.

**9) Please provide a general description of how you will analyze this data.**

Using the Google Analytics interactive tools.

**10) Where do you intend to share the results of your analysis?**

In the Test Pilot graduation report.
