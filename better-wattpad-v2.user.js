// ==UserScript==
// @name         Better Wattpad+ v2
// @namespace    https://greasyfork.org/
// @version      2.0.0
// @description  Clean Wattpad's interface, remove distractions, expand reading area for a smooth, AO3-style experience and allow chapter downloads. Combined the efforts of the "Simplified Wattpad" userscript by @sharkcat, the "Wattpad Width Fixer and Suggestions Hider" userscript by @You, and the "Download Wattpad Chapter" userscript by @Dj Dragkan with additional tweaks.
// @author       Myst1cX
// @match        https://www.wattpad.com/*
// @grant        none
// @license      GPL-3.0
// @require      https://code.jquery.com/jquery-3.7.0.min.js
// @homepageURL  https://github.com/Myst1cX/better-wattpad
// @supportURL   https://github.com/Myst1cX/better-wattpad/issues
// @updateURL    https://raw.githubusercontent.com/Myst1cX/better-wattpad/main/better-wattpad-v2.user.js
// @downloadURL  https://raw.githubusercontent.com/Myst1cX/better-wattpad/main/better-wattpad-v2.user.js
// ==/UserScript==


/* the Download Wattpad Chapter userscript (modified) */

// @description  Downloaded chapters follow the naming scheme: "Book Title - Chapter Title".
// @downloadURL  https://update.greasyfork.org/scripts/491126/Download%20Wattpad%20Chapter.user.js
// @updateURL    https://update.greasyfork.org/scripts/491126/Download%20Wattpad%20Chapter.meta.js


(function () {
    'use strict';

     // ========== RESPONSIVE READING AREA ==========

// Replace all .meta with a .restart-part.on-navigate, preserving content and copying computed style for visibility.
    function copyComputedStyle(src, dest) {
        const computed = window.getComputedStyle(src);
        for (let key of computed) {
            dest.style.setProperty(key, computed.getPropertyValue(key), computed.getPropertyPriority(key));
        }
    }
    function fullyReplaceMetaWithRestartPart() {
        document.querySelectorAll('.text-center.panel-reading.panel > .meta').forEach(meta => {
            if (meta.dataset.replacedWithRestart) return;
            const restart = document.createElement('div');
            restart.className = 'restart-part on-navigate'; // always this order!
            restart.innerHTML = meta.innerHTML;
            copyComputedStyle(meta, restart); // ensures visibility
            restart.dataset.replacedFromMeta = "1";
            meta.dataset.replacedWithRestart = "1";
            meta.parentNode.replaceChild(restart, meta);
        });
    }
    fullyReplaceMetaWithRestartPart();
    const metaReplaceObserver = new MutationObserver(fullyReplaceMetaWithRestartPart);
    metaReplaceObserver.observe(document.body, { childList: true, subtree: true });

    // Center and expand the .restart-part.on-navigate
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
    let readingWidth = 578;
    // Find both possible restart-part orders
    const restartA = document.querySelector('.panel-reading.panel > .restart-part.on-navigate');
    const restartB = document.querySelector('.panel-reading.panel > .on-navigate.restart-part');
    let stickWidth = readingWidth; // fallback if none present

    if (restartA && restartA.offsetWidth) {
        stickWidth = restartA.offsetWidth;
    } else if (restartB && restartB.offsetWidth) {
        stickWidth = restartB.offsetWidth;
    }

    insertOrUpdateCss('better-wattpad-responsive-style', `
        .panel-reading {
            margin-left: auto !important;
            margin-right: auto !important;
            width: ${readingWidth}px !important;
            max-width: 100vw !important;
            min-width: 340px !important;
            box-sizing: border-box !important;
            float: none !important;
            position: static !important;
            left: 0 !important;
            right: 0 !important;
        }
        #story-reading .page p {
            width: ${stickWidth}px !important;
            max-width: 100vw !important;
            min-width: 200px !important;
            margin-left: auto !important;
            margin-right: auto !important;
            box-sizing: border-box !important;
            word-break: break-word !important;
            display: block !important;
        }
        .restart-part.on-navigate,
        .on-navigate.restart-part {
    margin-left: auto !important;
    margin-right: auto !important;
    display: block !important;
    text-align: center !important;
    float: none !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    max-width: 100vw !important;
    min-width: 340px !important;
    box-sizing: border-box !important;
}
        #sticky-end {
            width: auto !important;
        }
    `);
}

    window.addEventListener('resize', updateReadingLayout);
    updateReadingLayout();
    const layoutObserver = new MutationObserver(updateReadingLayout);
    layoutObserver.observe(document.body, { childList: true, subtree: true });

    // ========== DOWNLOAD CHAPTER ==========

    // Function to create and manage the download progress bar at the top of the screen
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

    // Updates the width of the progress bar based on percentage
    function updateProgressBar(percent) {
        const bar = document.getElementById('scrollProgressBar');
        if (bar) bar.style.width = `${Math.min(percent, 100)}%`;
    }

    // Removes the progress bar with a fade-out effect
    function removeProgressBar() {
        const bar = document.getElementById('scrollProgressBar');
        if (bar) {
            bar.style.transition = 'opacity 0.5s ease';
            bar.style.opacity = 0;
            setTimeout(() => bar.remove(), 600); // Remove after fade
        }
    }

    // Downloads a text file with the chapter's content
    function downloadFile(text) {
        const bookTitle = document.querySelector('.h5.title')?.innerText.trim() || 'book';
        const chapterTitle = document.querySelector('.h2')?.innerText.trim() || 'chapter';

        // Remove illegal characters from file names
        const omitIllegalChars = str => str.replace(/[\/\\:\*\?"<>\|]/g, '').trim();

        const safeBookTitle = omitIllegalChars(bookTitle);
        const safeChapterTitle = omitIllegalChars(chapterTitle);
        const combinedTitle = `${safeBookTitle} - ${safeChapterTitle}`;

        // Create and trigger a download link
        const blob = new Blob([text], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);

        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${combinedTitle}.txt`;
        downloadLink.click();

        // Revoke the object URL to free memory
        window.URL.revokeObjectURL(url);
    }

    // Function to fetch all pages of the chapter
    async function fetchAllPages() {
        createProgressBar(); // Show progress bar
        const baseUrl = window.location.href.split('/page/')[0];
        let page = 1;
        let allText = '';
        let allParagraphs = [];

        // Loop through all pages of the chapter
        while (true) {
            const url = page === 1 ? baseUrl : `${baseUrl}/page/${page}`;
            try {
                const response = await fetch(url);
                if (!response.ok) break;
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Extract paragraphs with a specific data attribute
                const paragraphs = Array.from(doc.querySelectorAll('p[data-p-id]'));

                if (paragraphs.length === 0) break;
                allParagraphs = allParagraphs.concat(paragraphs);
                paragraphs.forEach(p => allText += p.innerText + '\n');

                // Update progress bar based on page count
                updateProgressBar((page / (page + 2)) * 100); // Slightly more accurate
                page++;
            } catch (e) {
                console.error('Error fetching page:', e);
                break;
            }
        }

        // Finalize progress bar and start download
        updateProgressBar(100);
        setTimeout(() => {
            removeProgressBar();
            downloadFile(allText);
        }, 500);
    }

    // Function to save and restore scroll position
    function getChapterId() {
        const book = document.querySelector('.h5.title')?.innerText.trim() || 'book';
        const chapter = document.querySelector('.h2')?.innerText.trim() || 'chapter';
        return `bp_scroll_${book}__${chapter}`;
    }

    // Saves the scroll position in sessionStorage
    function saveScrollPosition() {
        const id = getChapterId();
        sessionStorage.setItem(id, window.scrollY);
    }

    // Restores scroll position on reload
    function restoreScrollPosition() {
        const id = getChapterId();
        const pos = sessionStorage.getItem(id);
        if (pos !== null) {
            setTimeout(() => {
                window.scrollTo({ top: parseInt(pos, 10), behavior: 'smooth' });
            }, 400);
        }
    }

    // Create the download button
    function createDownloadChapterButton() {
    const tryPremiumButton = document.querySelector('.btn-primary.on-premium.try-premium');

    if (tryPremiumButton) {
        const computedStyles = window.getComputedStyle(tryPremiumButton);
        const width = computedStyles.width;
        const height = computedStyles.height;

        const downloadButton = document.createElement('button');
        downloadButton.innerText = 'DOWNLOAD CHAPTER';

        // Match dimensions
        downloadButton.style.width = width;
        downloadButton.style.height = height;

        // Core styles
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


        // Flexbox for horizontal alignment
        downloadButton.style.display = 'flex';
        downloadButton.style.alignItems = 'center';
        downloadButton.style.justifyContent = 'center';
        downloadButton.style.gap = '6px';

        // Smaller font size
        downloadButton.style.fontSize = '13px';
        downloadButton.style.padding = computedStyles.padding || '6px 13px';

        const icon = document.createElement('img');
        icon.src = 'https://www.wattpad.com/apple-touch-icon-114x114-precomposed.png';
        icon.style.width = '16px';
        icon.style.height = '16px';

        // Add icon before text
        downloadButton.textContent = ''; // Clear existing text
        downloadButton.appendChild(icon);
        downloadButton.appendChild(document.createTextNode('DOWNLOAD CHAPTER'));

        downloadButton.addEventListener('click', fetchAllPages);

        tryPremiumButton.replaceWith(downloadButton);
    } else {
        console.warn('Try Premium button not found.');
    }
}




// Call the function after the page has fully loaded
window.addEventListener('load', () => {
    createDownloadChapterButton();
    restoreScrollPosition(); // If you have a function to restore scroll position
});

})();

   // ========== SIMPLIFIED WATTPAD ========== //

/* the Better Wattpad userscript (combination of the "Simplified Wattpad" userscript by @sharkcat and the "Wattpad Width Fixer and Suggestions Hider" userscript by @You with additional tweaks) */

(function() {
    'use strict';

    var userPreferenceAdditionalPaddingPX = "0"; // Optional additional padding on the right margin

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


    // Injects CSS into the page
    function insertCss(code) {
        var style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = code;
        document.head.appendChild(style);
    }

    // Wait until the paragraph element is available to measure padding
    waitForElement('#story-reading .page p', () => {
        const commentBubblePaddingWidth = window.getComputedStyle(
            document.querySelector('#story-reading .page p')
        ).getPropertyValue('padding-right').split("px")[0];

        insertCss('#sticky-end{width:auto;}'); // Adjust bottom bar width
        insertCss('.panel-reading{margin-left:'+(parseInt(commentBubblePaddingWidth,10)+parseInt(userPreferenceAdditionalPaddingPX,10))+'px;width:auto;}'); // Adjust reading panel margins
        insertCss('#story-reading .page p{margin-right:'+userPreferenceAdditionalPaddingPX+'px}'); // Adjust text paragraph margin
        insertCss('.left-rail, .right-rail{display:none;}'); // Hide left and right sidebars
        insertCss('.modal-open{overflow:inherit;}'); // Allow scroll when modal is open
    });


    // Helper to inject full CSS block
    const insertCSS = (css) => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    };

    // Bulk CSS removal for distractions
    insertCSS(`
        .youll-also-like,                                /* Removes the -You’ll also like- section */
        .recommendations,                                /* Removes the recommended stories */
        .new-stats__comments,                            /* Removes the new comment stats */
        .story-extras,                                   /* Remove the empty space between the "Follow" button and the header's line. */
        .inline-recommendations,                         /* Removes the inline story recommendations */
        .story-info__social,                             /* Removes the share/social buttons */
        .paid-story-label,                               /* Removes the label for paid stories */
        .site-footer,                                    /* Removes the site footer */
        .login-modal,                                    /* Removes the login page. To sign in, disable the userscript first or comment the line using // in front. Once logged in, uncomment the line. */
        .overlay,                                        /* Removes the generic overlay */
        .recommendations-sidebar,                        /* Removes the sidebar recommendations */
        .bottom-nav,                                     /* Removes the bottom navigation bar */
        .right-sidebar,                                  /* Removes the right sidebar content */
        .left-rail,                                      /* Removes the left rail/sidebar */
        .right-rail,                                     /* Removes the right rail/sidebar */
        .story__profile,                                 /* Removes the author's tiny profile box */
        .vote-button,                                    /* Removes the vote button */
        #part-footer-actions,                            /* Removes the footer buttons such as comment/vote */
        .comment-marker,                                 /* Removes the inline comment markers */
     /* .part-comments,   */                             /* Removes the comment section */
        #similar-stories.similar-stories,                /* Removes the similar stories box */
        .similar-stories-footer,                         /* Removes the footer under similar stories */
        .hidden-sm.hidden-xs.vertical.share-tools,       /* Removes the share menu with floating social tools */
     /* .on-comments.comments,   */                      /* Removes the comment icon under chapter name */
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
            margin: 5px 30px !important;  /* Tweak title spacing */
        }
        .col-lg-offset-3.col-lg-6.col-md-offset-1.col-md-7.col-sm-offset-1.col-sm-10.col-xs-12 {  /* Centers the author panel with profile icon, chapter name and follow button */
        float: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
        display: block !important;
        width: 100% !important;
        max-width: 900px !important;
        min-width: 340px !important;
        box-sizing: border-box !important;
        position: static !important;
        left: 0 !important;
        right: 0 !important;
        clear: both !important;
        }
    `);

    // Move author info box to top of page
    function moveAuthorDetails() {
        const authorDeets = document.querySelector('.left-rail > #sticky-nav'); // Original author panel
        const alreadyMoved = document.querySelector('header > #sticky-nav');   // Prevent duplicate move

        if (authorDeets && !alreadyMoved) {
            const target = document.querySelector('header > .meta, header > .restart-part'); // Where to insert
            if (target) {
                target.insertAdjacentElement('beforebegin', authorDeets);
                authorDeets.style.display = 'block';
                authorDeets.style.position = 'relative';
                authorDeets.style.width = '100%';
                authorDeets.style.marginBottom = '15px';
            }
        }
    }

    moveAuthorDetails(); // Initial move

    // Re-run when DOM changes (e.g. new chapter loads)
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                moveAuthorDetails();
            }
        }
    });

    const targetNode = document.querySelector('#main-content') || document.body;
    if (targetNode) {
        observer.observe(targetNode, { childList: true, subtree: true });
    }

    // jQuery DOM cleanup when document is ready
    $(document).ready(function () {
        $("story-extras").remove(); // Removes the empty space between the "Follow" button and the header's line.
     // $("on-comments.comments").remove(); // Removes the comment icon under chapter name
        $("hidden-sm.hidden-xs.vertical.share-tools").remove(); // Removes the share menu with floating social tools
     // $("span.comments.on-comments").remove(); // Removes the comment icon under chapter name
        $("button.btn-no-background.comment-marker").remove(); // Removes inline comment buttons
     // $("div.row.part-content.part-comments").remove(); // Removes the comment section
        $("#similar-stories.similar-stories").remove(); // Removes similar stories box
        $("div.container.similar-stories-container.similar-stories-footer").remove(); // Removes similar stories footer
        $("#component-tagpagepaidstoriescontainer-tagpage-paid-stories-%2fstories%2ffantasy").remove(); // Removes paid stories recommendations
    });

})();
