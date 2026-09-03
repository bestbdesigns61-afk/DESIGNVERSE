/* =========================================================
   DESIGNVERSE
   navigation.js
   Global Navigation Controller
   ========================================================= */

"use strict";


/* =========================================================
   1. NAVIGATION OBJECT
   ========================================================= */

const DVNavigation = {

    /* =====================================================
       STATE
       ===================================================== */

        state: {
        initialized: false,
        menuOpen: false,
        sidebarOpen: false,
        activeDropdown: null
    },

    overlay: null,



    /* =====================================================
       INITIALIZE
       ===================================================== */

    init() {

                if (this.state.initialized) return;

        this.ensureMobileNav();
        this.setupMobileMenu();
        this.setupSidebar();
        this.setupDropdowns();
        this.setupActiveLinks();
        this.setupNavigationLinks();
        this.setupBottomNavigation();
        this.setupOutsideClick();
        this.setupKeyboardNavigation();

        this.state.initialized = true;

        console.log(
            "🧭 DESIGNVERSE navigation initialized."
        );
        },


    /* =====================================================
       1.5 ENSURE MOBILE NAV
       Dynamically create the hamburger button and mobile
       nav drawer for pages that don't have them in their HTML.
       ===================================================== */

    ensureMobileNav() {

        /* Create mobile menu button if missing */
        if (!this.getMobileToggle()) {

            const navActions =
                document.querySelector(".nav-actions");

            if (navActions) {

                const button =
                    document.createElement("button");

                button.type = "button";
                button.className = "mobile-menu-button";
                button.id = "mobile-menu-button";
                button.setAttribute(
                    "aria-label",
                    "Open navigation menu"
                );
                button.setAttribute(
                    "aria-expanded",
                    "false"
                );
                button.innerHTML =
                    '<i class="fa-solid fa-bars"></i>';

                navActions.appendChild(button);
            }
        }

        /* Create mobile nav drawer if missing */
        if (!this.getMobileNav()) {

            const desktopNav =
                document.querySelector(".desktop-nav");

            if (!desktopNav) return;

            const header =
                document.querySelector(".site-header");

            if (!header) return;

            const mobileNav =
                document.createElement("div");

            mobileNav.className = "mobile-nav";
            mobileNav.id = "mobile-nav";
            mobileNav.setAttribute(
                "aria-hidden",
                "true"
            );

            /* Icon mapping for nav links */
            const iconMap = {
                "Explore": "fa-compass",
                "Challenges": "fa-fire",
                "Leaderboard": "fa-trophy",
                "Designers": "fa-users",
                "Dashboard": "fa-table-columns",
                "Sign In": "fa-right-to-bracket",
                "Join DESIGNVERSE": "fa-rocket",
                "My Designs": "fa-paint-brush",
                "My Challenges": "fa-list",
                "Notifications": "fa-bell",
                "Settings": "fa-cog",
                "Profile": "fa-user"
            };

            /* Clone desktop nav links into mobile nav */
            desktopNav
                .querySelectorAll("a")
                .forEach(link => {

                    const href =
                        link.getAttribute("href") || "#";

                    const text =
                        link.textContent.trim();

                    const icon =
                        iconMap[text] ||
                        "fa-chevron-right";

                    const mobileLink =
                        document.createElement("a");

                    mobileLink.href = href;
                    mobileLink.innerHTML =
                        `<i class="fa-solid ${icon}"></i> ${text}`;

                    mobileNav.appendChild(mobileLink);
                });

            /* Clone auth/action links from nav-actions */
            const navActions =
                document.querySelector(".nav-actions");

            if (navActions) {

                const divider =
                    document.createElement("div");

                divider.className =
                    "mobile-nav-divider";

                mobileNav.appendChild(divider);

                navActions
                    .querySelectorAll("a")
                    .forEach(link => {

                        const href =
                            link.getAttribute("href") || "#";

                        const text = link.textContent.trim();
                        const icon =
                            iconMap[text] ||
                            "fa-chevron-right";

                        const mobileLink =
                            document.createElement("a");

                        mobileLink.href = href;
                        mobileLink.innerHTML =
                            `<i class="fa-solid ${icon}"></i> ${text}`;

                        mobileNav.appendChild(mobileLink);
                    });
            }

            /* Insert mobile nav after the navbar */
            header.appendChild(mobileNav);
        }
    },


    /* =====================================================
       2. MOBILE MENU
       ===================================================== */

    setupMobileMenu() {

        const toggle =
            this.getMobileToggle();

        const nav =
            this.getMobileNav();

        if (!toggle || !nav) return;


        toggle.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                this.toggleMobileMenu();

            }
        );


        /* Close menu when a link is clicked */

        nav.querySelectorAll("a").forEach(
            link => {

                link.addEventListener(
                    "click",
                    () => {

                        this.closeMobileMenu();

                    }
                );
            }
        );
    },


    /* Get the mobile menu toggle, supporting
       both the new and legacy selector names. */

    getMobileToggle() {

        return (
            document.querySelector(
                ".mobile-menu-button"
            ) ||
            document.querySelector(
                ".mobile-nav-toggle"
            )
        );
    },


    /* Get the mobile menu container, supporting
       both the new and legacy selector names. */

    getMobileNav() {

        return (
            document.querySelector(
                ".mobile-nav"
            ) ||
            document.querySelector(
                ".nav-links"
            )
        );
    },


    toggleMobileMenu() {

        const nav =
            this.getMobileNav();

        const toggle =
            this.getMobileToggle();

        if (!nav) return;


        this.state.menuOpen =
            !this.state.menuOpen;


        nav.classList.toggle(
            "open",
            this.state.menuOpen
        );


        nav.setAttribute(
            "aria-hidden",
            String(
                !this.state.menuOpen
            )
        );


        toggle?.classList.toggle(
            "active",
            this.state.menuOpen
        );


        toggle?.setAttribute(
            "aria-expanded",
            String(
                this.state.menuOpen
            )
        );


                document.body.classList.toggle(
            "menu-open",
            this.state.menuOpen
        );

        /* Toggle backdrop overlay */

        if (
            !this.overlay &&
            this.state.menuOpen
        ) {

            const overlay =
                document.createElement(
                    "div"
                );

            overlay.className =
                "mobile-nav-overlay";

            overlay.addEventListener(
                "click",
                () => {

                    this.closeMobileMenu();

                }
            );

            document.body.appendChild(
                overlay
            );

            this.overlay =
                overlay;

        } else if (
            this.overlay &&
            !this.state.menuOpen
        ) {

            this.overlay.remove();

            this.overlay =
                null;

        }
    },


    closeMobileMenu() {

        const nav =
            this.getMobileNav();

        const toggle =
            this.getMobileToggle();


        this.state.menuOpen =
            false;


        nav?.classList.remove(
            "open"
        );

        nav?.setAttribute(
            "aria-hidden",
            "true"
        );

        toggle?.classList.remove(
            "active"
        );

        toggle?.setAttribute(
            "aria-expanded",
            "false"
        );


                document.body.classList.remove(
            "menu-open"
        );

        /* Clean up overlay */

        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    },


    /* =====================================================
       3. SIDEBAR
       ===================================================== */

    setupSidebar() {

        const toggle =
            document.querySelector(
                "[data-sidebar-toggle]"
            );

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        if (!sidebar) return;


        toggle?.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                this.toggleSidebar();

            }
        );


        /* Sidebar close buttons */

        sidebar
            .querySelectorAll(
                "[data-sidebar-close]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        this.closeSidebar();

                    }
                );
            });


        /* Sidebar links */

        sidebar
            .querySelectorAll("a")
            .forEach(link => {

                link.addEventListener(
                    "click",
                    () => {

                        if (
                            window.innerWidth <
                            992
                        ) {

                            this.closeSidebar();

                        }
                    }
                );
            });
    },


    toggleSidebar() {

        const sidebar =
            document.querySelector(
                ".sidebar"
            );

        if (!sidebar) return;


        this.state.sidebarOpen =
            !this.state.sidebarOpen;


        sidebar.classList.toggle(
            "open",
            this.state.sidebarOpen
        );


        sidebar.setAttribute(
            "aria-hidden",
            String(
                !this.state.sidebarOpen
            )
        );


        document.body.classList.toggle(
            "sidebar-open",
            this.state.sidebarOpen
        );
    },


    closeSidebar() {

        const sidebar =
            document.querySelector(
                ".sidebar"
            );


        this.state.sidebarOpen =
            false;


        sidebar?.classList.remove(
            "open"
        );


        sidebar?.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.classList.remove(
            "sidebar-open"
        );
    },


    /* =====================================================
       4. DROPDOWN MENUS
       ===================================================== */

    setupDropdowns() {

        const dropdowns =
            document.querySelectorAll(
                "[data-dropdown]"
            );


        dropdowns.forEach(
            dropdown => {

                const trigger =
                    dropdown.querySelector(
                        "[data-dropdown-trigger]"
                    );

                if (!trigger) return;


                trigger.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        event.stopPropagation();

                        this.toggleDropdown(
                            dropdown
                        );
                    }
                );


                trigger.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        );
    },


    toggleDropdown(dropdown) {

        if (
            this.state.activeDropdown &&
            this.state.activeDropdown !==
            dropdown
        ) {

            this.closeDropdown(
                this.state.activeDropdown
            );
        }


        const isOpen =
            dropdown.classList.contains(
                "open"
            );


        if (isOpen) {

            this.closeDropdown(
                dropdown
            );

        } else {

            this.openDropdown(
                dropdown
            );
        }
    },


    openDropdown(dropdown) {

        dropdown.classList.add(
            "open"
        );


        const trigger =
            dropdown.querySelector(
                "[data-dropdown-trigger]"
            );


        trigger?.setAttribute(
            "aria-expanded",
            "true"
        );


        this.state.activeDropdown =
            dropdown;
    },


    closeDropdown(dropdown) {

        if (!dropdown) return;


        dropdown.classList.remove(
            "open"
        );


        const trigger =
            dropdown.querySelector(
                "[data-dropdown-trigger]"
            );


        trigger?.setAttribute(
            "aria-expanded",
            "false"
        );


        if (
            this.state.activeDropdown ===
            dropdown
        ) {

            this.state.activeDropdown =
                null;
        }
    },


    closeAllDropdowns() {

        document
            .querySelectorAll(
                "[data-dropdown].open"
            )
            .forEach(dropdown => {

                this.closeDropdown(
                    dropdown
                );
            });
    },


    /* =====================================================
       5. ACTIVE NAVIGATION LINKS
       ===================================================== */

    setupActiveLinks() {

        const currentPath =
            this.normalizePath(
                window.location.pathname
            );


        document
            .querySelectorAll(
                "a[data-nav-link], " +
                ".nav-links a, " +
                ".mobile-nav a, " +
                ".sidebar a, " +
                ".mobile-bottom-nav a"
            )
            .forEach(link => {

                const href =
                    link.getAttribute("href");

                if (
                    !href ||
                    href.startsWith("#") ||
                    href.startsWith("http") ||
                    href.startsWith("mailto:")
                ) {
                    return;
                }


                const linkPath =
                    this.normalizePath(
                        this.getPathFromHref(
                            href
                        )
                    );


                if (
                    linkPath ===
                    currentPath
                ) {

                    this.markActive(
                        link
                    );
                }
            });
    },


    markActive(link) {

        link.classList.add(
            "active"
        );

        link.setAttribute(
            "aria-current",
            "page"
        );


        /* Also activate parent dropdown */

        const dropdown =
            link.closest(
                "[data-dropdown]"
            );

        if (dropdown) {

            dropdown.classList.add(
                "active"
            );
        }
    },


    normalizePath(path) {

        if (!path) {
            return "/";
        }


        let normalized =
            path
                .replace(
                    /\/+/g,
                    "/"
                )
                .replace(
                    /\/$/,
                    ""
                );


        if (
            normalized ===
            ""
        ) {

            normalized = "/";
        }


        return normalized.toLowerCase();
    },


    getPathFromHref(href) {

        try {

            const url =
                new URL(
                    href,
                    window.location.origin
                );

            return url.pathname;

        } catch {

            return href;
        }
    },


    /* =====================================================
       6. NAVIGATION LINKS
       ===================================================== */

    setupNavigationLinks() {

        document
            .querySelectorAll(
                "a[data-navigate]"
            )
            .forEach(link => {

                link.addEventListener(
                    "click",
                    event => {

                        const target =
                            link.getAttribute(
                                "data-navigate"
                            );

                        if (!target) return;


                        event.preventDefault();

                        this.navigate(
                            target
                        );
                    }
                );
            });
    },


    navigate(url) {

        if (!url) return;


        /* Close navigation UI */

        this.closeMobileMenu();
        this.closeSidebar();
        this.closeAllDropdowns();


        /* Page transition */

        const reducedMotion =
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;


        if (
            reducedMotion ||
            !document.body
        ) {

            window.location.href =
                url;

            return;
        }


        document.body.classList.add(
            "page-exiting"
        );


        setTimeout(
            () => {

                window.location.href =
                    url;

            },
            150
        );
    },


    /* =====================================================
       7. MOBILE BOTTOM NAVIGATION
       ===================================================== */

    setupBottomNavigation() {

        const bottomNav =
            document.querySelector(
                ".mobile-bottom-nav"
            );

        if (!bottomNav) return;


        bottomNav
            .querySelectorAll("a")
            .forEach(link => {

                link.addEventListener(
                    "click",
                    () => {

                        bottomNav
                            .querySelectorAll(
                                "a"
                            )
                            .forEach(
                                item => {

                                    item.classList.remove(
                                        "active"
                                    );

                                }
                            );


                        link.classList.add(
                            "active"
                        );
                    }
                );
            });
    },


    /* =====================================================
       8. OUTSIDE CLICK
       ===================================================== */

    setupOutsideClick() {

        document.addEventListener(
            "click",
            event => {

                const target =
                    event.target;


                /* Dropdown */

                if (
                    !target.closest(
                        "[data-dropdown]"
                    )
                ) {

                    this.closeAllDropdowns();

                }


                                /* Mobile nav */

                if (
                    this.state.menuOpen &&
                    !target.closest(".mobile-nav") &&
                    !target.closest(".nav-links") &&
                    !target.closest(".mobile-menu-button") &&
                    !target.closest(".mobile-nav-toggle") &&
                    !target.closest(".mobile-nav-overlay")
                ) {

                    this.closeMobileMenu();

                }


                /* Sidebar */

                if (
                    this.state.sidebarOpen &&
                    !target.closest(
                        ".sidebar"
                    ) &&
                    !target.closest(
                        "[data-sidebar-toggle]"
                    )
                ) {

                    this.closeSidebar();

                }
            }
        );
    },


    /* =====================================================
       9. KEYBOARD NAVIGATION
       ===================================================== */

    setupKeyboardNavigation() {

        document.addEventListener(
            "keydown",
            event => {


                /* Escape */

                if (
                    event.key ===
                    "Escape"
                ) {

                    this.closeMobileMenu();

                    this.closeSidebar();

                    this.closeAllDropdowns();

                }


                /* Enter / Space for dropdowns */

                const trigger =
                    event.target.closest(
                        "[data-dropdown-trigger]"
                    );


                if (
                    trigger &&
                    (
                        event.key ===
                        "Enter" ||
                        event.key ===
                        " "
                    )
                ) {

                    event.preventDefault();

                    const dropdown =
                        trigger.closest(
                            "[data-dropdown]"
                        );

                    if (dropdown) {

                        this.toggleDropdown(
                            dropdown
                        );
                    }
                }
            }
        );
    },


    /* =====================================================
       10. RESPONSIVE NAVIGATION
       ===================================================== */

    handleResponsiveNavigation() {

        if (
            window.innerWidth >=
            992
        ) {

            this.closeMobileMenu();

        }

    }
};


/* =========================================================
   11. RESIZE HANDLER
   ========================================================= */

window.addEventListener(
    "resize",
    Utils.debounce(
        () => {

            DVNavigation
                .handleResponsiveNavigation();

        },
        150
    )
);


/* =========================================================
   12. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVNavigation.init();

    }
);


/* =========================================================
   13. GLOBAL EXPORT
   ========================================================= */

window.DVNavigation =
    DVNavigation;


/* =========================================================
   DESIGNVERSE NAVIGATION COMPLETE
   ========================================================= */
