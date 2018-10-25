this.providerMetadata = (function () {
  let exports = {};

  exports.detectProvider = function () {
    if (location.host.includes("mail.google")) {
      return "gmail";
    } else if (location.host.includes("mail.yahoo")) {
      return "yahoo";
    } else if (location.host.includes("outlook.live")) {
      return "outlook";
    }
    throw new Error("Could not determine provider");
  };

  exports.providers = {
    gmail: {
      composeUrl() {
        return "https://mail.google.com/mail/?view=cm&fs=1&tf=1&source=mailto&to=";
      },
      isLoginPage(url) {
        return url.includes("accounts.google.com") || url.includes("google.com/gmail/about/");
      },
    },
    yahoo: {
      composeUrl(subject) {
        // Updating the subject in the Yahoo Mail interface is seemingly impossible due to some
        // kind of malware detection
        return `http://compose.mail.yahoo.com/?subject=${encodeURIComponent(subject)}`;
      },
      isLoginPage(url) {
        return url.includes("login.yahoo.com");
      },
    },
    outlook: {
      composeUrl() {
        return "https://outlook.live.com/owa/?path=/mail/action/compose&to=";
      },
      isLoginPage(url) {
        return false;
      },
    },
  };

  return exports;
})();
