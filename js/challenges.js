/* =========================================================
   DESIGNVERSE — CHALLENGES SYSTEM
   js/challenges.js

   Handles:
   - Loading challenges from Supabase
   - Rendering challenge cards
   - Search
   - Category filtering
   - Status filtering
   - Challenge statistics
   - Countdown / deadline display
   - Challenge links
   - Loading / empty / error states
   ========================================================= */

"use strict";


const DVChallenges = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        challenges: [],

        filteredChallenges: [],

        search: "",

        category: "all",

        status: "all",

        initialized: false

    };


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (!window.supabaseClient) {

            console.error(
                "DESIGNVERSE: Supabase client is not available."
            );

            return null;
        }


        return window.supabaseClient;
    }


    /* =====================================================
       DOM HELPERS
       ===================================================== */

    function $(selector) {

        return document.querySelector(
            selector
        );
    }


    /* =====================================================
       LOAD CHALLENGES
       ===================================================== */

    async function loadChallenges() {

        const supabase =
            getSupabase();


        if (!supabase) {

            showError(
                "Unable to connect to DESIGNVERSE."
            );

            return [];
        }


        showLoading();


        const {
            data,
            error
        } =
            await supabase
                .from("challenges")
                .select(`
                    id,
                    title,
                    slug,
                    description,
                    brief,
                    category,
                    difficulty,
                    cover_image_url,
                    rules,
                    prize,
                    points,
                    max_submissions,
                    starts_at,
                    ends_at,
                    status,
                    created_by,
                    created_at,
                    updated_at
                `)
                .order(
                    "starts_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            console.error(
                "DESIGNVERSE challenges error:",
                error
            );


            hideLoading();


            showError(
                getChallengeErrorMessage(
                    error
                )
            );


            return [];
        }


        state.challenges =
            normalizeChallenges(
                data || []
            );


        /*
         * Use the live date calculation for
         * display/filtering rather than trusting
         * stale status values.
         */

        state.challenges =
            state.challenges.map(
                challenge => ({
                    ...challenge,

                    displayStatus:
                        calculateStatus(
                            challenge
                        )
                })
            );


        updateStatistics();

        applyFilters();

        hideLoading();


        return state.challenges;
    }


    /* =====================================================
       NORMALIZE CHALLENGES
       ===================================================== */

    function normalizeChallenges(
        challenges
    ) {

        return challenges.map(
            challenge => ({

                ...challenge,

                title:
                    challenge.title ||
                    "Untitled Challenge",

                description:
                    challenge.description ||
                    challenge.brief ||
                    "A new creative challenge.",

                category:
                    challenge.category ||
                    "other",

                difficulty:
                    challenge.difficulty ||
                    "medium",

                points:
                    Number(
                        challenge.points || 0
                    ),

                max_submissions:
                    challenge.max_submissions
                        ? Number(
                            challenge.max_submissions
                        )
                        : null

            })
        );
    }


    /* =====================================================
       CALCULATE STATUS
       ===================================================== */

    function calculateStatus(
        challenge
    ) {

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


        /*
         * Respect explicitly cancelled challenges.
         */

        if (
            challenge.status ===
            "cancelled"
        ) {

            return "cancelled";
        }


        if (
            Number.isFinite(
                starts
            ) &&
            now < starts
        ) {

            return "upcoming";
        }


        if (
            Number.isFinite(
                starts
            ) &&
            Number.isFinite(
                ends
            ) &&
            now >= starts &&
            now < ends
        ) {

            /*
             * If the database says voting,
             * keep it as voting.
             */

            if (
                challenge.status ===
                "voting"
            ) {

                return "voting";
            }


            return "active";
        }


        if (
            Number.isFinite(
                ends
            ) &&
            now >= ends
        ) {

            if (
                challenge.status ===
                "voting"
            ) {

                return "voting";
            }


            return "completed";
        }


        /*
         * Fallback to database status.
         */

        return (
            challenge.status ||
            "upcoming"
        );
    }


    /* =====================================================
       UPDATE STATISTICS
       ===================================================== */

    function updateStatistics() {

        const active =
            state.challenges.filter(
                challenge =>
                    challenge.displayStatus ===
                    "active"
            ).length;


        const upcoming =
            state.challenges.filter(
                challenge =>
                    challenge.displayStatus ===
                    "upcoming"
            ).length;


        const total =
            state.challenges.length;


        setText(
            "#activeChallengesCount",
            formatNumber(active)
        );


        setText(
            "#upcomingChallengesCount",
            formatNumber(upcoming)
        );


        setText(
            "#totalChallengesCount",
            formatNumber(total)
        );
    }


    /* =====================================================
       SEARCH
       ===================================================== */

    function searchChallenges(
        query
    ) {

        state.search =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();


        applyFilters();
    }


    /* =====================================================
       CATEGORY FILTER
       ===================================================== */

    function filterByCategory(
        category
    ) {

        state.category =
            category ||
            "all";


        applyFilters();
    }


    /* =====================================================
       STATUS FILTER
       ===================================================== */

    function filterByStatus(
        status
    ) {

        state.status =
            status ||
            "all";


        applyFilters();
    }


    /* =====================================================
       APPLY FILTERS
       ===================================================== */

    function applyFilters() {

        state.filteredChallenges =
            state.challenges.filter(
                challenge => {

                    const title =
                        String(
                            challenge.title ||
                            ""
                        )
                        .toLowerCase();


                    const description =
                        String(
                            challenge.description ||
                            ""
                        )
                        .toLowerCase();


                    const brief =
                        String(
                            challenge.brief ||
                            ""
                        )
                        .toLowerCase();


                    const category =
                        String(
                            challenge.category ||
                            ""
                        )
                        .toLowerCase();


                    const matchesSearch =
                        !state.search ||
                        title.includes(
                            state.search
                        ) ||
                        description.includes(
                            state.search
                        ) ||
                        brief.includes(
                            state.search
                        ) ||
                        category.includes(
                            state.search
                        );


                    const matchesCategory =
                        state.category ===
                            "all" ||
                        challenge.category ===
                            state.category;


                    const matchesStatus =
                        state.status ===
                            "all" ||
                        challenge.displayStatus ===
                            state.status;


                    return (
                        matchesSearch &&
                        matchesCategory &&
                        matchesStatus
                    );
                }
            );


        renderChallenges();
    }


    /* =====================================================
       RENDER CHALLENGES
       ===================================================== */

    function renderChallenges() {

        const grid =
            $("#challengesGrid");


        const empty =
            $("#challengesEmpty");


        if (!grid) {
            return;
        }


        grid.innerHTML =
            "";


        const results =
            state.filteredChallenges.length;


        setText(
            "#challengeResultsCount",
            `${formatNumber(results)} ${
                results === 1
                    ? "challenge"
                    : "challenges"
            }`
        );


        if (
            results === 0
        ) {

            grid.hidden =
                true;


            empty?.classList.add(
                "visible"
            );


            if (empty) {

                empty.style.display =
                    "flex";
            }


            return;
        }


        empty?.classList.remove(
            "visible"
        );


        if (empty) {

            empty.style.display =
                "";
        }


        state.filteredChallenges
            .forEach(
                challenge => {

                    grid.appendChild(
                        createChallengeCard(
                            challenge
                        )
                    );

                }
            );


        grid.hidden =
            false;
    }


    /* =====================================================
       CREATE CHALLENGE CARD
       ===================================================== */

    function createChallengeCard(
        challenge
    ) {

        const article =
            document.createElement(
                "article"
            );


        article.className =
            "challenge-card";


        article.dataset.challengeId =
            challenge.id;


        article.dataset.category =
            challenge.category;


        article.dataset.status =
            challenge.displayStatus;


        const cover =
            challenge.cover_image_url
                ? `
                    <img
                        src="${escapeAttribute(
                            challenge.cover_image_url
                        )}"
                        alt="${escapeAttribute(
                            challenge.title
                        )}"
                        loading="lazy"
                    >
                `
                : createCoverPlaceholder(
                    challenge
                );


        const statusClass =
            getStatusClass(
                challenge.displayStatus
            );


        const statusLabel =
            formatStatus(
                challenge.displayStatus
            );


        const icon =
            getCategoryIcon(
                challenge.category
            );


        const deadline =
            getDeadlineText(
                challenge
            );


        const actionText =
            getActionText(
                challenge.displayStatus
            );


        article.innerHTML = `

            <div class="challenge-card-cover">

                ${cover}

                <span
                    class="challenge-status ${statusClass}"
                >

                    <i
                        class="fa-solid ${getStatusIcon(
                            challenge.displayStatus
                        )}"
                    ></i>

                    ${escapeHTML(
                        statusLabel
                    )}

                </span>

            </div>


            <div class="challenge-card-body">

                <div class="challenge-category">

                    <i
                        class="fa-solid ${icon}"
                    ></i>

                    ${escapeHTML(
                        formatCategory(
                            challenge.category
                        )
                    )}

                </div>


                <h3 class="challenge-card-title">

                    ${escapeHTML(
                        challenge.title
                    )}

                </h3>


                <p class="challenge-card-description">

                    ${escapeHTML(
                        challenge.description
                    )}

                </p>


                <div class="challenge-meta">

                    <div class="challenge-meta-item">

                        <span>
                            Difficulty
                        </span>

                        <strong>
                            ${escapeHTML(
                                formatDifficulty(
                                    challenge.difficulty
                                )
                            )}
                        </strong>

                    </div>


                    <div class="challenge-meta-item">

                        <span>
                            Reward
                        </span>

                        <strong>
                            ${formatNumber(
                                challenge.points
                            )} XP
                        </strong>

                    </div>


                    <div class="challenge-meta-item">

                        <span>
                            Prize
                        </span>

                        <strong>
                            ${escapeHTML(
                                challenge.prize ||
                                "—"
                            )}
                        </strong>

                    </div>

                </div>


                <div class="challenge-card-footer">

                    <span
                        class="challenge-deadline"
                    >

                        <i
                            class="fa-regular fa-clock"
                        ></i>

                        ${escapeHTML(
                            deadline
                        )}

                    </span>


                    <a
                        href="challenge.html?id=${encodeURIComponent(
                            challenge.id
                        )}"
                        class="btn btn-primary btn-small"
                    >

                        ${escapeHTML(
                            actionText
                        )}

                        <i
                            class="fa-solid fa-arrow-right"
                        ></i>

                    </a>

                </div>

            </div>

        `;


        return article;
    }


    /* =====================================================
       COVER PLACEHOLDER
       ===================================================== */

    function createCoverPlaceholder(
        challenge
    ) {

        const variation =
            getCoverVariation(
                challenge.category
            );


        const categoryName =
            formatCategory(
                challenge.category
            );


        return `

            <div
                class="challenge-cover-placeholder ${variation}"
            >

                <span>
                    ${escapeHTML(
                        categoryName
                    )}
                </span>


                <strong>
                    ${escapeHTML(
                        truncateTitle(
                            challenge.title,
                            28
                        )
                    )}
                </strong>

            </div>

        `;
    }


    /* =====================================================
       CHALLENGE DETAIL URL
       ===================================================== */

    function getChallengeUrl(
        challenge
    ) {

        return (
            `challenge.html?id=` +
            encodeURIComponent(
                challenge.id
            )
        );
    }


    /* =====================================================
       DEADLINE TEXT
       ===================================================== */

    function getDeadlineText(
        challenge
    ) {

        const status =
            challenge.displayStatus;


        if (
            status ===
            "completed"
        ) {

            return "Challenge ended";
        }


        if (
            status ===
            "cancelled"
        ) {

            return "Cancelled";
        }


        if (
            status ===
            "voting"
        ) {

            return "Voting in progress";
        }


        if (
            status ===
            "upcoming"
        ) {

            return (
                "Starts " +
                formatRelativeDate(
                    challenge.starts_at
                )
            );
        }


        if (
            status ===
            "active"
        ) {

            return (
                timeRemaining(
                    challenge.ends_at
                ) +
                " left"
            );
        }


        return "View challenge";
    }


    /* =====================================================
       ACTION TEXT
       ===================================================== */

    function getActionText(
        status
    ) {

        switch (status) {

            case "active":
                return "Enter";

            case "upcoming":
                return "View";

            case "voting":
                return "Vote";

            case "completed":
                return "Results";

            case "cancelled":
                return "View";

            default:
                return "View";
        }
    }


    /* =====================================================
       STATUS HELPERS
       ===================================================== */

    function getStatusClass(
        status
    ) {

        return [
            "active",
            "upcoming",
            "voting",
            "completed"
        ].includes(
            status
        )
            ? status
            : "";
    }


    function getStatusIcon(
        status
    ) {

        switch (status) {

            case "active":
                return "fa-circle";

            case "upcoming":
                return "fa-calendar";

            case "voting":
                return "fa-check-to-slot";

            case "completed":
                return "fa-flag-checkered";

            case "cancelled":
                return "fa-ban";

            default:
                return "fa-circle-info";
        }
    }


    function formatStatus(
        status
    ) {

        switch (status) {

            case "active":
                return "Active";

            case "upcoming":
                return "Upcoming";

            case "voting":
                return "Voting";

            case "completed":
                return "Completed";

            case "cancelled":
                return "Cancelled";

            default:
                return "Challenge";
        }
    }


    /* =====================================================
       CATEGORY HELPERS
       ===================================================== */

    function formatCategory(
        category
    ) {

        const categories = {

            branding:
                "Branding",

            poster:
                "Poster",

            "ui-ux":
                "UI / UX",

            illustration:
                "Illustration",

            logo:
                "Logo",

            motion:
                "Motion",

            other:
                "Other"

        };


        if (
            categories[category]
        ) {

            return categories[
                category
            ];
        }


        return String(
            category ||
            "Other"
        )
        .replace(
            /[-_]/g,
            " "
        )
        .replace(
            /\b\w/g,
            char =>
                char.toUpperCase()
        );
    }


    function getCategoryIcon(
        category
    ) {

        const icons = {

            branding:
                "fa-pen-nib",

            poster:
                "fa-image",

            "ui-ux":
                "fa-window-maximize",

            illustration:
                "fa-paintbrush",

            logo:
                "fa-bezier-curve",

            motion:
                "fa-film",

            other:
                "fa-palette"

        };


        return (
            icons[category] ||
            "fa-palette"
        );
    }


    function getCoverVariation(
        category
    ) {

        const variations = {

            branding:
                "blue",

            poster:
                "",

            "ui-ux":
                "pink",

            illustration:
                "orange",

            logo:
                "blue",

            motion:
                "pink",

            other:
                ""

        };


        return (
            variations[category] ||
            ""
        );
    }


    function formatDifficulty(
        difficulty
    ) {

        const value =
            String(
                difficulty ||
                "medium"
            );


        return (
            value.charAt(0)
                .toUpperCase() +
            value.slice(1)
        );
    }


    /* =====================================================
       TIME HELPERS
       ===================================================== */

    function timeRemaining(
        dateString
    ) {

        const target =
            new Date(
                dateString
            ).getTime();


        const now =
            Date.now();


        let difference =
            target - now;


        if (
            !Number.isFinite(
                difference
            ) ||
            difference <= 0
        ) {

            return "Ended";
        }


        const minute =
            60 * 1000;


        const hour =
            60 * minute;


        const day =
            24 * hour;


        const days =
            Math.floor(
                difference /
                day
            );


        difference %=
            day;


        const hours =
            Math.floor(
                difference /
                hour
            );


        difference %=
            hour;


        const minutes =
            Math.floor(
                difference /
                minute
            );


        if (
            days > 0
        ) {

            return `${days}d ${hours}h`;
        }


        if (
            hours > 0
        ) {

            return `${hours}h ${minutes}m`;
        }


        return `${Math.max(
            1,
            minutes
        )}m`;
    }


    function formatRelativeDate(
        dateString
    ) {

        const target =
            new Date(
                dateString
            ).getTime();


        const now =
            Date.now();


        const difference =
            target - now;


        if (
            !Number.isFinite(
                difference
            )
        ) {

            return "soon";
        }


        if (
            difference <= 0
        ) {

            return "now";
        }


        const day =
            24 *
            60 *
            60 *
            1000;


        const days =
            Math.ceil(
                difference /
                day
            );


        if (
            days === 1
        ) {

            return "tomorrow";
        }


        if (
            days < 7
        ) {

            return `in ${days} days`;
        }


        return new Date(
            dateString
        ).toLocaleDateString(
            undefined,
            {
                month:
                    "short",

                day:
                    "numeric"
            }
        );
    }


    /* =====================================================
       LIVE COUNTDOWN REFRESH
       ===================================================== */

    function startCountdownRefresh() {

        /*
         * Recalculate status and remaining time
         * every minute.
         */

        setInterval(
            () => {

                if (
                    !state.challenges.length
                ) {

                    return;
                }


                let changed =
                    false;


                state.challenges =
                    state.challenges.map(
                        challenge => {

                            const status =
                                calculateStatus(
                                    challenge
                                );


                            if (
                                status !==
                                challenge.displayStatus
                            ) {

                                changed =
                                    true;
                            }


                            return {

                                ...challenge,

                                displayStatus:
                                    status

                            };

                        }
                    );


                if (changed) {

                    updateStatistics();

                    applyFilters();

                } else {

                    /*
                     * Refresh the cards so active
                     * countdowns remain accurate.
                     */

                    renderChallenges();
                }

            },
            60 * 1000
        );
    }


    /* =====================================================
       LOADING
       ===================================================== */

    function showLoading() {

        const loading =
            $("#challengeLoading");


        const grid =
            $("#challengesGrid");


        const empty =
            $("#challengesEmpty");


        loading?.removeAttribute(
            "hidden"
        );


        if (grid) {

            grid.hidden =
                true;
        }


        empty?.classList.remove(
            "visible"
        );
    }


    function hideLoading() {

        const loading =
            $("#challengeLoading");


        loading?.setAttribute(
            "hidden",
            ""
        );
    }


    /* =====================================================
       ERROR
       ===================================================== */

    function showError(
        message
    ) {

        hideLoading();


        const grid =
            $("#challengesGrid");


        if (!grid) {
            return;
        }


        grid.innerHTML = `

            <div
                class="challenges-empty visible"
                style="
                    display:flex;
                    grid-column:1/-1;
                "
            >

                <div
                    class="empty-icon"
                >

                    <i
                        class="fa-solid fa-triangle-exclamation"
                    ></i>

                </div>


                <h2>
                    Challenges unavailable
                </h2>


                <p>
                    ${escapeHTML(
                        message
                    )}
                </p>


                <button
                    type="button"
                    class="btn btn-primary"
                    id="retryChallengesButton"
                    style="margin-top:16px;"
                >

                    <i
                        class="fa-solid fa-rotate"
                    ></i>

                    Try Again

                </button>

            </div>

        `;


        grid.hidden =
            false;


        $("#retryChallengesButton")
            ?.addEventListener(
                "click",
                () => {

                    loadChallenges();

                }
            );
    }


    /* =====================================================
       FILTER CONTROLS
       ===================================================== */

    function setupControls() {

        const search =
            $("#challengeSearch");


        const category =
            $("#challengeCategoryFilter");


        const status =
            $("#challengeStatusFilter");


        search?.addEventListener(
            "input",
            event => {

                searchChallenges(
                    event.target.value
                );

            }
        );


        category?.addEventListener(
            "change",
            event => {

                filterByCategory(
                    event.target.value
                );

            }
        );


        status?.addEventListener(
            "change",
            event => {

                filterByStatus(
                    event.target.value
                );

            }
        );
    }


    /* =====================================================
       ERROR MESSAGE
       ===================================================== */

    function getChallengeErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to load challenges."
            );
        }


        const message =
            String(
                error.message ||
                error
            );


        const lower =
            message.toLowerCase();


        if (
            lower.includes(
                "row-level security"
            )
        ) {

            return (
                "DESIGNVERSE could not access the challenge data."
            );
        }


        if (
            lower.includes(
                "network"
            )
        ) {

            return (
                "Network error. Please check your connection."
            );
        }


        if (
            lower.includes(
                "relation"
            ) &&
            lower.includes(
                "does not exist"
            )
        ) {

            return (
                "The challenges database table has not been created yet."
            );
        }


        return message;
    }


    /* =====================================================
       UTILITIES
       ===================================================== */

    function setText(
        selector,
        value
    ) {

        const element =
            $(selector);


        if (element) {

            element.textContent =
                value;
        }
    }


    function formatNumber(
        number
    ) {

        return new Intl.NumberFormat(
            "en-US"
        ).format(
            Number(number) || 0
        );
    }


    function escapeHTML(
        value
    ) {

        const element =
            document.createElement(
                "div"
            );


        element.textContent =
            String(
                value ?? ""
            );


        return element.innerHTML;
    }


    function escapeAttribute(
        value
    ) {

        return escapeHTML(
            value
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
    }


    function truncateTitle(
        value,
        maxLength
    ) {

        const title =
            String(
                value ||
                ""
            );


        if (
            title.length <=
            maxLength
        ) {

            return title;
        }


        return (
            title.substring(
                0,
                maxLength
            ) +
            "..."
        );
    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function init() {

        if (
            state.initialized
        ) {

            return;
        }


        /*
         * Only run on the challenges page.
         */

        if (
            !$("#challengesGrid") &&
            !$("#challengeLoading")
        ) {

            return;
        }


        state.initialized =
            true;


        setupControls();

        startCountdownRefresh();

        await loadChallenges();
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        state,

        init,

        loadChallenges,

        renderChallenges,

        searchChallenges,

        filterByCategory,

        filterByStatus,

        updateStatistics,

        getChallengeUrl,

        calculateStatus

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVChallenges =
    DVChallenges;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVChallenges.init();

    }
);


/* =========================================================
   DESIGNVERSE CHALLENGES SYSTEM COMPLETE
   ========================================================= */