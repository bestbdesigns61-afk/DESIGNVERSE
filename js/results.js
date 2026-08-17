/* =========================================================
   DESIGNVERSE — RESULTS SYSTEM
   js/results.js

   Handles:
   - Completed challenge results
   - Final vote totals
   - Final ranking
   - Winner / podium
   - Full result list
   - Challenge validation
   - Results statistics

   IMPORTANT:
   Results are READ-ONLY.

   Final score:
       score = total votes

   Ranking:
       highest votes → best rank

   Tie handling:
       1
       2
       2
       4

   This file does NOT modify:
       submissions.score
       submissions.rank

   The votes table remains the source of truth.
   ========================================================= */

"use strict";


const DVResults = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        challenge: null,

        entries: [],

        podium: {

            first: null,

            second: null,

            third: null

        },

        statistics: {

            submissions: 0,

            designers: 0,

            votes: 0,

            topScore: 0

        },

        loading: false

    };


    /* =====================================================
       DOM
       ===================================================== */

    function $(selector) {

        return document.querySelector(
            selector
        );
    }


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (!window.supabaseClient) {

            console.error(
                "DESIGNVERSE: Supabase client is unavailable."
            );

            return null;
        }


        return window.supabaseClient;
    }


    /* =====================================================
       URL PARAMETER
       ===================================================== */

    function getChallengeIdentifier() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return {

            id:
                params.get(
                    "challenge"
                ) ||
                params.get(
                    "challenge_id"
                ) ||
                params.get(
                    "id"
                ),

            slug:
                params.get(
                    "slug"
                )

        };
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


        return Number.isNaN(
            timestamp
        )
            ? null
            : timestamp;
    }


    /* =====================================================
       LOAD CHALLENGE
       ===================================================== */

    async function loadChallenge() {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const identifier =
            getChallengeIdentifier();


        if (
            !identifier.id &&
            !identifier.slug
        ) {

            throw new Error(
                "No challenge was specified."
            );
        }


        let query =
            supabase
                .from("challenges")
                .select(`
                    id,
                    title,
                    slug,
                    description,
                    category,
                    difficulty,
                    prize,
                    points,
                    starts_at,
                    ends_at,
                    voting_ends_at,
                    status,
                    cover_image_url
                `);


        if (
            identifier.id
        ) {

            query =
                query.eq(
                    "id",
                    identifier.id
                );

        } else {

            query =
                query.eq(
                    "slug",
                    identifier.slug
                );
        }


        const {
            data,
            error
        } =
            await query.single();


        if (error) {

            console.error(
                "DESIGNVERSE results challenge error:",
                error
            );

            throw error;
        }


        if (!data) {

            throw new Error(
                "Challenge not found."
            );
        }


        state.challenge =
            data;


        return data;
    }


    /* =====================================================
       CHALLENGE STATUS
       ===================================================== */

    function getChallengeStatus(
        challenge = state.challenge
    ) {

        if (!challenge) {

            return "unknown";
        }


        if (
            challenge.status ===
            "cancelled"
        ) {

            return "cancelled";
        }


        const now =
            Date.now();


        const starts =
            parseDate(
                challenge.starts_at
            );


        const ends =
            parseDate(
                challenge.ends_at
            );


        const votingEnds =
            parseDate(
                challenge.voting_ends_at
            );


        if (
            starts !== null &&
            now < starts
        ) {

            return "upcoming";
        }


        if (
            ends !== null &&
            now < ends
        ) {

            return "active";
        }


        if (
            votingEnds !== null &&
            now < votingEnds
        ) {

            return "voting";
        }


        if (
            votingEnds !== null &&
            now >= votingEnds
        ) {

            return "completed";
        }


        return (
            challenge.status ||
            "unknown"
        );
    }


    /* =====================================================
       VERIFY RESULTS ARE AVAILABLE
       ===================================================== */

    function validateResultsAvailability() {

        if (
            !state.challenge
        ) {

            throw new Error(
                "No challenge is loaded."
            );
        }


        const status =
            getChallengeStatus();


        /*
         * Results should only be final after the
         * voting window has ended.
         */

        if (
            status ===
            "cancelled"
        ) {

            throw new Error(
                "Results are unavailable because this challenge was cancelled."
            );
        }


        if (
            status ===
            "upcoming"
        ) {

            throw new Error(
                "This challenge has not started yet."
            );
        }


        if (
            status ===
            "active"
        ) {

            throw new Error(
                "This challenge is still accepting submissions."
            );
        }


        if (
            status ===
            "voting"
        ) {

            throw new Error(
                "Voting is still open. Final results will appear after voting ends."
            );
        }


        if (
            status !==
            "completed"
        ) {

            throw new Error(
                "Final results are not available yet."
            );
        }


        return true;
    }


    /* =====================================================
       LOAD SUBMISSIONS
       ===================================================== */

    async function loadSubmissions() {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        if (
            !state.challenge
        ) {

            throw new Error(
                "No challenge is loaded."
            );
        }


        const {
            data,
            error
        } =
            await supabase
                .from("submissions")
                .select(`
                    id,
                    challenge_id,
                    design_id,
                    designer_id,
                    status,
                    score,
                    rank,
                    submitted_at,
                    updated_at,
                    design:designs (
                        id,
                        title,
                        description,
                        category,
                        image_url,
                        thumbnail_url,
                        tags,
                        is_public
                    )
                `)
                .eq(
                    "challenge_id",
                    state.challenge.id
                )
                .order(
                    "submitted_at",
                    {
                        ascending:
                            true
                    }
                );


        if (error) {

            console.error(
                "DESIGNVERSE results submissions error:",
                error
            );

            throw error;
        }


        const submissions =
            data || [];


        /*
         * Get all vote totals from the votes table.
         */

        const voteCounts =
            await loadVoteCounts(
                submissions
            );


        state.entries =
            submissions.map(
                submission => ({

                    ...submission,

                    finalScore:
                        voteCounts.get(
                            submission.id
                        ) ||
                        0,

                    finalRank:
                        null

                })
            );


        calculateFinalRanks();


        calculateStatistics();


        return state.entries;
    }


    /* =====================================================
       LOAD VOTE COUNTS
       ===================================================== */

    async function loadVoteCounts(
        submissions
    ) {

        const supabase =
            getSupabase();


        const counts =
            new Map();


        if (
            !supabase ||
            !submissions.length
        ) {

            return counts;
        }


        const submissionIds =
            submissions.map(
                submission =>
                    submission.id
            );


        const {
            data,
            error
        } =
            await supabase
                .from("votes")
                .select(
                    "id, submission_id"
                )
                .in(
                    "submission_id",
                    submissionIds
                );


        if (error) {

            console.error(
                "DESIGNVERSE final vote count error:",
                error
            );


            throw error;
        }


        (data || []).forEach(
            vote => {

                counts.set(

                    vote.submission_id,

                    (
                        counts.get(
                            vote.submission_id
                        ) ||
                        0
                    ) + 1

                );

            }
        );


        return counts;
    }


    /* =====================================================
       CALCULATE FINAL RANKS
       ===================================================== */

    function calculateFinalRanks() {

        const ranked =
            [
                ...state.entries
            ]
            .sort(
                (
                    a,
                    b
                ) => {

                    const scoreDifference =
                        Number(
                            b.finalScore ||
                            0
                        ) -
                        Number(
                            a.finalScore ||
                            0
                        );


                    if (
                        scoreDifference !==
                        0
                    ) {

                        return scoreDifference;
                    }


                    /*
                     * Deterministic tie ordering:
                     * earlier submission appears first.
                     */

                    const dateA =
                        parseDate(
                            a.submitted_at
                        ) ||
                        0;


                    const dateB =
                        parseDate(
                            b.submitted_at
                        ) ||
                        0;


                    return (
                        dateA -
                        dateB
                    );
                }
            );


        let previousScore =
            null;


        let currentRank =
            0;


        ranked.forEach(
            (
                entry,
                index
            ) => {

                const score =
                    Number(
                        entry.finalScore ||
                        0
                    );


                if (
                    previousScore ===
                    null
                ) {

                    currentRank =
                        1;

                } else if (
                    score !==
                    previousScore
                ) {

                    /*
                     * Competition ranking:
                     *
                     * 1
                     * 2
                     * 2
                     * 4
                     */

                    currentRank =
                        index + 1;
                }


                entry.finalRank =
                    currentRank;


                previousScore =
                    score;
            }
        );


        /*
         * Rebuild the main array in final ranking
         * order.
         */

        state.entries =
            ranked;


        state.podium = {

            first:
                ranked.find(
                    entry =>
                        entry.finalRank ===
                        1
                ) ||
                null,

            second:
                ranked.find(
                    entry =>
                        entry.finalRank ===
                        2
                ) ||
                null,

            third:
                ranked.find(
                    entry =>
                        entry.finalRank ===
                        3
                ) ||
                null

        };


        return state.entries;
    }


    /* =====================================================
       STATISTICS
       ===================================================== */

    function calculateStatistics() {

        const entries =
            state.entries;


        const totalVotes =
            entries.reduce(
                (
                    total,
                    entry
                ) =>
                    total +
                    Number(
                        entry.finalScore ||
                        0
                    ),
                0
            );


        const designers =
            new Set(
                entries.map(
                    entry =>
                        entry.designer_id
                )
            );


        const topScore =
            entries.length
                ? Number(
                    entries[0].finalScore ||
                    0
                )
                : 0;


        state.statistics = {

            submissions:
                entries.length,

            designers:
                designers.size,

            votes:
                totalVotes,

            topScore

        };


        return state.statistics;
    }


    /* =====================================================
       WINNER
       ===================================================== */

    function getWinner() {

        return (
            state.podium.first ||
            null
        );
    }


    /* =====================================================
       RENDER RESULTS
       ===================================================== */

    function renderResults() {

        const winner =
            getWinner();


        renderChallengeHeader();

        renderStatistics();

        renderWinner(
            winner
        );

        renderPodium();

        renderFullRanking();


        /*
         * Results content is visible once all
         * rendering has completed.
         */

        const content =
            $("#resultsContent");


        content?.removeAttribute(
            "hidden"
        );
    }


    /* =====================================================
       HEADER
       ===================================================== */

    function renderChallengeHeader() {

        const challenge =
            state.challenge;


        if (!challenge) {

            return;
        }


        document.title =
            `${challenge.title} Results — DESIGNVERSE`;


        setText(
            "#resultsChallengeTitle",
            challenge.title
        );


        setText(
            "#resultsBreadcrumb",
            `${challenge.title} Results`
        );


        const description =
            challenge.description ||
            "The final results are in. See the winning designs and final rankings.";


        setText(
            "#resultsHeroDescription",
            description
        );
    }


    /* =====================================================
       STATISTICS
       ===================================================== */

    function renderStatistics() {

        const stats =
            state.statistics;


        setText(
            "#resultsSubmissionCount",
            formatNumber(
                stats.submissions
            )
        );


        setText(
            "#resultsDesignerCount",
            formatNumber(
                stats.designers
            )
        );


        setText(
            "#resultsVoteCount",
            formatNumber(
                stats.votes
            )
        );


        setText(
            "#resultsTopScore",
            formatNumber(
                stats.topScore
            )
        );
    }


    /* =====================================================
       WINNER
       ===================================================== */

    function renderWinner(
        winner
    ) {

        const title =
            $("#winnerTitle");


        const description =
            $("#winnerDescription");


        const score =
            $("#winnerScore");


        const category =
            $("#winnerCategory");


        const prize =
            $("#winnerPrize");


        const imageContainer =
            $("#winnerImage");


        const designLink =
            $("#winnerDesignLink");


        if (!winner) {

            setText(
                "#winnerTitle",
                "No winner yet"
            );


            setText(
                "#winnerDescription",
                "No submissions have received votes yet."
            );


            setText(
                "#winnerScore",
                "0"
            );


            setText(
                "#winnerCategory",
                "—"
            );


            setText(
                "#winnerPrize",
                state.challenge?.prize ||
                "—"
            );


            return;
        }


        const design =
            winner.design ||
            {};


        setText(
            "#winnerTitle",
            design.title ||
            "Untitled Design"
        );


        setText(
            "#winnerDescription",
            design.description ||
            "The winning submission for this challenge."
        );


        setText(
            "#winnerScore",
            formatNumber(
                winner.finalScore
            )
        );


        setText(
            "#winnerCategory",
            formatCategory(
                design.category
            )
        );


        setText(
            "#winnerPrize",
            state.challenge?.prize ||
            "—"
        );


        if (
            imageContainer
        ) {

            renderImageContainer(
                imageContainer,
                design,
                "winner-image-placeholder"
            );
        }


        if (
            designLink &&
            design.id
        ) {

            designLink.href =
                `design.html?id=${encodeURIComponent(
                    design.id
                )}`;
        }
    }


    /* =====================================================
       PODIUM
       ===================================================== */

    function renderPodium() {

        renderPodiumEntry(
            "#resultsFirst",
            state.podium.first,
            1
        );


        renderPodiumEntry(
            "#resultsSecond",
            state.podium.second,
            2
        );


        renderPodiumEntry(
            "#resultsThird",
            state.podium.third,
            3
        );
    }


    function renderPodiumEntry(
        selector,
        entry,
        rank
    ) {

        const container =
            $(selector);


        if (!container) {

            return;
        }


        if (!entry) {

            container.innerHTML = `

                <div
                    class="results-podium-rank"
                >
                    ${getMedal(
                        rank
                    )}
                </div>


                <div
                    class="results-podium-image"
                >

                    <div
                        class="results-podium-placeholder"
                    >

                        <i
                            class="fa-solid fa-user"
                        ></i>

                    </div>

                </div>


                <strong
                    class="results-podium-title"
                >
                    Awaiting entry
                </strong>


                <span
                    class="results-podium-score"
                >
                    —

                </span>

            `;


            return;
        }


        const design =
            entry.design ||
            {};


        const image =
            design.image_url ||
            design.thumbnail_url ||
            "";


        const imageHTML =
            image
                ? `

                    <img
                        src="${escapeAttribute(
                            image
                        )}"
                        alt="${escapeAttribute(
                            design.title ||
                            "Design"
                        )}"
                    >

                `
                : `

                    <div
                        class="results-podium-placeholder"
                    >

                        <i
                            class="fa-solid fa-palette"
                        ></i>

                    </div>

                `;


        container.innerHTML = `

            <div
                class="results-podium-rank"
            >

                ${getMedal(
                    rank
                )}

            </div>


            <div
                class="results-podium-image"
            >

                ${imageHTML}

            </div>


            <strong
                class="results-podium-title"
            >

                ${escapeHTML(
                    design.title ||
                    "Untitled Design"
                )}

            </strong>


            <span
                class="results-podium-score"
            >

                ${formatNumber(
                    entry.finalScore
                )}

                ${
                    Number(
                        entry.finalScore
                    ) === 1
                        ? "vote"
                        : "votes"
                }

            </span>

        `;
    }


    /* =====================================================
       FULL RANKING
       ===================================================== */

    function renderFullRanking() {

        const container =
            $("#resultsList");


        if (!container) {

            return;
        }


        container.innerHTML =
            "";


        if (
            !state.entries.length
        ) {

            container.innerHTML = `

                <div
                    class="results-loading"
                >

                    <i
                        class="fa-solid fa-images"
                    ></i>

                    No submissions were found.

                </div>

            `;


            return;
        }


        state.entries.forEach(
            entry => {

                container.appendChild(
                    createResultRow(
                        entry
                    )
                );

            }
        );
    }


    /* =====================================================
       CREATE RESULT ROW
       ===================================================== */

    function createResultRow(
        entry
    ) {

        const row =
            document.createElement(
                "article"
            );


        row.className =
            "results-row";


        const design =
            entry.design ||
            {};


        const rank =
            entry.finalRank;


        const score =
            Number(
                entry.finalScore ||
                0
            );


        const image =
            design.image_url ||
            design.thumbnail_url ||
            "";


        const imageHTML =
            image
                ? `

                    <img
                        src="${escapeAttribute(
                            image
                        )}"
                        alt="${escapeAttribute(
                            design.title ||
                            "Design"
                        )}"
                        loading="lazy"
                    >

                `
                : `

                    <div
                        class="results-row-image-placeholder"
                    >

                        <i
                            class="fa-solid fa-palette"
                        ></i>

                    </div>

                `;


        row.innerHTML = `

            <div
                class="results-row-rank"
            >

                ${getMedal(
                    rank
                ) ||
                `#${formatNumber(
                    rank
                )}`}

            </div>


            <div
                class="results-row-design"
            >

                <div
                    class="results-row-image"
                >

                    ${imageHTML}

                </div>


                <div
                    class="results-row-info"
                >

                    <h3>

                        ${escapeHTML(
                            design.title ||
                            "Untitled Design"
                        )}

                    </h3>


                    <span>

                        ${escapeHTML(
                            formatCategory(
                                design.category
                            )
                        )}

                    </span>

                </div>

            </div>


            <div
                class="results-row-score"
            >

                <strong>
                    ${formatNumber(
                        score
                    )}
                </strong>

                <span>

                    ${
                        score === 1
                            ? "Vote"
                            : "Votes"
                    }

                </span>

            </div>


            <a
                href="design.html?id=${encodeURIComponent(
                    design.id ||
                    ""
                )}"
                class="btn btn-secondary btn-small"
            >

                View

                <i
                    class="fa-solid fa-arrow-right"
                ></i>

            </a>

        `;


        return row;
    }


    /* =====================================================
       IMAGE CONTAINER
       ===================================================== */

    function renderImageContainer(
        container,
        design,
        placeholderClass
    ) {

        const image =
            design?.image_url ||
            design?.thumbnail_url ||
            "";


        if (
            image
        ) {

            container.innerHTML = `

                <img
                    src="${escapeAttribute(
                        image
                    )}"
                    alt="${escapeAttribute(
                        design.title ||
                        "Winning design"
                    )}"
                >

                <span
                    class="winner-badge"
                >

                    <i
                        class="fa-solid fa-trophy"
                    ></i>

                    1ST PLACE

                </span>

            `;

        } else {

            container.innerHTML = `

                <div
                    class="${placeholderClass}"
                >

                    <i
                        class="fa-solid fa-palette"
                    ></i>

                </div>

                <span
                    class="winner-badge"
                >

                    <i
                        class="fa-solid fa-trophy"
                    ></i>

                    1ST PLACE

                </span>

            `;
        }
    }


    /* =====================================================
       MEDALS
       ===================================================== */

    function getMedal(
        rank
    ) {

        switch (
            Number(rank)
        ) {

            case 1:
                return "🥇";

            case 2:
                return "🥈";

            case 3:
                return "🥉";

            default:
                return "";

        }
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    function formatCategory(
        category
    ) {

        const map = {

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


        return (
            map[category] ||
            "Other"
        );
    }


    function formatNumber(
        value
    ) {

        return new Intl.NumberFormat(
            "en-US"
        ).format(
            Number(value) || 0
        );
    }


    function setText(
        selector,
        value
    ) {

        const element =
            $(selector);


        if (element) {

            element.textContent =
                value ?? "";
        }
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
                value ??
                ""
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


    /* =====================================================
       ERROR
       ===================================================== */

    function showError(
        error
    ) {

        const loading =
            $("#resultsLoading");


        loading?.remove();


        const content =
            $("#resultsContent");


        content?.setAttribute(
            "hidden",
            ""
        );


        const errorContainer =
            $("#resultsError");


        errorContainer?.classList.add(
            "visible"
        );


        setText(
            "#resultsErrorMessage",
            error?.message ||
            "Unable to load challenge results."
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
         * Only activate on results pages.
         */

        const isResultsPage =
            Boolean(
                document.body.dataset.resultsPage
            ) ||
            Boolean(
                $("#winnerCard")
            ) ||
            Boolean(
                $("#resultsList")
            );


        if (
            !isResultsPage
        ) {

            return;
        }


        state.initialized =
            true;


        const identifier =
            getChallengeIdentifier();


        if (
            !identifier.id &&
            !identifier.slug
        ) {

            showError(
                new Error(
                    "No challenge was specified. Open results from a completed challenge."
                )
            );


            return;
        }


        state.loading =
            true;


        try {

            /*
             * Load challenge first.
             */

            await loadChallenge();


            /*
             * Results should only be displayed
             * after voting has ended.
             */

            validateResultsAvailability();


            /*
             * Load submissions and votes.
             */

            await loadSubmissions();


            /*
             * Render entire page.
             */

            renderResults();


        } catch (error) {

            console.error(
                "DESIGNVERSE results error:",
                error
            );


            showError(
                error
            );

        } finally {

            state.loading =
                false;
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        state,

        init,

        loadChallenge,

        loadSubmissions,

        loadVoteCounts,

        getChallengeStatus,

        validateResultsAvailability,

        calculateFinalRanks,

        calculateStatistics,

        getWinner,

        renderResults

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVResults =
    DVResults;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVResults.init();

    }
);


/* =========================================================
   DESIGNVERSE RESULTS SYSTEM COMPLETE
   ========================================================= */