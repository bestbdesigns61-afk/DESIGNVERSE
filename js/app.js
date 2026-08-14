/* =========================================================
   DESIGNVERSE
   app.js
   Global Application Controller
   ========================================================= */

"use strict";


/* =========================================================
   1. DESIGNVERSE APPLICATION
   ========================================================= */

const DesignVerse = {

    /* ---------- Application State ---------- */

    state: {
        initialized: false,
        isMobile: false,
        isTablet: false,
        isDesktop: false,
        isTouchDevice: false,
        reducedMotion: false,
        online: navigator.onLine
    },


    /* ---------- Initialize App ---------- */

    init() {

        if (this.state.initialized) return;

        this.detectDevice();
        this.detectMotionPreference();

        this.setupGlobalEvents();
        this.setupScrollReveal();
        this.setupExternalLinks();
        this.setupImageFallbacks();
        this.setupOnlineStatus();

        this.state.initialized = true;

        document.documentElement.classList.add(
            "dv-app-ready"
        );

        console.log(
            "🎨 DESIGNVERSE initialized successfully."
        );
    },


    /* =====================================================
       2. DEVICE DETECTION
       ===================================================== */

    detectDevice() {

        const width = window.innerWidth;

        this.state.isMobile = width < 768;

        this.state.isTablet =
            width >= 768 &&
            width < 992;

        this.state.isDesktop =
            width >= 992;

        this.state.isTouchDevice =
            "ontouchstart" in window ||
            navigator.maxTouchPoints > 0;

        document.documentElement.classList.toggle(
            "is-mobile",
            this.state.isMobile
        );

        document.documentElement.classList.toggle(
            "is-tablet",
            this.state.isTablet
        );

        document.documentElement.classList.toggle(
            "is-desktop",
            this.state.isDesktop
        );

        document.documentElement.classList.toggle(
            "is-touch",
            this.state.isTouchDevice
        );
    },


    /* =====================================================
       3. MOTION PREFERENCE
       ===================================================== */

    detectMotionPreference() {

        const mediaQuery = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        );

        this.state.reducedMotion =
            mediaQuery.matches;

        document.documentElement.classList.toggle(
            "reduced-motion",
            this.state.reducedMotion
        );

        mediaQuery.addEventListener(
            "change",
            event => {

                this.state.reducedMotion =
                    event.matches;

                document.documentElement.classList.toggle(
                    "reduced-motion",
                    event.matches
                );
            }
        );
    },


    /* =====================================================
       4. GLOBAL EVENTS
       ===================================================== */

    setupGlobalEvents() {

        /* ---------- Resize ---------- */

        window.addEventListener(
            "resize",
            Utils.debounce(() => {

                this.detectDevice();

            }, 150)
        );


        /* ---------- Escape Key ---------- */

        document.addEventListener(
            "keydown",
            event => {

                if (event.key === "Escape") {

                    this.closeOpenElements();
                }
            }
        );


        /* ---------- Prevent Double Tap Zoom ---------- */

        if (this.state.isTouchDevice) {

            document.addEventListener(
                "dblclick",
                event => {

                    if (
                        event.target.closest(
                            "button, a, input"
                        )
                    ) {
                        return;
                    }

                    event.preventDefault();
                }
            );
        }
    },


    /* =====================================================
       5. CLOSE OPEN UI
       ===================================================== */

    closeOpenElements() {

        /* Mobile navigation */

        const nav =
            document.querySelector(".nav-links");

        if (nav) {
            nav.classList.remove("open");
        }


        /* Sidebar */

        const sidebar =
            document.querySelector(".sidebar");

        if (sidebar) {
            sidebar.classList.remove("open");
        }


        /* Modals */

        document
            .querySelectorAll(
                ".modal.is-open, .modal.open"
            )
            .forEach(modal => {

                modal.classList.remove(
                    "is-open",
                    "open"
                );

                modal.setAttribute(
                    "aria-hidden",
                    "true"
                );
            });


        /* Search */

        const search =
            document.querySelector(
                ".search-overlay"
            );

        if (search) {

            search.classList.remove(
                "open",
                "is-open"
            );
        }


        document.body.classList.remove(
            "menu-open",
            "modal-open"
        );
    },


    /* =====================================================
       6. SCROLL REVEAL
       ===================================================== */

    setupScrollReveal() {

        const elements =
            document.querySelectorAll(
                ".reveal, " +
                ".reveal-left, " +
                ".reveal-right, " +
                ".reveal-scale"
            );

        if (!elements.length) return;


        /* If reduced motion is enabled,
           reveal everything immediately. */

        if (this.state.reducedMotion) {

            elements.forEach(element => {

                element.classList.add(
                    "visible"
                );

            });

            return;
        }


        /* Intersection Observer */

        if ("IntersectionObserver" in window) {

            const observer =
                new IntersectionObserver(
                    entries => {

                        entries.forEach(
                            entry => {

                                if (
                                    entry.isIntersecting
                                ) {

                                    entry.target.classList.add(
                                        "visible"
                                    );

                                    observer.unobserve(
                                        entry.target
                                    );
                                }
                            }
                        );

                    },
                    {
                        threshold: 0.12,
                        rootMargin:
                            "0px 0px -50px 0px"
                    }
                );


            elements.forEach(element => {

                observer.observe(element);

            });

        } else {

            elements.forEach(element => {

                element.classList.add(
                    "visible"
                );

            });
        }
    },


    /* =====================================================
       7. EXTERNAL LINKS
       ===================================================== */

    setupExternalLinks() {

        document
            .querySelectorAll(
                'a[href^="http"]'
            )
            .forEach(link => {

                const url =
                    link.getAttribute("href");

                if (!url) return;

                try {

                    const targetURL =
                        new URL(url);

                    if (
                        targetURL.hostname !==
                        window.location.hostname
                    ) {

                        link.setAttribute(
                            "target",
                            "_blank"
                        );

                        link.setAttribute(
                            "rel",
                            "noopener noreferrer"
                        );
                    }

                } catch (error) {

                    console.warn(
                        "Invalid URL:",
                        url
                    );
                }
            });
    },


    /* =====================================================
       8. IMAGE FALLBACKS
       ===================================================== */

    setupImageFallbacks() {

        document
            .querySelectorAll("img")
            .forEach(image => {

                image.addEventListener(
                    "error",
                    () => {

                        if (
                            image.dataset.fallbackApplied
                        ) {
                            return;
                        }

                        image.dataset.fallbackApplied =
                            "true";

                        image.src =
                            "assets/images/design-placeholder.svg";

                        image.alt =
                            "Design preview unavailable";
                    }
                );
            });
    },


    /* =====================================================
       9. ONLINE / OFFLINE STATUS
       ===================================================== */

    setupOnlineStatus() {

        const updateStatus = () => {

            this.state.online =
                navigator.onLine;

            document.documentElement.classList.toggle(
                "offline",
                !navigator.onLine
            );

            document.documentElement.classList.toggle(
                "online",
                navigator.onLine
            );

            if (navigator.onLine) {

                this.showToast(
                    "You're back online.",
                    "success"
                );

            } else {

                this.showToast(
                    "You're offline. Some features may be unavailable.",
                    "warning"
                );
            }
        };


        window.addEventListener(
            "online",
            updateStatus
        );

        window.addEventListener(
            "offline",
            updateStatus
        );
    },


    /* =====================================================
       10. TOAST SYSTEM
       ===================================================== */

    showToast(
        message,
        type = "info",
        duration = 3500
    ) {

        if (!message) return;


        let container =
            document.querySelector(
                ".toast-container"
            );


        /* Create container */

        if (!container) {

            container =
                document.createElement("div");

            container.className =
                "toast-container";

            document.body.appendChild(
                container
            );
        }


        /* Create toast */

        const toast =
            document.createElement("div");

        toast.className =
            `toast toast-${type}`;

        toast.setAttribute(
            "role",
            "status"
        );


        /* Toast content */

        toast.innerHTML = `

            <div class="toast-content">

                <span class="toast-message">
                    ${this.escapeHTML(message)}
                </span>

                <button
                    class="toast-close"
                    type="button"
                    aria-label="Close notification"
                >
                    &times;
                </button>

            </div>

        `;


        container.appendChild(
            toast
        );


        /* Trigger animation */

        requestAnimationFrame(() => {

            toast.classList.add(
                "show"
            );

        });


        /* Close button */

        const closeButton =
            toast.querySelector(
                ".toast-close"
            );

        closeButton?.addEventListener(
            "click",
            () => {

                this.removeToast(
                    toast
                );
            }
        );


        /* Automatic removal */

        const timeout =
            setTimeout(() => {

                this.removeToast(
                    toast
                );

            }, duration);


        toast.dataset.timeout =
            timeout;
    },


    /* =====================================================
       11. REMOVE TOAST
       ===================================================== */

    removeToast(toast) {

        if (!toast) return;

        if (toast.dataset.timeout) {

            clearTimeout(
                Number(
                    toast.dataset.timeout
                )
            );
        }

        toast.classList.remove(
            "show"
        );

        setTimeout(() => {

            toast.remove();

        }, 300);
    },


    /* =====================================================
       12. HTML ESCAPE
       ===================================================== */

    escapeHTML(value) {

        const div =
            document.createElement("div");

        div.textContent =
            String(value);

        return div.innerHTML;
    },


    /* =====================================================
       13. PAGE LOADING
       ===================================================== */

    showPageLoader() {

        let loader =
            document.querySelector(
                ".page-loader"
            );

        if (loader) {

            loader.classList.add(
                "active"
            );

            return;
        }


        loader =
            document.createElement("div");

        loader.className =
            "page-loader active";

        loader.innerHTML = `

            <div class="page-loader-inner">

                <div class="loader-logo">
                    DV
                </div>

                <div class="loading-dots">

                    <span></span>
                    <span></span>
                    <span></span>

                </div>

            </div>

        `;

        document.body.appendChild(
            loader
        );
    },


    hidePageLoader() {

        const loader =
            document.querySelector(
                ".page-loader"
            );

        if (!loader) return;

        loader.classList.remove(
            "active"
        );

        setTimeout(() => {

            loader.remove();

        }, 400);
    },


    /* =====================================================
       14. BODY SCROLL LOCK
       ===================================================== */

    lockScroll() {

        document.body.classList.add(
            "scroll-locked"
        );

        document.body.style.overflow =
            "hidden";
    },


    unlockScroll() {

        document.body.classList.remove(
            "scroll-locked"
        );

        document.body.style.overflow =
            "";
    },


    /* =====================================================
       15. LOCAL STORAGE
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
                    "Storage write failed:",
                    error
                );

                return false;
            }
        },


        get(key, fallback = null) {

            try {

                const value =
                    localStorage.getItem(
                        `designverse_${key}`
                    );

                return value !== null
                    ? JSON.parse(value)
                    : fallback;

            } catch (error) {

                console.warn(
                    "Storage read failed:",
                    error
                );

                return fallback;
            }
        },


        remove(key) {

            try {

                localStorage.removeItem(
                    `designverse_${key}`
                );

                return true;

            } catch (error) {

                return false;
            }
        }
    },


    /* =====================================================
       16. PAGE NAVIGATION
       ===================================================== */

    navigate(url) {

        if (!url) return;

        document.body.classList.add(
            "page-exiting"
        );

        setTimeout(() => {

            window.location.href =
                url;

        }, this.state.reducedMotion ? 0 : 150);
    },


    /* =====================================================
       17. SCROLL TO ELEMENT
       ===================================================== */

    scrollTo(
        selector,
        offset = 0
    ) {

        const element =
            typeof selector === "string"
                ? document.querySelector(selector)
                : selector;

        if (!element) return;


        const top =
            element.getBoundingClientRect().top +
            window.scrollY -
            offset;


        window.scrollTo({

            top,

            behavior:
                this.state.reducedMotion
                    ? "auto"
                    : "smooth"
        });
    },


    /* =====================================================
       18. DEBOUNCE
       ===================================================== */

    debounce(callback, delay = 250) {

        let timeout;

        return (...args) => {

            clearTimeout(timeout);

            timeout =
                setTimeout(() => {

                    callback(...args);

                }, delay);
        };
    },


    /* =====================================================
       19. THROTTLE
       ===================================================== */

    throttle(callback, limit = 100) {

        let waiting = false;

        return (...args) => {

            if (waiting) return;

            callback(...args);

            waiting = true;

            setTimeout(() => {

                waiting = false;

            }, limit);
        };
    }
};


/* =========================================================
   20. GLOBAL UTILS
   ========================================================= */

const Utils = {

    /* ---------- Debounce ---------- */

    debounce(callback, delay = 250) {

        let timeout;

        return (...args) => {

            clearTimeout(timeout);

            timeout =
                setTimeout(
                    () => callback(...args),
                    delay
                );
        };
    },


    /* ---------- Throttle ---------- */

    throttle(callback, limit = 100) {

        let waiting = false;

        return (...args) => {

            if (waiting) return;

            callback(...args);

            waiting = true;

            setTimeout(() => {

                waiting = false;

            }, limit);
        };
    },


    /* ---------- Generate ID ---------- */

    generateId(prefix = "dv") {

        return `${prefix}_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 9)}`;
    },


    /* ---------- Format Number ---------- */

    formatNumber(number) {

        return new Intl.NumberFormat(
            "en-US"
        ).format(number);
    },


    /* ---------- Format Date ---------- */

    formatDate(
        date,
        options = {}
    ) {

        const defaultOptions = {

            year: "numeric",
            month: "short",
            day: "numeric"

        };

        return new Intl.DateTimeFormat(
            "en-US",
            {
                ...defaultOptions,
                ...options
            }
        ).format(
            new Date(date)
        );
    },


    /* ---------- Capitalize ---------- */

    capitalize(text) {

        if (!text) return "";

        return (
            text.charAt(0).toUpperCase() +
            text.slice(1)
        );
    },


    /* ---------- Slugify ---------- */

    slugify(text) {

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
                ""
            );
    },


    /* ---------- Clamp Number ---------- */

    clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                value,
                min
            ),
            max
        );
    },


    /* ---------- Check Email ---------- */

    isValidEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(
                String(email)
                    .toLowerCase()
            );
    },


    /* ---------- Copy To Clipboard ---------- */

    async copyToClipboard(text) {

        try {

            await navigator.clipboard.writeText(
                text
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


    /* ---------- Get Query Parameter ---------- */

    getQueryParam(name) {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return params.get(name);
    },


    /* ---------- Device Check ---------- */

    isTouchDevice() {

        return (
            "ontouchstart" in window ||
            navigator.maxTouchPoints > 0
        );
    }
};


/* =========================================================
   21. GLOBAL EVENT HELPERS
   ========================================================= */

/* Smooth anchor scrolling */

document.addEventListener(
    "click",
    event => {

        const link =
            event.target.closest(
                'a[href^="#"]'
            );

        if (!link) return;

        const targetID =
            link.getAttribute("href");

        if (
            !targetID ||
            targetID === "#"
        ) {
            return;
        }

        const target =
            document.querySelector(
                targetID
            );

        if (!target) return;

        event.preventDefault();

        DesignVerse.scrollTo(
            target,
            80
        );
    }
);


/* =========================================================
   22. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DesignVerse.init();

    }
);


/* =========================================================
   23. WINDOW LOAD
   ========================================================= */

window.addEventListener(
    "load",
    () => {

        document.documentElement.classList.add(
            "dv-loaded"
        );

        DesignVerse.hidePageLoader();

    }
);


/* =========================================================
   24. GLOBAL EXPORT
   ========================================================= */

window.DesignVerse =
    DesignVerse;

window.Utils =
    Utils;


/* =========================================================
   DESIGNVERSE APP.JS COMPLETE
   ========================================================= */