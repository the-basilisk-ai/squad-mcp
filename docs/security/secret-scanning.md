# Secret scanning

gitleaks gates every pull request and re-checks a rolling week of commits daily. A
husky pre-commit hook scans staged changes. Same setup in `squidge` and `squad-cli`.
The comparison against TruffleHog is in `squidge` at
`docs/security/secret-scanning.md`.

## How it runs

`.github/workflows/secret-scan.yml`, on pull requests, daily, and on
`workflow_dispatch`.

Full history was scanned once, recorded below. `main` is protected against
force-pushes, so routine runs only cover new commits: a pull request run scans
`base..head`, the daily run scans `--since=7.days` on the default branch. No state
is committed to the repository for either window.

The daily window deliberately excludes `--all`. Branch commits are already covered by
the pull request gate, and a rebase gives the same line a new commit SHA, so scanning
every ref re-reports one value once per copy. Fingerprints are commit-scoped and
cannot keep up with that.

`workflow_dispatch` with `full_history` rescans everything. Do that after a gitleaks
upgrade, since new rules invalidate the old baseline.

Every run writes rule, location, commit, author and fingerprint to the job summary
and uploads a redacted JSON report, retained 90 days. `--redact=100` keeps values
out of both.

The husky `pre-commit` hook runs `gitleaks git --staged`. It does not replace the CI
job, which is what blocks a merge, and it skips with a warning if gitleaks is not on
`PATH`. `nix develop` provides it.

## Baseline scan

`gitleaks git --log-opts="--all"` with gitleaks 8.30.1, every ref up to `7f7fb4e0`,
2026-08-02. One finding, accepted and allowlisted:

A PropelAuth access token in `src/opportunity.ts`, commit `846cb887`, 2025-04-01, in
a file no longer present at `HEAD`. It was issued by a PropelAuth test tenant with a
30-minute expiry, so it expired in April 2025 and there is nothing to rotate. Steven
accepted it in history on 2026-08-02 rather than rewrite, since a rewrite breaks
every existing clone and buys nothing against a dead credential. The JWT body still
carries a name, an email address and organisation metadata, and this repository is
public, which the decision accepts.

The fingerprint is in `.gitleaksignore` with that reasoning. A `full_history`
dispatch is clean as a result, so a future finding stands out rather than arriving
alongside a known one.

## When the scan fires

A failed pull request check is visible to the author and reviewers. A failed
scheduled run notifies whoever last changed the workflow file; there is no Slack
alert. Read the job summary rather than the log, and treat every finding as a
suspected compromise until shown otherwise.

1. Tell the CTO. Rotation is their decision and happens first. Rotate at the
   provider, then confirm the old value is dead.
2. Check the provider's audit log for the exposure window, which starts at the
   commit date in the summary.
3. Once the credential is dead, decide what to do about the history. Removal means a
   rewrite that breaks every existing clone.
4. Record how it was found, when it was rotated, and the exposure.

Do not resolve a real finding with an allowlist entry.

## Adding an allowlist entry

Two cases qualify. A confirmed false positive: the value is not a credential, or
cannot authenticate to anything. Or a credential confirmed dead, where accepting it
in history beats a rewrite that would break every clone. Nothing else.

Copy the fingerprint from the job summary into `.gitleaksignore` with a comment
giving your name, the date and the reasoning. Push it in the pull request the finding
blocked, so someone other than you reviews the justification.

```
# steven 2026-08-02: sample response body in a test fixture, the token field is a
# hand-written placeholder and authenticates to nothing.
1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b:src/__fixtures__/response.json:generic-api-key:12
```

A fingerprint suppresses one rule on one line of one commit, so an entry cannot mask
a different finding. Reject entries with no justification, and reject path or regex
allowlists. `--ignore-gitleaks-allow` disables the inline `gitleaks:allow` comment,
so every suppression lands in this one file.

## Upgrading gitleaks

Bump `GITLEAKS_VERSION` and `GITLEAKS_SHA256` together. The checksum is the
`linux_x64` line of `gitleaks_<version>_checksums.txt` on the release. Dependabot
does not track this pin. After a bump, dispatch with `full_history` and update the
baseline above.
