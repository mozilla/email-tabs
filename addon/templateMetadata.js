this.templateMetadata = (function() {
  let exports = {};

  exports.metadata = [
    {
      name: "title_screenshot",
      title: "With screenshots",
      wantsScreenshots: true,
      wantsReadability: false,
      componentName: "TitleScreenshot",
    },
    {
      name: "just_links",
      title: "Just the links",
      wantsScreenshots: false,
      wantsReadability: false,
      componentName: "JustLinks",
    },
    {
      name: "readability",
      title: "Full articles",
      wantsScreenshots: false,
      wantsReadability: true,
      componentName: "FullArticles",
    }
  ];

  for (let name in this.templateMetadata) {
    this.templateMetadata[name].name = name;
  }

  exports.defaultTemplateName = "title_screenshot";

  exports.getTemplate = function(name) {
    for (let template of exports.metadata) {
      if (template.name === name) {
        return template;
      }
    }
    throw new Error("No template found");
  };

  return exports;
})();
