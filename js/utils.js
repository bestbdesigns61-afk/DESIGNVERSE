/* =========================================================
   DESIGNVERSE
   utils.js
   Shared Utility Library
   ========================================================= */

"use strict";


/* =========================================================
   1. DESIGNVERSE UTILITIES
   ========================================================= */

const DVUtils = {


    /* =====================================================
       1. ID GENERATOR
       ===================================================== */

    generateId(prefix = "dv") {

        const random =
            Math.random()
                .toString(36)
                .substring(2, 10);

        return `${prefix}_${Date.now()}_${random}`;
    },


    /* =====================================================
       2. RANDOM STRING
       ===================================================== */

    randomString(length = 12) {

        const characters =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            "abcdefghijklmnopqrstuvwxyz" +
            "0123456789";

        let result = "";

        for (let i = 0; i < length; i++) {

            result +=
                characters.charAt(
                    Math.floor(
                        Math.random() *
                        characters.length
                    )
                );
        }

        return result;
    },


    /* =====================================================
       3. DEBOUNCE
       ===================================================== */

    debounce(callback, delay = 250) {

        let timeout;

        return (...args) => {

            clearTimeout(timeout);

            timeout = setTimeout(
                () => {
                    callback(...args);
                },
                delay
            );
        };
    },


    /* =====================================================
       4. THROTTLE
       ===================================================== */

    throttle(callback, limit = 100) {

        let waiting = false;

        return (...args) => {

            if (waiting) return;

            callback(...args);

            waiting = true;

            setTimeout(
                () => {
                    waiting = false;
                },
                limit
            );
        };
    },


    /* =====================================================
       5. NUMBER FORMATTING
       ===================================================== */

    formatNumber(
        number,
        options = {}
    ) {

        const defaults = {
            maximumFractionDigits: 0
        };

        return new Intl.NumberFormat(
            "en-US",
            {
                ...defaults,
                ...options
            }
        ).format(
            Number(number) || 0
        );
    },


    /* =====================================================
       6. COMPACT NUMBER
       Example:
       1200 → 1.2K
       1500000 → 1.5M
       ===================================================== */

    formatCompactNumber(number) {

        const value =
            Number(number) || 0;

        return new Intl.NumberFormat(
            "en-US",
            {
                notation: "compact",
                maximumFractionDigits: 1
            }
        ).format(value);
    },


    /* =====================================================
       7. PERCENTAGE
       ===================================================== */

    formatPercentage(
        value,
        decimals = 0
    ) {

        const number =
            Number(value) || 0;

        return `${number.toFixed(decimals)}%`;
    },


    /* =====================================================
       8. DATE FORMATTING
       ===================================================== */

    formatDate(
        date,
        options = {}
    ) {

        if (!date) return "";

        const defaults = {

            year: "numeric",
            month: "short",
            day: "numeric"

        };

        try {

            return new Intl.DateTimeFormat(
                "en-US",
                {
                    ...defaults,
                    ...options
                }
            ).format(
                new Date(date)
            );

        } catch {

            return "";
        }
    },


    /* =====================================================
       9. TIME FORMATTING
       ===================================================== */

    formatTime(date) {

        if (!date) return "";

        try {

            return new Intl.DateTimeFormat(
                "en-US",
                {
                    hour: "numeric",
                    minute: "2-digit"
                }
            ).format(
                new Date(date)
            );

        } catch {

            return "";
        }
    },


    /* =====================================================
       10. RELATIVE TIME
       Example:
       "Just now"
       "5 minutes ago"
       "2 days ago"
       ===================================================== */

    timeAgo(date) {

        const timestamp =
            new Date(date).getTime();

        if (Number.isNaN(timestamp)) {
            return "";
        }

        const seconds =
            Math.floor(
                (Date.now() - timestamp) /
                1000
            );

        if (seconds < 10) {
            return "Just now";
        }

        if (seconds < 60) {
            return `${seconds}s ago`;
        }

        const minutes =
            Math.floor(seconds / 60);

        if (minutes < 60) {
            return `${minutes}m ago`;
        }

        const hours =
            Math.floor(minutes / 60);

        if (hours < 24) {
            return `${hours}h ago`;
        }

        const days =
            Math.floor(hours / 24);

        if (days < 7) {
            return `${days}d ago`;
        }

        const weeks =
            Math.floor(days / 7);

        if (weeks < 5) {
            return `${weeks}w ago`;
        }

        return this.formatDate(date);
    },


    /* =====================================================
       11. CAPITALIZE
       ===================================================== */

    capitalize(text) {

        if (!text) return "";

        const value =
            String(text);

        return (
            value.charAt(0).toUpperCase() +
            value.slice(1)
        );
    },


    /* =====================================================
       12. TITLE CASE
       ===================================================== */

    titleCase(text) {

        if (!text) return "";

        return String(text)
            .toLowerCase()
            .split(" ")
            .map(
                word =>
                    this.capitalize(word)
            )
            .join(" ");
    },


    /* =====================================================
       13. SLUGIFY
       ===================================================== */

    slugify(text) {

        if (!text) return "";

        return String(text)
            .toLowerCase()
            .trim()
            .replace(
                /[^\w\s-]/g,
                ""
            )
            .replace(
                /[\s_-]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                "");
    },


    /* =====================================================
       14. TRUNCATE TEXT
       ===================================================== */

    truncate(
        text,
        maxLength = 100
    ) {

        if (!text) return "";

        const value =
            String(text);

        if (
            value.length <=
            maxLength
        ) {
            return value;
        }

        return (
            value.substring(
                0,
                maxLength
            ).trimEnd() +
            "..."
        );
    },


    /* =====================================================
       15. HTML ESCAPE
       ===================================================== */

    escapeHTML(value) {

        const element =
            document.createElement("div");

        element.textContent =
            String(value ?? "");

        return element.innerHTML;
    },


    /* =====================================================
       16. HTML SANITIZATION
       ===================================================== */

    sanitizeHTML(html) {

        const template =
            document.createElement(
                "template"
            );

        template.innerHTML =
            String(html ?? "");

        const forbidden =
            template.content.querySelectorAll(
                "script, iframe, object, embed, style"
            );

        forbidden.forEach(
            element => element.remove()
        );

        template.content
            .querySelectorAll("*")
            .forEach(element => {

                [...element.attributes]
                    .forEach(attribute => {

                        if (
                            attribute.name
                                .toLowerCase()
                                .startsWith("on")
                        ) {

                            element.removeAttribute(
                                attribute.name
                            );
                        }

                        if (
                            attribute.name
                                .toLowerCase() ===
                            "src"
                        ) {

                            const value =
                                attribute.value
                                    .trim()
                                    .toLowerCase();

                            if (
                                value.startsWith(
                                    "javascript:"
                                )
                            ) {

                                element.removeAttribute(
                                    attribute.name
                                );
                            }
                        }
                    });
            });

        return template.innerHTML;
    },


    /* =====================================================
       17. EMAIL VALIDATION
       ===================================================== */

    isValidEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(
                String(email)
                    .trim()
                    .toLowerCase()
            );
    },


    /* =====================================================
       18. PASSWORD STRENGTH
       ===================================================== */

    getPasswordStrength(password) {

        const value =
            String(password || "");

        let score = 0;

        if (value.length >= 8) {
            score++;
        }

        if (/[A-Z]/.test(value)) {
            score++;
        }

        if (/[a-z]/.test(value)) {
            score++;
        }

        if (/[0-9]/.test(value)) {
            score++;
        }

        if (/[^A-Za-z0-9]/.test(value)) {
            score++;
        }


        const levels = [
            "very-weak",
            "weak",
            "fair",
            "good",
            "strong",
            "very-strong"
        ];

        return {

            score,

            level:
                levels[score] || "very-weak",

            valid:
                value.length >= 8
        };
    },


    /* =====================================================
       19. QUERY PARAMETERS
       ===================================================== */

    getQueryParam(name) {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return params.get(name);
    },


    getQueryParams() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return Object.fromEntries(
            params.entries()
        );
    },


    setQueryParam(
        name,
        value
    ) {

        const url =
            new URL(
                window.location.href
            );

        url.searchParams.set(
            name,
            value
        );

        return url.toString();
    },


    /* =====================================================
       20. CLAMP
       ===================================================== */

    clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                Number(value),
                min
            ),
            max
        );
    },


    /* =====================================================
       21. RANDOM NUMBER
       ===================================================== */

    randomNumber(
        min,
        max
    ) {

        return Math.floor(
            Math.random() *
            (max - min + 1)
        ) + min;
    },


    /* =====================================================
       22. ARRAY SHUFFLE
       ===================================================== */

    shuffle(array) {

        if (!Array.isArray(array)) {
            return [];
        }

        const result =
            [...array];

        for (
            let i = result.length - 1;
            i > 0;
            i--
        ) {

            const j =
                Math.floor(
                    Math.random() *
                    (i + 1)
                );

            [
                result[i],
                result[j]
            ] = [
                result[j],
                result[i]
            ];
        }

        return result;
    },


    /* =====================================================
       23. ARRAY CHUNK
       ===================================================== */

    chunk(
        array,
        size = 10
    ) {

        if (
            !Array.isArray(array) ||
            size <= 0
        ) {
            return [];
        }

        const result = [];

        for (
            let i = 0;
            i < array.length;
            i += size
        ) {

            result.push(
                array.slice(
                    i,
                    i + size
                )
            );
        }

        return result;
    },


    /* =====================================================
       24. REMOVE DUPLICATES
       ===================================================== */

    unique(array) {

        if (!Array.isArray(array)) {
            return [];
        }

        return [
            ...new Set(array)
        ];
    },


    /* =====================================================
       25. SORT BY PROPERTY
       ===================================================== */

    sortBy(
        array,
        property,
        direction = "asc"
    ) {

        if (!Array.isArray(array)) {
            return [];
        }

        return [...array].sort(
            (a, b) => {

                const valueA =
                    a?.[property];

                const valueB =
                    b?.[property];

                if (
                    valueA <
                    valueB
                ) {
                    return direction ===
                        "asc"
                        ? -1
                        : 1;
                }

                if (
                    valueA >
                    valueB
                ) {
                    return direction ===
                        "asc"
                        ? 1
                        : -1;
                }

                return 0;
            }
        );
    },


    /* =====================================================
       26. LOCAL STORAGE
       ===================================================== */

    storage: {

        set(key, value) {

            try {

                localStorage.setItem(
                    `designverse_${key}`,
                    JSON.stringify(value)
                );

                return true;

            } catch (error) {

                console.warn(
                    "DESIGNVERSE storage error:",
                    error
                );

                return false;
            }
        },


        get(
            key,
            fallback = null
        ) {

            try {

                const value =
                    localStorage.getItem(
                        `designverse_${key}`
                    );

                if (
                    value === null
                ) {
                    return fallback;
                }

                return JSON.parse(value);

            } catch {

                return fallback;
            }
        },


        remove(key) {

            try {

                localStorage.removeItem(
                    `designverse_${key}`
                );

                return true;

            } catch {

                return false;
            }
        },


        clear() {

            try {

                const prefix =
                    "designverse_";

                Object.keys(
                    localStorage
                )
                    .filter(
                        key =>
                            key.startsWith(
                                prefix
                            )
                    )
                    .forEach(
                        key =>
                            localStorage.removeItem(
                                key
                            )
                    );

                return true;

            } catch {

                return false;
            }
        }
    },


    /* =====================================================
       27. CLIPBOARD
       ===================================================== */

    async copyToClipboard(text) {

        try {

            await navigator.clipboard.writeText(
                String(text)
            );

            return true;

        } catch (error) {

            console.warn(
                "Clipboard error:",
                error
            );

            return false;
        }
    },


    /* =====================================================
       28. FILE SIZE
       ===================================================== */

    formatFileSize(bytes) {

        const value =
            Number(bytes);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {
            return "0 Bytes";
        }

        const units = [
            "Bytes",
            "KB",
            "MB",
            "GB"
        ];

        const index =
            Math.floor(
                Math.log(value) /
                Math.log(1024)
            );

        return (
            parseFloat(
                (
                    value /
                    Math.pow(
                        1024,
                        index
                    )
                ).toFixed(2)
            ) +
            " " +
            units[index]
        );
    },


    /* =====================================================
       29. IMAGE VALIDATION
       ===================================================== */

    validateImage(
        file,
        options = {}
    ) {

        if (!file) {

            return {
                valid: false,
                error: "No image selected."
            };
        }


        const maxSize =
            options.maxSize ||
            10 * 1024 * 1024;


        const allowedTypes =
            options.types || [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif"
            ];


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            return {
                valid: false,
                error:
                    "Unsupported image format."
            };
        }


        if (
            file.size >
            maxSize
        ) {

            return {
                valid: false,
                error:
                    `Image must be smaller than ${this.formatFileSize(maxSize)}.`
            };
        }


        return {
            valid: true,
            error: null
        };
    },


    /* =====================================================
       30. IMAGE PREVIEW
       ===================================================== */

    createImagePreview(file) {

        if (!file) {
            return null;
        }

        return URL.createObjectURL(
            file
        );
    },


    /* =====================================================
       31. DEVICE DETECTION
       ===================================================== */

    device: {

        isMobile() {

            return window.innerWidth < 768;
        },


        isTablet() {

            return (
                window.innerWidth >= 768 &&
                window.innerWidth < 992
            );
        },


        isDesktop() {

            return window.innerWidth >= 992;
        },


        isTouch() {

            return (
                "ontouchstart" in window ||
                navigator.maxTouchPoints > 0
            );
        }
    },


    /* =====================================================
       32. ONLINE STATUS
       ===================================================== */

    isOnline() {

        return navigator.onLine;
    },


    /* =====================================================
       33. ELEMENT HELPERS
       ===================================================== */

    $(selector, parent = document) {

        return parent.querySelector(
            selector
        );
    },


    $$(selector, parent = document) {

        return [
            ...parent.querySelectorAll(
                selector
            )
        ];
    },


    /* =====================================================
       34. CLASS HELPERS
       ===================================================== */

    addClass(
        element,
        className
    ) {

        if (!element) return;

        element.classList.add(
            className
        );
    },


    removeClass(
        element,
        className
    ) {

        if (!element) return;

        element.classList.remove(
            className
        );
    },


    toggleClass(
        element,
        className,
        force
    ) {

        if (!element) return;

        return element.classList.toggle(
            className,
            force
        );
    },


    /* =====================================================
       35. SLEEP / DELAY
       ===================================================== */

    sleep(milliseconds) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    milliseconds
                )
        );
    },


    /* =====================================================
       36. SAFE JSON PARSE
       ===================================================== */

    parseJSON(
        value,
        fallback = null
    ) {

        try {

            return JSON.parse(value);

        } catch {

            return fallback;
        }
    },


    /* =====================================================
       37. DEEP CLONE
       ===================================================== */

    clone(object) {

        try {

            return structuredClone(
                object
            );

        } catch {

            return JSON.parse(
                JSON.stringify(
                    object
                )
            );
        }
    },


    /* =====================================================
       38. CHECK EMPTY VALUE
       ===================================================== */

    isEmpty(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return true;
        }

        if (
            typeof value ===
            "string"
        ) {
            return value.trim() === "";
        }

        if (
            Array.isArray(value)
        ) {
            return value.length === 0;
        }

        if (
            typeof value ===
            "object"
        ) {
            return (
                Object.keys(value)
                    .length === 0
            );
        }

        return false;
    },


    /* =====================================================
       39. ERROR LOGGER
       ===================================================== */

    logError(
        message,
        error = null
    ) {

        console.error(
            `[DESIGNVERSE] ${message}`,
            error || ""
        );
    }
};


/* =========================================================
   40. GLOBAL EXPORT
   ========================================================= */

window.DVUtils =
    DVUtils;


/* =========================================================
   41. BACKWARD-COMPATIBLE ALIAS
   ========================================================= */

/*
   Allows other DESIGNVERSE scripts to use:

   Utils.debounce()
   Utils.formatNumber()
   etc.

   without breaking the architecture.
*/

window.Utils =
    DVUtils;


/* =========================================================
   DESIGNVERSE UTILITY SYSTEM COMPLETE
   ========================================================= */