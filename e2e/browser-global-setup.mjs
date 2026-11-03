import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import { browserLaunchOptions, verifyBrowserSecurity } from "../scripts/browser-security.mjs";

export default async function browserGlobalSetup() {
	await verifyBrowserSecurity(chromium);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
	await verifyBrowserSecurity(chromium, { ...browserLaunchOptions, executablePath: undefined });
}
