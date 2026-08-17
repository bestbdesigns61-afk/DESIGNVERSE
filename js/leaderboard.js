/* =========================================================
   DESIGNVERSE — LEADERBOARD SYSTEM
   js/leaderboard.js

   Handles:
   - Challenge leaderboard
   - Vote-based rankings
   - Submission rankings
   - Designer rankings
   - Rank calculation
   - Tie handling
   - Challenge lookup from URL
   - Sorting
   - Search
   - Leaderboard statistics

   V1 SCORING:

   score = total votes

   Ranking:

   1st = highest votes
   2nd = next highest
   3rd = next highest
   etc.

   Ties use competition ranking:

   1
   2
   2
   4
   ========================================================= */

"use strict";


const DVLeaderboard = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        user: null,

        challenge: null,

        entries: [],

        filteredEntries: [],

        search: "",

        sort: "votes",

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
       CURRENT USER
       ===================================================== */

    async function getCurrentUser() {

        const supabase =
            getSupabase();


        if (!supabase) {

            return null;
        }


        const {
            data,
            error
        } =
            await supabase.auth.getUser();


        if (error) {

            console.warn(
                "DESIGNVERSE leaderboard user lookup:",
                error
            );

            return null;
        }


        state.user =
            data?.user ||
            null;


        return state.user;
    }


    /* =====================================================
       CHALLENGE IDENTIFIER
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
                ) ||
                params.get(
                    "challengeSlug"
                )

        };
    }


    /* =====================================================
       LOAD CHALLENGE
       ===================================================== */

    async function loadChallenge(
        identifier = null
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const challengeIdentifier =
            identifier ||
            getChallengeIdentifier();


        /*
         * On the global leaderboard there may be
         * no challenge parameter.
         */

        if (
            !challengeIdentifier.id &&
            !challengeIdentifier.slug
        ) {

            return null;
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
            challengeIdentifier.id
        ) {

            query =
                query.eq(
                    "id",
                    challengeIdentifier.id
                );

        } else {

            query =
                query.eq(
                    "slug",
                    challengeIdentifier.slug
                );
        }


        const {
            data,
            error
        } =
            await query.single();


        if (error) {

            throw error;
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
       LOAD SUBMISSIONS
       ===================================================== */

    async function loadSubmissions(
        challengeId = null
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const id =
            challengeId ||
            state.challenge?.id;


        if (!id) {

            throw new Error(
                "No challenge selected."
            );
        }


        state.loading =
            true;


        try {

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
                        id
                    )
                    .order(
                        "submitted_at",
                        {
                            ascending:
                                true
                        }
                    );


            if (error) {

                throw error;
            }


            state.entries =
                await attachVoteCounts(
                    data || []
                );


            calculateRanks();


            state.filteredEntries =
                [
                    ...state.entries
                ];


            applySearch();


            return state.entries;

        } finally {

            state.loading =
                false;
        }
    }


    /* =====================================================
       ATTACH VOTE COUNTS
       ===================================================== */

    async function attachVoteCounts(
        submissions
    ) {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !submissions.length
        ) {

            return submissions.map(
                submission => ({

                    ...submission,

                    voteCount:
                        0

                })
            );
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
                .select(`
                    id,
                    submission_id
                `)
                .in(
                    "submission_id",
                    submissionIds
                );


        if (error) {

            console.warn(
                "DESIGNVERSE leaderboard vote count error:",
                error
            );


            /*
             * Fall back to existing score values
             * when votes aren't readable.
             */

            return submissions.map(
                submission => ({

                    ...submission,

                    voteCount:
                        Number(
                            submission.score ||
                            0
                        )

                })
            );
        }


        const counts =
            new Map();


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


        return submissions.map(
            submission => ({

                ...submission,

                voteCount:
                    counts.get(
                        submission.id
                    ) ||
                    0

            })
        );
    }


    /* =====================================================
       CALCULATE RANKS
       ===================================================== */

    function calculateRanks() {

        /*
         * Highest vote count first.
         */

        const ranked =
            [
                ...state.entries
            ]
            .sort(
                (
                    a,
                    b
                ) => {

                    const voteDifference =
                        Number(
                            b.voteCount ||
                            0
                        ) -
                        Number(
                            a.voteCount ||
                            0
                        );


                    if (
                        voteDifference !== 0
                    ) {

                        return voteDifference;
                    }


                    /*
                     * Tie breaker:
                     * earlier submission wins.
                     *
                     * This doesn't change the displayed
                     * rank when the vote count is equal,
                     * but gives deterministic ordering.
                     */

                    return (
                        new Date(
                            a.submitted_at
                        ) -
                        new Date(
                            b.submitted_at
                        )
                    );

                }
            );


        let previousVotes =
            null;


        let currentRank =
            0;


        ranked.forEach(
            (
                entry,
                index
            ) => {

                const votes =
                    Number(
                        entry.voteCount ||
                        0
                    );


                if (
                    previousVotes ===
                    null
                ) {

                    currentRank =
                        1;

                } else if (
                    votes !==
                    previousVotes
                ) {

                    /*
                     * Competition ranking:
                     * 1, 2, 2, 4
                     */

                    currentRank =
                        index + 1;
                }


                entry.calculatedScore =
                    votes;


                entry.calculatedRank =
                    currentRank;


                previousVotes =
                    votes;

            }
        );


        /*
         * Re-map calculated ranks back into
         * the original array objects.
         */

        const rankMap =
            new Map();


        ranked.forEach(
            entry => {

                rankMap.set(
                    entry.id,
                    {

                        score:
                            entry.calculatedScore,

                        rank:
                            entry.calculatedRank

                    }
                );

            }
        );


        state.entries.forEach(
            entry => {

                const ranking =
                    rankMap.get(
                        entry.id
                    );


                if (
                    ranking
                ) {

                    entry.calculatedScore =
                        ranking.score;

                    entry.calculatedRank =
                        ranking.rank;
                }

            }
        );


        return state.entries;
    }


    /* =====================================================
       SEARCH
       ===================================================== */

    function search(
        query
    ) {

        state.search =
            String(
                query ||
                ""
            )
            .trim()
            .toLowerCase();


        applySearch();
    }


    function applySearch() {

        if (
            !state.search
        ) {

            state.filteredEntries =
                [
                    ...state.entries
                ];

            sortEntries(
                state.sort
            );

            return;
        }


        state.filteredEntries =
            state.entries.filter(
                entry => {

                    const design =
                        entry.design ||
                        {};


                    const title =
                        String(
                            design.title ||
                            ""
                        )
                        .toLowerCase();


                    const description =
                        String(
                            design.description ||
                            ""
                        )
                        .toLowerCase();


                    const category =
                        String(
                            design.category ||
                            ""
                        )
                        .toLowerCase();


                    return (
                        title.includes(
                            state.search
                        ) ||
                        description.includes(
                            state.search
                        ) ||
                        category.includes(
                            state.search
                        )
                    );
                }
            );


        sortEntries(
            state.sort
        );
    }


    /* =====================================================
       SORT
       ===================================================== */

    function sortEntries(
        mode = "votes"
    ) {

        state.sort =
            mode;


        switch (
            mode
        ) {

            case "votes":

                state.filteredEntries.sort(
                    (
                        a,
                        b
                    ) => {

                        const difference =
                            Number(
                                b.calculatedScore ||
                                0
                            ) -
                            Number(
                                a.calculatedScore ||
                                0
                            );


                        if (
                            difference !== 0
                        ) {

                            return difference;
                        }


                        return (
                            new Date(
                                a.submitted_at
                            ) -
                            new Date(
                                b.submitted_at
                            )
                        );
                    }
                );

                break;


            case "newest":

                state.filteredEntries.sort(
                    (
                        a,
                        b
                    ) =>
                        new Date(
                            b.submitted_at
                        ) -
                        new Date(
                            a.submitted_at
                        )
                );

                break;


            case "oldest":

                state.filteredEntries.sort(
                    (
                        a,
                        b
                    ) =>
                        new Date(
                            a.submitted_at
                        ) -
                        new Date(
                            b.submitted_at
                        )
                );

                break;


            case "rank":

                state.filteredEntries.sort(
                    (
                        a,
                        b
                    ) =>
                        Number(
                            a.calculatedRank ||
                            999999
                        ) -
                        Number(
                            b.calculatedRank ||
                            999999
                        )
                );

                break;


            default:

                break;
        }


        return state.filteredEntries;
    }


    /* =====================================================
       PODIUM
       ===================================================== */

    function getPodium() {

        const ranked =
            [
                ...state.entries
            ]
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(
                        a.calculatedRank ||
                        999999
                    ) -
                    Number(
                        b.calculatedRank ||
                        999999
                    )
            );


        return {

            first:
                ranked.find(
                    entry =>
                        entry.calculatedRank ===
                        1
                ) ||
                null,

            second:
                ranked.find(
                    entry =>
                        entry.calculatedRank ===
                        2
                ) ||
                null,

            third:
                ranked.find(
                    entry =>
                        entry.calculatedRank ===
                        3
                ) ||
                null

        };
    }


    /* =====================================================
       LEADERBOARD STATS
       ===================================================== */

    function getStatistics() {

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
                        entry.calculatedScore ||
                        0
                    ),
                0
            );


        const highestScore =
            entries.length
                ? Math.max(
                    ...entries.map(
                        entry =>
                            Number(
                                entry.calculatedScore ||
                                0
                            )
                    )
                )
                : 0;


        const uniqueDesigners =
            new Set(
                entries.map(
                    entry =>
                        entry.designer_id
                )
            ).size;


        return {

            submissions:
                entries.length,

            votes:
                totalVotes,

            designers:
                uniqueDesigners,

            highestScore

        };
    }


    /* =====================================================
       FIND USER ENTRY
       ===================================================== */

    function getCurrentUserEntry() {

        if (
            !state.user
        ) {

            return null;
        }


        return (
            state.entries.find(
                entry =>
                    entry.designer_id ===
                    state.user.id
            ) ||
            null
        );
    }


    /* =====================================================
       MEDAL
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
       CREATE LEADERBOARD ROW
       ===================================================== */

    function createLeaderboardRow(
        entry,
        index
    ) {

        const row =
            document.createElement(
                "article"
            );


        row.className =
            "leaderboard-row";


        row.dataset.submissionId =
            entry.id;


        const design =
            entry.design ||
            {};


        const rank =
            entry.calculatedRank ||
            index + 1;


        const score =
            Number(
                entry.calculatedScore ||
                0
            );


        const medal =
            getMedal(
                rank
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
                        class="leaderboard-image-placeholder"
                    >

                        <i
                            class="fa-solid fa-palette"
                        ></i>

                    </div>
                `;


        const isCurrentUser =
            state.user &&
            entry.designer_id ===
            state.user.id;


        row.innerHTML = `

            <div
                class="leaderboard-rank"
            >

                ${
                    medal
                        ? `
                            <span
                                class="leaderboard-medal"
                            >
                                ${medal}
                            </span>
                          `
                        : `
                            <span>
                                #${formatNumber(
                                    rank
                                )}
                            </span>
                          `
                }

            </div>


            <div
                class="leaderboard-design"
            >

                <div
                    class="leaderboard-design-image"
                >

                    ${imageHTML}

                </div>


                <div
                    class="leaderboard-design-info"
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

                        ${
                            isCurrentUser
                                ? " · Your Entry"
                                : ""
                        }

                    </span>

                </div>

            </div>


            <div
                class="leaderboard-score"
            >

                <strong>
                    ${formatNumber(
                        score
                    )}
                </strong>

                <span>
                    ${
                        score === 1
                            ? "vote"
                            : "votes"
                    }
                </span>

            </div>


            <a
                href="design.html?id=${encodeURIComponent(
                    design.id ||
                    ""
                )}"
                class="btn btn-secondary btn-small leaderboard-view-button"
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
       RENDER LEADERBOARD
       ===================================================== */

    function renderLeaderboard(
        options = {}
    ) {

        const container =
            options.container ||
            $("#leaderboardList");


        if (!container) {

            return;
        }


        calculateRanks();


        applySearch();


        const entries =
            state.filteredEntries;


        container.innerHTML =
            "";


        if (
            !entries.length
        ) {

            renderEmptyState(
                container
            );


            return;
        }


        entries.forEach(
            (
                entry,
                index
            ) => {

                container.appendChild(
                    createLeaderboardRow(
                        entry,
                        index
                    )
                );

            }
        );


        updateLeaderboardUI();
    }


    /* =====================================================
       RENDER EMPTY
       ===================================================== */

    function renderEmptyState(
        container
    ) {

        container.innerHTML = `

            <div
                class="leaderboard-empty"
                style="
                    grid-column:1/-1;
                    min-height:300px;
                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    justify-content:center;
                    text-align:center;
                    padding:40px;
                "
            >

                <div
                    style="
                        width:64px;
                        height:64px;
                        display:grid;
                        place-items:center;
                        margin-bottom:15px;
                        border-radius:18px;
                        background:rgba(124,58,237,.10);
                        color:#c4b5fd;
                        font-size:23px;
                    "
                >

                    <i
                        class="fa-solid fa-trophy"
                    ></i>

                </div>


                <h2
                    style="
                        margin:0 0 7px;
                        color:white;
                        font-size:21px;
                    "
                >

                    No rankings yet

                </h2>


                <p
                    style="
                        max-width:420px;
                        margin:0;
                        color:#71717a;
                        font-size:9px;
                        line-height:1.6;
                    "
                >

                    Rankings will appear once designers
                    start submitting entries and receiving votes.

                </p>

            </div>

        `;
    }


    /* =====================================================
       UPDATE LEADERBOARD UI
       ===================================================== */

    function updateLeaderboardUI() {

        const stats =
            getStatistics();


        setText(
            "#leaderboardSubmissionCount",
            formatNumber(
                stats.submissions
            )
        );


        setText(
            "#leaderboardVoteCount",
            formatNumber(
                stats.votes
            )
        );


        setText(
            "#leaderboardDesignerCount",
            formatNumber(
                stats.designers
            )
        );


        setText(
            "#leaderboardTopScore",
            formatNumber(
                stats.highestScore
            )
        );


        if (
            state.challenge
        ) {

            setText(
                "#leaderboardChallengeTitle",
                state.challenge.title
            );


            setText(
                "#leaderboardChallengeStatus",
                formatStatus(
                    getChallengeStatus()
                )
            );
        }


        renderPodium();
    }


    /* =====================================================
       PODIUM
       ===================================================== */

    function renderPodium() {

        const podium =
            getPodium();


        renderPodiumEntry(
            "#podiumFirst",
            podium.first,
            1
        );


        renderPodiumEntry(
            "#podiumSecond",
            podium.second,
            2
        );


        renderPodiumEntry(
            "#podiumThird",
            podium.third,
            3
        );
    }


    function renderPodiumEntry(
        selector,
        entry,
        expectedRank
    ) {

        const container =
            $(selector);


        if (!container) {

            return;
        }


        if (
            !entry
        ) {

            container.innerHTML = `

                <div
                    class="podium-empty"
                >

                    <i
                        class="fa-solid fa-user"
                    ></i>

                    <span>
                        Awaiting entry
                    </span>

                </div>

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
                        class="podium-image-placeholder"
                    >

                        <i
                            class="fa-solid fa-palette"
                        ></i>

                    </div>
                `;


        container.innerHTML = `

            <div
                class="podium-image"
            >

                ${imageHTML}

            </div>


            <span
                class="podium-medal"
            >
                ${getMedal(
                    expectedRank
                )}
            </span>


            <strong
                class="podium-title"
            >
                ${escapeHTML(
                    design.title ||
                    "Untitled Design"
                )}
            </strong>


            <span
                class="podium-votes"
            >

                ${formatNumber(
                    entry.calculatedScore ||
                    0
                )}

                ${
                    Number(
                        entry.calculatedScore ||
                        0
                    ) === 1
                        ? "vote"
                        : "votes"
                }

            </span>

        `;
    }


    /* =====================================================
       LOAD GLOBAL LEADERBOARD
       ===================================================== */

    async function loadGlobalLeaderboard() {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        state.loading =
            true;


        try {

            /*
             * Global leaderboard is designer-focused.
             *
             * We use completed challenge submissions
             * and their vote counts.
             */

            const {
                data,
                error
            } =
                await supabase
                    .from("submissions")
                    .select(`
                        id,
                        challenge_id,
                        designer_id,
                        status,
                        score,
                        rank,
                        submitted_at,
                        challenge:challenges (
                            id,
                            title,
                            slug,
                            status,
                            ends_at,
                            voting_ends_at
                        ),
                        design:designs (
                            id,
                            title,
                            category,
                            image_url,
                            thumbnail_url
                        )
                    `);


            if (error) {

                throw error;
            }


            const submissions =
                await attachVoteCounts(
                    data || []
                );


            state.entries =
                submissions;


            calculateRanks();


            /*
             * Group by designer and calculate
             * total votes / challenge score.
             */

            const designerMap =
                new Map();


            submissions.forEach(
                submission => {

                    const designerId =
                        submission.designer_id;


                    if (
                        !designerMap.has(
                            designerId
                        )
                    ) {

                        designerMap.set(
                            designerId,
                            {

                                designer_id:
                                    designerId,

                                totalVotes:
                                    0,

                                challenges:
                                    0,

                                bestRank:
                                    Infinity,

                                submissions:
                                    0,

                                latestSubmission:
                                    submission

                            }
                        );
                    }


                    const designer =
                        designerMap.get(
                            designerId
                        );


                    const votes =
                        Number(
                            submission.voteCount ||
                            0
                        );


                    designer.totalVotes +=
                        votes;


                    designer.challenges +=
                        1;


                    designer.submissions +=
                        1;


                    designer.bestRank =
                        Math.min(
                            designer.bestRank,
                            Number(
                                submission.calculatedRank ||
                                999999
                            )
                        );


                    if (
                        new Date(
                            submission.submitted_at
                        ) >
                        new Date(
                            designer.latestSubmission
                                .submitted_at
                        )
                    ) {

                        designer.latestSubmission =
                            submission;
                    }

                }
            );


            return Array.from(
                designerMap.values()
            )
            .sort(
                (
                    a,
                    b
                ) => {

                    if (
                        b.totalVotes !==
                        a.totalVotes
                    ) {

                        return (
                            b.totalVotes -
                            a.totalVotes
                        );
                    }


                    return (
                        a.bestRank -
                        b.bestRank
                    );

                }
            );


        } finally {

            state.loading =
                false;
        }
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


        const hasLeaderboard =
            Boolean(
                $("#leaderboardList")
            );


        const hasPodium =
            Boolean(
                $("#podiumFirst") ||
                $("#podiumSecond") ||
                $("#podiumThird")
            );


        const hasLeaderboardMarker =
            Boolean(
                document.body.dataset.leaderboard
            );


        const identifier =
            getChallengeIdentifier();


        if (
            !hasLeaderboard &&
            !hasPodium &&
            !hasLeaderboardMarker &&
            !identifier.id &&
            !identifier.slug
        ) {

            return;
        }


        state.initialized =
            true;


        try {

            await getCurrentUser();


            /*
             * Challenge leaderboard:
             * /leaderboard.html?challenge=ID
             */

            if (
                identifier.id ||
                identifier.slug
            ) {

                await loadChallenge(
                    identifier
                );


                await loadSubmissions();


                renderLeaderboard();

                return;
            }


            /*
             * Global leaderboard:
             * /leaderboard.html
             */

            if (
                hasLeaderboard ||
                hasPodium ||
                hasLeaderboardMarker
            ) {

                const global =
                    await loadGlobalLeaderboard();


                /*
                 * Global designer leaderboard may use
                 * a different rendering block.
                 */

                renderGlobalLeaderboard(
                    global
                );
            }


        } catch (error) {

            console.error(
                "DESIGNVERSE leaderboard initialization error:",
                error
            );


            showToast(
                getLeaderboardErrorMessage(
                    error
                ),
                "error"
            );
        }
    }


    /* =====================================================
       GLOBAL LEADERBOARD RENDER
       ===================================================== */

    function renderGlobalLeaderboard(
        designers
    ) {

        const container =
            $("#leaderboardList");


        if (!container) {

            return;
        }


        container.innerHTML =
            "";


        if (
            !designers.length
        ) {

            renderEmptyState(
                container
            );


            return;
        }


        designers.forEach(
            (
                designer,
                index
            ) => {

                const row =
                    document.createElement(
                        "article"
                    );


                row.className =
                    "leaderboard-row";


                const rank =
                    index + 1;


                const latest =
                    designer.latestSubmission ||
                    {};


                const design =
                    latest.design ||
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
                                loading="lazy"
                            >
                          `
                        : `
                            <div
                                class="leaderboard-image-placeholder"
                            >

                                <i
                                    class="fa-solid fa-palette"
                                ></i>

                            </div>
                          `;


                row.innerHTML = `

                    <div
                        class="leaderboard-rank"
                    >

                        ${
                            getMedal(
                                rank
                            ) ||
                            `#${formatNumber(
                                rank
                            )}`
                        }

                    </div>


                    <div
                        class="leaderboard-design"
                    >

                        <div
                            class="leaderboard-design-image"
                        >

                            ${imageHTML}

                        </div>


                        <div
                            class="leaderboard-design-info"
                        >

                            <h3>
                                Designer
                            </h3>

                            <span>
                                ${formatNumber(
                                    designer.challenges
                                )}
                                challenge
                                ${
                                    designer.challenges === 1
                                        ? ""
                                        : "s"
                                }
                            </span>

                        </div>

                    </div>


                    <div
                        class="leaderboard-score"
                    >

                        <strong>
                            ${formatNumber(
                                designer.totalVotes
                            )}
                        </strong>

                        <span>
                            votes
                        </span>

                    </div>

                `;


                container.appendChild(
                    row
                );

            }
        );


        setText(
            "#leaderboardSubmissionCount",
            formatNumber(
                designers.reduce(
                    (
                        total,
                        designer
                    ) =>
                        total +
                        designer.submissions,
                    0
                )
            )
        );


        setText(
            "#leaderboardDesignerCount",
            formatNumber(
                designers.length
            )
        );


        setText(
            "#leaderboardVoteCount",
            formatNumber(
                designers.reduce(
                    (
                        total,
                        designer
                    ) =>
                        total +
                        designer.totalVotes,
                    0
                )
            )
        );


        setText(
            "#leaderboardTopScore",
            formatNumber(
                designers[0]?.totalVotes ||
                0
            )
        );
    }


    /* =====================================================
       ERROR
       ===================================================== */

    function getLeaderboardErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to load leaderboard."
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
                "DESIGNVERSE could not access the leaderboard data."
            );
        }


        if (
            lower.includes(
                "relationship"
            )
        ) {

            return (
                "The submission/design relationship could not be loaded."
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


        return message;
    }


    /* =====================================================
       TOAST
       ===================================================== */

    function showToast(
        message,
        type = "info"
    ) {

        let container =
            document.querySelector(
                ".leaderboard-toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "leaderboard-toast-container";


            container.style.cssText = `
                position:fixed;
                right:18px;
                bottom:18px;
                z-index:5000;
                display:flex;
                flex-direction:column;
                gap:8px;
                max-width:min(
                    390px,
                    calc(100vw - 36px)
                );
            `;


            document.body.appendChild(
                container
            );
        }


        const toast =
            document.createElement(
                "div"
            );


        const icon =
            type === "success"
                ? "fa-check"
                : type === "error"
                    ? "fa-triangle-exclamation"
                    : "fa-info-circle";


        const color =
            type === "success"
                ? "#86efac"
                : type === "error"
                    ? "#fca5a5"
                    : "#c4b5fd";


        toast.style.cssText = `
            display:flex;
            align-items:center;
            gap:10px;
            padding:13px 14px;
            border:1px solid rgba(255,255,255,.10);
            border-radius:13px;
            background:rgba(10,10,16,.96);
            color:white;
            box-shadow:0 20px 50px rgba(0,0,0,.35);
            backdrop-filter:blur(18px);
            font:10px/1.5 Inter,sans-serif;
        `;


        toast.innerHTML = `

            <i
                class="fa-solid ${icon}"
                style="color:${color};"
            ></i>

            <span>
                ${escapeHTML(
                    message
                )}
            </span>

        `;


        container.appendChild(
            toast
        );


        setTimeout(
            () => {

                toast.remove();

            },
            4000
        );
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
                value ?? "";
        }
    }


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


    function formatStatus(
        status
    ) {

        const map = {

            upcoming:
                "Upcoming",

            active:
                "Active",

            voting:
                "Voting",

            completed:
                "Completed",

            cancelled:
                "Cancelled"

        };


        return (
            map[status] ||
            "Unknown"
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
       PUBLIC API
       ===================================================== */

    return {

        state,

        init,

        getCurrentUser,

        loadChallenge,

        loadSubmissions,

        attachVoteCounts,

        calculateRanks,

        search,

        applySearch,

        sortEntries,

        getPodium,

        getStatistics,

        getCurrentUserEntry,

        renderLeaderboard,

        loadGlobalLeaderboard

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVLeaderboard =
    DVLeaderboard;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVLeaderboard.init();

    }
);


/* =========================================================
   DESIGNVERSE LEADERBOARD SYSTEM COMPLETE
   ========================================================= */