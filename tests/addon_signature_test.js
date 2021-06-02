/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// addon_signature_test.js installs XPIs
//
// Example args and result (as the autograph.py xpcshell sees):
//
// {"env": "prod", "xpi_urls": "https://addons.mozilla.org/firefox/downloads/file/3772109/facebook_container-2.2.1-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3713375/firefox_multi_account_containers-7.3.0-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3768975/ublock_origin-1.35.2-an+fx.xpi"}
// =>
// {"id":2,"worker_id":456387343069546500,"original_cmd":{"id":2,"mode":"run_test","args":{"xpi_urls":"https://addons.mozilla.org/firefox/downloads/file/3772109/facebook_container-2.2.1-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3713375/firefox_multi_account_containers-7.3.0-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3768975/ublock_origin-1.35.2-an+fx.xpi","env":"prod"}},"success":true,"result":{"origin":"run_test","result_details":[{"result":true,"url":"https://addons.mozilla.org/firefox/downloads/file/3772109/facebook_container-2.2.1-fx.xpi"},{"result":true,"url":"https://addons.mozilla.org/firefox/downloads/file/3713375/firefox_multi_account_containers-7.3.0-fx.xpi"},{"result":true,"url":"https://addons.mozilla.org/firefox/downloads/file/3768975/ublock_origin-1.35.2-an+fx.xpi"}],"messages":["promiseStartup completed","getInstallForURL completed for fixtures https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/signed1.xpi https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/unsigned.xpi","Expected to verify; comparing signedState","verified fixtures true with details: {\"signed\":true,\"unsigned\":true}","testing 3 XPIs","getInstallForURL completed for 3 addons","Expected to verify; comparing signedState","Expected to verify; comparing signedState","Expected to verify; comparing signedState","verified installs for 3 of 3 provided addons"],"fixture_verified":true,"fixture_verified_details":{"signed":true,"unsigned":true}},"command_time":1622657937581,"response_time":1622657944842}

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

// promiseStartup initializes the addon service and managers and waits
// for addons to finish starting
//
// copied from https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/internal/AddonTestUtils.jsm#896
//
async function promiseStartup() {
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
}

// switchEnvironment sets preferences to switch from one environment to another.
//
// prod or stage
//
async function switchEnvironment(env) {
  if (env.includes("prod")) {
    Services.prefs.setBoolPref("xpinstall.signatures.dev-root", false);
  } else if (env.includes("stage")) {
    Services.prefs.setBoolPref("xpinstall.signatures.dev-root", true);
  } else {
    throw `Unrecognized addons environment: ${env}`;
  }
}

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

  await promiseStartup();
  messages.push("promiseStartup completed");

  const [fixtureVerificationResult, fixtureVerificationDetails] =
    await verifyAddonFixtures(messages);
  messages.push(
    `verified fixtures ${fixtureVerificationResult} with details: ${JSON.stringify(
      fixtureVerificationDetails
    )}`
  );

  await switchEnvironment(args["env"]);
  const xpiURLs = args["xpi_urls"].split(",");
  messages.push(`testing ${xpiURLs.length} XPIs`);

  const installs = await Promise.all(
    xpiURLs.map((xpiURL) => AddonManager.getInstallForURL(xpiURL))
  );
  messages.push(`getInstallForURL completed for ${xpiURLs.length} addons`);

  const verificationResults = await Promise.all(
    installs.map((install) =>
      testAddonInstall(install, true, AddonManager.SIGNEDSTATE_SIGNED, messages)
    )
  );
  messages.push(
    `verified installs for ${verificationResults.length} of ${xpiURLs.length} provided addons`
  );
  const verificationResultsWithXPIURL = Array.from(
    verificationResults,
    (result, i) => {
      return { result: result, url: xpiURLs[i] };
    }
  );

  let allVerified = true;
  for (const result of verificationResults) {
    if (result !== true) {
      allVerified = false;
      break;
    }
  }

  return response_cb(allVerified, {
    origin: "run_test",
    result_details: verificationResultsWithXPIURL,
    messages: messages,
    fixture_verified: fixtureVerificationResult,
    fixture_verified_details: fixtureVerificationDetails,
  });
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
