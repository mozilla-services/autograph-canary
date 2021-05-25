/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var _Services = ChromeUtils.import(
  "resource://gre/modules/Services.jsm",
  null
).Services;

ChromeUtils.defineModuleGetter(
  this,
  "RemoteSettingsWorker",
  "resource://services-settings/RemoteSettingsWorker.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "ExtensionAddonObserver",
  "resource://gre/modules/Extension.jsm"
);

Cu.importGlobalProperties(["fetch"]);

var { AddonManager } = ChromeUtils.import(
  "resource://gre/modules/AddonManager.jsm",
  null
);

const { Utils } = ChromeUtils.import("resource://services-settings/Utils.jsm");
const { FileUtils } = ChromeUtils.import(
  "resource://gre/modules/FileUtils.jsm"
);

var promise_startup = async function () {
  ExtensionAddonObserver.init();

  let XPIScope = ChromeUtils.import(
    "resource://gre/modules/addons/XPIProvider.jsm",
    null
  );

  XPIScope.XPIInternal.BootstrapScope.prototype._beforeCallBootstrapMethod = (
    method,
    params,
    reason
  ) => {
    try {
      this.emit("bootstrap-method", { method, params, reason });
    } catch (e) {
      try {
        this.testScope.do_throw(e);
      } catch (e) {
        // Le sigh.
      }
    }
  };

  let addonIntegrationService = Cc[
    "@mozilla.org/addons/integration;1"
  ].getService(Ci.nsIObserver);

  addonIntegrationService.observe(null, "addons-startup", null);

  await Promise.all(XPIScope.XPIProvider.startupPromises);

  // Wait for all add-ons to finish starting up before resolving.
  const { XPIProvider } = ChromeUtils.import(
    "resource://gre/modules/addons/XPIProvider.jsm"
  );
  await Promise.all(
    Array.from(
      XPIProvider.activeAddons.values(),
      (addon) => addon.startupPromise
    )
  );
};

var test_addon_install = async function (
  install,
  should_pass,
  expected_result,
  debug_messages
) {
  try {
    await install.install();
  } catch (_error) {
    if (should_pass) {
      debug_messages.push("should pass but has thrown");
      return false;
    } else {
      return expected_result == install.error;
    }
  }

  if (should_pass) {
    debug_messages.push("Expected to verify; comparing signedState");
    return expected_result == install.addon.signedState;
  } else {
    debug_messages.push("Not expected to verify");
    return false;
  }
};

var run_test = async function (args, response_cb) {
  try {
    await promise_startup();

    let debug_messages = [];

    // TODO: MDG - Take the unsigned addon file from the filesystem (relative lambda path).
    debug_messages.push("args are....");

    debug_messages.push(JSON.stringify(args));

    let signed_addon_url = args["env"]["signed_XPI"];
    let signed_install = await AddonManager.getInstallForURL(signed_addon_url);

    let unsigned_addon_url = args["env"]["unsigned_XPI"];
    let unsigned_install = await AddonManager.getInstallForURL(
      unsigned_addon_url
    );

    let unsigned_addon_pass = await test_addon_install(
      unsigned_install,
      false,
      AddonManager.ERROR_SIGNEDSTATE_REQUIRED,
      debug_messages
    );
    if (!unsigned_addon_pass) {
      debug_messages.push("unsigned addon test failed");
    }
    let signed_addon_pass = await test_addon_install(
      signed_install,
      true,
      AddonManager.SIGNEDSTATE_SIGNED,
      debug_messages
    );
    if (!signed_addon_pass) {
      debug_messages.push("signed addon test failed");
    }

    let test_passes = unsigned_addon_pass && signed_addon_pass;

    return response_cb(test_passes, {
      origin: "run_test",
      debug_messages: debug_messages,
    });
  } catch (e) {
    return response_cb(false, {
      origin: "run_test",
      debug_messages: debug_messages,
    });
  }
};

register_command("run_test", run_test);

// set up a command 'get_worker_info' that fetches extended worker info useful
// for diagnosing addon signature verification errors. These will be dumped to
// the output in the event of a failure
register_command(
  "get_worker_info",
  create_extended_info_command({
    preference_keys: [
      "xpinstall.signatures.dev-root",
      "security.signed_app_signatures.policy",
    ],
  })
);

run_loop();
