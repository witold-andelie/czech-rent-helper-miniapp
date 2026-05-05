module.exports = {
  root: true,
  env: {
    es2021: true,
    commonjs: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2021
  },
  globals: {
    App: "readonly",
    Page: "readonly",
    getApp: "readonly",
    getCurrentPages: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    wx: "readonly",
    Behavior: "readonly",
    Component: "readonly"
  },
  rules: {
    "no-console": "off"
  }
};
