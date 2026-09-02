/* =========================================================
   DESIGNVERSE — GLOBAL SEARCH
   js/search.js

   Provides a site-wide search overlay powered by Supabase.

   Searches:
   - Designs (public)      → design.html?id=
   - Challenges            → challenge.html?id=
   - Designers (profiles)  → designer.html?username=

   The module self-injects a search toggle into
   .nav-actions and the .search-overlay into <body>,
   so pages only need to include this script tag.

   Public API (window.DVSearch):
   open() · close() · toggle() · search(term) · isOpen()
   ========================================================= */

"use strict";


const DVSearch = (() => {

    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        open: false,

        query: "",

        results: {
            designs: [],
            challenges: [],
            designers: []
        },

        activeIndex: 0,

        activeList: [],

        loading: false,

        debounceTimer: null

    };


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (!window.supabaseClient) {

            console.warn(
                "DESIGNVERSE: Search is unavailable because Supabase is not loaded."
            );

            return null;
        }

        return window.supabaseClient;
    }


    /* =====================================================
       DOM HELPERS
       ===================================================== */

    function $(selector) {

        return document.querySelector(selector);
    }


    function $$(selector) {

        return [
            ...document.querySelectorAll(selector)
        ];
    }


    /* =====================================================
       LINK RESOLUTION
       ===================================================== */

    /*
     * Target pages live inside /pages/. The current page
     * can be at the root, inside /pages/, or deeper. We
     * compute the correct relative prefix so generated
     * links always resolve.
     */

    function getPagePrefix() {

        const path =
            window.location.pathname;

        const pagesIndex =
            path.lastIndexOf("/pages/");

        if (pagesIndex === -1) {

            /* Root level (index.html) */

            return "pages/";
        }

        const rest =
            path.slice(pagesIndex + 7);

        const folderDepth =
            rest.split("/").length - 1;

        if (folderDepth <= 0) {

            return "";
        }

        return "../".repeat(
            folderDepth
        );
    }


    function designUrl(id) {

        return (
            getPagePrefix() +
            "design.html?id=" +
            encodeURIComponent(id)
        );
    }


    function challengeUrl(id) {

        return (
            getPagePrefix() +
            "challenge.html?id=" +
            encodeURIComponent(id)
        );
    }


    function designerUrl(profile) {

        const username =
            profile?.username;

        if (username) {

            return (
                getPagePrefix() +
                "designer.html?username=" +
                encodeURIComponent(username)
            );
        }

        return (
            getPagePrefix() +
            "designer.html?id=" +
            encodeURIComponent(profile?.id || "")
        );
    }

    /* =====================================================
       UI MARKUP
       ===================================================== */

    const overlayTemplate = `

        <div
            class="search-overlay"
            id="dvSearchOverlay"
            aria-hidden="true"
        >

            <div
                class="search-overlay-backdrop"
                data-search-close
            ></div>


            <div
                class="search-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Search DESIGNVERSE"
            >

                <div class="search-panel-header">

                    <div class="search-panel-search-icon">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>

                    <input
                        type="search"
                        id="dvSearchInput"
                        class="search-panel-input"
                        placeholder="Search designs, challenges, designers..."
                        autocomplete="off"
                        spellcheck="false"
                        aria-label="Search DESIGNVERSE"
                    >

                    <button
                        type="button"
                        class="search-panel-close"
                        data-search-close
                        aria-label="Close search"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                </div>


                <div
                    class="search-panel-body"
                    id="dvSearchResults"
                >

                    <div
                        class="search-state search-state-idle"
                        id="dvSearchIdle"
                    >
                        <i class="fa-solid fa-magnifying-glass"></i>

                        <p>
                            Search the Verse for designs,
                            challenges and designers.
                        </p>
                    </div>


                    <div
                        class="search-state search-state-loading"
                        id="dvSearchLoading"
                        hidden
                    >
                        <i
                            class="fa-solid fa-circle-notch fa-spin"
                        ></i>

                        <p>
                            Searching the Verse...
                        </p>
                    </div>


                    <div
                        class="search-state search-state-empty"
                        id="dvSearchEmpty"
                        hidden
                    >
                        <i class="fa-solid fa-box-open"></i>

                        <p>
                            No results found for
                            &ldquo;<span id="dvSearchEmptyQuery"></span>&rdquo;
                        </p>
                    </div>


                    <div
                        class="search-state search-state-error"
                        id="dvSearchError"
                        hidden
                    >
                        <i class="fa-solid fa-triangle-exclamation"></i>

                        <p>
                            Something went wrong while searching.
                        </p>
                    </div>


                    <div
                        class="search-results"
                        id="dvSearchResultsList"
                    ></div>

                </div>


                <div class="search-panel-footer">

                    <span>
                        DESIGNVERSE
                    </span>

                    <span>
                        <kbd>↑↓</kbd> navigate
                        <kbd>↵</kbd> open
                        <kbd>esc</kbd> close
                    </span>

                </div>

            </div>

        </div>
    `;


    function getToggleTemplate() {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "icon-button search-toggle";

        button.setAttribute(
            "aria-label",
            "Search DESIGNVERSE"
        );

        button.setAttribute(
            "aria-expanded",
            "false"
        );

        button.innerHTML = `
            <i class="fa-solid fa-magnifying-glass"></i>
        `;

        return button;
    }

    /* =====================================================
       INJECT UI
       ===================================================== */

    function injectToggle() {

        const actions =
            $(".nav-actions");

        if (!actions) return;

        if (
            actions.querySelector(
                ".search-toggle"
            )
        ) {
            return;
        }

        const toggle =
            getToggleTemplate();

        /* Place before the mobile menu button so it
           sits next to Sign In on desktop. */

        const mobileButton =
            actions.querySelector(
                ".mobile-menu-button"
            );

        if (mobileButton) {

            actions.insertBefore(
                toggle,
                mobileButton
            );

        } else {

            actions.appendChild(
                toggle
            );
        }

        toggle.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                DVSearch.toggle();
            }
        );

        return toggle;
    }


    function injectOverlay() {

        if (
            document.getElementById(
                "dvSearchOverlay"
            )
        ) {
            return;
        }

        const wrapper =
            document.createElement("div");

        wrapper.innerHTML =
            overlayTemplate;

        const overlay =
            wrapper.firstElementChild;

        document.body.appendChild(
            overlay
        );

        return overlay;
    }


    /* =====================================================
       POSITION HELPERS
       ===================================================== */

    function flattenResults() {

        const list = [];

        list.push(
            ...state.results.designs.map(
                item => ({
                    type: "design",
                    ref: item
                })
            ),
            ...state.results.challenges.map(
                item => ({
                    type: "challenge",
                    ref: item
                })
            ),
            ...state.results.designers.map(
                item => ({
                    type: "designer",
                    ref: item
                })
            )
        );

        return list;
    }


    function resultHref(entry) {

        if (entry.type === "design") {

            return designUrl(entry.ref.id);
        }

        if (entry.type === "challenge") {

            return challengeUrl(entry.ref.id);
        }

        return designerUrl(entry.ref);
    }

    /* =====================================================
       RENDER HELPERS
       ===================================================== */

    function showState(name) {

        const map = {
            idle: "dvSearchIdle",
            loading: "dvSearchLoading",
            empty: "dvSearchEmpty",
            error: "dvSearchError"
        };

        Object.entries(map).forEach(
            ([key, id]) => {

                const element =
                    document.getElementById(id);

                if (element) {

                    element.hidden =
                        key !== name;
                }
            }
        );

        const list =
            $("#dvSearchResultsList");

        if (list) {

            list.hidden =
                name !== "results";
        }
    }


    function clearResults() {

        const list =
            $("#dvSearchResultsList");

        if (list) {

            list.innerHTML = "";
        }

        state.results = {
            designs: [],
            challenges: [],
            designers: []
        };

        state.activeList = [];

        state.activeIndex = 0;
    }


    function buildGroup(
        title,
        icon,
        href,
        items,
        renderItem
    ) {

        if (!items.length) return "";

        return `
            <section class="search-group">

                <header class="search-group-header">

                    <span class="search-group-title">
                        <i class="${icon}"></i>
                        ${title}
                    </span>

                    <a
                        href="${href}"
                        class="search-group-all"
                        data-search-group-all
                    >
                        View all
                        <i class="fa-solid fa-arrow-right"></i>
                    </a>

                </header>

                <div class="search-group-items">
                    ${items.map(renderItem).join("")}
                </div>

            </section>
        `;
    }

    function renderResults() {

        const list =
            $("#dvSearchResultsList");

        if (!list) return;

        clearResults();

        const {
            designs,
            challenges,
            designers
        } =
            state.results;

        const prefix =
            getPagePrefix();

        state.activeList =
            flattenResults();

        const html =

            buildGroup(
                "Designs",
                "fa-solid fa-palette",
                `${prefix}explore.html`,
                designs,
                design =>
                    renderResultItem(
                        "design",
                        design,
                        design.image_url ||
                        design.thumbnail_url,
                        design.title ||
                        "Untitled design",
                        design.category
                            ? formatCategory(
                                design.category
                              )
                            : "Design",
                        formatDesignerName(
                            design.profiles
                        )
                    )
            ) +

            buildGroup(
                "Challenges",
                "fa-solid fa-fire",
                `${prefix}challenges.html`,
                challenges,
                challenge =>
                    renderResultItem(
                        "challenge",
                        challenge,
                        null,
                        challenge.title ||
                        "Untitled challenge",
                        formatChallengeStatus(
                            challenge
                        ),
                        "Challenge"
                    )
            ) +

            buildGroup(
                "Designers",
                "fa-solid fa-users",
                `${prefix}designers.html`,
                designers,
                designer =>
                    renderResultItem(
                        "designer",
                        designer,
                        null,
                        designer.display_name ||
                        designer.username ||
                        "Designer",
                        designer.role === "admin"
                            ? "Admin"
                            : "Designer",
                        designer.username
                            ? `@${designer.username}`
                            : ""
                    )
            );

        if (state.activeList.length) {

            showState("results");

            list.innerHTML =
                html;

            list.querySelectorAll(
                "a[data-search-group-all], a.search-result"
            ).forEach(link => {

                link.addEventListener(
                    "click",
                    () => {

                        DVSearch.close();
                    }
                );
            });

        } else {

            const queryElement =
                $("#dvSearchEmptyQuery");

            if (queryElement) {

                queryElement.textContent =
                    state.query;
            }

            showState("empty");
        }
    }

    function renderResultItem(
        type,
        ref,
        image,
        title,
        meta,
        sub
    ) {

        const href =
            resultHref({
                type,
                ref
            });

        const icon =
            type === "design"
                ? "fa-solid fa-palette"
                : type === "challenge"
                    ? "fa-solid fa-fire"
                    : "fa-solid fa-user";

        const imageHTML =
            image
                ? `
                    <img
                        src="${escapeAttribute(image)}"
                        alt=""
                        loading="lazy"
                    >
                `
                : `
                    <div class="search-result-icon ${type}">
                        <i class="${icon}"></i>
                    </div>
                `;

        const avatarHTML =
            type === "designer"
                ? `
                    <div class="search-result-avatar">
                        ${
                            escapeHTML(
                                (ref.display_name ||
                                 ref.username ||
                                 "D")
                                    .charAt(0)
                                    .toUpperCase()
                            )
                        }
                    </div>
                `
                : imageHTML;

        return `
            <a
                href="${escapeAttribute(href)}"
                class="search-result"
                data-search-result
                data-type="${type}"
            >

                ${avatarHTML}

                <div class="search-result-body">

                    <strong>
                        ${escapeHTML(title)}
                    </strong>

                    <span>
                        ${escapeHTML(meta)}
                        ${
                            sub
                                ? ` · ${escapeHTML(sub)}`
                                : ""
                        }
                    </span>

                </div>

                <i class="fa-solid fa-angle-right search-result-arrow"></i>

            </a>
        `;
    }

    /* =====================================================
       FORMATTERS
       ===================================================== */

    function formatCategory(category) {

        const map = {
            branding: "Branding",
            "logo-design": "Logo Design",
            poster: "Poster",
            "social-media": "Social Media",
            "ui-ux": "UI / UX",
            illustration: "Illustration",
            typography: "Typography",
            packaging: "Packaging",
            motion: "Motion",
            "3d": "3D Design",
            other: "Other"
        };

        return map[category] || "Design";
    }


    function formatChallengeStatus(challenge) {

        if (!challenge) return "Challenge";

        const status =
            String(
                challenge.status || ""
            ).toUpperCase();

        if (status) return status;

        const now =
            Date.now();

        const starts =
            new Date(
                challenge.starts_at
            ).getTime();

        const ends =
            new Date(
                challenge.ends_at
            ).getTime();

        if (Number.isNaN(starts) && Number.isNaN(ends)) {

            return "Challenge";
        }

        if (starts > now) return "UPCOMING";

        if (ends > now) return "ACTIVE";

        return "COMPLETED";
    }


    function formatDesignerName(profile) {

        if (!profile) return "";

        return (
            profile.display_name ||
            profile.username ||
            ""
        );
    }


    /* =====================================================
       ESCAPE HELPERS
       ===================================================== */

    function escapeHTML(value) {

        const element =
            document.createElement("div");

        element.textContent =
            String(value ?? "");

        return element.innerHTML;
    }


    function escapeAttribute(value) {

        return escapeHTML(value)
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =====================================================
       DATABASE QUERIES
       ===================================================== */

    async function searchDesigns(supabase, query) {

        const {
            data,
            error
        } =
            await supabase
                .from("designs")
                .select(`
                    id,
                    title,
                    description,
                    category,
                    image_url,
                    thumbnail_url,
                    profiles:designer_id (
                        username,
                        display_name
                    )
                `)
                .eq("is_public", true)
                .or(`
                    title.ilike.%${query}%,
                    description.ilike.%${query}%,
                    category.ilike.%${query}%
                `)
                .order("created_at", {
                    ascending: false
                })
                .limit(5);

        if (error) throw error;

        return data || [];
    }


    async function searchChallenges(supabase, query) {

        const {
            data,
            error
        } =
            await supabase
                .from("challenges")
                .select(`
                    id,
                    title,
                    description,
                    category,
                    status,
                    starts_at,
                    ends_at
                `)
                .or(`
                    title.ilike.%${query}%,
                    description.ilike.%${query}%,
                    category.ilike.%${query}%
                `)
                .order("ends_at", {
                    ascending: false
                })
                .limit(5);

        if (error) throw error;

        return data || [];
    }


    async function searchDesigners(supabase, query) {

        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar_url,
                    role,
                    total_points
                `)
                .or(`
                    username.ilike.%${query}%,
                    display_name.ilike.%${query}%
                `)
                .order("total_points", {
                    ascending: false
                })
                .limit(5);

        if (error) throw error;

        return data || [];
    }

    /* =====================================================
       SEARCH
       ===================================================== */

    async function search(term) {

        const supabase =
            getSupabase();

        if (!supabase) {

            showState("error");

            return;
        }

        const query =
            String(term || "")
                .trim()
                .toLowerCase()
                .replace(/[%]/g, "");

        state.query =
            query;

        if (!query) {

            clearResults();

            showState("idle");

            return;
        }

        state.loading =
            true;

        showState("loading");

        try {

            const [
                designs,
                challenges,
                designers
            ] =
                await Promise.all([
                    searchDesigns(
                        supabase,
                        query
                    ),
                    searchChallenges(
                        supabase,
                        query
                    ),
                    searchDesigners(
                        supabase,
                        query
                    )
                ]);

            /* Ignore stale responses */

            if (state.query !== query) {

                return;
            }

            state.results = {
                designs,
                challenges,
                designers
            };

            state.loading =
                false;

            renderResults();

        } catch (error) {

            console.error(
                "DESIGNVERSE search error:",
                error
            );

            if (state.query !== query) {

                return;
            }

            state.loading =
                false;

            clearResults();

            showState("error");
        }
    }


    /* =====================================================
       OPEN / CLOSE / TOGGLE
       ===================================================== */

    function open() {

        const overlay =
            document.getElementById(
                "dvSearchOverlay"
            );

        if (!overlay) return;

        state.open =
            true;

        overlay.classList.add(
            "open",
            "is-open"
        );

        overlay.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "menu-open",
            "search-open"
        );

        const toggle =
            $(".search-toggle");

        toggle?.setAttribute(
            "aria-expanded",
            "true"
        );

        const input =
            $("#dvSearchInput");

        /* Reset on every open */

        if (input) {

            input.value = "";
        }

        clearResults();

        showState("idle");

        state.query = "";

        input?.focus();
    }


    function close() {

        const overlay =
            document.getElementById(
                "dvSearchOverlay"
            );

        if (!overlay) return;

        state.open =
            false;

        overlay.classList.remove(
            "open",
            "is-open"
        );

        overlay.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "menu-open",
            "search-open"
        );

        const toggle =
            $(".search-toggle");

        toggle?.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    function toggle() {

        if (state.open) {

            close();

        } else {

            open();
        }
    }


    function isOpen() {

        return state.open;
    }

    /* =====================================================
       KEYBOARD NAVIGATION
       ===================================================== */

    function moveActive(direction) {

        if (!state.activeList.length) {

            return;
        }

        state.activeIndex +=
            direction;

        const rowCount =
            state.activeList.length;

        if (state.activeIndex < 0) {

            state.activeIndex =
                rowCount - 1;
        }

        if (state.activeIndex >= rowCount) {

            state.activeIndex = 0;
        }

        $$(
            "[data-search-result]"
        ).forEach((element, index) => {

            element.classList.toggle(
                "active",
                index ===
                state.activeIndex
            );

            if (index === state.activeIndex) {

                element.scrollIntoView({
                    block: "nearest"
                });
            }
        });
    }


    function openActive() {

        const element =
            $$(
                "[data-search-result]"
            )[state.activeIndex];

        if (!element) return;

        close();

        window.location.href =
            element.getAttribute("href");
    }


    /* =====================================================
       EVENTS
       ===================================================== */

    function setupEvents() {

        const overlay =
            document.getElementById(
                "dvSearchOverlay"
            );

        const input =
            $("#dvSearchInput");

        if (!overlay || !input) {

            return;
        }


        /* Close on backdrop / close button */

        overlay.addEventListener(
            "click",
            event => {

                const closeTrigger =
                    event.target.closest(
                        "[data-search-close]"
                    );

                if (closeTrigger) {

                    close();
                }
            }
        );


        /* Debounced live search */

        input.addEventListener(
            "input",
            event => {

                clearTimeout(
                    state.debounceTimer
                );

                state.debounceTimer =
                    setTimeout(
                        () => {

                            search(
                                event.target.value
                            );

                        },
                        250
                    );
            }
        );


        /* Keyboard navigation */

        input.addEventListener(
            "keydown",
            event => {

                if (event.key === "ArrowDown") {

                    event.preventDefault();

                    moveActive(1);

                } else if (event.key === "ArrowUp") {

                    event.preventDefault();

                    moveActive(-1);

                } else if (event.key === "Enter") {

                    event.preventDefault();

                    openActive();
                }
            }
        );


        /* Escape closes the overlay */

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape" &&
                    state.open
                ) {

                    close();
                }
            }
        );


        /* Global shortcut: press "/" to open search
           when not already typing in a field */

        document.addEventListener(
            "keydown",
            event => {

                if (event.key !== "/") return;

                const tag =
                    event.target.tagName;

                const isTyping =
                    tag === "INPUT" ||
                    tag === "TEXTAREA" ||
                    event.target.isContentEditable;

                if (isTyping) return;

                event.preventDefault();

                open();
            }
        );
    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function init() {

        if (state.initialized) return;

        state.initialized =
            true;

        injectToggle();

        injectOverlay();

        setupEvents();

        console.log(
            "🔍 DESIGNVERSE search initialized."
        );
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {
        state,
        init,
        open,
        close,
        toggle,
        search,
        isOpen
    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVSearch =
    DVSearch;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVSearch.init();

    }
);


/* =========================================================
   DESIGNVERSE SEARCH SYSTEM COMPLETE
   ========================================================= */
