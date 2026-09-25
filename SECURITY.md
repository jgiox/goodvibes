# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability, please do not open a public GitHub issue. Public issues are visible to everyone, which gives attackers an opportunity to exploit the problem before it is fixed.

Instead, report it privately using GitHub's private vulnerability reporting feature: go to the Security tab of this repository, click "Report a vulnerability", and fill out the form. Your report will only be visible to the repository maintainers.

If that button is not available, open an issue titled "Security contact request" with no details about the problem, and a maintainer will contact you privately.

## Supported versions

Only the latest release on npm (`goodvibes-cli`) and PyPI (`goodvibes-cli`) receives security fixes. Run `goodvibes upgrade` to get it.

## Response

- We will acknowledge your report within 48 hours.
- We will aim to release a fix within 30 days of confirmation, depending on severity.

## Scope

This security policy applies to the code in this repository, including the files goodvibes installs into projects and `~/.claude` (hooks, permissions, CI templates, skills) and the telemetry counter in `workers/telemetry/`. Problems in third-party dependencies belong with that project; please report them upstream.
