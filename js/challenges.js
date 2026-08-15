/* =========================================================
   DESIGNVERSE — CHALLENGES SYSTEM
   js/challenges.js

   Challenge lifecycle:

   UPCOMING
      ↓ starts_at
   ACTIVE
      ↓ ends_at
   VOTING
      ↓ voting_ends_at
   COMPLETED

   Handles:
   - Supabase challenge loading
   - Challenge status
   - Search
   - Category filtering
   - Status filtering
   - Challenge statistics
   - Countdown timers
   - Challenge cards
   - Challenge detail links
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

        initialized: false,

        countdownTimer: null

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
       DOM
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
                    voting_ends_at,
                    status,
                    created_by,
                    created_at,
                    updated_at
                `)
                .order(
                    "starts_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "DESIGNVERSE challenges error:",
                error
            );


            hideLoading();


            const message =
                String(
                    error.message ||
                    ""
                ).toLowerCase();


            if (
                message.includes(
                    "voting_ends_at"
                ) &&
                (
                    message.includes(
                        "does not exist"
                    ) ||
                    message.includes(
                        "schema cache"
                    )
                )
            ) {

                showError(
                    "The challenges table needs the voting_ends_at column."
                );

            } else {

                showError(
                    getChallengeErrorMessage(
                        error
                    )
                );
            }


            return [];
        }


        state.challenges =
            normalizeChallenges(
                data || []
            );


        recalculateStatuses();

        updateStatistics();

        applyFilters();

        hideLoading();


        return state.challenges;
    }


    /* =====================================================
       NORMALIZE
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
                    challenge.max_submissions !== null &&
                    challenge.max_submissions !== undefined
                        ? Number(
                            challenge.max_submissions
                        )
                        : null,

                starts_at:
                    challenge.starts_at ||
                    null,

                ends_at:
                    challenge.ends_at ||
                    null,

                voting_ends_at:
                    challenge.voting_ends_at ||
                    null

            })
        );
    }


    /* =====================================================
       STATUS CALCULATION
       ===================================================== */

    function calculateStatus(
        challenge
    ) {

        /*
         * Cancelled always wins.
         */

        if (
            challenge.status ===
            "cancelled"
        ) {

            return "cancelled";
        }


        const now =
            Date.now();


        const startsAt =
            parseDate(
                challenge.starts_at
            );


        const endsAt =
            parseDate(
                challenge.ends_at
            );


        const votingEndsAt =
            parseDate(
                challenge.voting_ends_at
            );


        /*
         * No valid start date.
         * Fall back to database status.
         */

        if (
            startsAt === null
        ) {

            return (
                challenge.status ||
                "upcoming"
            );
        }


        /*
         * UPCOMING
         */

        if (
            now < startsAt
        ) {

            return "upcoming";
        }


        /*
         * ACTIVE
         */

        if (
            endsAt !== null &&
            now < endsAt
        ) {

            return "active";
        }


        /*
         * VOTING
         */

        if (
            endsAt !== null &&
            now >= endsAt
        ) {

            /*
             * A configured voting period exists.
             */

            if (
                votingEndsAt !== null &&
                now < votingEndsAt
            ) {

                return "voting";
            }


            /*
             * Voting deadline has passed.
             */

            if (
                votingEndsAt !== null &&
                now >= votingEndsAt
            ) {

                return "completed";
            }


            /*
             * Legacy challenge without
             * voting_ends_at.
             */

            return "completed";
        }


        /*
         * Fallback when ends_at is missing.
         */

        return (
            challenge.status ||
            "active"
        );
    }


    /* =====================================================
       RECALCULATE ALL STATUSES
       ===================================================== */

    function recalculateStatuses() {

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
    }


    /* =====================================================
       STATISTICS
       ===================================================== */

    function updateStatistics() {

        const active =
            countStatus(
                "active"
            );


        const upcoming =
            countStatus(
                "upcoming"
            );


        const voting =
            countStatus(
                "voting"
            );


        const total =
            state.challenges.length;


        setText(
            "#activeChallengesCount",
            formatNumber(
                active
            )
        );


        setText(
            "#upcomingChallengesCount",
            formatNumber(
                upcoming
            )
        );


        setText(
            "#totalChallengesCount",
            formatNumber(
                total
            )
        );


        /*
         * Optional element for future UI.
         */

        setText(
            "#votingChallengesCount",
            formatNumber(
                voting
            )
        );
    }


    function countStatus(
        status
    ) {

        return state.challenges.filter(
            challenge =>
                challenge.displayStatus ===
                status
        ).length;
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
       CATEGORY
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
       STATUS
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
       FILTER
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
       RENDER
       ===================================================== */

    function renderChallenges() {

        const grid =
            $("#challengesGrid");


        if (!grid) {

            return;
        }


        const empty =
            $("#challengesEmpty");


        grid.innerHTML =
            "";


        const results =
            state.filteredChallenges.length;


        setText(
            "#challengeResultsCount",
            `${formatNumber(
                results
            )} ${
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


            showEmptyState();

            return;
        }


        hideEmptyState();


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
       CREATE CARD
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


        const status =
            challenge.displayStatus;


        const statusClass =
            getStatusClass(
                status
            );


        const statusLabel =
            formatStatus(
                status
            );


        const statusIcon =
            getStatusIcon(
                status
            );


        const categoryIcon =
            getCategoryIcon(
                challenge.category
            );


        const deadline =
            getDeadlineText(
                challenge
            );


        const actionText =
            getActionText(
                status
            );


        const detailUrl =
            getChallengeUrl(
                challenge
            );


        article.innerHTML = `

            <div class="challenge-card-cover">

                ${cover}

                <span
                    class="challenge-status ${statusClass}"
                >

                    <i
                        class="fa-solid ${statusIcon}"
                    ></i>

                    ${escapeHTML(
                        statusLabel
                    )}

                </span>

            </div>


            <div class="challenge-card-body">

                <div class="challenge-category">

                    <i
                        class="fa-solid ${categoryIcon}"
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
                        href="${detailUrl}"
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


        return `

            <div
                class="challenge-cover-placeholder ${variation}"
            >

                <span>
                    ${escapeHTML(
                        formatCategory(
                            challenge.category
                        )
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
       DETAIL URL
       ===================================================== */

    function getChallengeUrl(
        challenge
    ) {

        /*
         * Slug gives cleaner URLs.
         * ID remains the fallback.
         */

        if (
            challenge.slug
        ) {

            return (
                `challenge.html?slug=` +
                encodeURIComponent(
                    challenge.slug
                )
            );
        }


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


        switch (
            status
        ) {

            case "upcoming":

                return (
                    "Starts " +
                    formatRelativeDate(
                        challenge.starts_at
                    )
                );


            case "active":

                return (
                    timeRemaining(
                        challenge.ends_at
                    ) +
                    " left"
                );


            case "voting":

                return (
                    "Voting · " +
                    timeRemaining(
                        challenge.voting_ends_at
                    )
                );


            case "completed":

                return "Voting ended";


            case "cancelled":

                return "Cancelled";


            default:

                return "View challenge";
        }
    }


    /* =====================================================
       ACTION TEXT
       ===================================================== */

    function getActionText(
        status
    ) {

        switch (
            status
        ) {

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

        switch (
            status
        ) {

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

        const statuses = {

            active:
                "Active",

            upcoming:
                "Upcoming",

            voting:
                "Voting",

            completed:
                "Completed",

            cancelled:
                "Cancelled"

        };


        return (
            statuses[status] ||
            "Challenge"
        );
    }


    /* =====================================================
       CATEGORY
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
            value.charAt(0).toUpperCase() +
            value.slice(1)
        );
    }


    /* =====================================================
       DATE HELPERS
       ===================================================== */

    function parseDate(
        value
    ) {

        if (!value) {

            return null;
        }


        const timestamp =
            new Date(
                value
            ).getTime();


        if (
            Number.isNaN(
                timestamp
            )
        ) {

            return null;
        }


        return timestamp;
    }


    function timeRemaining(
        dateString
    ) {

        const target =
            parseDate(
                dateString
            );


        if (
            target === null
        ) {

            return "Unknown";
        }


        let difference =
            target - Date.now();


        if (
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
            parseDate(
                dateString
            );


        if (
            target === null
        ) {

            return "soon";
        }


        const difference =
            target -
            Date.now();


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
       COUNTDOWN
       ===================================================== */

    function startCountdownRefresh() {

        if (
            state.countdownTimer
        ) {

            clearInterval(
                state.countdownTimer
            );
        }


        state.countdownTimer =
            setInterval(
                () => {

                    if (
                        !state.challenges.length
                    ) {

                        return;
                    }


                    const oldStatuses =
                        state.challenges.map(
                            challenge =>
                                challenge.displayStatus
                        );


                    recalculateStatuses();


                    const newStatuses =
                        state.challenges.map(
                            challenge =>
                                challenge.displayStatus
                        );


                    const statusChanged =
                        oldStatuses.some(
                            (
                                oldStatus,
                                index
                            ) =>
                                oldStatus !==
                                newStatuses[
                                    index
                                ]
                        );


                    updateStatistics();


                    /*
                     * Re-render every minute so
                     * countdown text stays accurate.
                     */

                    if (
                        statusChanged
                    ) {

                        applyFilters();

                    } else {

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
       EMPTY STATE
       ===================================================== */

    function showEmptyState() {

        const empty =
            $("#challengesEmpty");


        if (!empty) {
            return;
        }


        empty.classList.add(
            "visible"
        );


        empty.style.display =
            "flex";
    }


    function hideEmptyState() {

        const empty =
            $("#challengesEmpty");


        if (!empty) {
            return;
        }


        empty.classList.remove(
            "visible"
        );


        empty.style.display =
            "";
    }


    /* =====================================================
       ERROR STATE
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
       CONTROLS
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
       DESTROY
       ===================================================== */

    function destroy() {

        if (
            state.countdownTimer
        ) {

            clearInterval(
                state.countdownTimer
            );


            state.countdownTimer =
                null;
        }
    }


    window.addEventListener(
        "pagehide",
        destroy
    );


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
         * Only initialize on the challenge
         * listing page.
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


        await loadChallenges();


        startCountdownRefresh();
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

        calculateStatus,

        recalculateStatuses,

        destroy

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