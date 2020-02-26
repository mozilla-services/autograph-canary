# autograph-canary
An AWS lambda for running Firefox / Autograph integration tests. This exercises the actual Firefox client code via XPConnect, making use of the TLS-Canary tooling.

# Usage:
## Command line
To run the default set of autograph-canary tests, ensure you have tls-canary installed correctly (e.g. via `pip install tls-canary`), then:

```bash
autograph.py
```

## Packaging the AWS Lambda
TODO

## AWS lambda
There are a few settings you need to think about when configuring an autograph-canary lamdba:
1. Memory. The lambda will download, extract and execute a full build of Firefox. Firefox uses more memory than an AWS Lambda is allocated by default. The lambda with a current (early 2020) version of Firefox runs happily in 1024MB.
2. Environment. The test runner itself does not rely on any specific environment to run - but the tests do. Test configuration is performed through the environment that's passed through from the lambda_context. Inspect the table below on the variables expected by the various tests and ensure these are set appropriately in your deployment:

### Environment Varables
Individual tests will need specific environment variables to be set.

Variable | Description | Used By
---------|-------------|--------
CANARY_LOG_LEVEL | What log level should be used (default INFO, use DEBUG for more verbose logging) | autograph-canary
signed_XPI | The URL of a signed XPI for addon signature testing. A signed XPI is needed to ensure that signatures verify correctly and signed addons are correctly installed. | addon_signature_test.js
unsigned_XPI | The URL of an unsigned XPI for addon signature testing. An unsigned XPI is needed to check that unsigned addons are appropriately rejected by Firefox. | addon_signature_test.js
