# Contributing to @realstamp/verify

Thanks for considering a contribution. This is the official SDK for verifying RealStamp credentials; correctness here matters more than feature velocity, so the bar is high on what gets merged.

## What's welcomed

- **Bug reports** with a minimal reproduction (Node version + a 5-line script that fails)
- **Type bugs** where the SDK return type doesn't match what the API actually returns (these are the highest-leverage reports)
- **Documentation fixes** — typos, misleading examples, gaps in the README
- **Examples** for runtimes we don't yet show (Bun, Cloudflare Workers, Deno, Next.js App Router, etc.)
- **Test cases** that pin down current behavior so it can't drift

## What's NOT welcomed

- New API methods that wrap endpoints not documented in the README — open an issue first
- Breaking changes to public types without a discussion issue first
- Performance optimizations that meaningfully complicate the code
- Dependencies (this is a zero-runtime-dep SDK; we will not accept runtime-deps without strong justification)

## Local development

```bash
git clone https://github.com/emiliacarp/realstamp-sdk.git
cd realstamp-sdk
npm install
npm run typecheck
npm test
npm run build
```

If those four commands all pass, you have a working local build.

## Branch + PR rules

- Branch from `main`. Name branches `fix/short-summary`, `feat/short-summary`, or `docs/short-summary`.
- Run `npm run typecheck`, `npm test`, and `npm run build` before pushing.
- One concern per PR. Atomic changes review faster.
- Add or update tests when behavior changes.
- Update `CHANGELOG.md` under an "Unreleased" section.
- PR description: what changed, why, and how a user would notice.

## Security issues

**Do not open public PRs or issues for security vulnerabilities.** See [SECURITY.md](SECURITY.md) for the private disclosure process.

## Code style

- TypeScript strict mode + `noUncheckedIndexedAccess`. Don't suppress with `as any` or `@ts-ignore` unless you write a comment explaining why.
- Snake_case is the API contract; camelCase is the consumer contract. The boundary lives in `src/normalize.ts`. Server responses go in snake_case; SDK consumer types come out camelCase.
- Stable string error codes (e.g., `'rate_limited'`, `'stamp_not_found'`) — never English sentences that consumers might switch on.
- No new runtime dependencies. WebCrypto only.

## License

By contributing, you agree your contributions are licensed under Apache-2.0, the same license as the rest of the project.
