/* =========================================================
   DESIGNVERSE — VOTING SYSTEM
   js/voting.js

   Uses actual DESIGNVERSE database schema.

   TABLE:
       votes

   COLUMNS:
       id
       submission_id
       voter_id
       created_at

   RULES:
       - User must be authenticated
       - User cannot vote for own submission
       - User can vote once per submission
       - User can remove their own vote
       - Database RLS remains authoritative
   ========================================================= */

"use strict";


const DVVoting = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        loading: false,

        currentUser: null,

        challenge: null,

        submissions: [],

        votedSubmissionIds: new Set(),

        votesBySubmission: new Map(),

        challengeStatus: "unknown",

        voteActionInProgress: false,

        realtimeChannel: null

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
                "DESIGNVERSE voting auth error:",
                error
            );

            state.currentUser =
                null;

            return null;
        }


        state.currentUser =
            data?.user ||
            null;


        return state.currentUser;
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
                )

        };
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


        /*
         * Don't request columns we haven't verified.
         * These are the core challenge fields already
         * used throughout DESIGNVERSE.
         */

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

            throw error;
        }


        if (!data) {

            throw new Error(
                "Challenge not found."
            );
        }


        state.challenge =
            data;


        state.challengeStatus =
            calculateChallengeStatus(
                data
            );


        return data;
    }


    /* =====================================================
       CHALLENGE STATUS
       ===================================================== */

    function calculateChallengeStatus(
        challenge
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


        if (
            startsAt !== null &&
            now < startsAt
        ) {

            return "upcoming";
        }


        /*
         * Once the submission period ends,
         * voting can be open.
         */

        if (
            votingEndsAt !== null &&
            now < votingEndsAt
        ) {

            /*
             * If the challenge has an explicit
             * active/voting status, respect it.
             */

            if (
                challenge.status ===
                "voting"
            ) {

                return "voting";
            }


            if (
                endsAt !== null &&
                now >= endsAt
            ) {

                return "voting";
            }
        }


        if (
            endsAt !== null &&
            now < endsAt
        ) {

            return "active";
        }


        if (
            votingEndsAt !== null &&
            now >= votingEndsAt
        ) {

            return "completed";
        }


        return (
            challenge.status ||
            "unknown"
        );
    }


    /* =====================================================
       CAN VOTE
       ===================================================== */

    function canVote() {

        return (
            state.challengeStatus ===
            "voting"
        );
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


        const challengeId =
            state.challenge?.id;


        if (!challengeId) {

            throw new Error(
                "No challenge has been loaded."
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
                        views,
                        likes_count,
                        votes_count,
                        is_public
                    )
                `)
                .eq(
                    "challenge_id",
                    challengeId
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


        state.submissions =
            (
                data || []
            )
            .filter(
                submission =>
                    Boolean(
                        submission.design
                    )
            );


        await Promise.all([

            loadDesignerProfiles(),

            loadVoteCounts(),

            loadCurrentUserVotes()

        ]);


        return state.submissions;
    }


    /* =====================================================
       LOAD DESIGNER PROFILES
       ===================================================== */

    async function loadDesignerProfiles() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.submissions.length
        ) {

            return;
        }


        const designerIds =
            [
                ...new Set(
                    state.submissions.map(
                        submission =>
                            submission.designer_id
                    )
                )
            ]
            .filter(
                Boolean
            );


        if (
            !designerIds.length
        ) {

            return;
        }


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
                    avatar_url
                `)
                .in(
                    "id",
                    designerIds
                );


        if (error) {

            console.warn(
                "DESIGNVERSE voting designer profile error:",
                error
            );

            return;
        }


        const profiles =
            new Map(
                (
                    data || []
                )
                .map(
                    profile => [
                        profile.id,
                        profile
                    ]
                )
            );


        state.submissions.forEach(
            submission => {

                submission.designerProfile =
                    profiles.get(
                        submission.designer_id
                    ) ||
                    null;
            }
        );
    }


    /* =====================================================
       LOAD VOTE COUNTS
       ===================================================== */

    async function loadVoteCounts() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.submissions.length
        ) {

            return;
        }


        const submissionIds =
            state.submissions.map(
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

            throw error;
        }


        const map =
            new Map();


        (
            data || []
        )
        .forEach(
            vote => {

                const count =
                    map.get(
                        vote.submission_id
                    ) ||
                    0;


                map.set(
                    vote.submission_id,
                    count + 1
                );
            }
        );


        state.votesBySubmission =
            map;
    }


    /* =====================================================
       LOAD CURRENT USER VOTES
       ===================================================== */

    async function loadCurrentUserVotes() {

        const supabase =
            getSupabase();


        const user =
            state.currentUser ||
            await getCurrentUser();


        if (
            !supabase ||
            !user ||
            !state.submissions.length
        ) {

            state.votedSubmissionIds =
                new Set();

            return;
        }


        const submissionIds =
            state.submissions.map(
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
                .eq(
                    "voter_id",
                    user.id
                )
                .in(
                    "submission_id",
                    submissionIds
                );


        if (error) {

            throw error;
        }


        state.votedSubmissionIds =
            new Set(
                (
                    data || []
                )
                .map(
                    vote =>
                        vote.submission_id
                )
            );
    }


    /* =====================================================
       HELPERS
       ===================================================== */

    function getSubmission(
        submissionId
    ) {

        return state.submissions.find(
            submission =>
                submission.id ===
                submissionId
        ) || null;
    }


    function isOwnSubmission(
        submission
    ) {

        return Boolean(
            state.currentUser &&
            submission &&
            state.currentUser.id ===
                submission.designer_id
        );
    }


    function hasVoted(
        submissionId
    ) {

        return state.votedSubmissionIds.has(
            submissionId
        );
    }


    function getVoteCount(
        submissionId
    ) {

        return Number(
            state.votesBySubmission.get(
                submissionId
            ) ||
            0
        );
    }


    function setVoteCount(
        submissionId,
        count
    ) {

        state.votesBySubmission.set(
            submissionId,
            Math.max(
                0,
                Number(
                    count
                ) || 0
            )
        );
    }


    /* =====================================================
       CAST VOTE
       ===================================================== */

    async function voteForSubmission(
        submissionId
    ) {

        if (
            state.voteActionInProgress
        ) {

            return;
        }


        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            state.currentUser ||
            await getCurrentUser();


        if (!user) {

            redirectToLogin();

            return;
        }


        /*
         * Recalculate immediately before writing.
         */

        state.challengeStatus =
            calculateChallengeStatus(
                state.challenge
            );


        if (!canVote()) {

            throw new Error(
                getVotingClosedMessage(
                    state.challengeStatus
                )
            );
        }


        const submission =
            getSubmission(
                submissionId
            );


        if (!submission) {

            throw new Error(
                "Submission not found."
            );
        }


        if (
            isOwnSubmission(
                submission
            )
        ) {

            throw new Error(
                "You cannot vote for your own submission."
            );
        }


        if (
            hasVoted(
                submissionId
            )
        ) {

            throw new Error(
                "You have already voted for this design."
            );
        }


        state.voteActionInProgress =
            true;


        const previousCount =
            getVoteCount(
                submissionId
            );


        try {

            /*
             * Optimistic state.
             */

            state.votedSubmissionIds.add(
                submissionId
            );


            setVoteCount(
                submissionId,
                previousCount + 1
            );


            renderVotingGrid();

            renderVotingStats();


            const {
                data,
                error
            } =
                await supabase
                    .from("votes")
                    .insert({

                        submission_id:
                            submissionId,

                        voter_id:
                            user.id

                    })
                    .select(`
                        id,
                        submission_id,
                        voter_id,
                        created_at
                    `)
                    .single();


            if (error) {

                /*
                 * Roll back optimistic state.
                 */

                state.votedSubmissionIds.delete(
                    submissionId
                );


                setVoteCount(
                    submissionId,
                    previousCount
                );


                renderVotingGrid();

                renderVotingStats();


                const message =
                    String(
                        error.message ||
                        ""
                    ).toLowerCase();


                if (
                    message.includes(
                        "duplicate"
                    ) ||
                    message.includes(
                        "unique"
                    )
                ) {

                    /*
                     * Refresh current state because
                     * another request may have won the
                     * race.
                     */

                    await loadCurrentUserVotes();

                    await loadVoteCounts();

                    renderVotingGrid();

                    renderVotingStats();


                    throw new Error(
                        "You have already voted for this design."
                    );
                }


                if (
                    message.includes(
                        "row-level security"
                    )
                ) {

                    throw new Error(
                        "Supabase blocked this vote."
                    );
                }


                throw error;
            }


            /*
             * The INSERT succeeded.
             *
             * Keep optimistic state.
             */

            showVotingToast(
                "Vote submitted successfully.",
                "success"
            );


            return data;

        } finally {

            state.voteActionInProgress =
                false;
        }
    }


    /* =====================================================
       REMOVE VOTE
       ===================================================== */

    async function removeVote(
        submissionId
    ) {

        if (
            state.voteActionInProgress
        ) {

            return;
        }


        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            state.currentUser ||
            await getCurrentUser();


        if (!user) {

            redirectToLogin();

            return;
        }


        if (
            !hasVoted(
                submissionId
            )
        ) {

            return;
        }


        state.voteActionInProgress =
            true;


        const previousCount =
            getVoteCount(
                submissionId
            );


        try {

            state.votedSubmissionIds.delete(
                submissionId
            );


            setVoteCount(
                submissionId,
                previousCount - 1
            );


            renderVotingGrid();

            renderVotingStats();


            const {
                error
            } =
                await supabase
                    .from("votes")
                    .delete()
                    .eq(
                        "submission_id",
                        submissionId
                    )
                    .eq(
                        "voter_id",
                        user.id
                    );


            if (error) {

                /*
                 * Roll back.
                 */

                state.votedSubmissionIds.add(
                    submissionId
                );


                setVoteCount(
                    submissionId,
                    previousCount
                );


                renderVotingGrid();

                renderVotingStats();


                const message =
                    String(
                        error.message ||
                        ""
                    ).toLowerCase();


                if (
                    message.includes(
                        "row-level security"
                    )
                ) {

                    throw new Error(
                        "Supabase blocked removing your vote."
                    );
                }


                throw error;
            }


            showVotingToast(
                "Your vote was removed.",
                "success"
            );


            return true;

        } finally {

            state.voteActionInProgress =
                false;
        }
    }


    /* =====================================================
       RENDER
       ===================================================== */

    function renderPage() {

        renderChallengeHeader();

        renderVotingStatus();

        renderVotingStats();

        renderVotingGrid();
    }


    /* =====================================================
       CHALLENGE HEADER
       ===================================================== */

    function renderChallengeHeader() {

        const challenge =
            state.challenge;


        if (!challenge) {

            return;
        }


        document.title =
            `Vote — ${challenge.title} — DESIGNVERSE`;


        setText(
            "#votingChallengeTitle",
            challenge.title
        );


        setText(
            "#votingChallengeDescription",
            challenge.description ||
            "Review the submissions and vote for your favorite design."
        );


        setText(
            "#votingCategory",
            formatCategory(
                challenge.category
            )
        );


        setText(
            "#votingPrize",
            challenge.prize ||
            "No prize listed"
        );


        setText(
            "#votingPoints",
            `${formatNumber(
                challenge.points
            )} XP`
        );


        setText(
            "#votingBreadcrumbTitle",
            challenge.title
        );
    }


    /* =====================================================
       STATUS
       ===================================================== */

    function renderVotingStatus() {

        const status =
            state.challengeStatus;


        const statusElement =
            $("#votingStatus");


        if (
            statusElement
        ) {

            statusElement.className =
                `voting-status ${status}`;


            statusElement.textContent =
                formatStatus(
                    status
                );
        }


        const message =
            $("#votingStatusMessage");


        if (!message) {

            return;
        }


        if (
            status ===
            "voting"
        ) {

            if (
                state.currentUser
            ) {

                message.textContent =
                    "Choose the design you think deserves your vote.";

            } else {

                message.textContent =
                    "Sign in to vote for your favorite design.";
            }


            return;
        }


        if (
            status ===
            "completed"
        ) {

            message.textContent =
                "Voting has ended. Final results are available.";

            return;
        }


        if (
            status ===
            "active"
        ) {

            message.textContent =
                "Submissions are open. Voting will begin when the submission period ends.";

            return;
        }


        if (
            status ===
            "upcoming"
        ) {

            message.textContent =
                "This challenge has not started yet.";

            return;
        }


        if (
            status ===
            "cancelled"
        ) {

            message.textContent =
                "This challenge has been cancelled.";

            return;
        }


        message.textContent =
            "Voting is currently unavailable.";
    }


    /* =====================================================
       STATS
       ===================================================== */

    function renderVotingStats() {

        const totalEntries =
            state.submissions.length;


        const totalVotes =
            [
                ...state.votesBySubmission.values()
            ]
            .reduce(
                (
                    total,
                    count
                ) =>
                    total +
                    Number(
                        count
                    ),
                0
            );


        const myVotes =
            state.votedSubmissionIds.size;


        setText(
            "#votingSubmissionCount",
            formatNumber(
                totalEntries
            )
        );


        setText(
            "#votingTotalVotes",
            formatNumber(
                totalVotes
            )
        );


        setText(
            "#votingMyVotes",
            formatNumber(
                myVotes
            )
        );
    }


    /* =====================================================
       GRID
       ===================================================== */

    function renderVotingGrid() {

        const grid =
            $("#votingGrid");


        if (!grid) {

            return;
        }


        grid.innerHTML =
            "";


        if (
            !state.submissions.length
        ) {

            renderEmptyState(
                grid
            );


            return;
        }


        state.submissions
            .forEach(
                (
                    submission,
                    index
                ) => {

                    grid.appendChild(
                        createVotingCard(
                            submission,
                            index
                        )
                    );

                }
            );
    }


    /* =====================================================
       CARD
       ===================================================== */

    function createVotingCard(
        submission,
        index
    ) {

        const card =
            document.createElement(
                "article"
            );


        card.className =
            "voting-card";


        card.dataset.submissionId =
            submission.id;


        const design =
            submission.design ||
            {};


        const profile =
            submission.designerProfile ||
            {};


        const image =
            design.image_url ||
            design.thumbnail_url ||
            "";


        const voteCount =
            getVoteCount(
                submission.id
            );


        const voted =
            hasVoted(
                submission.id
            );


        const ownSubmission =
            isOwnSubmission(
                submission
            );


        const designerName =
            profile.display_name ||
            profile.username ||
            "Designer";


        const designerUsername =
            profile.username
                ? `@${profile.username}`
                : "";


        let actionHTML;


        /*
         * Completed / inactive state.
         */

        if (
            !canVote()
        ) {

            actionHTML = `

                <button
                    type="button"
                    class="voting-action own"
                    disabled
                >

                    <i
                        class="fa-solid fa-clock"
                    ></i>

                    ${
                        state.challengeStatus ===
                        "completed"
                            ? "Voting Closed"
                            : "Voting Unavailable"
                    }

                </button>

            `;

        } else if (
            ownSubmission
        ) {

            actionHTML = `

                <button
                    type="button"
                    class="voting-action own"
                    disabled
                >

                    <i
                        class="fa-solid fa-user"
                    ></i>

                    Your Design

                </button>

            `;

        } else if (
            !state.currentUser
        ) {

            actionHTML = `

                <button
                    type="button"
                    class="voting-action vote"
                    data-vote-login
                >

                    <i
                        class="fa-solid fa-right-to-bracket"
                    ></i>

                    Sign in to Vote

                </button>

            `;

        } else if (
            voted
        ) {

            actionHTML = `

                <button
                    type="button"
                    class="voting-action voted"
                    data-vote-action="remove"
                >

                    <i
                        class="fa-solid fa-check"
                    ></i>

                    Voted · Remove

                </button>

            `;

        } else {

            actionHTML = `

                <button
                    type="button"
                    class="voting-action vote"
                    data-vote-action="add"
                >

                    <i
                        class="fa-solid fa-heart"
                    ></i>

                    Vote for this design

                </button>

            `;
        }


        card.innerHTML = `

            <div
                class="voting-card-image"
            >

                ${
                    image
                        ? `
                            <img
                                src="${escapeAttribute(
                                    image
                                )}"
                                alt="${escapeAttribute(
                                    design.title ||
                                    "Submitted design"
                                )}"
                                loading="lazy"
                            >
                          `
                        : `
                            <div
                                class="voting-image-placeholder"
                            >

                                <i
                                    class="fa-solid fa-palette"
                                ></i>

                            </div>
                          `
                }


                <div
                    class="voting-entry-number"
                >

                    ENTRY #${formatNumber(
                        index + 1
                    )}

                </div>


                ${
                    ownSubmission
                        ? `
                            <div
                                class="voting-own-badge"
                            >

                                <i
                                    class="fa-solid fa-user"
                                ></i>

                                YOUR ENTRY

                            </div>
                          `
                        : ""
                }

            </div>


            <div
                class="voting-card-body"
            >

                <div
                    class="voting-category"
                >

                    <i
                        class="fa-solid fa-palette"
                    ></i>

                    ${escapeHTML(
                        formatCategory(
                            design.category
                        )
                    )}

                </div>


                <h2
                    class="voting-design-title"
                >

                    ${escapeHTML(
                        design.title ||
                        "Untitled Design"
                    )}

                </h2>


                ${
                    design.description
                        ? `
                            <p
                                class="voting-description"
                            >

                                ${escapeHTML(
                                    design.description
                                )}

                            </p>
                          `
                        : ""
                }


                <div
                    class="voting-designer"
                >

                    <div
                        class="voting-designer-avatar"
                    >

                        ${
                            profile.avatar_url
                                ? `
                                    <img
                                        src="${escapeAttribute(
                                            profile.avatar_url
                                        )}"
                                        alt="${escapeAttribute(
                                            designerName
                                        )}"
                                        loading="lazy"
                                    >
                                  `
                                : `
                                    <i
                                        class="fa-solid fa-user"
                                    ></i>
                                  `
                        }

                    </div>


                    <div
                        class="voting-designer-info"
                    >

                        <strong>
                            ${escapeHTML(
                                designerName
                            )}
                        </strong>


                        <span>
                            ${escapeHTML(
                                designerUsername
                            )}
                        </span>

                    </div>

                </div>


                <div
                    class="voting-card-footer"
                >

                    <div
                        class="voting-count"
                    >

                        <strong
                            data-vote-count
                        >

                            ${formatNumber(
                                voteCount
                            )}

                        </strong>


                        <span>

                            ${
                                voteCount === 1
                                    ? "vote"
                                    : "votes"
                            }

                        </span>

                    </div>


                    ${actionHTML}

                </div>

            </div>

        `;


        /*
         * Add vote.
         */

        card.querySelector(
            '[data-vote-action="add"]'
        )
        ?.addEventListener(
            "click",
            async event => {

                event.stopPropagation();


                try {

                    await voteForSubmission(
                        submission.id
                    );

                } catch (error) {

                    showVotingToast(
                        getVotingErrorMessage(
                            error
                        ),
                        "error"
                    );
                }

            }
        );


        /*
         * Remove vote.
         */

        card.querySelector(
            '[data-vote-action="remove"]'
        )
        ?.addEventListener(
            "click",
            async event => {

                event.stopPropagation();


                try {

                    await removeVote(
                        submission.id
                    );

                } catch (error) {

                    showVotingToast(
                        getVotingErrorMessage(
                            error
                        ),
                        "error"
                    );
                }

            }
        );


        /*
         * Logged-out user.
         */

        card.querySelector(
            "[data-vote-login]"
        )
        ?.addEventListener(
            "click",
            () => {

                redirectToLogin();

            }
        );


        return card;
    }


    /* =====================================================
       EMPTY STATE
       ===================================================== */

    function renderEmptyState(
        container
    ) {

        container.innerHTML = `

            <div
                style="
                    grid-column:1/-1;
                    min-height:300px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    flex-direction:column;
                    padding:40px;
                    border:1px dashed rgba(255,255,255,.10);
                    border-radius:18px;
                    text-align:center;
                "
            >

                <i
                    class="fa-solid fa-images"
                    style="
                        margin-bottom:13px;
                        color:#c4b5fd;
                        font-size:27px;
                    "
                ></i>


                <h2
                    style="
                        margin:0 0 6px;
                        color:white;
                        font-size:20px;
                    "
                >

                    No submissions yet

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

                    There are no submissions available
                    for this challenge yet.

                </p>

            </div>

        `;
    }


    /* =====================================================
       LOGIN
       ===================================================== */

    function redirectToLogin() {

        try {

            sessionStorage.setItem(
                "designverse_redirect",
                window.location.href
            );

        } catch {
            /* Ignore storage errors. */
        }


        window.location.href =
            "auth/login.html";
    }


    /* =====================================================
       REALTIME
       ===================================================== */

    function subscribeToVotes() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.challenge
        ) {

            return null;
        }


        if (
            state.realtimeChannel
        ) {

            return state.realtimeChannel;
        }


        /*
         * Subscribe to all votes.
         * We filter in the browser because the realtime
         * filter cannot conveniently contain a dynamic
         * list of submission IDs.
         */

        const channel =
            supabase
                .channel(
                    `voting:${state.challenge.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "votes"
                    },
                    payload => {

                        handleRealtimeVoteInsert(
                            payload
                        );
                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "DELETE",

                        schema:
                            "public",

                        table:
                            "votes"
                    },
                    payload => {

                        handleRealtimeVoteDelete(
                            payload
                        );
                    }
                )
                .subscribe();


        state.realtimeChannel =
            channel;


        return channel;
    }


    function handleRealtimeVoteInsert(
        payload
    ) {

        const vote =
            payload?.new;


        if (!vote) {

            return;
        }


        const submission =
            getSubmission(
                vote.submission_id
            );


        if (!submission) {

            return;
        }


        /*
         * If this is our own vote, we've already
         * updated the count optimistically.
         */

        if (
            state.currentUser &&
            vote.voter_id ===
                state.currentUser.id
        ) {

            return;
        }


        setVoteCount(
            vote.submission_id,
            getVoteCount(
                vote.submission_id
            ) + 1
        );


        renderVotingGrid();

        renderVotingStats();
    }


    function handleRealtimeVoteDelete(
        payload
    ) {

        const vote =
            payload?.old;


        if (!vote) {

            return;
        }


        const submission =
            getSubmission(
                vote.submission_id
            );


        if (!submission) {

            return;
        }


        if (
            state.currentUser &&
            vote.voter_id ===
                state.currentUser.id
        ) {

            return;
        }


        setVoteCount(
            vote.submission_id,
            getVoteCount(
                vote.submission_id
            ) - 1
        );


        renderVotingGrid();

        renderVotingStats();
    }


    /* =====================================================
       TOAST
       ===================================================== */

    function showVotingToast(
        message,
        type = "info"
    ) {

        let container =
            document.querySelector(
                ".voting-toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "voting-toast-container";


            container.style.cssText = `
                position:fixed;
                right:18px;
                bottom:18px;
                z-index:10000;
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


        const iconColor =
            type === "success"
                ? "#86efac"
                : type === "error"
                    ? "#fca5a5"
                    : "#c4b5fd";


        toast.style.cssText = `
            display:flex;
            align-items:center;
            gap:9px;
            padding:12px 14px;
            border:1px solid rgba(255,255,255,.10);
            border-radius:12px;
            background:rgba(10,10,16,.96);
            color:white;
            box-shadow:0 20px 50px rgba(0,0,0,.35);
            backdrop-filter:blur(18px);
            font:10px/1.5 Inter,sans-serif;
        `;


        toast.innerHTML = `

            <i
                class="fa-solid ${icon}"
                style="color:${iconColor};"
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
            3500
        );
    }


    /* =====================================================
       ERROR MESSAGES
       ===================================================== */

    function getVotingClosedMessage(
        status
    ) {

        const messages = {

            upcoming:
                "This challenge hasn't started yet.",

            active:
                "Voting hasn't opened yet.",

            completed:
                "Voting has ended for this challenge.",

            cancelled:
                "This challenge has been cancelled.",

            unknown:
                "Voting is currently unavailable."

        };


        return (
            messages[status] ||
            messages.unknown
        );
    }


    function getVotingErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to submit your vote."
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
                "already voted"
            ) ||
            lower.includes(
                "duplicate"
            ) ||
            lower.includes(
                "unique"
            )
        ) {

            return (
                "You have already voted for this design."
            );
        }


        if (
            lower.includes(
                "own submission"
            ) ||
            lower.includes(
                "your own"
            )
        ) {

            return (
                "You cannot vote for your own submission."
            );
        }


        if (
            lower.includes(
                "row-level security"
            )
        ) {

            return (
                "Supabase blocked this vote."
            );
        }


        if (
            lower.includes(
                "foreign key"
            )
        ) {

            return (
                "This submission is no longer available."
            );
        }


        return message;
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    function formatStatus(
        status
    ) {

        const map = {

            upcoming:
                "Upcoming",

            active:
                "Submissions Open",

            voting:
                "Voting Open",

            completed:
                "Completed",

            cancelled:
                "Cancelled"

        };


        return (
            map[status] ||
            "Unavailable"
        );
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


    function formatNumber(
        value
    ) {

        return new Intl.NumberFormat(
            "en-US"
        ).format(
            Number(
                value
            ) || 0
        );
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
       ERROR SCREEN
       ===================================================== */

    function showVotingError(
        error
    ) {

        $("#votingLoading")
            ?.remove();


        const grid =
            $("#votingGrid");


        if (grid) {

            grid.innerHTML =
                "";
        }


        const errorBox =
            $("#votingError");


        if (errorBox) {

            errorBox.classList.add(
                "visible"
            );
        }


        setText(
            "#votingErrorMessage",
            error?.message ||
            "Unable to load this challenge."
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


        const isVotingPage =
            Boolean(
                document.body.dataset.votingPage
            ) ||
            Boolean(
                $("#votingGrid")
            );


        if (
            !isVotingPage
        ) {

            return;
        }


        state.initialized =
            true;


        state.loading =
            true;


        try {

            await getCurrentUser();


            await loadChallenge();


            await loadSubmissions();


            renderPage();


            subscribeToVotes();


            /*
             * Re-check challenge status every minute.
             */

            window.setInterval(
                () => {

                    if (
                        !state.challenge
                    ) {

                        return;
                    }


                    state.challengeStatus =
                        calculateChallengeStatus(
                            state.challenge
                        );


                    renderVotingStatus();

                    renderVotingGrid();

                },
                60 * 1000
            );

        } catch (error) {

            console.error(
                "DESIGNVERSE voting initialization error:",
                error
            );


            showVotingError(
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

        getCurrentUser,

        loadChallenge,

        loadSubmissions,

        loadVoteCounts,

        loadCurrentUserVotes,

        voteForSubmission,

        removeVote,

        hasVoted,

        isOwnSubmission,

        getVoteCount,

        canVote,

        calculateChallengeStatus,

        renderPage,

        renderVotingGrid,

        subscribeToVotes

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVVoting =
    DVVoting;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVVoting.init();

    }
);


/* =========================================================
   DESIGNVERSE VOTING SYSTEM COMPLETE
   ========================================================= */