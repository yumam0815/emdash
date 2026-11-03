#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]]
: "${RUNNER_TEMP:?RUNNER_TEMP is required}" "${GITHUB_ENV:?GITHUB_ENV is required}"

version=156.0.8078.80
sha256=b711c720f774be355197f32edf37e0651418ba036d92446ee2da19ac017540a7
directory="$(mktemp -d "${RUNNER_TEMP}/emdash-chrome.XXXXXX")"
archive="${directory}/chrome-linux64.zip"
curl --fail --location --retry 2 --proto '=https' --tlsv1.2 --max-time 120 --max-filesize 250000000 \
	"https://storage.googleapis.com/chrome-for-testing-public/${version}/linux64/chrome-linux64.zip" \
	--output "$archive"
printf '%s  %s\n' "$sha256" "$archive" | sha256sum --check --status
unzip -q "$archive" -d "$directory"

# The setuid helper keeps Chromium sandboxing available on restricted CI kernels.
sandbox="${directory}/chrome-linux64/chrome_sandbox"
sudo chown root:root "$sandbox"
sudo chmod 4755 "$sandbox"
printf 'EMDASH_CHROMIUM_EXECUTABLE_PATH=%s\n' "${directory}/chrome-linux64/chrome" >> "$GITHUB_ENV"
printf 'CHROME_DEVEL_SANDBOX=%s\n' "$sandbox" >> "$GITHUB_ENV"
