/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.importGlobalProperties(["fetch"]);

XPCOMUtils.defineLazyModuleGetters(this, {
  CanonicalJSON: "resource://gre/modules/CanonicalJSON.jsm",
  RemoteSettings: "resource://services-settings/remote-settings.js",
  RemoteSettingsWorker: "resource://services-settings/RemoteSettingsWorker.jsm",
  Services: "resource://gre/modules/Services.jsm",
  Utils: "resource://services-settings/Utils.jsm",
});

const verifier = Cc[
  "@mozilla.org/security/contentsignatureverifier;1"
].createInstance(Ci.nsIContentSignatureVerifier);

const SERVER_LOCAL = "http://localhost:8888/v1";
const SERVER_PROD = "https://firefox.settings.services.mozilla.com/v1";
const SERVER_STAGE = "https://settings.stage.mozaws.net/v1";
const HASH_PROD =
  "97:E8:BA:9C:F1:2F:B3:DE:53:CC:42:A4:E6:57:7E:D6:4D:F4:93:C2:47:B4:14:FE:A0:36:81:8D:38:23:56:0E";
const HASH_STAGE =
  "3C:01:44:6A:BE:90:36:CE:A9:A0:9A:CA:A3:A5:20:AC:62:8F:20:A7:AE:32:CE:86:1C:B2:EF:B7:0F:A0:C7:45";
const HASH_LOCAL =
  "5E:36:F2:14:DE:82:3F:8B:29:96:89:23:5F:03:41:AC:AF:A0:75:AF:82:CB:4C:D4:30:7C:3D:B3:43:39:2A:FE";

const MEGAPHONE_STAGE = "https://autopush.stage.mozaws.net";

/**
 * switchEnvironment() will set the necessary internal preferences to switch from
 * an environment to another.
 */
async function switchEnvironment(env) {
  if (env.includes("prod")) {
    Services.prefs.setCharPref("services.settings.server", SERVER_PROD);
    Services.prefs.setCharPref(
      "security.content.signature.root_hash",
      HASH_PROD
    );
    Services.prefs.clearUserPref("dom.push.serverURL");
    Services.prefs.clearUserPref("services.settings.load_dump");
  } else if (env.includes("stage")) {
    Services.prefs.setCharPref("services.settings.server", SERVER_STAGE);
    Services.prefs.setCharPref(
      "security.content.signature.root_hash",
      HASH_STAGE
    );
    Services.prefs.setCharPref("dom.push.serverURL", MEGAPHONE_STAGE);
    // We don't want to load dumps for stage since the datasets don't always overlap.
    Services.prefs.setBoolPref("services.settings.load_dump", false);
  } else if (env.includes("local")) {
    Services.prefs.setCharPref("services.settings.server", SERVER_LOCAL);
    Services.prefs.setCharPref(
      "security.content.signature.root_hash",
      HASH_LOCAL
    );
    Services.prefs.clearUserPref("dom.push.serverURL");
    Services.prefs.setBoolPref("services.settings.load_dump", false);
  }

  if (env.includes("-preview")) {
    Services.prefs.setCharPref(
      "services.settings.default_bucket",
      "main-preview"
    );
    Services.prefs.setCharPref(
      "services.blocklist.bucket",
      "blocklists-preview"
    );
    Services.prefs.setCharPref(
      "services.blocklist.pinning.bucket",
      "pinning-preview"
    );
  } else {
    Services.prefs.setCharPref("services.settings.default_bucket", "main");
    Services.prefs.setCharPref("services.blocklist.bucket", "blocklists");
    Services.prefs.setCharPref("services.blocklist.pinning.bucket", "pinning");
  }
}

async function verifyContentSignatureFixture() {
  // from https://searchfox.org/mozilla-central/source/services/settings/test/unit/test_remote_settings_signatures
  const chainFilenamesToContent = new Map([
    [
      "collection_signing_ee.pem",
      `-----BEGIN CERTIFICATE-----
MIICdTCCAV2gAwIBAgIULWXqMXrDQ3IYzpWJIseQRInl9zEwDQYJKoZIhvcNAQEL
BQAwIzEhMB8GA1UEAwwYY29sbGVjdGlvbi1zaWduZXItaW50LUNBMCIYDzIwMTkx
MTI4MDAwMDAwWhgPMjAyMjAyMDUwMDAwMDBaMCYxJDAiBgNVBAMMG2NvbGxlY3Rp
b24tc2lnbmVyLWVlLWludC1DQTB2MBAGByqGSM49AgEGBSuBBAAiA2IABKFockM2
K1x7GInzeRVGFaHHP7SN7oY+AikV22COJS3ktxMtqM6Y6DFTTmqcDAsJyNY5regy
BuW6gTRzoR+jMOBdqMluQ4P+J4c9qXEDviiIz/AC8Fr3Gh/dzIN0qm6pzqNIMEYw
EwYDVR0lBAwwCgYIKwYBBQUHAwMwLwYDVR0RBCgwJoIkb25lY3JsLmNvbnRlbnQt
c2lnbmF0dXJlLm1vemlsbGEub3JnMA0GCSqGSIb3DQEBCwUAA4IBAQBrU5DuGjBv
Dj2seQLI1jDxDB8oS4oPU1sbHp5OCfisPYl2JMKo5Cy1nPC/8t/W3BDC0wI7ug7J
5OyZGIy5I2dgN3zIShql7X2bLLw/SSZGY0jIWa+GFOE5YmkWtM8uFB8FVtpOtYeF
+zXIyeWyPv/JL9A9/c8EfzzYMc/2NCQV+J0QsXOcWvsV794dG0Poq0N3W35ai/jd
itmWERTlPS4ivZliIcSUyR57lfRIFZP9KjcJSuKfYIuntG7YPtsqioLRKQjyricj
p85QFZ+8z2XOQxd1Nt5DoBBO3gx9TsVDErbTxPMRkWxzHiIbVQxDj+frB+ChpQVk
zufihT+yBVxE
-----END CERTIFICATE-----`,
    ],
    [
      "collection_signing_int.pem",
      `-----BEGIN CERTIFICATE-----
MIIC+TCCAeGgAwIBAgIUP+jlP5+sjznUojGrupiX+yQReYswDQYJKoZIhvcNAQEL
BQAwHzEdMBsGA1UEAwwUY29sbGVjdGlvbi1zaWduZXItY2EwIhgPMjAxOTExMjgw
MDAwMDBaGA8yMDIyMDIwNTAwMDAwMFowIzEhMB8GA1UEAwwYY29sbGVjdGlvbi1z
aWduZXItaW50LUNBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuohR
qESOFtZB/W62iAY2ED08E9nq5DVKtOz1aFdsJHvBxyWo4NgfvbGcBptuGobya+Kv
WnVramRxCHqlWqdFh/cc1SScAn7NQ/weadA4ICmTqyDDSeTbuUzCa2wO7RWCD/F+
rWkasdMCOosqQe6ncOAPDY39ZgsrsCSSpH25iGF5kLFXkD3SO8XguEgfqDfTiEPv
JxbYVbdmWqp+ApAvOnsQgAYkzBxsl62WYVu34pYSwHUxowyR3bTK9/ytHSXTCe+5
Fw6naOGzey8ib2njtIqVYR3uJtYlnauRCE42yxwkBCy/Fosv5fGPmRcxuLP+SSP6
clHEMdUDrNoYCjXtjQIDAQABoyUwIzAMBgNVHRMEBTADAQH/MBMGA1UdJQQMMAoG
CCsGAQUFBwMDMA0GCSqGSIb3DQEBCwUAA4IBAQCWEYQGVaiI5LNAAPOAPy5hYdfz
i6mLMxjr/sPpOq1+W79KfxJBnZQv0K2fhyP2Sp78wBpgkZ6NOR/7f7XwWXkhFb+N
u7f9Wmb9Ogbiy4rzlHaOitduzj/O0ohUZa+9v4q7LUJC/2xMlVXS2AxEZWdvh1NX
zC9QujqgmhU5aTODJq2M87f3qHq7NJ1CGKeIx7dpEJ8mSeiboY3dXxK9iFBj0OuG
YCh4ZW/IUwIB6QW6S0oPugCMvJJ0f3qr/npAHF7VzkPi1Pde4zxMVVBL9PNGV3WT
x6/jV3zfMYu+OhU6shUJS4I4mA+EIT4Lr6JCO6QfcHjzYrgCvcwZmW5/j9l4
-----END CERTIFICATE-----`,
    ],
    [
      "collection_signing_root.pem",
      `-----BEGIN CERTIFICATE-----
MIIC9TCCAd2gAwIBAgIUV6J20TV5oEm+lv4oelnu2EJ+9bMwDQYJKoZIhvcNAQEL
BQAwHzEdMBsGA1UEAwwUY29sbGVjdGlvbi1zaWduZXItY2EwIhgPMjAxOTExMjgw
MDAwMDBaGA8yMDIyMDIwNTAwMDAwMFowHzEdMBsGA1UEAwwUY29sbGVjdGlvbi1z
aWduZXItY2EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC6iFGoRI4W
1kH9braIBjYQPTwT2erkNUq07PVoV2wke8HHJajg2B+9sZwGm24ahvJr4q9adWtq
ZHEIeqVap0WH9xzVJJwCfs1D/B5p0DggKZOrIMNJ5Nu5TMJrbA7tFYIP8X6taRqx
0wI6iypB7qdw4A8Njf1mCyuwJJKkfbmIYXmQsVeQPdI7xeC4SB+oN9OIQ+8nFthV
t2Zaqn4CkC86exCABiTMHGyXrZZhW7filhLAdTGjDJHdtMr3/K0dJdMJ77kXDqdo
4bN7LyJvaeO0ipVhHe4m1iWdq5EITjbLHCQELL8Wiy/l8Y+ZFzG4s/5JI/pyUcQx
1QOs2hgKNe2NAgMBAAGjJTAjMAwGA1UdEwQFMAMBAf8wEwYDVR0lBAwwCgYIKwYB
BQUHAwMwDQYJKoZIhvcNAQELBQADggEBAEgx0mT791EuD+v0QBALSNrHo+dWUpuI
w1FalKVxsdDxM6V6O1NEcGTKndBDaBex3lwmH4aT/rYWwNr/Xyy7Koqal83JA9WG
J9ofyHK+0tuL+zrAojHEg9JIUwWwi5Jbc+ewVwvD61BKU7ixcjcGxEfwF1Q1lILd
iJoGZd50P6/bEN9QQeGQV0y+mkn82GPgpvfu/uNhYRmCCs+qm1OuRWrXaCuO+epN
IuUXbInCSB03y3XUK8JnB1igVH0Sx9r9P+7tylQDsy4udq3tghuneI+GJnLxtfUH
d6p55v4o5khhgaH1sI/bqYXj0Dl4EWdsvoGzjuxaJ11RnNn38vKPmlE=
-----END CERTIFICATE-----`,
    ],
  ]);

  const PREF_SETTINGS_SERVER = "services.settings.server";
  const PREF_SIGNATURE_ROOT = "security.content.signature.root_hash";
  const SIGNER_NAME = "onecrl.content-signature.mozilla.org";

  const CERT_DIR = "test_remote_settings_signatures/";
  const CHAIN_FILES = [
    "collection_signing_ee.pem",
    "collection_signing_int.pem",
    "collection_signing_root.pem",
  ];

  const collectionData =
    '[{"details":{"bug":"https://bugzilla.mozilla.org/show_bug.cgi?id=1155145","created":"2016-01-18T14:43:37Z","name":"GlobalSign certs","who":".","why":"."},"enabled":true,"id":"97fbf7c4-3ef2-f54f-0029-1ba6540c63ea","issuerName":"MHExKDAmBgNVBAMTH0dsb2JhbFNpZ24gUm9vdFNpZ24gUGFydG5lcnMgQ0ExHTAbBgNVBAsTFFJvb3RTaWduIFBhcnRuZXJzIENBMRkwFwYDVQQKExBHbG9iYWxTaWduIG52LXNhMQswCQYDVQQGEwJCRQ==","last_modified":2000,"serialNumber":"BAAAAAABA/A35EU="},{"details":{"bug":"https://bugzilla.mozilla.org/show_bug.cgi?id=1155145","created":"2016-01-18T14:48:11Z","name":"GlobalSign certs","who":".","why":"."},"enabled":true,"id":"e3bd531e-1ee4-7407-27ce-6fdc9cecbbdc","issuerName":"MIGBMQswCQYDVQQGEwJCRTEZMBcGA1UEChMQR2xvYmFsU2lnbiBudi1zYTElMCMGA1UECxMcUHJpbWFyeSBPYmplY3QgUHVibGlzaGluZyBDQTEwMC4GA1UEAxMnR2xvYmFsU2lnbiBQcmltYXJ5IE9iamVjdCBQdWJsaXNoaW5nIENB","last_modified":3000,"serialNumber":"BAAAAAABI54PryQ="}]';
  const collectionSignature =
    "p384ecdsa=f4pA2tYM5jQgWY6YUmhUwQiBLj6QO5sHLD_5MqLePz95qv-7cNCuQoZnPQwxoptDtW8hcWH3kLb0quR7SB-r82gkpR9POVofsnWJRA-ETb0BcIz6VvI3pDT49ZLlNg3p";

  function do_get_file(filename) {
    return chainFilenamesToContent.get(filename);
  }

  function setRoot() {
    const filename = CHAIN_FILES[0];

    const certFile = do_get_file(filename, false);

    const b64cert = certFile
      .replace(/-----BEGIN CERTIFICATE-----/, "")
      .replace(/-----END CERTIFICATE-----/, "")
      .replace(/[\r\n]/g, "");
    const certdb = Cc["@mozilla.org/security/x509certdb;1"].getService(
      Ci.nsIX509CertDB
    );
    const cert = certdb.constructX509FromBase64(b64cert);
    print("setting pref ${PREF_SIGNATURE_ROOT} to ${cert.sha256Fingerprint}");
    Services.prefs.setCharPref(PREF_SIGNATURE_ROOT, cert.sha256Fingerprint);
  }

  function getCertChain() {
    const chain = [];
    for (let file of CHAIN_FILES) {
      chain.push(do_get_file(file));
    }
    return chain.join("\n");
  }

  // set the content signing root to our test root
  setRoot();

  return await verifier.asyncVerifyContentSignature(
    collectionData,
    collectionSignature,
    getCertChain(),
    SIGNER_NAME
  );
}

class Telemetry {
  // What was the result of the content signature verification?
  static VERIFICATION_HISTOGRAM = Services.telemetry.getHistogramById(
    "CONTENT_SIGNATURE_VERIFICATION_STATUS"
  );

  // Result of the content signature verification keyed by application (certificate fingerprint)
  static ERROR_HISTOGRAM = Services.telemetry.getKeyedHistogramById(
    "CONTENT_SIGNATURE_VERIFICATION_ERRORS"
  );

  // map of telemetry codes to descriptions from
  // https://searchfox.org/mozilla-central/rev/08f063f4c89d270fd809fc0325b5a9000ae87d63/toolkit/components/telemetry/Histograms.json#11868-11888
  //
  // currently both histograms use the same codes
  static ResultStatusMap = new Map([
    ["0", "valid"],
    ["1", "invalid"],
    ["2", "noCertChain"],
    ["3", "createContextFailedWithOtherError"],
    ["4", "expiredCert"],
    ["5", "certNotValidYet"],
    ["6", "buildCertChainFailed"],
    ["7", "eeCertForWrongHost"],
    ["8", "extractKeyError"],
    ["9", "vfyContextError"],
  ]);

  static clear() {
    Telemetry.VERIFICATION_HISTOGRAM.clear();
    Telemetry.ERROR_HISTOGRAM.clear();
  }

  static snapshot() {
    return {
      errors: Telemetry.ERROR_HISTOGRAM.snapshot(),
      verifications: Telemetry.VERIFICATION_HISTOGRAM.snapshot(),
    };
  }

  // snapshotCodeToStatus returns the status of the first telemetry
  // code with a count of one:
  //
  // {"0": 1, "1": 0} => "valid"
  //
  // "none" for an empty histogram object (the errors histogram when
  // verification succeeds):
  //
  // {} => "none"
  //
  // or throw an error for an unrecognized code:
  //
  // {"bar": 1} => Error("unknown telemetry status code: bar")
  //
  // snapshot is an object of a string code to a histogram count
  //
  // We expect snapshot to contain at most one telemetry result
  // (i.e. the sum of all counts is 0 or 1), since we should only
  // collect telemetry results from one content signature
  // verification attempt.
  //
  static snapshotCodeToStatus(snapshot) {
    for (let code in snapshot) {
      if (snapshot[code] === 1) {
        if (!Telemetry.ResultStatusMap.has(code)) {
          throw `unknown telemetry status code: ${code}`;
        }
        return Telemetry.ResultStatusMap.get(code);
      }
    }
    return "none";
  }

  // firstAppValue returns the value of the first app key in an error histogram snapshot object:
  //
  // {"AD2E8CE0487FB6FA9DF1EEF8A6A8E7E8A3F089FB912276834A7172ECBC7C3873":{"bucket_count":51,"histogram_type":5,"sum":1,"range":[1,50],"values":{"0":0,"1":1,"2":0}}}
  // =>
  // {"bucket_count":51,"histogram_type":5,"sum":1,"range":[1,50],"values":{"0":0,"1":1,"2":0}}
  static firstAppValue(errorSnapshot) {
    for (let key in errorSnapshot) {
      return errorSnapshot[key];
    }
    return null;
  }

  static pretty() {
    const snapshot = Telemetry.snapshot();
    const verificationStatus = Telemetry.snapshotCodeToStatus(
      snapshot["verifications"]["values"]
    );
    const appErrorSnapshot = Telemetry.firstAppValue(snapshot["errors"]);
    const errorStatus =
      appErrorSnapshot !== null
        ? Telemetry.snapshotCodeToStatus(appErrorSnapshot["values"])
        : "none";
    return `verification: ${verificationStatus} (error: ${errorStatus})`;
  }
}

async function run_test(args, response_cb) {
  const fixtureVerified = await verifyContentSignatureFixture();
  print(`verified fixture! ${fixtureVerified}`);

  Services.prefs.setCharPref("services.settings.loglevel", "debug");
  Services.prefs.setCharPref("services.settings.server", SERVER_PROD);
  print("setting pref security.content.signature.root_hash to ${HASH_PROD}");
  Services.prefs.setCharPref("security.content.signature.root_hash", HASH_PROD);
  Services.prefs.clearUserPref("dom.push.serverURL");
  Services.prefs.clearUserPref("services.settings.load_dump");

  Telemetry.clear();

  const env = "prod";
  await switchEnvironment(env);
  print(`set crs env to: ${env}`);

  const SETTINGS_SERVER = Services.prefs.getCharPref(
    "services.settings.server"
  );

  // const BUCKET = "security-state";
  // const COLLECTION = "onecrl";
  // const SIGNER_NAME = "onecrl.content-signature.mozilla.org";

  const BUCKET = "main";
  const COLLECTION = "search-config";
  const SIGNER_NAME = "remote-settings.content-signature.mozilla.org";

  const PREFIX = SETTINGS_SERVER + "/buckets/";
  const METADATA_URL = `${PREFIX}${BUCKET}/collections/${COLLECTION}`;
  const RECORD_URL = `${METADATA_URL}/records`;
  print(`testing ${BUCKET}/${COLLECTION}`);

  const res = await fetch(METADATA_URL, { redirect: "follow" });
  print(`fetched ${METADATA_URL}`);
  const metadata = await res.json();

  const recordResponse = await fetch(RECORD_URL);
  print(`fetched ${RECORD_URL}`);
  const records = await recordResponse.json();

  const x5uResponse = await fetch(metadata.data.signature.x5u);
  print(`fetched ${metadata.data.signature.x5u}`);
  const certChain = await x5uResponse.text();

  let last_modified = 0;
  for (let record of records.data) {
    if (record.last_modified > last_modified) {
      last_modified = record.last_modified;
    }
  }

  // Merge remote records with local ones and serialize as canonical JSON.
  //
  // RemoteSettingsWorker.canonicalStringify takes args [localRecords, remoteRecords, timestamp]
  // at https://searchfox.org/mozilla-central/source/services/settings/RemoteSettingsWorker.jsm#169
  // then calls this._execute with "canonicalStringify", [localRecords, remoteRecords, timestamp,]
  //
  // However, RemoteSettingsWorker.js Agent canonicalStringify
  // only takes args [records, timestamp]
  // at https://searchfox.org/mozilla-central/source/services/settings/RemoteSettingsWorker.js#35
  //
  const serialized = await RemoteSettingsWorker.canonicalStringify(
    // [], // TODO: figure out if this is a bug elsewhere too
    records.data,
    last_modified
  );

  try {
    const verified = await verifier.asyncVerifyContentSignature(
      serialized,
      `p384ecdsa=${metadata.data.signature.signature}`,
      certChain,
      SIGNER_NAME
    );

    print(
      `verified content signature for ${BUCKET}/${COLLECTION} with result: ${verified}`
    );
    print(
      `telemetry results: ${Telemetry.pretty()}\nJSON: ${JSON.stringify(
        Telemetry.snapshot()
      )}`
    );

    response_cb(verified, { origin: "run_test" });
  } catch (error) {
    if (error.details) {
      print("got error with details:");
      const { bucket, collection } = error.details;
      console.error(
        `Error with ${bucket}/${collection}`,
        JSON.stringify({
          bucket,
          collection,
          error: error.toString(),
        })
      );
    } else {
      print("got error without details:");
      console.error(error);
    }
    console.trace(error);
    response_cb(false, { origin: "run_test" });
  }
}

register_command("run_test", run_test);

// set up a command 'get_worker_info' that fetches extended worker info useful
// for diagnosing collection signature verification errors. These will be
// dumped to the output in the event of a test failure
register_command(
  "get_worker_info",
  create_extended_info_command({
    preference_keys: [
      // Which settings server are we using?
      "services.settings.server",
      // What is the root that content signatures chain to?
      "security.content.signature.root_hash",
      // We're testing with the OneCRL collection - what signer is used?
      "services.settings.security.onecrl.signer",
    ],
  })
);

run_loop();
