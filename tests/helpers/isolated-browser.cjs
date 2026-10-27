// Legacy UI checks keep their URLs while all requests are routed in-process.
// No listening port, existing local server, personal notes or external network.
const {chromium: engine} = require('playwright');
const {routeSite} = require('./browser-fixture.cjs');
const chromium = {
  async launch(options) {
    const browser = await engine.launch(options);
    const attached = new WeakSet();
    async function attach(context) {
      if (!attached.has(context)) {
        await routeSite(context);
        attached.add(context);
      }
    }
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async options => {
      const context = await newContext(options);
      await attach(context);
      return context;
    };
    const newPage = browser.newPage.bind(browser);
    browser.newPage = async options => {
      const page = await newPage(options);
      await attach(page.context());
      return page;
    };
    return browser;
  }
};
module.exports = {chromium};
