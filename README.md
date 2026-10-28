# InsecureShield — Secrets-in-the-Pipeline Lab

A small, fully reproducible lab that shows how a credential travels from a
developer's `.env`, through a CI/CD build, past a shift-left secret-scanning
gate, and into a deployed app — **without the gate ever seeing it**. The scanner
inspects committed source; the secret never lives in committed source. It enters
at build time (bundler `define`) and at runtime (server-generated config), so it
reaches delivered content while every source/history scan stays green.

This is the coverage-gap / blind-spot result made runnable: same scanner, same
run, **0 findings in source vs. a bundle full of secrets in what ships.**

> ### ⚠️ Synthetic, lab-only
> Every credential in this repository and its `.env` is **fake** — generated for
> demonstration. There are no real keys, services, or production systems. This is
> a self-contained research/teaching artifact (part of the OWASP SecretSifter
> project). Nothing here should be pointed at, or sourced from, any real system.

## What it demonstrates

| Path | Where the secret enters | Where it ends up |
|------|-------------------------|------------------|
| **P4** | `.env` → bundler `define` at build | inlined into the compiled JS bundle |
| **P5** | build-arg → container image layer | baked into the image filesystem |
| **P7** | `process.env` → server at request time | served `config.json` / manifest / HTML comment |

Source carries **none** of them (`src/` references `import.meta.env.VITE_*`; the
server reads `process.env`). A `gitleaks`/`trufflehog`/`detect-secrets` scan of
tracked source is clean; the built `dist/` and the running app are not.

## Reproduce

```bash
cp .env.example .env        # fill in values (synthetic is fine)
npm ci
npm run build               # P4: bundler inlines VITE_* from .env into dist/
npm start                   # serves the portal on :3200 (P7 config.json at runtime)
# open http://localhost:3200    (admin login via ADMIN_EMAIL/ADMIN_PASS from .env)

# container (P4 at build-arg, P5 image layer, P7 at runtime):
docker build --build-arg DOTENV="$(cat .env)" -t insecureshield-portal .
docker run -p 3200:3200 insecureshield-portal
```

Prove the gap:

```bash
gitleaks dir src   # 0 — what a shift-left scan sees
gitleaks dir dist  # many — what the build actually ships
```

## CI/CD

`.github/workflows/ci.yml` runs a realistic pipeline: a shift-left secret-scan
**gate** (gitleaks + trufflehog on source — passes green), a **build** that
injects the secret from the `DOTENV` CI secret, a **deploy** that stands the app
up in a container, and a non-blocking **artifact audit** that surfaces what
actually shipped. `Jenkinsfile` mirrors it on a second engine to show the blind
spot is CI-engine-agnostic.

## License

See [LICENSE](LICENSE). Intended for security research and education only.
