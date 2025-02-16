// ==UserScript==
// @name         TwitchNoSub
// @namespace    https://github.com/besuper/TwitchNoSub
// @version      1.1.1
// @description  Watch sub only VODs on Twitch
// @author       besuper
// @updateURL    https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @downloadURL  https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @icon         https://raw.githubusercontent.com/besuper/TwitchNoSub/master/assets/icons/icon.png
// @match        *://*.twitch.tv/*
// @run-at       document-end
// @inject-into  page
// @grant        none

// ==/UserScript==
(function () {
    'use strict';

    const ivsPatchLinks = [
        "https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub@master/src/patch_amazonworker.js",
        "https://cdn.statically.io/gh/besuper/TwitchNoSub/master/src/patch_amazonworker.js",
        "https://raw.githubusercontent.com/besuper/TwitchNoSub/master/src/patch_amazonworker.js"
    ];

    // From vaft script (https://github.com/pixeltris/TwitchAdSolutions/blob/master/vaft/vaft.user.js#L299)
    function getWasmWorkerJs(twitchBlobUrl) {
        var req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.overrideMimeType("text/javascript");
        req.send();
        return req.responseText;
    }

    async function overrideWorker() {
        let ivsPatchLink = null;
        // Attempt to find an accessible patch link
        for (const link of ivsPatchLinks) {
            try {
                const fileResponse = await fetch(link, { method: "HEAD" });
                if (fileResponse.ok) {
                    ivsPatchLink = link;
                    break;
                }
            } catch (error) {
                console.error(`[TwitchNoSub] Error accessing patch link ${link}:`, error);
            }
        }

        if (!ivsPatchLink) {
            console.error("[TwitchNoSub] All patch links are unavailable!");
            return;
        }
        console.debug(`[TwitchNoSub] Loading patch from ${link}`);

        const oldWorker = window.Worker;

        window.Worker = class extends oldWorker {
            constructor(twitchBlobUrl) {
                var workerString = getWasmWorkerJs(`${twitchBlobUrl.replaceAll("'", "%27")}`);

                const blobUrl = URL.createObjectURL(new Blob([`
                    importScripts(
                        '${ivsPatchLink}',
                    );
                    ${workerString}
                `]));
                super(blobUrl);
            }
        }
        console.log('[TwitchNoSub] Worker overridden successfully!');
    }
    overrideWorker();
})();