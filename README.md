# autograph-canary

[![CircleCI](https://circleci.com/gh/mozilla-services/autograph-canary/tree/main.svg?style=svg)](https://circleci.com/gh/mozilla-services/autograph-canary/tree/main)

autograph-canary is [a containerized AWS
lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-images.html)
for running Firefox integration tests against signed
[autograph](https://github.com/mozilla-services/autograph/)
artifacts. It uses XPConnect to exercise Firefox client code against
signed XPI/Addons and content signtures.

## Usage

### Installation

To download the built image from dockerhub run:

```sh
docker pull mozilla/autograph-canary
```

or [see
below](https://github.com/mozilla-services/autograph-canary/blob/main/README.md#command-line)
to build it locally.

## AWS Lambda

#### Environment Varables

The following environment variables with their default values below
configure logging verbosity, tests to run, and test targets.

What log level should be used (use INFO for less verbose logging):

```sh
CANARY_LOG_LEVEL=debug
```

Which XPCShell test files in `tests/` to run (as matched by [pathlib
glob][py3_pathlib_glob]):

```sh
TEST_FILES_GLOB="*_test.js"
```

##### Addon / XPI Signature Verification

Which PKI root to verify addons against. Defaults to `prod`, use
`stage` to set `xpinstall.signatures.dev-root` to true (Fx Nightly
only):

```sh
XPI_ENV=prod
```

Which XPI URLs to download and install as a CSV:

```sh
XPI_URLS=https://addons.mozilla.org/firefox/downloads/file/3772109/facebook_container-2.2.1-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3713375/firefox_multi_account_containers-7.3.0-fx.xpi,https://addons.mozilla.org/firefox/downloads/file/3768975/ublock_origin-1.35.2-an+fx.xpi
```

##### Content Signature Verification

Which prefs to use for content signature settings server URL, bucket,
and root hash (`prod` or `stage` with an optional `-preview` suffix
same as [remotesettings devtools][rsdevtools]):

```sh
CSIG_ENV=prod
```

Which content signature collections to verify. Collections must all
use the same `CSIG_ENV` and be a CSV list formatted as
"$BUCKET_NAME/$COLLECTION_NAME". Use `bin/list_collections.sh` to list
publicly available collections:

```sh
CSIG_COLLECTIONS=blocklists/gfx,blocklists/addons-bloomfilters,blocklists/plugins,blocklists/addons,blocklists/certificates,main/normandy-recipes,main/normandy-recipes-capabilities,main/hijack-blocklists,main/search-config,security-state/onecrl,security-state/intermediates
```

[py3_pathlib_glob]: https://docs.python.org/3/library/pathlib.html#pathlib.Path.glob
[rsdevtools]: https://github.com/mozilla-extensions/remote-settings-devtools

#### Event payload

To support running from scheduled events, autograph-canary ignores event payloads.

### Command line

To run the default set of autograph-canary tests:

1. install docker and docker-compose

1. Run `docker-compose build canary` to build the canary container

1. Run `docker-compose run canary` to run `autograph.py` from the main entrypoint

To run integration tests in the containerized AWS lambda emulator:

1. install docker and docker-compose

1. Run `make build` to build the canary and emulator containers

1. Run `make integration-test`, which starts the emulator and runs `bin/run_integration_tests.sh`

## Development

1. install docker and docker-compose

1. run `cp docker-compose.override.yml.example docker-compose.override.yml`

1. Run `make build` to build the canary and emulator containers

1. Run `docker-compose up -d emulator` to start the emulator container

1. Run `make emulator-shell` to log into the emulator container. In
   the container run `cp local/autograph.py . && python autograph.py`
   to run tests without rebuilding the container.
