# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import bz2
import coloredlogs
import io
import logging
import os
import pathlib
import requests
import sys
import tarfile
import tempfile
import time
import typing

from tlscanary.tools import firefox_app as fx_app
from tlscanary.tools import firefox_downloader as fx_dl
from tlscanary.tools import firefox_extractor as fx_ex
from tlscanary.tools import xpcshell_worker as xw

tmp_dir = None
module_dir = None

# Initialize coloredlogs
logging.Formatter.converter = time.gmtime
logger = logging.getLogger(__file__)
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
    logger.debug(f"Created temp dir {temp_dir!r}")
    return temp_dir


def get_app(temp_dir, native):
    downloader = fx_dl.FirefoxDownloader(temp_dir, cache_timeout=1)
    if native:
        test_archive = downloader.download("nightly", use_cache=True)
        return fx_ex.extract(test_archive, temp_dir)
    else:
        url = fx_dl.FirefoxDownloader.get_download_url("nightly")
        logger.info(f"fetching nightly from {url}")
        dc = bz2.BZ2Decompressor()
        r = requests.get(url)
        f = io.BytesIO(dc.decompress(r.content))
        ta = tarfile.open(fileobj=f)
        logger.info(f"extracting tar file to {temp_dir}")
        ta.extractall(path=temp_dir)
        return fx_app.FirefoxApp(temp_dir)


def get_test_args(test_filename: str) -> typing.Tuple[typing.Dict[str, str], int]:
    """
    Return the kwargs and timeout for a test filename
    """
    if test_filename == "content_signature_test.js":
        kwargs = dict(
            collections=os.environ["CSIG_COLLECTIONS"], env=os.environ["CSIG_ENV"]
        )
        timeout = 5 * len(os.environ["CSIG_COLLECTIONS"].split(","))
    elif test_filename == "addon_signature_test.js":
        kwargs = dict(xpi_urls=os.environ["XPI_URLS"], env=os.environ["XPI_ENV"])
        timeout = 3 * len(os.environ["XPI_URLS"].split(","))
    else:
        kwargs = dict()
        timeout = 5
    return kwargs, timeout


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
    test_files = sorted(
        path
        for path in pathlib.Path("./tests").glob(os.environ["TEST_FILES_GLOB"])
        if path.is_file()
    )

    # Unless a test fails, we want to exit with a non-error result
    failure_seen = False

    for script_path in test_files:
        test_kwargs, test_timeout = get_test_args(script_path.name)

        profile_dir = __create_tempdir(prefix="profile_")
        w = xw.XPCShellWorker(
            app,
            script=str(script_path.resolve()),
            # head_script=os.path.join(os.path.abspath("."), "head.js"),
            profile=profile_dir,
        )
        w.spawn()
        info_response = sync_send(w, xw.Command("get_worker_info", id=1))
        logger.info(f"running test {str(script_path.resolve())} with {test_kwargs}")
        response = sync_send(w, xw.Command(mode="run_test", id=2, **test_kwargs))
        time.sleep(test_timeout)
        w.terminate()

        res_dict = response.as_dict()

        # print log lines when possible
        if (
            "result" in res_dict
            and "results" in res_dict["result"]
            and isinstance(res_dict["result"]["results"], list)
        ):
            for result in res_dict["result"]["results"]:
                if isinstance(result, dict) and "messages" in result and isinstance(result["messages"], list):
                    for line in result["messages"]:
                        logger.info(line)
                else:
                    logger.info(result)
        else:
            logger.info(res_dict)

        logger.info(f"Worker info: {info_response.as_dict()}")

        if res_dict["success"]:
            logger.info(
                f"SUCCESS: {script_path} executed with result {res_dict['success']}"
            )
        else:
            logger.info(
                f"FAIL: {script_path} executed with result {res_dict['success']}"
            )
            failure_seen = True

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
