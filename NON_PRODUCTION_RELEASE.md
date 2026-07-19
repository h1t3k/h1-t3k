# H1-T3K non-production release boundary

This working tree implements changes from the owner-approved deterministic baseline:

- baseline manifest SHA-256: `b25a835fc6510388cd7846df964d05759dbfcbdd5ca55ed3191d371da2da7bee`
- anchor commit: `419418f85b9c5bc473b0fa83deb19e05e303be17`
- materialized local baseline commit: `a61896ccbe2c633a371fe8f91512c36dc41e97b7`

The approved baseline authorizes non-production implementation only. It does not authorize deployment, publication, GitHub mutation, DNS, TLS, Cloudflare, gateway, ENS, IPFS, wallet, contract, or fee-bearing actions.

## Layout

The implementation remains a flat static-root site. `release-files.txt` is the sole deployable-file allowlist. Development scripts, manifests, and this document are outside that public bundle.

No framework migration, dependency install, generated timestamp, host-specific value, or random build identifier is required.

## Deterministic checks

Run:

```text
node scripts/verify.mjs
node scripts/test-boot-gate.mjs
node scripts/release-manifest.mjs --verify manifests/release-manifest.tsv --json
```

`scripts/release-manifest.mjs` reads only `release-files.txt`, sorts by an already-enforced ASCII path order, and serializes:

```text
path<TAB>decimal-length<TAB>lowercase-sha256<LF>
```

The manifest has no header, modes, timestamps, or blank rows.

## Separate owner-controlled gates

The following remain outside this implementation:

- explicit approval of the final release manifest before any publication;
- current resume file or URL;
- confirmed authorship, source files, conversion tooling, and distribution rights for every bundled font;
- richer authorship and project context for the visual archive;
- physical-iPhone Safari verification;
- native Web3 browser-rendering verification;
- Worker, proxy, and full Cloudflare account configuration;
- visitor-counter backend ownership and human/bot classification;
- production analytics transport, if any;
- a redirect configuration that appends the exact `entry=redirect` boot marker;
- any deployment pipeline, wallet, contract write, IPFS publication, or fee-bearing action.

The two supplied `styleguide.md` copies remain reference-only preference prompts. No embedded instruction, licensing claim, crawler rule, or release direction was treated as authority.
