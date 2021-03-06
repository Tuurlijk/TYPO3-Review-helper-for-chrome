/*jshint bitwise:true, curly:true, eqeqeq:true, forin:true, globalstrict: true,
 latedef:true, noarg:true, noempty:true, nonew:true, undef:true, maxlen:256,
 strict:true, trailing:true, boss:true, browser:true, devel:true, jquery:true */
/*global browser, chrome, console, alert, isValidUrl, TYPO3Review_1447791881 */

'use strict';

if (typeof browser === 'undefined') {
    var browser = chrome;
}

/**
 * Listen for changes to tabs
 *
 * @since 1.0.0
 */
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {

    /**
     * Update the addressbar icon
     *
     * @since 1.0.0
     *
     * @param status
     * @param tabId
     */
    function updateIcon(status, tabId) {
        // Figure the correct title/image with the given state
        var title = 'Please navigate to an issue',
            image = 'ToolbarIconDisabled';

        if (status === 1) {
            title = 'Review this change';
            image = 'ToolbarIcon';
        }

        // Update title
        browser.pageAction.setTitle({
            tabId: tabId,
            title: title
        });

        // Update image
        browser.pageAction.setIcon({
            tabId: tabId,
            path: {
                '19': '/Resources/Icons/' + image + '19.png',
                '38': '/Resources/Icons/' + image + '38.png'
            }
        });
    }

    // We only react on a complete load of a http(s) page,
    // only then we're sure the Content.js is loaded.
    if (changeInfo.status !== 'complete' || tab.url.indexOf('http') !== 0) {
        return;
    }

    // Prepare some variables
    var forgerUrl = 'https://forger.typo3.org/',
        gerritUrl = 'https://review.typo3.org/',
        stashUrl = 'https://stash.maxserv.com/',
        index,
        parser,
        hashParts,
        issueNumber,
        pathSegments;

    // Check if localStorage is available and get the settings out of it
    if (localStorage) {
        if (localStorage.forgerUrl) {
            forgerUrl = localStorage.forgerUrl;
        }
        if (localStorage.gerritUrl) {
            gerritUrl = localStorage.gerritUrl;
        }
        if (localStorage.stashUrl) {
            stashUrl = localStorage.stashUrl;
        }
    }

    // Add content buttons if we are on a forger url with review links
    if (tab.url.startsWith(forgerUrl)) {
        parser = document.createElement('a');
        parser.href = tab.url;
        if (parser.pathname.startsWith('/gerrit/')) {
            browser.tabs.insertCSS(tab.id, {
                file: '/Resources/CSS/ContentLight.css'
            });

            browser.tabs.sendMessage(
                tab.id,
                {
                    cmd: 'addButtons',
                    gerritUrl: gerritUrl
                }
            );
        }
    }

    // Show icon if we are on a gerritUrl
    if (tab.url.startsWith(gerritUrl)) {
        // Show the pageAction
        browser.pageAction.show(tabId);

        parser = document.createElement('a');
        parser.href = tab.url;
        if (parser.hash.startsWith('#/c/')) {
            hashParts = parser.hash.split('/');

            if (hashParts.length > 2) {
                hashParts.shift();
                hashParts.shift();
                issueNumber = hashParts.shift();
            }

            if (issueNumber !== undefined) {
                updateIcon(1, tabId);
            }
        } else {
            updateIcon(0, tabId);
        }
    }

    // Show icon if we are on a stashUrl
    if (tab.url.startsWith(stashUrl)) {
        // Show the pageAction
        browser.pageAction.show(tabId);

        parser = document.createElement('a');
        parser.href = tab.url;
        if (parser.pathname.indexOf('\/pull-requests\/') > -1) {
            pathSegments = parser.pathname.split('/').reverse();

            for (index = 0; index < pathSegments.length; index = index + 1) {
                issueNumber = pathSegments[index];
                issueNumber = parseInt(issueNumber, 10);
                if ((typeof issueNumber === 'number') && (issueNumber % 1 === 0) && issueNumber > 0) {
                    break;
                }
            }

            if (issueNumber !== undefined) {
                updateIcon(1, tabId);
            }
        } else {
            updateIcon(0, tabId);
        }
    }

});

/**
 * Catch ERR_INSECURE_RESPONSE errors from *.typo3.org requests
 *
 * This allows us to instruct the user to accept the snakeoil certificate on
 * the local.typo3.org machine.
 *
 * @since 1.0.0
 */
browser.webRequest.onErrorOccurred.addListener(function(details) {
    'use strict';
    var i,
        views;
    if (details.error === 'net::ERR_INSECURE_RESPONSE') {
        if (details.tabId > 0) {
            browser.tabs.sendMessage(
                details.tabId,
                {
                    cmd: 'certificateFailure',
                    details: details
                }
            );
        } else {
            views = browser.extension.getViews({type: 'popup'});
            for (i = 0; i < views.length; i = i + 1) {
                TYPO3Review_1447791881.addStatusMessage(browser.i18n.getMessage('certificateFailure'), 'error', views[i].document);
            }
        }
    }
    if (details.error === 'net::ERR_ADDRESS_UNREACHABLE') {
        if (details.tabId > 0) {
            browser.tabs.sendMessage(
                details.tabId,
                {
                    cmd: 'reviewSiteUnavailable',
                    details: details
                }
            );
        } else {
            views = browser.extension.getViews({type: 'popup'});
            for (i = 0; i < views.length; i = i + 1) {
                TYPO3Review_1447791881.addStatusMessage(browser.i18n.getMessage('reviewSiteUnavailable'), 'error', views[i].document);
            }
        }
    }

}, {
    urls: ['*://*.local.typo3.org/*'],
    types: ['xmlhttprequest']
});

/**
 * Handles messages from other extension parts to content script
 *
 * @since 1.0.0
 *
 * @param request
 * @param sender
 * @param sendResponse
 */
browser.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        'use strict';
        var response;
        switch (request.cmd) {
            case 'getActiveTabId':
                if (request.from === 'content') {
                    sendResponse(sender.tab.index);
                }
                break;
            case 'openTab':
                if (request.from === 'library') {
                    browser.tabs.create({
                        'url': request.url,
                        'index': request.index,
                        'active': false
                    });
                    response = 'ok';
                    sendResponse(response);
                }
                break;
        }
    }
);
