# Writing Tests

Autograph monitor tests run inside [XPCShell](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_bindings/XPConnect/xpcshell). They are a little different to [XPCShell tests](https://developer.mozilla.org/en-US/docs/Mozilla/QA/Writing_xpcshell-based_unit_tests) you may have seen before in
some important ways:
- There is no xpcshell.ini and special filenames(e.g. starting test_) are not needed. Any regular file in the tests directory will be executed
- You should not assume that any of the special configuration options or flags needed for regular XPCShell tests are set.
- You should not assume that the XPCShell Testing API is present
- There is a specific entry point that is used when a test is run (the `run_test` function)
- Your test should explicitly return information on the test run (status and information) back to the test runner

## Test Invocation
Any regular file placed in the `tests` directory of autograph-monitor will be executed by the test runner. Execution takes the following steps:
1. A temporary profile is created
2. The worker_common.js script is executed making common worker script functionality available for tests
3. The test file is executed
4. `run_test`, an async function which should be defined in the test file is executed

## Test Parameters
The `run_test` function takes two parameters:
1. `args` - a JSON object containing information useful for the test. Notably, this includes the 'env' property, a map of the environment (e.g. from the lambda context)
2. `response_cb` - a response callback to be called when the test completes (successfully or otherwise)

## Callback Parameters
The `response_cb` callback takes the following parameters:
1. `status` - did this worker succeed or fail
2. `info` - information on the worker execution (e.g. if the test failed what information might be useful for diagnosis). The runner currently only actually uses one member of the info object: `debug_messages` - an array of messages that provide information on a failure. In the event of a test failure, the contents of `debug_messages` are echoed to stderr.

## Other Setup
It's often useful to have information available on the test worker in the event of a failure. The test runner will attempt to invoke a `get_worker_info` command on each worker run to collect such information. This provides a mechanism for requesting the value of specific preferences that might be set in the running worker instance. This is best communicated by example; see the sample test below to see how
a `get_worker_info` command can be created to examine specific preferences.

## An Example
```javascript

var run_test = async function(args, response_cb) {
    let debug_messages = [];
    debug_messages.push("Some debug to make test failure easier to diagnose");

    // We'll just fail the test with some sample info. Returning true would
    // cause the test to pass
    return response_cb(false, {origin: "run_test", debug_messages: debug_messages});
}

register_command("run_test", run_test);

// Some extra info is useful in the event of failure. Here we tell the worker to
// grab a couple of prefs 
register_command("get_worker_info", create_extended_info_command({
    preference_keys: [
        "some.sample.pref",
        "another.sample.pref"
    ]
}));

// run_loop() starts the js end of the runner:worker protocol
run_loop();
```