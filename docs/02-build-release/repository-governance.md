# Repository governance

This is the source of truth for merge protection, quality-baseline exceptions
and emergency repository changes.

## Normal merge path

Changes to `main` require the configured status checks, one approving review,
code-owner review, approval after the latest push and resolved conversations.
Administrators retain bypass only for an emergency.

The wildcard code owners must explicitly accept the ongoing responsibility.
Repository write access alone is not acceptance. Until both owners confirm,
review capacity is an open governance dependency.

## Ratcheting baselines

Documentation context ceilings and mobile web bundle baselines are compared with
the merge base. A pull request must not raise either committed limit merely to
make a larger change pass.

If an increase is unavoidable, do not weaken or bypass the checker in the same
change. First open a separate governance proposal adding a narrowly scoped,
time-bounded record to `scripts/quality-baseline-exceptions.json` with:

- the old and proposed measurements;
- the cause and user value;
- options considered;
- the named code owner approving the exception;
- an expiry date or reduction task.

Merge the approved exception separately. The implementation may then raise only
the named measurement to the approved value. Expired, incomplete and broader
increases remain blocked.

## Backend test quarantine

`npm test` discovers every `tests/api/*.test.js` file. Stable files are required.
Known failing files are listed with reasons in
`scripts/backend-test-manifest.json`; this quarantine is test debt, not passing
evidence. New tests are included automatically. Removing a quarantine entry
must make that file part of the required suite.

Current state: all discovered backend test files are required; the quarantine
manifest is empty. CI compares the quarantine count with the merge base and
rejects any increase. The check also fails when the merge-base manifest cannot
be read; it never establishes an implicit baseline from the current branch.

## Emergency merge

Administrator bypass is limited to an active security incident, production
outage or unavailable required service where delaying the change causes greater
harm. Record the reason, approver, skipped checks and rollback plan in the pull
request before merging where possible, or immediately afterwards during an
incident. Run skipped checks and open any remediation task as soon as service is
restored. Convenience, deadline pressure and pre-existing test failures are not
emergencies.
