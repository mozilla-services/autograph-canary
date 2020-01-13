# autograph-monitor
An AWS lambda for checking Autograph signing is working correctly. This exercises the signature verification code in Firefox via XPCShell using the TLS-Canary tooling.

# Usage:
## Command line
Ensure you have tls-canary installed correctly (e.g. via pip), then:

```$ autograph.py```

## AWS lambda
Instructions to follow...