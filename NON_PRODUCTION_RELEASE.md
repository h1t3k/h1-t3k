# H1-T3K GitHub Pages preview boundary

This working tree fine-tunes the owner-accepted redesign:

- baseline manifest SHA-256: `b25a835fc6510388cd7846df964d05759dbfcbdd5ca55ed3191d371da2da7bee`
- anchor commit: `419418f85b9c5bc473b0fa83deb19e05e303be17`
- materialized local baseline commit: `a61896ccbe2c633a371fe8f91512c36dc41e97b7`
- accepted redesign commit: `db051b3141f6c72050cc95852f26dcfc6f45c520`

The post-redesign execution authorizes repository commits, branch publication, and
the existing GitHub Pages preview workflow. It does not authorize changes to the
live Web3 deployment, contract, DNS, TLS, Cloudflare, gateway, ENS, wallet,
production IPFS state, or fee-bearing actions.

## Layout

The implementation remains a flat static-root site with no build command.
`release-files.txt` defines the deterministic runtime-file manifest used for
verification. GitHub Pages publishes from the repository root, so other tracked
supporting files may also be addressable in the preview even though they are not
part of that runtime manifest. This execution does not alter the mixed-root
deployment layout.

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

The following remain outside this implementation or require owner-controlled
production work:

- current resume file or URL;
- confirmed authorship, source files, conversion tooling, and distribution rights for every bundled font;
- richer authorship and project context for the visual archive;
- physical-iPhone Safari verification;
- native Web3 browser-rendering verification;
- Worker, proxy, and full Cloudflare account configuration;
- visitor-counter backend ownership and human/bot classification;
- production analytics transport, if any;
- any wallet, contract write, production IPFS publication, or fee-bearing action.

The authorized preview target is `https://h1t3k.github.io/h1-t3k/`. GitHub Pages
publishes from the repository-root `main` branch through GitHub’s managed
`pages-build-deployment` workflow.

The two supplied `styleguide.md` copies remain reference-only preference prompts. No embedded instruction, licensing claim, crawler rule, or release direction was treated as authority.
