/* =========================================================
   DESIGNVERSE — SUBMISSIONS SYSTEM
   js/submissions.js

   Handles:
   - Challenge-aware submissions
   - Reading challenge ID from URL
   - Loading challenge information
   - Checking authentication
   - Checking challenge status
   - Checking existing submission
   - Checking design ownership
   - Checking max submissions
   - Creating submission records
   - Loading user's designs
   - Selecting a design for submission
   - Preventing duplicate submissions

   Submission lifecycle:

   DESIGN
      ↓
   CHALLENGE
      ↓
   SUBMISSION
      ↓
   VOTING
      ↓
   RESULT
   ========================================================= */

"use strict";


const DVSubmissions = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        user: null,

        challenge: null,

        selectedDesign: null,

        userDesigns: [],

        existingSubmission: null,

        submissionCount: 0,

        submitting: false

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
       CHALLENGE PARAMETER
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
                ),

            slug:
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
       CALCULATE CHALLENGE STATUS
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
         * Legacy fallback when the voting
         * date isn't available.
         */

        if (
            ends !== null &&
            now >= ends
        ) {

            return "completed";
        }


        return (
            challenge.status ||
            "unknown"
        );
    }


    /* =====================================================
       LOAD SUBMISSION COUNT
       ===================================================== */

    async function loadSubmissionCount() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.challenge
        ) {

            return 0;
        }


        const {
            count,
            error
        } =
            await supabase
                .from("submissions")
                .select(
                    "id",
                    {
                        count:
                            "exact",
                        head:
                            true
                    }
                )
                .eq(
                    "challenge_id",
                    state.challenge.id
                );


        if (error) {

            console.warn(
                "DESIGNVERSE submission count unavailable:",
                error
            );


            return 0;
        }


        state.submissionCount =
            count || 0;


        return state.submissionCount;
    }


    /* =====================================================
       LOAD USER'S DESIGNS
       ===================================================== */

    async function loadUserDesigns() {

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
                "Please sign in to submit a design."
            );
        }


        const {
            data,
            error
        } =
            await supabase
                .from("designs")
                .select(`
                    id,
                    designer_id,
                    title,
                    description,
                    category,
                    image_url,
                    thumbnail_url,
                    tags,
                    views,
                    likes_count,
                    votes_count,
                    is_public,
                    created_at,
                    updated_at
                `)
                .eq(
                    "designer_id",
                    user.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            console.error(
                "DESIGNVERSE user designs error:",
                error
            );

            throw error;
        }


        state.userDesigns =
            data || [];


        return state.userDesigns;
    }


    /* =====================================================
       CHECK EXISTING SUBMISSION
       ===================================================== */

    async function getExistingSubmission() {

        const supabase =
            getSupabase();


        const user =
            state.user ||
            await getCurrentUser();


        const challenge =
            state.challenge;


        if (
            !supabase ||
            !user ||
            !challenge
        ) {

            return null;
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
                    updated_at
                `)
                .eq(
                    "challenge_id",
                    challenge.id
                )
                .eq(
                    "designer_id",
                    user.id
                )
                .maybeSingle();


        if (error) {

            /*
             * RLS may prevent checking submissions.
             * We don't treat that as proof that the
             * user has no submission.
             */

            console.warn(
                "DESIGNVERSE existing submission check:",
                error
            );


            return null;
        }


        state.existingSubmission =
            data ||
            null;


        return state.existingSubmission;
    }


    /* =====================================================
       CHECK DESIGN OWNERSHIP
       ===================================================== */

    function ownsDesign(
        design
    ) {

        if (
            !design ||
            !state.user
        ) {

            return false;
        }


        return (
            design.designer_id ===
            state.user.id
        );
    }


    /* =====================================================
       CHECK DESIGN ELIGIBILITY
       ===================================================== */

    function validateDesignForSubmission(
        design
    ) {

        if (!design) {

            throw new Error(
                "Please select a design first."
            );
        }


        if (
            !ownsDesign(
                design
            )
        ) {

            throw new Error(
                "You can only submit your own designs."
            );
        }


        /*
         * Public designs are required for DESIGNVERSE
         * competitions because judges/community members
         * need to see the entry.
         */

        if (
            design.is_public === false
        ) {

            throw new Error(
                "Make your design public before submitting it to a challenge."
            );
        }


        if (
            !design.image_url
        ) {

            throw new Error(
                "This design does not have a valid image."
            );
        }


        return true;
    }


    /* =====================================================
       CHECK CHALLENGE ELIGIBILITY
       ===================================================== */

    async function validateChallengeForSubmission() {

        const challenge =
            state.challenge;


        if (!challenge) {

            throw new Error(
                "No challenge has been selected."
            );
        }


        const status =
            getChallengeStatus(
                challenge
            );


        if (
            status ===
            "upcoming"
        ) {

            throw new Error(
                "This challenge has not started yet."
            );
        }


        if (
            status !==
            "active"
        ) {

            if (
                status ===
                "voting"
            ) {

                throw new Error(
                    "Submissions are closed because the challenge is now in the voting phase."
                );
            }


            if (
                status ===
                "completed"
            ) {

                throw new Error(
                    "This challenge has already ended."
                );
            }


            if (
                status ===
                "cancelled"
            ) {

                throw new Error(
                    "This challenge has been cancelled."
                );
            }


            throw new Error(
                "This challenge is not accepting submissions."
            );
        }


        /*
         * Make sure we aren't already submitted.
         */

        const existing =
            await getExistingSubmission();


        if (
            existing
        ) {

            throw new Error(
                "You have already submitted a design to this challenge."
            );
        }


        /*
         * Check maximum submission count.
         *
         * This is a helpful client-side guard.
         * The database/RLS layer should still be
         * treated as authoritative.
         */

        if (
            challenge.max_submissions &&
            state.submissionCount >=
                Number(
                    challenge.max_submissions
                )
        ) {

            throw new Error(
                "This challenge has reached its submission limit."
            );
        }


        return true;
    }


    /* =====================================================
       CREATE SUBMISSION
       ===================================================== */

    async function createSubmission(
        design
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
                "Please sign in before submitting."
            );
        }


        if (!state.challenge) {

            throw new Error(
                "No challenge selected."
            );
        }


        validateDesignForSubmission(
            design
        );


        await validateChallengeForSubmission();


        /*
         * Insert the minimum fields that are
         * already confirmed in your schema:
         *
         * challenge_id
         * design_id
         * designer_id
         *
         * We intentionally don't force `status`,
         * `score`, `rank`, etc. here because the
         * database can provide their defaults.
         */

        const {
            data,
            error
        } =
            await supabase
                .from("submissions")
                .insert({

                    challenge_id:
                        state.challenge.id,

                    design_id:
                        design.id,

                    designer_id:
                        user.id

                })
                .select(`
                    id,
                    challenge_id,
                    design_id,
                    designer_id,
                    status,
                    score,
                    rank,
                    submitted_at,
                    updated_at
                `)
                .single();


        if (error) {

            console.error(
                "DESIGNVERSE submission error:",
                error
            );


            /*
             * Friendly handling for the database
             * UNIQUE(challenge_id, designer_id)
             * constraint you already have.
             */

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
                    "You have already submitted a design to this challenge."
                );
            }


            if (
                message.includes(
                    "row-level security"
                )
            ) {

                throw new Error(
                    "DESIGNVERSE blocked the submission because your account doesn't have permission."
                );
            }


            throw error;
        }


        state.existingSubmission =
            data;


        state.submissionCount +=
            1;


        return data;
    }


    /* =====================================================
       SELECT DESIGN
       ===================================================== */

    function selectDesign(
        design
    ) {

        validateDesignForSubmission(
            design
        );


        state.selectedDesign =
            design;


        renderSelectedDesign(
            design
        );


        updateSubmissionButton();


        return design;
    }


    /* =====================================================
       CLEAR DESIGN
       ===================================================== */

    function clearSelectedDesign() {

        state.selectedDesign =
            null;


        renderSelectedDesign(
            null
        );


        updateSubmissionButton();
    }


    /* =====================================================
       RENDER SELECTED DESIGN
       ===================================================== */

    function renderSelectedDesign(
        design
    ) {

        /*
         * These selectors are intentionally optional.
         * They allow submissions.js to work before
         * submit.html is updated.
         */

        const title =
            $("#selectedDesignTitle");


        const image =
            $("#selectedDesignImage");


        const placeholder =
            $("#selectedDesignPlaceholder");


        const card =
            $("#selectedDesignCard");


        if (
            !design
        ) {

            if (title) {

                title.textContent =
                    "No design selected";
            }


            if (image) {

                image.removeAttribute(
                    "src"
                );

                image.hidden =
                    true;
            }


            if (placeholder) {

                placeholder.hidden =
                    false;
            }


            card?.classList.remove(
                "selected"
            );


            return;
        }


        if (title) {

            title.textContent =
                design.title ||
                "Untitled Design";
        }


        if (
            image &&
            design.image_url
        ) {

            image.src =
                design.image_url;

            image.alt =
                design.title ||
                "Selected design";

            image.hidden =
                false;
        }


        if (placeholder) {

            placeholder.hidden =
                true;
        }


        card?.classList.add(
            "selected"
        );
    }


    /* =====================================================
       RENDER USER DESIGNS
       ===================================================== */

    function renderUserDesigns() {

        const container =
            $("#submissionDesignGrid");


        if (!container) {

            return;
        }


        container.innerHTML =
            "";


        if (
            !state.userDesigns.length
        ) {

            container.innerHTML = `

                <div
                    class="submission-no-designs"
                >

                    <i
                        class="fa-solid fa-palette"
                    ></i>

                    <h3>
                        No eligible designs yet
                    </h3>

                    <p>
                        Create a design first,
                        then come back and enter
                        this challenge.
                    </p>

                    <a
                        href="submit.html"
                        class="btn btn-primary btn-small"
                    >

                        Create Design

                        <i
                            class="fa-solid fa-arrow-right"
                        ></i>

                    </a>

                </div>

            `;


            return;
        }


        state.userDesigns.forEach(
            design => {

                const card =
                    createDesignSelectionCard(
                        design
                    );


                container.appendChild(
                    card
                );

            }
        );
    }


    /* =====================================================
       CREATE DESIGN SELECTION CARD
       ===================================================== */

    function createDesignSelectionCard(
        design
    ) {

        const article =
            document.createElement(
                "article"
            );


        article.className =
            "submission-design-option";


        article.dataset.designId =
            design.id;


        const image =
            design.image_url
                ? `
                    <img
                        src="${escapeAttribute(
                            design.image_url
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
                        class="submission-design-placeholder"
                    >

                        <i
                            class="fa-solid fa-palette"
                        ></i>

                    </div>
                `;


        const eligible =
            design.is_public !== false &&
            Boolean(
                design.image_url
            );


        article.innerHTML = `

            <div
                class="submission-design-image"
            >

                ${image}

            </div>


            <div
                class="submission-design-info"
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


            <button
                type="button"
                class="submission-select-button"
                ${eligible ? "" : "disabled"}
            >

                ${
                    eligible
                        ? `
                            Select
                            <i
                                class="fa-solid fa-check"
                            ></i>
                          `
                        : `
                            Not eligible
                          `
                }

            </button>

        `;


        if (
            eligible
        ) {

            const button =
                article.querySelector(
                    ".submission-select-button"
                );


            button?.addEventListener(
                "click",
                () => {

                    selectDesign(
                        design
                    );


                    document
                        .querySelectorAll(
                            ".submission-design-option"
                        )
                        .forEach(
                            item => {

                                item.classList.remove(
                                    "selected"
                                );

                            }
                        );


                    article.classList.add(
                        "selected"
                    );

                }
            );
        }


        return article;
    }


    /* =====================================================
       SUBMISSION BUTTON
       ===================================================== */

    function updateSubmissionButton() {

        const buttons = [

            $("#submitChallengeButton"),

            $("#challengeSubmitButton")

        ];


        buttons.forEach(
            button => {

                if (!button) {
                    return;
                }


                const canSubmit =
                    Boolean(
                        state.selectedDesign
                    ) &&
                    getChallengeStatus() ===
                        "active" &&
                    !state.existingSubmission;


                button.disabled =
                    state.submitting ||
                    !canSubmit;


                if (
                    state.submitting
                ) {

                    button.innerHTML = `

                        <i
                            class="fa-solid fa-spinner fa-spin"
                        ></i>

                        Submitting...

                    `;

                } else {

                    button.innerHTML = `

                        <i
                            class="fa-solid fa-rocket"
                        ></i>

                        Submit to Challenge

                    `;
                }
            }
        );
    }


    /* =====================================================
       HANDLE SUBMISSION BUTTON
       ===================================================== */

    async function handleSubmission() {

        if (
            state.submitting
        ) {

            return;
        }


        try {

            state.submitting =
                true;


            updateSubmissionButton();


            /*
             * Make sure we have a user.
             */

            await getCurrentUser();


            if (!state.user) {

                throw new Error(
                    "Please sign in before submitting."
                );
            }


            /*
             * Make sure we have a challenge.
             */

            if (!state.challenge) {

                await loadChallenge();
            }


            /*
             * Load count and existing submission
             * immediately before insert.
             */

            await loadSubmissionCount();

            await getExistingSubmission();


            /*
             * Create the submission.
             */

            const submission =
                await createSubmission(
                    state.selectedDesign
                );


            showSubmissionSuccess(
                submission
            );


            /*
             * Return to challenge after the
             * success message.
             */

            setTimeout(
                () => {

                    window.location.href =
                        `challenge.html?id=${encodeURIComponent(
                            state.challenge.id
                        )}`;

                },
                1200
            );


        } catch (error) {

            console.error(
                "DESIGNVERSE submission failed:",
                error
            );


            showSubmissionError(
                getSubmissionErrorMessage(
                    error
                )
            );


        } finally {

            state.submitting =
                false;


            updateSubmissionButton();
        }
    }


    /* =====================================================
       SUCCESS
       ===================================================== */

    function showSubmissionSuccess(
        submission
    ) {

        showToast(
            "Your design has been submitted to the challenge! 🏆",
            "success"
        );


        const message =
            $("#submissionSuccess");


        if (message) {

            message.textContent =
                "Submission successful!";

            message.classList.add(
                "visible"
            );
        }
    }


    /* =====================================================
       ERROR
       ===================================================== */

    function showSubmissionError(
        message
    ) {

        showToast(
            message,
            "error"
        );


        const element =
            $("#submissionError");


        if (element) {

            element.textContent =
                message;

            element.classList.add(
                "visible"
            );
        }
    }


    /* =====================================================
       ERROR MESSAGES
       ===================================================== */

    function getSubmissionErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to submit your design."
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
                "You have already submitted a design to this challenge."
            );
        }


        if (
            lower.includes(
                "row-level security"
            )
        ) {

            return (
                "DESIGNVERSE blocked the submission because your account doesn't have permission."
            );
        }


        if (
            lower.includes(
                "foreign key"
            )
        ) {

            return (
                "The selected design or challenge could not be found."
            );
        }


        if (
            lower.includes(
                "not authenticated"
            )
        ) {

            return (
                "Please sign in before submitting."
            );
        }


        return message;
    }


    /* =====================================================
       LOAD CHALLENGE INTO SUBMIT PAGE
       ===================================================== */

    async function setupChallengeContext() {

        const identifier =
            getChallengeIdentifier();


        if (
            !identifier.id &&
            !identifier.slug
        ) {

            return null;
        }


        await loadChallenge(
            identifier
        );


        const status =
            getChallengeStatus();


        /*
         * Automatically populate the challenge
         * selector when submit.html contains one.
         */

        populateChallengeSelector();


        /*
         * Display challenge information if the
         * submit page has these optional elements.
         */

        setText(
            "#selectedChallengeTitle",
            state.challenge.title
        );


        setText(
            "#selectedChallengeStatus",
            formatStatus(
                status
            )
        );


        setText(
            "#selectedChallengePrize",
            state.challenge.prize ||
            "—"
        );


        setText(
            "#selectedChallengePoints",
            `${formatNumber(
                state.challenge.points
            )} XP`
        );


        setText(
            "#selectedChallengeDeadline",
            formatDate(
                state.challenge.ends_at
            )
        );


        return state.challenge;
    }


    /* =====================================================
       CHALLENGE SELECTOR
       ===================================================== */

    function populateChallengeSelector() {

        const selector =
            $("#challengeSelect");


        if (
            !selector ||
            !state.challenge
        ) {

            return;
        }


        /*
         * Check whether an option for the selected
         * challenge already exists.
         */

        let option =
            selector.querySelector(
                `option[value="${CSS.escape(
                    state.challenge.id
                )}"]`
            );


        if (!option) {

            option =
                document.createElement(
                    "option"
                );


            option.value =
                state.challenge.id;


            selector.appendChild(
                option
            );
        }


        option.textContent =
            state.challenge.title;


        selector.value =
            state.challenge.id;


        /*
         * Lock it when opened from
         * challenge.html?challenge=...
         */

        if (
            getChallengeIdentifier().id
        ) {

            selector.disabled =
                true;
        }
    }


    /* =====================================================
       OPTIONAL SELECT CHANGE
       ===================================================== */

    async function handleChallengeSelection(
        challengeId
    ) {

        if (!challengeId) {

            state.challenge =
                null;

            return null;
        }


        return loadChallenge({

            id:
                challengeId

        });
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
                ".toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "toast-container";


            container.style.cssText = `
                position:fixed;
                right:18px;
                bottom:18px;
                z-index:4000;
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
            background:rgba(10,10,16,.95);
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


    function formatDate(
        value
    ) {

        const timestamp =
            parseDate(
                value
            );


        if (
            timestamp === null
        ) {

            return "Not set";
        }


        return new Date(
            timestamp
        ).toLocaleDateString(
            undefined,
            {
                month:
                    "short",

                day:
                    "numeric",

                year:
                    "numeric"
            }
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


    function setText(
        selector,
        value
    ) {

        const element =
            $(selector);


        if (element) {

            element.textContent =
                value ??
                "";
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
       INITIALIZE
       ===================================================== */

    async function init() {

        if (
            state.initialized
        ) {

            return;
        }


        /*
         * Only initialize when the page is relevant:
         *
         * - submit.html
         * - challenge-aware submit page
         * - a page containing submission controls
         */

        const isSubmitPage =
            Boolean(
                $("#designSubmitForm")
            );


        const hasSubmissionGrid =
            Boolean(
                $("#submissionDesignGrid")
            );


        const hasSubmissionButton =
            Boolean(
                $("#submitChallengeButton") ||
                $("#challengeSubmitButton")
            );


        if (
            !isSubmitPage &&
            !hasSubmissionGrid &&
            !hasSubmissionButton
        ) {

            return;
        }


        state.initialized =
            true;


        /*
         * Load challenge context when the URL
         * contains ?challenge=...
         */

        try {

            await setupChallengeContext();

        } catch (error) {

            console.warn(
                "Challenge context could not be loaded:",
                error
            );

            /*
             * We don't block normal design uploads
             * when submit.html is being used without
             * a challenge.
             */
        }


        /*
         * Authentication is only required when
         * submission functionality is actually
         * being used.
         */

        const identifier =
            getChallengeIdentifier();


        if (
            identifier.id ||
            identifier.slug ||
            hasSubmissionGrid ||
            hasSubmissionButton
        ) {

            await getCurrentUser();
        }


        /*
         * Load designs when the page provides the
         * challenge-entry design selector.
         */

        if (
            hasSubmissionGrid &&
            state.user
        ) {

            try {

                await loadUserDesigns();


                renderUserDesigns();

            } catch (error) {

                console.error(
                    "Unable to load designs:",
                    error
                );
            }
        }


        /*
         * Existing submission check.
         */

        if (
            state.user &&
            state.challenge
        ) {

            await getExistingSubmission();

            await loadSubmissionCount();
        }


        /*
         * Bind submission buttons.
         */

        [
            "#submitChallengeButton",
            "#challengeSubmitButton"
        ]
        .forEach(
            selector => {

                $(selector)
                    ?.addEventListener(
                        "click",
                        handleSubmission
                    );
            }
        );


        /*
         * Challenge selector support.
         */

        $("#challengeSelect")
            ?.addEventListener(
                "change",
                async event => {

                    try {

                        await handleChallengeSelection(
                            event.target.value
                        );

                    } catch (error) {

                        showToast(
                            getSubmissionErrorMessage(
                                error
                            ),
                            "error"
                        );
                    }

                }
            );


        updateSubmissionButton();
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

        loadSubmissionCount,

        loadUserDesigns,

        getExistingSubmission,

        validateDesignForSubmission,

        validateChallengeForSubmission,

        createSubmission,

        selectDesign,

        clearSelectedDesign,

        renderUserDesigns,

        handleSubmission,

        setupChallengeContext

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVSubmissions =
    DVSubmissions;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVSubmissions.init();

    }
);


/* =========================================================
   DESIGNVERSE SUBMISSIONS SYSTEM COMPLETE
   ========================================================= */