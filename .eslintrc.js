module.exports = {
  "env": {
    "es6": true,
    "webextensions": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:mozilla/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 8,
    "sourceType": "module"
  },
  "plugins": [
    "jsx-a11y",
    "mozilla",
    "react"
  ],
  "root": true,
  "rules": {
    "eqeqeq": "error",
    "no-console": "warn",
    "space-before-function-paren": "off",
    "no-console": ["error", {"allow": ["error", "info", "trace", "warn"]}],
    "react/prop-types": "off",
    // The label-has-for error isn't working for us: we have htmlFor=... on elements, but the error
    // is still being emitted. The other rule wants all controls to be INSIDE labels, not alongside
    // them, but we aren't currently doing that.
    "jsx-a11y/label-has-associated-control": "off",
    "jsx-a11y/label-has-for": "off",
  },
  "settings": {
    "react": {
      "version": "16"
    }
  }
};
