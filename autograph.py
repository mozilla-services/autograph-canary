# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import bz2
import coloredlogs
import io
import logging
import os
import requests
import sys
import tarfile
import tempfile
import time

from tlscanary.tools import firefox_app as fx_app
from tlscanary.tools import firefox_downloader as fx_dl
from tlscanary.tools import firefox_extractor as fx_ex
from tlscanary.tools import xpcshell_worker as xw

tmp_dir = None
module_dir = None

# Initialize coloredlogs
logging.Formatter.converter = time.gmtime
logger = logging.getLogger(__name__)
coloredlogs.DEFAULT_LOG_FORMAT = (
    "%(asctime)s %(levelname)s %(threadName)s %(name)s %(message)s"
)
coloredlogs.install(level="DEBUG")

# TODO: MDG - Move create_tempdir to a helper module
def __create_tempdir(prefix="canary_"):
    """
    Helper function for creating the temporary directory.
    Writes to the global variable tmp_dir
    :return: Path of temporary directory
    """
    temp_dir = tempfile.mkdtemp(prefix=prefix)
    logger.debug("Created temp dir `%s`" % temp_dir)
    return temp_dir


def get_app(temp_dir, native):
    downloader = fx_dl.FirefoxDownloader(temp_dir, cache_timeout=1)
    if native:
        test_archive = downloader.download("nightly", use_cache=True)
        return fx_ex.extract(test_archive, temp_dir)
    else:
        url = fx_dl.FirefoxDownloader.get_download_url("nightly")
        print("Fetching nightly from %s" % url)
        dc = bz2.BZ2Decompressor()
        r = requests.get(url)
        f = io.BytesIO(dc.decompress(r.content))
        ta = tarfile.open(fileobj=f)
        print("extracting tar file to %s" % temp_dir)
        ta.extractall(path=temp_dir)
        return fx_app.FirefoxApp(temp_dir)


def sync_send(worker, command):
    worker.send(command)
    command_dict = command.as_dict()
    wakeup_cmd = xw.Command("wakeup")
    timeout = 10
    timeout_time = time.time() + timeout + 1
    # For now, just ignore ACKs and send wakeup messages
    while time.time() < timeout_time:
        for response in worker.receive():
            # TODO: MDG eventually we want to look at ACKs to re-set the timer
            if response.result != "ACK":
                # TODO: MDG - and eventually we might want to make sure the ID match (check this is required)
                if response.original_cmd["mode"] == command_dict["mode"]:
                    return response
        if worker.send(wakeup_cmd):
            time.sleep(0.1)
        else:
            break
    raise Exception("Message timed out")


def run_tests(event, lambda_context, native=False):
    coloredlogs.install(level=os.environ["CANARY_LOG_LEVEL"])

    temp_dir = __create_tempdir()
    app = get_app(temp_dir, native)

    # Spawn a worker.

    # TODO: MDG check args for user specified test path.
    # TODO: MDG get a path relative to *this script* for the default test path
    test_path = os.path.abspath("tests")

    script_files = []
    if os.path.isdir(test_path):
        children = os.listdir(test_path)
        script_files = [
            os.path.abspath(p)
            for p in filter(
                os.path.isfile, [os.path.join(test_path, child) for child in children]
            )
        ]
    else:
        script_files = [test_path]

    # Unless a test fails, we want to exit with a non-error result
    failure_seen = False

    csig_tests = [
        {
            "env": "prod",
            "bucket": "security-state",
            "collection": "onecrl",
            "signer_name": "onecrl.content-signature.mozilla.org",
        },
        {
            "env": "prod",
            "bucket": "main",
            "collection": "search-config",
            "signer_name": "remote-settings.content-signature.mozilla.org",
        },
    ]
    addon_test = {
        "signed_XPI" : "https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/signed1.xpi",
        "unsigned_XPI" : "https://searchfox.org/mozilla-central/source/toolkit/mozapps/extensions/test/xpcshell/data/signing_checks/unsigned.xpi",
    }

    for script_path in script_files:
        if script_path.endswith("content_signature_test.js"):
            run_test_kwargs = dict(tests=csig_tests)
        elif script_path.endswith("addon_signature_test.js"):
            run_test_kwargs = addon_test
        else:
            run_test_kwargs = dict()

        profile_dir = __create_tempdir(prefix="profile_")
        w = xw.XPCShellWorker(
            app,
            script=script_path,
            profile=profile_dir,
        )
        w.spawn()
        info_response = sync_send(w, xw.Command("get_worker_info", id=1))

        response = sync_send(w, xw.Command(mode="run_test", id=2, **run_test_kwargs))
        w.terminate()

        res_dict = response.as_dict()

        # If a test has failed, exit with error status
        if res_dict["success"]:
            print(
                "SUCCESS: %s executed with result %s"
                % (script_path, res_dict["success"])
            )
        else:
            print(
                "FAIL: %s executed with result %s" % (script_path, res_dict["success"])
            )
            failure_seen = True

        print(res_dict)
        print("Worker info:")
        print(info_response.as_dict())

    if not failure_seen:
        logger.info("Tests passed successfully")
    else:
        sys.exit(1)


def autograph_canary_monitor(event, context):
    logger.debug(
        "running autograph_canary_monitor with event={!r} and context={!r}".format(
            event, context
        )
    )
    run_tests(event, context, native=True)


if __name__ == "__main__":
    # simulate the lambda when run from a main program
    run_tests({}, lambda_context=None, native=True)
