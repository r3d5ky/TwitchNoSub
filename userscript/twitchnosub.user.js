// ==UserScript==
// @name         TwitchNoSub
// @namespace    https://github.com/besuper/TwitchNoSub
// @version      1.0.4
// @description  Watch sub only VODs on Twitch
// @author       besuper
// @updateURL    https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @downloadURL  https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @icon         https://raw.githubusercontent.com/besuper/TwitchNoSub/master/assets/icons/icon.png
// @match        *://*.twitch.tv/*
// @run-at       document-end
// @grant        none

// ==/UserScript==
(function () {
    'use strict';

    // Set specific version here to use it instead of the latest, for example "1.34.1"
    const version_override = ""

    var isVariantA = false;

    const originalAppendChild = document.head.appendChild;

    document.head.appendChild = function (element) {
        if (element?.tagName === "SCRIPT") {
            if (element?.src?.includes("player-core-variant-a")) {
                isVariantA = true;
            }
        }

        return originalAppendChild.call(this, element);
    };

    const ivsPatchLinks = [
        "https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub/src/patch_amazonworker.js",
        "https://cdn.statically.io/gh/besuper/TwitchNoSub/master/src/patch_amazonworker.js",
        "https://raw.githubusercontent.com/besuper/TwitchNoSub/master/src/patch_amazonworker.js"
    ];

    const ivsCdnConfigs = [
        {
            url: "https://registry.npmjs.org/amazon-ivs-player/latest",
            extractVersion: (data) => data.version
        },
        {
            url: "https://data.jsdelivr.com/v1/packages/npm/amazon-ivs-player",
            extractVersion: (data) => data.tags.latest
        },
        {
            url: "https://unpkg.com/amazon-ivs-player/package.json",
            extractVersion: (data) => data.version
        }
    ];

    const ivsLinkTemplates = [
        "https://player.live-video.net/VERSION/amazon-ivs-worker.min.js",
        "https://cdn.jsdelivr.net/npm/amazon-ivs-player@VERSION/dist/assets/amazon-ivs-worker.min.js",
        "https://unpkg.com/amazon-ivs-player@VERSION/dist/assets/amazon-ivs-worker.min.js"
    ];

    async function getLatestIvsLink() {
        let ivsVersion = null;

        // Attempt to retrieve the version from one of the CDN configs
        for (const { url, extractVersion } of ivsCdnConfigs) {
            try {
                const response = await fetch(url, { method: "GET", redirect: 'follow' });
                if (!response.ok) {
                    throw new Error(`[TwitchNoSub] Network response for ${url} was not ok: ${response.statusText}`);
                }
                const data = await response.json();
                ivsVersion = extractVersion(data);

                if (version_override) {
                    ivsVersion = version_override;
                    console.debug(`[TwitchNoSub] Using override version ${ivsVersion}`);
                    break;
                }
                if (ivsVersion) {
                    console.debug(`[TwitchNoSub] Retrieved worker version ${ivsVersion} from ${url}`);
                    break;
                } else {
                    console.error(`[TwitchNoSub] Could not find version in response from ${url}`);
                }
            } catch (error) {
                console.error(`[TwitchNoSub] Error accessing CDN ${url}:`, error);
            }
        }

        if (!ivsVersion) {
            console.error("[TwitchNoSub] Failed to retrieve the version from all CDNs!");
            return null;
        }

        // Check each link template for an available .js file
        for (const template of ivsLinkTemplates) {
            const finalLink = template.replace('VERSION', ivsVersion);

            try {
                const fileResponse = await fetch(finalLink, { method: "HEAD" });
                if (fileResponse.ok) {
                    console.debug(`[TwitchNoSub] Link is accessible, downloading worker from ${finalLink}`);
                    return finalLink;
                } else {
                    console.warn(`[TwitchNoSub] Link ${finalLink} is unavailable, trying next CDN...`);
                }
            } catch (error) {
                console.error(`[TwitchNoSub] Error accessing link ${finalLink}:`, error);
            }
        }

        console.error("[TwitchNoSub] All links to worker are unavailable!");
        return null;
    }

    async function overrideWorker() {
        let ivsPatchLink = null;
        const ivsLink = await getLatestIvsLink();
        if (!ivsLink) {
            console.error('[TwitchNoSub] Failed to get latest IVS link!');
            return;
        }

        // Attempt to find an accessible patch link
        for (const link of ivsPatchLinks) {
            try {
                const fileResponse = await fetch(link, { method: "HEAD" });
                if (fileResponse.ok) {
                    console.debug(`[TwitchNoSub] Patch link accessible, downloading patch from ${link}`);
                    ivsPatchLink = link;
                    break;
                } else {
                    console.warn(`[TwitchNoSub] Patch link ${link} is unavailable, trying next link...`);
                }
            } catch (error) {
                console.error(`[TwitchNoSub] Error accessing patch link ${link}:`, error);
            }
        }

        if (!ivsPatchLink) {
            console.error("[TwitchNoSub] All patch links are unavailable!");
            return;
        }

        // Override the Worker to use the retrieved patch and IVS links
        const oldWorker = window.Worker;
        window.Worker = class extends oldWorker {
            constructor() {
                const blobContent = `importScripts('${ivsPatchLink}', '${ivsLink}');`;
                super(URL.createObjectURL(new Blob([blobContent], { type: 'application/javascript' })));

                this.addEventListener("message", (event) => {
                    const { data } = event;
                    if ((data.id === 1 || isVariantA) && data.type === 1) {
                        this.postMessage({ ...data, arg: [data.arg] });
                    }
                });
            }
        }
        console.log('[TwitchNoSub] Worker overridden successfully!');
    }

    overrideWorker();
})();