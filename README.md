# autograph-canary

[![CircleCI](https://circleci.com/gh/mozilla-services/autograph-canary/tree/main.svg?style=svg)](https://circleci.com/gh/mozilla-services/autograph-canary/tree/main)

An AWS lambda for running Firefox / Autograph integration tests. This
exercises the actual Firefox client code via XPConnect, making use of
the TLS-Canary tooling.

# Usage:

## Command line

To run the default set of autograph-canary tests:

1. install docker and docker-compose

1. Run `docker-compose build canary` to build the canary container

1. Run `docker-compose run canary` to run `autograph.py` from the main entrypoint

To run integration tests in the containerized AWS lambda emulator:

1. install docker and docker-compose

1. Run `make build` to build the canary and emulator containers

1. Run `make integration-test`, which starts the emulator and runs `bin/run_integration_tests.sh`

## AWS lambda

There are a few settings you need to think about when configuring an autograph-canary lambda:

1. Memory. The lambda will download, extract and execute a full build of Firefox. Firefox uses more memory than an AWS Lambda is allocated by default. The lambda with a current (early 2020) version of Firefox runs happily in 1024MB.

2. Environment. The test runner itself does not rely on any specific environment to run - but the tests do. Test configuration is performed through the environment that's passed through from the lambda_context. Inspect the table below on the variables expected by the various tests and ensure these are set appropriately in your deployment:

### Environment Varables

Individual tests will need specific environment variables to be set.

Variable | Description | Used By
---------|-------------|--------
CANARY_LOG_LEVEL | What log level should be used (default INFO, use DEBUG for more verbose logging) | autograph-canary
signed_XPI | The URL of a signed XPI for addon signature testing. A signed XPI is needed to ensure that signatures verify correctly and signed addons are correctly installed. | addon_signature_test.js
unsigned_XPI | The URL of an unsigned XPI for addon signature testing. An unsigned XPI is needed to check that unsigned addons are appropriately rejected by Firefox. | addon_signature_test.js
