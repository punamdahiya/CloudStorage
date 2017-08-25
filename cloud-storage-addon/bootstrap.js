const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Console",
  "resource://gre/modules/Console.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "CloudStorageView",
  "chrome://cloud/content/CloudStorageView.jsm");

var WindowListener = {
  setupBrowserUI: function wm_setupBrowserUI(window) {
    let utils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    utils.loadSheetUsingURIString("chrome://cloud/content/binding.css", Ci.nsIDOMWindowUtils.AGENT_SHEET);
  },

  tearDownBrowserUI: function wm_tearDownBrowserUI(window) {
    let utils = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
    utils.removeSheetUsingURIString("chrome://cloud/content/binding.css", Ci.nsIDOMWindowUtils.AGENT_SHEET);
  },

  // nsIWindowMediatorListener functions
  onOpenWindow: function wm_onOpenWindow(xulWindow) {
    // A new window has opened
    let domWindow = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                             .getInterface(Ci.nsIDOMWindow);

    // Wait for it to finish loading
    domWindow.addEventListener("load", function listener() {
      // If this is a browser window or places library window then setup its UI
      if (domWindow.document.documentElement.getAttribute("windowtype") == "navigator:browser" ||
          domWindow.document.documentElement.getAttribute("windowtype") == "Places:Organizer" ) {
        WindowListener.setupBrowserUI(domWindow);
      }
    }, {once: true});
  },
};

function install() {}
function uninstall() {}

function startup() {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
           getService(Ci.nsIWindowMediator);

  // Get the list of browser windows already open
  let windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    WindowListener.setupBrowserUI(domWindow);
  }

  // Wait for any new browser windows to open
  Services.wm.addListener(WindowListener);

  Services.obs.addObserver(observe, "cloudstorage-prompt-notification");
  CloudStorageView.init();
}

function shutdown() {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
           getService(Ci.nsIWindowMediator);

  // Get the list of browser windows already open
  let windows = wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);

    WindowListener.tearDownBrowserUI(domWindow);
  }
  // Stop listening for any new browser windows to open
  wm.removeListener(WindowListener);
  Services.obs.removeObserver(this, "cloudstorage-prompt-notification");
}

function observe(subject, topic, data) {
  switch (topic) {
    case "cloudstorage-prompt-notification":
      console.log("notification receivced:", data);
      CloudStorageView.handlePromptNotification(data);
      break;
  }
}
