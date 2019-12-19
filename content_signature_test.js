/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var _Services = ChromeUtils.import("resource://gre/modules/Services.jsm", null)
  .Services;

ChromeUtils.defineModuleGetter(this,
                               "RemoteSettingsWorker",
                               "resource://services-settings/RemoteSettingsWorker.jsm");

Cu.importGlobalProperties(["fetch"]);

const { Utils } = ChromeUtils.import("resource://services-settings/Utils.jsm");

var run_test = async function(args, response_cb) {
    let SETTINGS_SERVER = _Services.prefs.getCharPref("services.settings.server");
    let BUCKET = "security-state";
    let COLLECTION = "onecrl";
    let SIGNER_NAME = "onecrl.content-signature.mozilla.org";
    let PREFIX = SETTINGS_SERVER + "/buckets/";

    let METADATA_URL = PREFIX + BUCKET + "/collections/" + COLLECTION;

    let res = await fetch(METADATA_URL, {redirect: 'follow'});

    try {
        let metadata = await res.json();

        let certres = await fetch(metadata.data.signature.x5u);
        let certdata = await certres.text();

        let colres = await fetch(PREFIX + BUCKET + "/collections/" + COLLECTION + "/records");
        let remote = await colres.json();

        // First, perform a signature verification with known data and signature
        // to ensure things are working correctly
        let verifier = Cc[
            "@mozilla.org/security/contentsignatureverifier;1"
        ].createInstance(Ci.nsIContentSignatureVerifier);

        let last_modified = 0;
        for (let record of remote.data) {
            if (record.last_modified > last_modified) {
                last_modified = record.last_modified;
            }
        }


        // Merge remote records with local ones and serialize as canonical JSON.
        const serialized = await RemoteSettingsWorker.canonicalStringify(
            [],
            remote.data,
            last_modified
        );
        
        let verified = await verifier.asyncVerifyContentSignature(
            serialized,
            "p384ecdsa=" + metadata.data.signature.signature,
            certdata,
            SIGNER_NAME
        );

        if(verified) {
            response_cb(true, {origin: "run_test"});
        } else {
            response_cb(false, {origin: "run_test"});
        }
    } catch (e) {
        response_cb(false, {origin: "run_test", exception: e});
    }
}

// TODO: MDG - Add convenience commands to allow settings service prefs to be set by env
//_Services.prefs.setCharPref("services.settings.server", "https://settings.stage.mozaws.net/v1");
//_Services.prefs.setCharPref("security.content.signature.root_hash", "EA:72:2C:80:6A:EF:82:95:D4:E4:08:7E:56:8B:2C:F0:38:25:31:2D:B5:88:B3:C5:D0:66:F6:51:56:02:9E:E3");

register_command("run_test", run_test);

run_loop();