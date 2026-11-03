import assert from "node:assert/strict";

const CHROMIUM_VERSION_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;

export const browserLaunchOptions = {
	channel: "chrome",
	chromiumSandbox: true,
	...(process.env.EMDASH_CHROMIUM_EXECUTABLE_PATH
		? { executablePath: process.env.EMDASH_CHROMIUM_EXECUTABLE_PATH }
		: {}),
};

export function requirePatchedChromium(version) {
	assert.match(version, CHROMIUM_VERSION_PATTERN, "Expected a complete Chromium version");
	const actual = version.split(".").map(Number);
	const minimum = [156, 0, 8078, 73];
	assert.ok(actual.every(Number.isSafeInteger), "Invalid Chromium version");
	const order = actual.reduce((result, value, index) => result || value - minimum[index], 0);
	assert.ok(order >= 0, `Chromium ${version} is below the security minimum 156.0.8078.73`);
}

export async function launchPatchedChromium(chromium, options = browserLaunchOptions) {
	const browser = await chromium.launch(options);
	try {
		requirePatchedChromium(browser.version());
		return browser;
	} catch (error) {
		await browser.close();
		throw error;
	}
}

export async function verifyBrowserSecurity(chromium, options = browserLaunchOptions) {
	const browser = await launchPatchedChromium(chromium, options);
	await browser.close();
}
