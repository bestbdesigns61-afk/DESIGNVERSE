/* =========================================================
   DESIGNVERSE — VOTING SYSTEM
   js/voting.js

   Handles:
   - Loading challenge submissions
   - Voting phase validation
   - Current-user authentication
   - Preventing self-voting
   - Checking existing votes
   - Casting votes
   - Removing votes
   - Vote counts
   - Submission display
   - Challenge-aware voting

   Voting lifecycle:

   ACTIVE
      ↓
   submission deadline
      ↓
   VOTING
      ↓
   votes allowed
      ↓
   voting_ends_at
      ↓
   COMPLETED
   ========================================================= */

"use strict";


const DVVoting = (() => {

    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        user: null,

        challenge: null,

        submissions: [],

        userVotes: new Set(),

        selectedSubmission: null,

        loading: false,

        voting: false

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
                "DESIGNVERSE: Supabase client unavailable."
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

            console.error(
                "DESIGNVERSE user error:",
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
       URL CHALLENGE ID
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


        if (
            !challengeIdentifier.id &&
            !challengeIdentifier.slug
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
                    brief,
                    category,
                    difficulty,
                    cover_image_url,
                    prize,
                    points,
                    max_submissions,
                    starts_at,
                    ends_at,
                    voting_ends_at,
                    status
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

            console.error(
                "DESIGNVERSE challenge load error:",
                error
            );

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


        /*
         * Legacy fallback.
         */

        return (
            challenge.status ||
            "completed"
        );
    }


    /* =====================================================
       VOTING WINDOW CHECK
       ===================================================== */

    function canVoteNow() {

        return (
            getChallengeStatus() ===
            "voting"
        );
    }


    /* =====================================================
       LOAD SUBMISSIONS
       ===================================================== */

    async function loadSubmissions() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.challenge
        ) {

            return [];
        }


        state.loading =
            true;


        try {

            /*
             * We use submission rows as the source
             * of challenge entries.
             *
             * The nested design relationship assumes
             * submissions.design_id references designs.id.
             *
             * If your RLS policies expose public
             * submissions/designs, visitors can read
             * these rows during voting.
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
                            is_public,
                            created_at
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
                    "DESIGNVERSE submissions load error:",
                    error
                );

                throw error;
            }


            state.submissions =
                (data || []).map(
                    submission => ({

                        ...submission,

                        voteCount:
                            0,

                        hasVoted:
                            false

                    })
                );


            await loadVoteCounts();


            if (
                state.user
            ) {

                await loadUserVotes();
            }


            return state.submissions;


        } finally {

            state.loading =
                false;
        }
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


        /*
         * Fetch all votes for the visible
         * submissions in this challenge.
         */

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
                .select(
                    "id, submission_id, voter_id"
                )
                .in(
                    "submission_id",
                    submissionIds
                );


        if (error) {

            console.warn(
                "DESIGNVERSE vote count load error:",
                error
            );

            /*
             * Keep the UI usable even when RLS
             * doesn't expose vote rows.
             */

            return;
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


        state.submissions.forEach(
            submission => {

                submission.voteCount =
                    counts.get(
                        submission.id
                    ) ||
                    0;

            }
        );
    }


    /* =====================================================
       LOAD USER VOTES
       ===================================================== */

    async function loadUserVotes() {

        const supabase =
            getSupabase();


        const user =
            state.user ||
            await getCurrentUser();


        if (
            !supabase ||
            !user ||
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
                .select(
                    "submission_id"
                )
                .eq(
                    "voter_id",
                    user.id
                )
                .in(
                    "submission_id",
                    submissionIds
                );


        if (error) {

            console.warn(
                "DESIGNVERSE user vote load error:",
                error
            );

            return;
        }


        state.userVotes =
            new Set(
                (
                    data || []
                ).map(
                    vote =>
                        vote.submission_id
                )
            );


        state.submissions.forEach(
            submission => {

                submission.hasVoted =
                    state.userVotes.has(
                        submission.id
                    );

            }
        );
    }


    /* =====================================================
       CHECK EXISTING VOTE
       ===================================================== */

    async function hasVoted(
        submissionId
    ) {

        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            return false;
        }


        if (
            state.userVotes.has(
                submissionId
            )
        ) {

            return true;
        }


        const supabase =
            getSupabase();


        if (!supabase) {

            return false;
        }


        const {
            data,
            error
        } =
            await supabase
                .from("votes")
                .select(
                    "id"
                )
                .eq(
                    "submission_id",
                    submissionId
                )
                .eq(
                    "voter_id",
                    user.id
                )
                .maybeSingle();


        if (error) {

            console.warn(
                "DESIGNVERSE vote lookup error:",
                error
            );

            return false;
        }


        const voted =
            Boolean(
                data
            );


        if (
            voted
        ) {

            state.userVotes.add(
                submissionId
            );
        }


        return voted;
    }


    /* =====================================================
       SELF-VOTE PROTECTION
       ===================================================== */

    function isOwnSubmission(
        submission
    ) {

        if (
            !submission ||
            !state.user
        ) {

            return false;
        }


        return (
            submission.designer_id ===
            state.user.id
        );
    }


    /* =====================================================
       VALIDATE VOTE
       ===================================================== */

    async function validateVote(
        submission
    ) {

        if (!submission) {

            throw new Error(
                "Submission not found."
            );
        }


        if (!state.challenge) {

            throw new Error(
                "No challenge selected."
            );
        }


        const status =
            getChallengeStatus();


        if (
            status !==
            "voting"
        ) {

            if (
                status ===
                "active"
            ) {

                throw new Error(
                    "Voting has not started yet."
                );
            }


            if (
                status ===
                "completed"
            ) {

                throw new Error(
                    "Voting has ended for this challenge."
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


            throw new Error(
                "Voting is not currently available."
            );
        }


        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in to vote."
            );
        }


        /*
         * Designers cannot vote for their own
         * challenge submission.
         */

        if (
            isOwnSubmission(
                submission
            )
        ) {

            throw new Error(
                "You cannot vote for your own submission."
            );
        }


        const alreadyVoted =
            await hasVoted(
                submission.id
            );


        if (
            alreadyVoted
        ) {

            throw new Error(
                "You have already voted for this submission."
            );
        }


        /*
         * Verify this submission actually
         * belongs to the current challenge.
         */

        if (
            submission.challenge_id !==
            state.challenge.id
        ) {

            throw new Error(
                "This submission does not belong to the selected challenge."
            );
        }


        return true;
    }


    /* =====================================================
       CAST VOTE
       ===================================================== */

    async function castVote(
        submission
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in to vote."
            );
        }


        await validateVote(
            submission
        );


        const {
            data,
            error
        } =
            await supabase
                .from("votes")
                .insert({

                    submission_id:
                        submission.id,

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

            console.error(
                "DESIGNVERSE vote insert error:",
                error
            );


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

                throw new Error(
                    "You have already voted for this submission."
                );
            }


            if (
                message.includes(
                    "row-level security"
                )
            ) {

                throw new Error(
                    "DESIGNVERSE blocked this vote because your account doesn't have permission."
                );
            }


            throw error;
        }


        /*
         * Update local state.
         */

        state.userVotes.add(
            submission.id
        );


        submission.hasVoted =
            true;


        submission.voteCount =
            Number(
                submission.voteCount ||
                0
            ) + 1;


        return data;
    }


    /* =====================================================
       REMOVE VOTE
       ===================================================== */

    async function removeVote(
        submission
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in."
            );
        }


        if (!submission) {

            throw new Error(
                "Submission not found."
            );
        }


        /*
         * Only allow removal during the voting
         * period. Once voting is over, votes
         * become immutable.
         */

        if (
            getChallengeStatus() !==
            "voting"
        ) {

            throw new Error(
                "Votes can only be changed during the voting period."
            );
        }


        const {
            error
        } =
            await supabase
                .from("votes")
                .delete()
                .eq(
                    "submission_id",
                    submission.id
                )
                .eq(
                    "voter_id",
                    user.id
                );


        if (error) {

            console.error(
                "DESIGNVERSE vote removal error:",
                error
            );

            throw error;
        }


        state.userVotes.delete(
            submission.id
        );


        submission.hasVoted =
            false;


        submission.voteCount =
            Math.max(
                0,
                Number(
                    submission.voteCount ||
                    0
                ) - 1
            );


        return true;
    }


    /* =====================================================
       TOGGLE VOTE
       ===================================================== */

    async function toggleVote(
        submission
    ) {

        const voted =
            await hasVoted(
                submission.id
            );


        if (
            voted
        ) {

            return removeVote(
                submission
            );
        }


        return castVote(
            submission
        );
    }


    /* =====================================================
       SORT SUBMISSIONS
       ===================================================== */

    function sortSubmissions(
        mode = "votes"
    ) {

        const list =
            [
                ...state.submissions
            ];


        switch (
            mode
        ) {

            case "newest":

                list.sort(
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

                list.sort(
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


            case "votes":

                list.sort(
                    (
                        a,
                        b
                    ) =>
                        Number(
                            b.voteCount ||
                            0
                        ) -
                        Number(
                            a.voteCount ||
                            0
                        )
                );

                break;


            default:

                break;
        }


        return list;
    }


    /* =====================================================
       RENDER SUBMISSIONS
       ===================================================== */

    function renderSubmissions(
        options = {}
    ) {

        const container =
            options.container ||
            $("#votingSubmissionGrid");


        if (!container) {

            return;
        }


        const sort =
            options.sort ||
            "votes";


        const list =
            sortSubmissions(
                sort
            );


        container.innerHTML =
            "";


        if (
            !list.length
        ) {

            container.innerHTML = `

                <div
                    class="voting-empty"
                    style="
                        grid-column:1/-1;
                        padding:50px 20px;
                        text-align:center;
                    "
                >

                    <i
                        class="fa-solid fa-images"
                        style="
                            font-size:28px;
                            color:#c4b5fd;
                            margin-bottom:12px;
                        "
                    ></i>


                    <h3>
                        No submissions yet
                    </h3>


                    <p>
                        Challenge entries will appear here
                        once designers submit their work.
                    </p>

                </div>

            `;


            return;
        }


        list.forEach(
            submission => {

                container.appendChild(
                    createSubmissionCard(
                        submission,
                        options
                    )
                );

            }
        );
    }


    /* =====================================================
       SUBMISSION CARD
       ===================================================== */

    function createSubmissionCard(
        submission,
        options = {}
    ) {

        const article =
            document.createElement(
                "article"
            );


        article.className =
            "voting-submission-card";


        article.dataset.submissionId =
            submission.id;


        const design =
            submission.design;


        const image =
            design?.image_url
                ? `
                    <img
                        src="${escapeAttribute(
                            design.image_url
                        )}"
                        alt="${escapeAttribute(
                            design.title ||
                            "Design submission"
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
                `;


        const ownSubmission =
            isOwnSubmission(
                submission
            );


        const voted =
            submission.hasVoted;


        const status =
            getChallengeStatus();


        const canVote =
            status === "voting" &&
            Boolean(state.user) &&
            !ownSubmission;


        let voteButton;


        if (
            ownSubmission
        ) {

            voteButton = `

                <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    disabled
                >

                    <i
                        class="fa-solid fa-user"
                    ></i>

                    Your Submission

                </button>

            `;

        } else if (
            status !== "voting"
        ) {

            voteButton = `

                <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    disabled
                >

                    <i
                        class="fa-solid fa-clock"
                    ></i>

                    ${
                        status === "active"
                            ? "Voting Soon"
                            : "Voting Closed"
                    }

                </button>

            `;

        } else if (
            voted
        ) {

            voteButton = `

                <button
                    type="button"
                    class="btn btn-primary btn-small"
                    data-vote-button
                >

                    <i
                        class="fa-solid fa-heart"
                    ></i>

                    Voted

                </button>

            `;

        } else if (
            canVote
        ) {

            voteButton = `

                <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    data-vote-button
                >

                    <i
                        class="fa-regular fa-heart"
                    ></i>

                    Vote

                </button>

            `;

        } else {

            voteButton = `

                <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    disabled
                >

                    Sign in to vote

                </button>

            `;
        }


        article.innerHTML = `

            <div
                class="voting-submission-image"
            >

                ${image}

            </div>


            <div
                class="voting-submission-body"
            >

                <div
                    class="voting-submission-top"
                    style="
                        display:flex;
                        justify-content:space-between;
                        gap:10px;
                        align-items:flex-start;
                    "
                >

                    <div>

                        <h3
                            style="
                                margin:0 0 4px;
                                color:white;
                                font-size:13px;
                            "
                        >

                            ${escapeHTML(
                                design?.title ||
                                "Untitled Design"
                            )}

                        </h3>


                        <span
                            style="
                                color:#a1a1aa;
                                font-size:8px;
                            "
                        >

                            ${escapeHTML(
                                formatCategory(
                                    design?.category
                                )
                            )}

                        </span>

                    </div>


                    <span
                        class="voting-count"
                        style="
                            display:inline-flex;
                            align-items:center;
                            gap:5px;
                            color:#c4b5fd;
                            font-size:9px;
                            font-weight:700;
                            white-space:nowrap;
                        "
                    >

                        <i
                            class="fa-solid fa-heart"
                        ></i>

                        <span data-vote-count>
                            ${formatNumber(
                                submission.voteCount
                            )}
                        </span>

                    </span>

                </div>


                <p
                    style="
                        margin:10px 0 12px;
                        color:#a1a1aa;
                        font-size:8px;
                        line-height:1.55;
                    "
                >

                    ${escapeHTML(
                        design?.description ||
                        "No description provided."
                    )}

                </p>


                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        gap:8px;
                    "
                >

                    <span
                        style="
                            color:#71717a;
                            font-size:7px;
                        "
                    >

                        Entry #${escapeHTML(
                            submission.id
                        ).slice(
                            0,
                            8
                        )}

                    </span>


                    ${voteButton}

                </div>

            </div>

        `;


        const voteButtonElement =
            article.querySelector(
                "[data-vote-button]"
            );


        voteButtonElement?.addEventListener(
            "click",
            async () => {

                await handleVoteButton(
                    submission,
                    voteButtonElement,
                    article
                );

            }
        );


        return article;
    }


    /* =====================================================
       HANDLE VOTE BUTTON
       ===================================================== */

    async function handleVoteButton(
        submission,
        button,
        article
    ) {

        if (
            state.voting
        ) {

            return;
        }


        try {

            state.voting =
                true;


            button.disabled =
                true;


            button.innerHTML = `

                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

                Voting...

            `;


            const hadVoted =
                await hasVoted(
                    submission.id
                );


            if (
                hadVoted
            ) {

                await removeVote(
                    submission
                );

                showToast(
                    "Your vote was removed.",
                    "info"
                );

            } else {

                await castVote(
                    submission
                );

                showToast(
                    "Vote recorded! 🗳️",
                    "success"
                );
            }


            /*
             * Update the card without a full
             * page reload.
             */

            refreshSubmissionCard(
                submission,
                article
            );


        } catch (error) {

            console.error(
                "DESIGNVERSE voting error:",
                error
            );


            showToast(
                getVotingErrorMessage(
                    error
                ),
                "error"
            );


            refreshSubmissionCard(
                submission,
                article
            );


        } finally {

            state.voting =
                false;
        }
    }


    /* =====================================================
       REFRESH CARD
       ===================================================== */

    function refreshSubmissionCard(
        submission,
        article
    ) {

        const count =
            article.querySelector(
                "[data-vote-count]"
            );


        if (count) {

            count.textContent =
                formatNumber(
                    submission.voteCount
                );
        }


        const button =
            article.querySelector(
                "[data-vote-button]"
            );


        if (!button) {
            return;
        }


        button.disabled =
            false;


        if (
            submission.hasVoted
        ) {

            button.className =
                "btn btn-primary btn-small";


            button.innerHTML = `

                <i
                    class="fa-solid fa-heart"
                ></i>

                Voted

            `;

        } else {

            button.className =
                "btn btn-secondary btn-small";


            button.innerHTML = `

                <i
                    class="fa-regular fa-heart"
                ></i>

                Vote

            `;
        }
    }


    /* =====================================================
       SEARCH
       ===================================================== */

    function searchSubmissions(
        query
    ) {

        const text =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();


        const cards =
            document.querySelectorAll(
                ".voting-submission-card"
            );


        cards.forEach(
            card => {

                const title =
                    card.textContent
                        .toLowerCase();


                card.style.display =
                    !text ||
                    title.includes(
                        text
                    )
                        ? ""
                        : "none";

            }
        );
    }


    /* =====================================================
       ERROR HANDLING
       ===================================================== */

    function getVotingErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to complete the vote."
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
                "duplicate"
            ) ||
            lower.includes(
                "unique"
            )
        ) {

            return (
                "You have already voted for this submission."
            );
        }


        if (
            lower.includes(
                "row-level security"
            )
        ) {

            return (
                "DESIGNVERSE blocked the vote because your account doesn't have permission."
            );
        }


        if (
            lower.includes(
                "foreign key"
            )
        ) {

            return (
                "The submission or voter account could not be found."
            );
        }


        if (
            lower.includes(
                "not authenticated"
            )
        ) {

            return (
                "Please sign in to vote."
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
                style="
                    color:${color};
                "
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
       INITIALIZE
       ===================================================== */

    async function init() {

        if (
            state.initialized
        ) {

            return;
        }


        /*
         * Only initialize where voting UI exists
         * or where a challenge context is present.
         */

        const votingGrid =
            Boolean(
                $("#votingSubmissionGrid")
            );


        const votingPage =
            Boolean(
                document.body.dataset.votingPage
            );


        const identifier =
            getChallengeIdentifier();


        if (
            !votingGrid &&
            !votingPage &&
            !identifier.id &&
            !identifier.slug
        ) {

            return;
        }


        state.initialized =
            true;


        try {

            await loadChallenge();


            await getCurrentUser();


            await loadSubmissions();


            /*
             * Render automatically when the page
             * contains the voting grid.
             */

            if (
                votingGrid
            ) {

                renderSubmissions();
            }


        } catch (error) {

            console.error(
                "DESIGNVERSE voting initialization error:",
                error
            );


            showToast(
                getVotingErrorMessage(
                    error
                ),
                "error"
            );
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

        getChallengeStatus,

        canVoteNow,

        loadSubmissions,

        loadVoteCounts,

        loadUserVotes,

        hasVoted,

        isOwnSubmission,

        validateVote,

        castVote,

        removeVote,

        toggleVote,

        sortSubmissions,

        renderSubmissions,

        searchSubmissions

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