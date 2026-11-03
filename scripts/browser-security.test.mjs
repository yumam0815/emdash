import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	browserLaunchOptions,
	launchPatchedChromium,
	requirePatchedChromium,
	verifyBrowserSecurity,
} from "./browser-security.mjs";

await test("accepts fixed Chromium and later builds", () => {
	for (const version of ["156.0.8078.73", "156.0.8078.80", "156.0.8079.0", "157.0.0.0"]) {
		assert.doesNotThrow(() => requirePatchedChromium(version));
	}
});

await test("rejects vulnerable or incomplete browser versions", () => {
	for (const version of [
		"149.0.7827.55",
		"155.0.9999.999",
		"156.0.8078.4",
		"156.0.8078.72",
		"156",
		"unknown",
	]) {
		assert.throws(() => requirePatchedChromium(version));
	}
});

await test("uses Chrome with its sandbox enabled", async () => {
	const browser = { version: () => "156.0.8078.80" };
	const chromium = {
		launch: async (options) => {
			assert.equal(options, browserLaunchOptions);
			assert.equal(options.channel, "chrome");
			assert.equal(options.chromiumSandbox, true);
			return browser;
		},
	};
	assert.equal(await launchPatchedChromium(chromium), browser);
});

await test("closes vulnerable Chromium before handing it to a caller", async () => {
	let closed = false;
	const browser = {
		version: () => "149.0.7827.55",
		close: async () => {
			closed = true;
		},
	};
	await assert.rejects(launchPatchedChromium({ launch: async () => browser }));
	assert.equal(closed, true);
});

await test("preflight closes the verified browser", async () => {
	let closed = false;
	const browser = {
		version: () => "156.0.8078.80",
		close: async () => {
			closed = true;
		},
	};
	await verifyBrowserSecurity({ launch: async () => browser });
	assert.equal(closed, true);
});

await test("installer refuses a failed checksum before extraction or privilege changes", () => {
	const directory = mkdtempSync(join(tmpdir(), "emdash-browser-install-"));
	try {
		const bins = join(directory, "bin");
		const environmentFile = join(directory, "environment");
		const marker = join(directory, "unsafe-side-effect");
		mkdirSync(bins);
		writeFileSync(environmentFile, "");
		const stub = (name, body) =>
			writeFileSync(join(bins, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
		stub("uname", 'if [ "$1" = -s ]; then echo Linux; else echo x86_64; fi');
		stub("curl", 'while [ "$1" != --output ]; do shift; done; printf invalid > "$2"');
		stub("sha256sum", "exit 1");
		stub("unzip", ': > "$SIDE_EFFECT_MARKER"');
		stub("sudo", ': > "$SIDE_EFFECT_MARKER"');
		const result = spawnSync(
			"/bin/bash",
			[fileURLToPath(new URL("./install-test-chrome.sh", import.meta.url))],
			{
				env: {
					PATH: `${bins}:/usr/bin:/bin`,
					HOME: directory,
					RUNNER_TEMP: directory,
					GITHUB_ENV: environmentFile,
					SIDE_EFFECT_MARKER: marker,
				},
				timeout: 10_000,
			},
		);
		assert.equal(result.status, 1);
		assert.equal(existsSync(marker), false);
		assert.equal(readFileSync(environmentFile, "utf8"), "");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
