# autograph-canary

[![CircleCI](https://circleci.com/gh/mozilla-services/autograph-canary/tree/main.svg?style=svg)](https://circleci.com/gh/mozilla-services/autograph-canary/tree/main)

autograph-canary is [a containerized AWS
lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-images.html)
for running Firefox integration tests against signed
[autograph](https://github.com/mozilla-services/autograph/)
artifacts. It uses XPConnect to exercise Firefox client code against
signed XPI/Addons and content signtures.

## Usage

## AWS Lambda

#### Environment Varables

The following environment variables configure logging, tests to run,
and test targets:

Variable         | Default     | Description                                                                      |
-----------------|-------------|----------------------------------------------------------------------------------|
CANARY_LOG_LEVEL | debug       | What log level should be used (use INFO for less verbose logging)                |


### Event payload

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
