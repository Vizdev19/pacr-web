#!/usr/bin/env bash
# Checks for the static site (everything outside apps/), run by
# .github/workflows/site.yml and runnable locally: bash .github/scripts/check-site.sh
#
#  1. Every browser module (js/) and serverless function (api/) parses.
#     Each is copied to a .mjs first: `node --check file.js` on a file with
#     import/export exits 0 even when the file has a syntax error (Node's ESM
#     detection skips the check), while .mjs is always checked as a module.
#  2. vercel.json and the .well-known app-link files are valid JSON. A broken
#     vercel.json fails the deploy; broken app-link files silently stop links
#     opening the app.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0

count=0
while IFS= read -r f; do
  base="${f//\//__}.mjs"
  copy="$tmp/$base"
  cp "$f" "$copy"
  if ! node --check "$copy" 2>"$tmp/err"; then
    # Name the real file, not the temp copy (macOS puts /private in front of
    # the mktemp path in Node's message, so match on the copy's name).
    msg=$(sed "s#[^ ]*$base#$f#g" "$tmp/err" | head -6)
    echo "::error file=$f::Syntax error"
    echo "$msg"
    fail=1
  fi
  count=$((count + 1))
done < <(git ls-files 'js/*.js' 'js/**/*.js' 'api/*.mjs')
echo "Parsed $count JavaScript files"

for f in vercel.json .well-known/apple-app-site-association .well-known/assetlinks.json; do
  if ! node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$f" 2>"$tmp/err"; then
    echo "::error file=$f::Invalid JSON"
    head -6 "$tmp/err"
    fail=1
  fi
done
echo "Checked JSON config"

exit "$fail"
