#!/usr/bin/env bash
# Build the web app into a fresh release directory, check it, then swap it in.
#
#   scripts/deploy-web.sh staging            # builds main's HEAD, serves on 3301 (v2.usekerb.xyz)
#   scripts/deploy-web.sh live <git-ref>     # builds an explicit ref, serves on 3300 (usekerb.xyz)
#   scripts/deploy-web.sh rollback <target>  # points <target> back at its previous release
#
# A build never happens in a directory a live process serves from. Each release is its own
# git worktree under /root/kerb-deploy/<target>/releases/. The running process only moves
# when the new build has compiled AND answered on a spare port; a failed build leaves the
# running site untouched.
set -euo pipefail

REPO=/root/kerb
BASE=/root/kerb-deploy
KEEP=4

target=${1:?usage: deploy-web.sh staging|live <ref> | rollback staging|live}

case "$target" in
  staging) proc=kerb-web-v2; envfile=/root/.kerb/web-v2.env; ref=${2:-main} ;;
  live)    proc=kerb-web;    envfile=/root/.kerb/web.env;    ref=${2:?live needs an explicit git ref} ;;
  rollback)
    t=${2:?usage: deploy-web.sh rollback staging|live}
    [ "$t" = staging ] && p=kerb-web-v2 || p=kerb-web
    prev=$(readlink "$BASE/$t/previous" || true)
    [ -n "$prev" ] && [ -d "$prev" ] || { echo "no previous release for $t" >&2; exit 1; }
    cur=$(readlink "$BASE/$t/current")
    ln -sfn "$prev" "$BASE/$t/current"
    ln -sfn "$cur" "$BASE/$t/previous"
    pm2 restart "$p" --update-env >/dev/null
    echo "rolled $t back to $prev"
    exit 0 ;;
  *) echo "unknown target $target" >&2; exit 1 ;;
esac

sha=$(git -C "$REPO" rev-parse --short "$ref")
rel="$BASE/$target/releases/$(date -u +%Y%m%dT%H%M%SZ)-$sha"
mkdir -p "$BASE/$target/releases"

echo "== $target: building $ref ($sha) into $rel"
git -C "$REPO" worktree add --detach "$rel" "$sha" >/dev/null

cleanup_failed() { echo "!! build failed; $target is unchanged" >&2; git -C "$REPO" worktree remove --force "$rel" >/dev/null 2>&1 || true; }
trap cleanup_failed ERR

cd "$rel"
pnpm install --frozen-lockfile --filter "@kerb/web..." --prefer-offline >/dev/null || { echo "!! pnpm install failed (is the lockfile committed?)" >&2; false; }
set -a; . "$envfile"; set +a
pnpm --filter @kerb/web build

# Answer on a spare port before anything live moves.
port=$((PORT + 9))
( cd "$rel/apps/web" && PORT=$port node node_modules/next/dist/bin/next start -p "$port" >/dev/null 2>&1 ) &
cand=$!
ok=0
for _ in $(seq 1 40); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/")" = 200 ]; then ok=1; break; fi
  sleep 0.5
done
for path in /board /proof; do
  # A first request can race the server's warm-up; three tries before calling it broken.
  code=000
  for _ in 1 2 3; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port$path")
    [ "$code" = 200 ] && break
    sleep 1
  done
  [ "$code" = 200 ] || { echo "candidate $path answered $code" >&2; ok=0; }
done
css=$(curl -s "http://127.0.0.1:$port/" | grep -o '/_next/static/[^"]*\.css' | head -1 || true)
if [ -n "$css" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port$css")" != 200 ]; then
  echo "candidate stylesheet $css missing" >&2; ok=0
fi
pkill -P "$cand" >/dev/null 2>&1 || true; kill "$cand" >/dev/null 2>&1 || true
fuser -k "$port/tcp" >/dev/null 2>&1 || true
[ "$ok" = 1 ] || { false; }
trap - ERR

# Swap.
cur=$(readlink "$BASE/$target/current" || true)
[ -n "$cur" ] && ln -sfn "$cur" "$BASE/$target/previous"
ln -sfn "$rel" "$BASE/$target/current"
if pm2 describe "$proc" >/dev/null 2>&1; then
  pm2 restart "$proc" --update-env >/dev/null
else
  pm2 start "$REPO/ecosystem.config.cjs" --only "$proc" >/dev/null
fi
pm2 save >/dev/null

# Prune old releases, never the current or previous one.
keep_cur=$(readlink -f "$BASE/$target/current"); keep_prev=$(readlink -f "$BASE/$target/previous" || true)
ls -1dt "$BASE/$target/releases"/* | tail -n +$((KEEP + 1)) | while read -r old; do
  [ "$old" = "$keep_cur" ] || [ "$old" = "$keep_prev" ] || git -C "$REPO" worktree remove --force "$old" >/dev/null 2>&1 || true
done

echo "== $target now serves $sha from $rel (process $proc, port $PORT)"
