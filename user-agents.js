"use strict";

const BROWSER_DATA = {
    windows: {
        platform: "Windows NT 10.0; Win64; x64",
        // Oct 2026: Chrome stable is 140-141. Keep 3 fresh versions.
        chromeVersions: ["141.0.0.0", "140.0.0.0", "139.0.0.0"],
        platformVersion: '"19.0.0"'
    },
    mac: {
        platform: "Macintosh; Intel Mac OS X 10_15_7",
        chromeVersions: ["141.0.0.0", "140.0.0.0", "139.0.0.0"],
        platformVersion: '"19.0.0"'
    },
    linux: {
        platform: "X11; Linux x86_64",
        chromeVersions: ["141.0.0.0", "140.0.0.0", "139.0.0.0"],
        // Chrome on Linux sends an empty Sec-CH-UA-Platform-Version.
        platformVersion: '""'
    }
};

const defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
// GoatBot compat: some old code uses utils.windowsUserAgent
const windowsUserAgent = defaultUserAgent;

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a realistic, randomized User-Agent string and related Sec-CH headers.
 * @returns {{userAgent: string, secChUa: string, secChUaFullVersionList: string, secChUaPlatform: string, secChUaPlatformVersion: string}}
 */
function randomUserAgent() {
    const os = getRandom(Object.keys(BROWSER_DATA));
    const data = BROWSER_DATA[os];
    const version = getRandom(data.chromeVersions);
    const majorVersion = version.split('.')[0];

    const userAgent = `Mozilla/5.0 (${data.platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    
    // Construct the Sec-CH-UA header
    const brands = [
        `"Not(A:Brand";v="99"`, // Updated brand grease
        `"Chromium";v="${majorVersion}"`,
        `"Google Chrome";v="${majorVersion}"`
    ];
    const secChUa = brands.join(', ');
    const secChUaFullVersionList = brands.map((b, i) => b.replace(/"$/, `.0.0.0"`)).join(', ');

    return {
        userAgent,
        secChUa,
        secChUaFullVersionList,
        secChUaPlatform: `"${os === 'windows' ? 'Windows' : os === 'mac' ? 'macOS' : 'Linux'}"`,
        secChUaPlatformVersion: data.platformVersion
    };
}

module.exports = {
    defaultUserAgent,
    windowsUserAgent,
    randomUserAgent
};
