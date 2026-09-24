#!/usr/bin/env bash
# Publish the Kerb SDK to npm (V3 L-07). Builds packages/sdk/src/index.ts to plain ESM with types
# into a clean directory and publishes it. Needs NPM_TOKEN (an npm granular access token with
# publish rights) in /root/.kerb/npm.env; the token never enters the repo or the logs.
#   bash scripts/publish-sdk.sh [--dry-run]
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${KERB_SDK_NAME:-kerb-sdk}"
VERSION=$(node -p "require('./packages/sdk/package.json').version")
OUT=$(mktemp -d)
npx tsc packages/sdk/src/index.ts --outDir "$OUT" --declaration --module es2022 --target es2022 --moduleResolution bundler --strict --skipLibCheck
cat > "$OUT/package.json" <<JSON
{
  "name": "$NAME",
  "version": "$VERSION",
  "description": "Read Kerb Terms: the market-time risk layer for tokenized stocks on X Layer. Credit on the market's clock.",
  "type": "module",
  "main": "index.js",
  "types": "index.d.ts",
  "exports": { ".": { "types": "./index.d.ts", "import": "./index.js" } },
  "files": ["index.js", "index.d.ts", "README.md"],
  "license": "MIT",
  "homepage": "https://www.usekerb.xyz/developers",
  "repository": { "type": "git", "url": "https://github.com/Franlinozz/Kerb", "directory": "packages/sdk" },
  "keywords": ["kerb", "x layer", "tokenized stocks", "xstocks", "credit", "risk", "okx"],
  "peerDependencies": { "viem": "^2.45.0" },
  "peerDependenciesMeta": { "viem": { "optional": true } }
}
JSON
cat > "$OUT/README.md" <<MD
# $NAME

Read Kerb Terms from anywhere: the market-time risk layer for tokenized stocks on X Layer.

\`\`\`ts
import { Kerb } from "$NAME";
const kerb = new Kerb();                 // X Layer mainnet, https://api.usekerb.xyz
const t = await kerb.terms("BRK.Bx");
if (!t.usable) throw new Error("no new exposure: terms stale or regime unsound");
\`\`\`

Docs: https://www.usekerb.xyz/docs · API: https://github.com/Franlinozz/Kerb/blob/main/docs/API.md · MIT
MD
if [ "${1:-}" = "--dry-run" ]; then (cd "$OUT" && npm pack --dry-run 2>&1 | tail -8); exit 0; fi
set -a; . /root/.kerb/npm.env; set +a
[ -n "${NPM_TOKEN:-}" ] || { echo "NPM_TOKEN missing in /root/.kerb/npm.env"; exit 1; }
printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$OUT/.npmrc"
(cd "$OUT" && npm publish --access public --userconfig "$OUT/.npmrc")
rm -f "$OUT/.npmrc"
echo "published $NAME@$VERSION"
