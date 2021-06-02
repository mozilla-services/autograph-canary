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

async function testAddonInstall(install, shouldPass, expectedResult, messages) {
  try {
    await install.install();
  } catch (_error) {
    if (shouldPass) {
      messages.push("should pass but has thrown");
      return false;
    } else {
      return expectedResult == install.error;
    }
  }

  if (shouldPass) {
    messages.push("Expected to verify; comparing signedState");
    return expectedResult == install.addon.signedState;
  } else {
    messages.push("Not expected to verify");
    return false;
  }
}

// verifyAddonFixtures installs a signed XPI to verify correctly
// signed addons are correctly installed and an unsigned XPI to verify
// Firefox does not install unsigned addons
async function verifyAddonFixtures(messages) {
  // TODO: inline test fixtures and run them
  const signedAddonURL =
    "https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/signed1.xpi";
  const unsignedAddonURL =
    "https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/unsigned.xpi";

  const [signedInstall, unsignedInstall] = await Promise.all([
    AddonManager.getInstallForURL(signedAddonURL),
    AddonManager.getInstallForURL(unsignedAddonURL),
  ]);
  messages.push(
    `getInstallForURL completed for fixtures ${signedAddonURL} ${unsignedAddonURL}`
  );

  const [signedAddonPass, unsignedAddonPass] = await Promise.all([
    testAddonInstall(
      signedInstall,
      true,
      AddonManager.SIGNEDSTATE_SIGNED,
      messages
    ),
    testAddonInstall(
      unsignedInstall,
      false,
      AddonManager.ERROR_SIGNEDSTATE_REQUIRED,
      messages
    ),
  ]);
  if (!unsignedAddonPass) {
    messages.push("unsigned addon test failed");
  }
  if (!signedAddonPass) {
    messages.push("signed addon test failed");
  }
  return [
    unsignedAddonPass && signedAddonPass,
    {
      signed: signedAddonPass,
      unsigned: unsignedAddonPass,
    },
  ];
}

var run_test = async function (args, response_cb) {
  let messages = [];

  await promise_startup();

  const [fixtureVerificationResult, fixtureVerificationDetails] =
    await verifyAddonFixtures(messages);

  try {
    // TODO: add table based tests with an env pref; expecting verification success for a list of URLs
    const testPasses = true;

    return response_cb(testPasses, {
      origin: "run_test",
      messages: messages,
      fixture_verified: fixtureVerificationResult,
      fixture_verified_details: fixtureVerificationDetails,
    });
  } catch (e) {
    return response_cb(false, {
      origin: "run_test",
      messages: messages,
      fixture_verified: fixtureVerificationResult,
      fixture_verified_details: fixtureVerificationDetails,
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
