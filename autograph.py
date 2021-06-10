# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.

import coloredlogs
import logging
import os
import pathlib
import shutil
import sys
import tempfile
import time
import typing

from tlscanary.tools import firefox_app as fx_app
from tlscanary.tools import xpcshell_worker as xw


# Initialize coloredlogs
logging.Formatter.converter = time.gmtime
logger = logging.getLogger(__file__)
coloredlogs.DEFAULT_LOG_FORMAT = (
    "%(asctime)s %(levelname)s %(threadName)s %(name)s %(message)s"
)
coloredlogs.install(level="DEBUG")


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


def log_test_messages(res_dict: typing.Dict[str, str]):
    """
    print log lines from run test results
    """
    if (
        "result" in res_dict
        and "results" in res_dict["result"]
        and isinstance(res_dict["result"]["results"], list)
    ):
        for result in res_dict["result"]["results"]:
            if (
                isinstance(result, dict)
                and "messages" in result
                and isinstance(result["messages"], list)
            ):
                for line in result["messages"]:
                    logger.info(line)
            else:
                logger.info(result)
    else:
        logger.info(res_dict)


def log_disk_usage(path: str = "/tmp"):
    """
    Log disk usage at path
    """
    logger.info(f"{path} disk usage: {shutil.disk_usage(path)}")


def run_tests(event, lambda_context):
    log_disk_usage()

    coloredlogs.install(level=os.environ["CANARY_LOG_LEVEL"])

    test_files = sorted(
        path
        for path in pathlib.Path("./tests").glob(os.environ["TEST_FILES_GLOB"])
        if path.is_file()
    )

    # Unless a test fails, we want to exit with a non-error result
    failure_seen = False

    app = fx_app.FirefoxApp(str(pathlib.Path("./firefox/").resolve(strict=True)))

    for script_path in test_files:
        test_kwargs, test_timeout = get_test_args(script_path.name)

        with tempfile.TemporaryDirectory(prefix="profile_") as profile_dir:
            logger.debug(f"Created profile dir {profile_dir!r}")
            log_disk_usage()

            # Spawn a worker.
            w = xw.XPCShellWorker(
                app,
                script=str(script_path.resolve()),
                # head_script=os.path.join(os.path.abspath("."), "head.js"),
                # profile=profile_dir,
            )
            spawn_result = w.spawn()
            logger.debug(f"spawned worker with result {spawn_result!r}")
            logger.debug(f"worker running? {w.is_running()!r}")

            assert spawn_result is True

            info_response = sync_send(w, xw.Command("get_worker_info", id=1))
            logger.info(f"running test {str(script_path.resolve())} with {test_kwargs}")
            response = sync_send(w, xw.Command(mode="run_test", id=2, **test_kwargs))
            time.sleep(test_timeout)
            w.terminate()

        res_dict = response.as_dict()

        log_test_messages(res_dict)
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

    log_disk_usage()

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
    run_tests(event, context)


if __name__ == "__main__":
    # simulate the lambda when run from a main program
    run_tests({}, lambda_context=None)
