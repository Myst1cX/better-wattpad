// ==UserScript==
// @name         Better Wattpad --bit uneven story text align (not centre yet) but elements now resize onn window resize
// @namespace    https://greasyfork.org/
// @version      1.7.5.test.unclean
// @description  Clean Wattpad's interface, remove distractions, expand reading area for a smooth, AO3-style experience and allow chapter downloads. Combined the efforts of the "Simplified Wattpad" userscript by @sharkcat, the "Wattpad Width Fixer and Suggestions Hider" userscript by @You, and the "Download Wattpad Chapter" userscript by @Dj Dragkan with additional tweaks.
// @author       Myst1cX
// @match        https://www.wattpad.com/*
// @grant        none
// @license      GPL-3.0
// @require      https://code.jquery.com/jquery-3.7.0.min.js
// @homepageURL  https://github.com/Myst1cX/better-wattpad
// @supportURL   https://github.com/Myst1cX/better-wattpad/issues
// @updateURL    https://raw.githubusercontent.com/Myst1cX/better-wattpad/main/better-wattpad.user.js
// @downloadURL  https://raw.githubusercontent.com/Myst1cX/better-wattpad/main/better-wattpad.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ========== RESPONSIVE READING AREA ==========

    function insertOrUpdateCss(id, code) {
        let style = document.getElementById(id);
        if (!style) {
            style = document.createElement('style');
            style.type = 'text/css';
            style.id = id;
            document.head.appendChild(style);
        }
        style.innerHTML = code;
    }

    function updateReadingLayout() {
    const winW = window.innerWidth;
    let readingWidth = Math.max(540, Math.min(0.56 * winW, 900));
    insertOrUpdateCss('better-wattpad-responsive-style', `
        /* Center all .panel-reading.panel, regardless of nesting */
        .panel-reading.panel,
        .text-center.panel-reading.panel,
        .col-lg-offset-3.col-lg-6.col-md-offset-1.col-md-7.col-sm-offset-1.col-sm-10.col-xs-12 > .panel-reading.panel {
            margin-left: auto !important;
            margin-right: auto !important;
            width: ${readingWidth}px !important;
            max-width: 100vw !important;
            min-width: 340px !important;
            box-sizing: border-box !important;
            float: none !important;
            position: static !important;
            left: 20px !important;
            right: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
        }
        /* Neutralize Bootstrap offsets and paddings on ancestors */
        .col-lg-offset-3.col-lg-6.col-md-offset-1.col-md-7.col-sm-offset-1.col-sm-10.col-xs-12,
        #main-content,
        #container,
        .container,
        .row {
            margin-left: auto !important;
            margin-right: auto !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            float: none !important;
        }
        /* Center any direct child of the panel, including .page */
        .panel-reading.panel > * {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            box-sizing: border-box !important;
        }
        /* Center and constrain the .page content */
        .panel-reading.panel > .page {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        /* Center paragraphs themselves (for story text) */
        .panel-reading.panel > .page > p,
        .panel-reading.panel > .page > div > p {
            display: block !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 680px !important;
            text-align: left !important;
            padding-left: 1em !important;
            padding-right: 1em !important;
            box-sizing: border-box !important;
        }
        /* Center any other direct children (e.g., banners, empty screens) */
        .panel-reading.panel > *:not(.page) {
            margin-left: auto !important;
            margin-right: auto !important;
        }
    `);
}

    window.addEventListener('resize', updateReadingLayout);
    updateReadingLayout();
    const layoutObserver = new MutationObserver(updateReadingLayout);
    layoutObserver.observe(document.body, { childList: true, subtree: true });

    // ========== DOWNLOAD CHAPTER ==========

    function createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.id = 'scrollProgressBar';
        progressBar.style.position = 'fixed';
        progressBar.style.top = '0';
        progressBar.style.left = '0';
        progressBar.style.width = '0%';
        progressBar.style.height = '5px';
        progressBar.style.backgroundColor = '#FFA500';
        progressBar.style.zIndex = '10000';
        progressBar.style.transition = 'width 0.2s ease';
        document.body.appendChild(progressBar);
    }

    function updateProgressBar(percent) {
        const bar = document.getElementById('scrollProgressBar');
        if (bar) bar.style.width = `${Math.min(percent, 100)}%`;
    }

    function removeProgressBar() {
        const bar = document.getElementById('scrollProgressBar');
        if (bar) {
            bar.style.transition = 'opacity 0.5s ease';
            bar.style.opacity = 0;
            setTimeout(() => bar.remove(), 600);
        }
    }

    function downloadFile(text) {
        const bookTitle = document.querySelector('.h5.title')?.innerText.trim() || 'book';
        const chapterTitle = document.querySelector('.h2')?.innerText.trim() || 'chapter';
        const omitIllegalChars = str => str.replace(/[\/\\:\*\?"<>\|]/g, '').trim();
        const safeBookTitle = omitIllegalChars(bookTitle);
        const safeChapterTitle = omitIllegalChars(chapterTitle);
        const combinedTitle = `${safeBookTitle} - ${safeChapterTitle}`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${combinedTitle}.txt`;
        downloadLink.click();
        window.URL.revokeObjectURL(url);
    }

    async function fetchAllPages() {
        createProgressBar();
        const baseUrl = window.location.href.split('/page/')[0];
        let page = 1;
        let allText = '';
        let allParagraphs = [];
        while (true) {
            const url = page === 1 ? baseUrl : `${baseUrl}/page/${page}`;
            try {
                const response = await fetch(url);
                if (!response.ok) break;
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const paragraphs = Array.from(doc.querySelectorAll('p[data-p-id]'));
                if (paragraphs.length === 0) break;
                allParagraphs = allParagraphs.concat(paragraphs);
                paragraphs.forEach(p => allText += p.innerText + '\n');
                updateProgressBar((page / (page + 2)) * 100);
                page++;
            } catch (e) {
                console.error('Error fetching page:', e);
                break;
            }
        }
        updateProgressBar(100);
        setTimeout(() => {
            removeProgressBar();
            downloadFile(allText);
        }, 500);
    }

    function getChapterId() {
        const book = document.querySelector('.h5.title')?.innerText.trim() || 'book';
        const chapter = document.querySelector('.h2')?.innerText.trim() || 'chapter';
        return `bp_scroll_${book}__${chapter}`;
    }

    function saveScrollPosition() {
        const id = getChapterId();
        sessionStorage.setItem(id, window.scrollY);
    }

    function restoreScrollPosition() {
        const id = getChapterId();
        const pos = sessionStorage.getItem(id);
        if (pos !== null) {
            setTimeout(() => {
                window.scrollTo({ top: parseInt(pos, 10), behavior: 'smooth' });
            }, 400);
        }
    }

    function createDownloadChapterButton() {
        const tryPremiumButton = document.querySelector('.btn-primary.on-premium.try-premium');
        if (tryPremiumButton) {
            const computedStyles = window.getComputedStyle(tryPremiumButton);
            const width = computedStyles.width;
            const height = computedStyles.height;
            const downloadButton = document.createElement('button');
            downloadButton.innerText = 'DOWNLOAD CHAPTER';
            downloadButton.style.width = width;
            downloadButton.style.height = height;
            downloadButton.style.backgroundColor = '#FFA500';
            downloadButton.style.color = 'white';
            downloadButton.style.fontWeight = 'bold';
            downloadButton.style.border = 'none';
            downloadButton.style.borderRadius = computedStyles.borderRadius || '5px';
            downloadButton.style.cursor = 'pointer';
            downloadButton.style.boxSizing = 'border-box';
            downloadButton.style.overflow = 'hidden';
            downloadButton.style.whiteSpace = 'nowrap';
            downloadButton.style.marginTop = '6px';
            downloadButton.style.display = 'flex';
            downloadButton.style.alignItems = 'center';
            downloadButton.style.justifyContent = 'center';
            downloadButton.style.gap = '6px';
            downloadButton.style.fontSize = '13px';
            downloadButton.style.padding = computedStyles.padding || '6px 13px';
            const icon = document.createElement('img');
            icon.src = 'https://www.wattpad.com/apple-touch-icon-114x114-precomposed.png';
            icon.style.width = '16px';
            icon.style.height = '16px';
            downloadButton.textContent = '';
            downloadButton.appendChild(icon);
            downloadButton.appendChild(document.createTextNode('DOWNLOAD CHAPTER'));
            downloadButton.addEventListener('click', fetchAllPages);
            tryPremiumButton.replaceWith(downloadButton);
        } else {
            console.warn('Try Premium button not found.');
        }
    }

    window.addEventListener('load', () => {
        createDownloadChapterButton();
        restoreScrollPosition();
    });

    // ========== SIMPLIFIED WATTPAD ==========

    var userPreferenceAdditionalPaddingPX = "0";

    // Waits for a specific element to load, then runs the callback
    const waitForElement = (selector, callback, interval = 100, timeout = 10000) => {
        const startTime = Date.now();
        const check = () => {
            const el = document.querySelector(selector);
            if (el) {
                callback(el);
            } else if (Date.now() - startTime < timeout) {
                setTimeout(check, interval);
            }
        };
        check();
    };

    function insertCss(code) {
        var style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = code;
        document.head.appendChild(style);
    }

    waitForElement('#story-reading .page p', () => {
        const commentBubblePaddingWidth = window.getComputedStyle(
            document.querySelector('#story-reading .page p')
        ).getPropertyValue('padding-right').split("px")[0];
        insertCss('#sticky-end{width:auto;}');
        insertCss('.panel-reading{margin-left:auto !important;margin-right:auto !important;width:auto;}');
        insertCss('#story-reading .page p{margin-right:'+userPreferenceAdditionalPaddingPX+'px}');
        insertCss('.left-rail, .right-rail{display:none;}');
        insertCss('.modal-open{overflow:inherit;}');
    });

    const insertCSS = (css) => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    };

    insertCSS(`
        .youll-also-like,
        .recommendations,
        .new-stats__comments,
        .story-extras,
        .inline-recommendations,
        .story-info__social,
        .paid-story-label,
        .site-footer,
        .login-modal,
        .overlay,
        .recommendations-sidebar,
        .bottom-nav,
        .right-sidebar,
        .left-rail,
        .right-rail,
        .story__profile,
        .vote-button,
        #part-footer-actions,
        .comment-marker,
     /* .part-comments,   */
        #similar-stories.similar-stories,
        .similar-stories-footer,
        .hidden-sm.hidden-xs.vertical.share-tools,
     /* .on-comments.comments,   */
        .hidden-lg.author
        {
            display: none !important;
        }
        .panel-title
        {
            display: none !important;
        }

        .modal-open {
            overflow: inherit !important;
        }

        h1.h2 {
            margin: 5px 30px !important;
        }
        /* Remove Bootstrap offset from containers of .panel-reading, making them centered */
        .col-lg-offset-3.col-lg-6.col-md-offset-1.col-md-7.col-sm-offset-1.col-sm-10.col-xs-12 {
        float: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
        display: block !important;
        width: 100% !important;
        max-width: 900px !important;  /* or your desired max width */
        min-width: 340px !important;
        box-sizing: border-box !important;
        position: static !important;
        left: 0 !important;
        right: 0 !important;
        clear: both !important;
}
    `);

    function moveAuthorDetails() {
        const authorDeets = document.querySelector('.left-rail > #sticky-nav');
        const alreadyMoved = document.querySelector('header > #sticky-nav');
        if (authorDeets && !alreadyMoved) {
            const target = document.querySelector('header > .meta, header > .restart-part');
            if (target) {
                target.insertAdjacentElement('beforebegin', authorDeets);
                authorDeets.style.display = 'block';
                authorDeets.style.position = 'relative';
                authorDeets.style.width = '100%';
                authorDeets.style.marginBottom = '15px';
            }
        }
    }

    moveAuthorDetails();

    const authorObserverTarget = document.querySelector('#main-content') || document.body;
    if (authorObserverTarget) {
        const authorObserver = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    moveAuthorDetails();
                }
            }
        });
        authorObserver.observe(authorObserverTarget, { childList: true, subtree: true });
    }

    $(document).ready(function () {
        $("story-extras").remove();
        // $("on-comments.comments").remove();
        $("hidden-sm.hidden-xs.vertical.share-tools").remove();
        // $("span.comments.on-comments").remove();
        $("button.btn-no-background.comment-marker").remove();
        // $("div.row.part-content.part-comments").remove();
        $("#similar-stories.similar-stories").remove();
        $("div.container.similar-stories-container.similar-stories-footer").remove();
        $("#component-tagpagepaidstoriescontainer-tagpage-paid-stories-%2fstories%2ffantasy").remove();
    });

})();
