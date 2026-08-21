/* =========================================================
   DESIGNVERSE — ADMIN SYSTEM
   js/admin.js

   Handles:
   - Administrator authentication
   - Admin authorization
   - Admin overview/dashboard
   - Platform statistics
   - Admin profile
   - Challenge creation
   - Challenge scheduling
   - Challenge cover upload
   - Challenge listing
   - Challenge status calculation
   - Challenge deletion
   - Form validation
   - Voting period support
   - Admin notifications/toasts
   ========================================================= */

"use strict";


const DVAdmin = (() => {

    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        user: null,

        profile: null,

        challenges: [],

        coverObjectUrl: null,

        submitting: false,

        initialized: false,

        authorized: false,

        stats: {
            users: 0,
            challenges: 0,
            submissions: 0,
            reports: 0
        }

    };


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
       DOM
       ===================================================== */

    function $(selector) {

        return document.querySelector(
            selector
        );
    }


    function $$(selector) {

        return [
            ...document.querySelectorAll(
                selector
            )
        ];
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
                "Admin user error:",
                error
            );

            return null;
        }


        return data.user || null;
    }


    /* =====================================================
       ADMIN PROFILE
       ===================================================== */

    async function getAdminProfile(
        userId
    ) {

        const supabase =
            getSupabase();


        if (!supabase || !userId) {

            return null;
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
                    bio,
                    avatar_url,
                    website_url,
                    location,
                    role,
                    total_points,
                    total_votes,
                    total_wins,
                    followers_count,
                    following_count,
                    created_at
                `)
                .eq(
                    "id",
                    userId
                )
                .single();


        if (error) {

            console.error(
                "Admin profile error:",
                error
            );

            return null;
        }


        return data;
    }


    /* =====================================================
       REQUIRE ADMIN
       ===================================================== */

    async function requireAdmin() {

        const user =
            await getCurrentUser();


        if (!user) {

            saveReturnUrl();


            window.location.href =
                getAuthPageUrl(
                    "login.html"
                );


            return false;
        }


        const profile =
            await getAdminProfile(
                user.id
            );


        if (
            !profile ||
            profile.role !== "admin"
        ) {

            console.warn(
                "DESIGNVERSE: Admin access denied."
            );


            showAdminToast(
                "You do not have administrator permission to access this area.",
                "error"
            );


            showAccessDenied();


            return false;
        }


        state.user =
            user;

        state.profile =
            profile;

        state.authorized =
            true;


        return true;
    }


    /* =====================================================
       ACCESS DENIED
       ===================================================== */

    function showAccessDenied() {

        const adminMain =
            $("#adminMain");


        const adminPage =
            $("#adminPage");


        const denied =
            $("#adminDenied");


        if (denied) {

            denied.style.display =
                "flex";
        }


        if (adminMain) {

            adminMain.style.display =
                "none";
        }


        if (adminPage) {

            adminPage.classList.add(
                "admin-access-denied"
            );
        }
    }


    /* =====================================================
       LOAD ADMIN PROFILE INTO PAGE
       ===================================================== */

    function renderAdminProfile() {

        const profile =
            state.profile;


        if (!profile) {

            return;
        }


        $$(
            '[data-profile="display-name"]'
        ).forEach(
            element => {

                element.textContent =
                    profile.display_name ||
                    "Administrator";
            }
        );


        $$(
            '[data-profile="username"]'
        ).forEach(
            element => {

                element.textContent =
                    profile.username
                        ? `@${profile.username}`
                        : "@admin";
            }
        );


        $$(
            '[data-profile="avatar"]'
        ).forEach(
            element => {

                if (
                    profile.avatar_url
                ) {

                    element.src =
                        profile.avatar_url;

                    element.alt =
                        profile.display_name ||
                        "Administrator";
                }
            }
        );


        $$(
            '[data-profile="role"]'
        ).forEach(
            element => {

                element.textContent =
                    "ADMIN";
            }
        );
    }


    /* =====================================================
       LOAD PLATFORM STATISTICS
       ===================================================== */

    async function loadPlatformStats() {

        const supabase =
            getSupabase();


        if (!supabase) {

            return state.stats;
        }


        try {

            const results =
                await Promise.all([

                    supabase
                        .from("profiles")
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        ),

                    supabase
                        .from("challenges")
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        ),

                    supabase
                        .from("submissions")
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        ),

                    supabase
                        .from("reports")
                        .select(
                            "id",
                            {
                                count:
                                    "exact",
                                head:
                                    true
                            }
                        )

                ]);


            state.stats = {

                users:
                    results[0].count || 0,

                challenges:
                    results[1].count || 0,

                submissions:
                    results[2].count || 0,

                reports:
                    results[3].count || 0

            };


            renderPlatformStats();


        } catch (error) {

            console.error(
                "Admin statistics error:",
                error
            );
        }


        return state.stats;
    }


    /* =====================================================
       RENDER PLATFORM STATISTICS
       ===================================================== */

    function renderPlatformStats() {

        Object.entries(
            state.stats
        ).forEach(
            ([key, value]) => {

                $$(
                    `[data-admin-stat="${key}"]`
                ).forEach(
                    element => {

                        element.textContent =
                            formatNumber(
                                value
                            );
                    }
                );
            }
        );
    }


    /* =====================================================
       LOAD CHALLENGES
       ===================================================== */

    async function loadChallenges() {

        const supabase =
            getSupabase();


        if (!supabase) {

            return [];
        }


        const list =
            $("#adminChallengeList");


        if (list) {

            list.innerHTML = `

                <div class="challenge-list-empty">

                    <i
                        class="fa-solid fa-spinner fa-spin"
                    ></i>

                    &nbsp;

                    Loading challenges...

                </div>

            `;
        }


        /*
         * We intentionally select only columns
         * that exist in the current DESIGNVERSE
         * schema.
         *
         * voting_ends_at is added below only
         * when the database supports it.
         */

        let query =
            supabase
                .from("challenges")
                .select(`
                    id,
                    title,
                    slug,
                    category,
                    difficulty,
                    cover_image_url,
                    prize,
                    points,
                    starts_at,
                    ends_at,
                    status,
                    created_at,
                    created_by
                `)
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        const {
            data,
            error
        } =
            await query;


        if (error) {

            console.error(
                "Admin challenge loading error:",
                error
            );


            if (list) {

                list.innerHTML = `

                    <div
                        class="challenge-list-empty"
                    >

                        Unable to load challenges.

                    </div>

                `;
            }


            return [];
        }


        state.challenges =
            data || [];


        renderChallengeList(
            state.challenges
        );


        return state.challenges;
    }


    /* =====================================================
       RENDER ADMIN CHALLENGE LIST
       ===================================================== */

    function renderChallengeList(
        challenges
    ) {

        const list =
            $("#adminChallengeList");


        if (!list) {

            return;
        }


        if (
            !challenges.length
        ) {

            list.innerHTML = `

                <div
                    class="challenge-list-empty"
                >

                    No challenges created yet.

                </div>

            `;

            return;
        }


        list.innerHTML =
            "";


        challenges.forEach(
            challenge => {

                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "challenge-list-item";


                const image =
                    challenge.cover_image_url
                        ? `
                            <img
                                src="${escapeAttribute(
                                    challenge.cover_image_url
                                )}"
                                alt=""
                                loading="lazy"
                            >
                        `
                        : "";


                const status =
                    calculateStatus(
                        challenge
                    );


                item.innerHTML = `

                    <div
                        class="challenge-list-cover"
                    >

                        ${image}

                    </div>


                    <div
                        class="challenge-list-info"
                    >

                        <h3>

                            ${escapeHTML(
                                challenge.title
                            )}

                        </h3>


                        <span>

                            ${escapeHTML(
                                formatCategory(
                                    challenge.category
                                )
                            )}

                            ·

                            ${formatNumber(
                                challenge.points
                            )}

                            XP

                        </span>

                    </div>


                    <div
                        style="
                            display:flex;
                            align-items:center;
                            gap:6px;
                        "
                    >

                        <span
                            class="challenge-list-status ${status}"
                        >

                            ${escapeHTML(
                                formatStatus(
                                    status
                                )
                            )}

                        </span>


                        <button
                            type="button"
                            class="admin-delete-challenge"
                            data-challenge-id="${escapeAttribute(
                                challenge.id
                            )}"
                            title="Delete challenge"
                            aria-label="Delete challenge"
                            style="
                                width:30px;
                                height:30px;
                                display:grid;
                                place-items:center;
                                border:1px solid rgba(239,68,68,.18);
                                border-radius:8px;
                                background:rgba(239,68,68,.06);
                                color:#fca5a5;
                                cursor:pointer;
                            "
                        >

                            <i
                                class="fa-solid fa-trash"
                            ></i>

                        </button>

                    </div>

                `;


                list.appendChild(
                    item
                );

            }
        );


        list
            .querySelectorAll(
                ".admin-delete-challenge"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const id =
                                button.dataset.challengeId;


                            await handleDeleteChallenge(
                                id,
                                button
                            );

                        }
                    );

                }
            );
    }


    /* =====================================================
       CREATE CHALLENGE
       ===================================================== */

    async function createChallenge({

        title,

        description,

        brief,

        category,

        difficulty,

        prize,

        points,

        maxSubmissions,

        startsAt,

        endsAt,

        votingEndsAt,

        rules,

        coverFile

    }) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        if (
            !state.user ||
            !state.authorized
        ) {

            throw new Error(
                "You must be an administrator."
            );
        }


        validateChallengeData({

            title,

            description,

            category,

            startsAt,

            endsAt,

            votingEndsAt,

            points

        });


        const slug =
            await createUniqueSlug(
                title
            );


        /*
         * Current database schema:
         *
         * challenges includes:
         * title, slug, description, brief,
         * category, difficulty, rules,
         * prize, points, max_submissions,
         * starts_at, ends_at, status,
         * created_by
         *
         * voting_ends_at is supported when
         * present in the database.
         */


        const insertPayload = {

            title:
                title.trim(),

            slug,

            description:
                description.trim(),

            brief:
                String(
                    brief || ""
                )
                    .trim() ||
                null,

            category,

            difficulty:
                difficulty ||
                "medium",

            rules:
                String(
                    rules || ""
                )
                    .trim() ||
                null,

            prize:
                String(
                    prize || ""
                )
                    .trim() ||
                null,

            points:
                Number(points) ||
                100,

            max_submissions:
                maxSubmissions
                    ? Number(
                        maxSubmissions
                    )
                    : null,

            starts_at:
                toISOString(
                    startsAt
                ),

            ends_at:
                toISOString(
                    endsAt
                ),

            status:
                calculateInitialStatus({
                    startsAt,
                    endsAt,
                    votingEndsAt
                }),

            created_by:
                state.user.id

        };


        /*
         * Add voting_ends_at only when
         * the form supplied it.
         *
         * Your current SQL schema needs
         * this column added before this field
         * can actually be persisted.
         */

        if (
            votingEndsAt
        ) {

            insertPayload.voting_ends_at =
                toISOString(
                    votingEndsAt
                );
        }


        /*
         * Create database record first.
         */

        const {
            data: challenge,
            error: createError
        } =
            await supabase
                .from("challenges")
                .insert(
                    insertPayload
                )
                .select()
                .single();


        if (createError) {

            console.error(
                "Challenge create error:",
                createError
            );

            throw createError;
        }


        /*
         * Upload cover after challenge
         * has been created.
         */

        if (coverFile) {

            let uploadedPath =
                null;


            try {

                const uploaded =
                    await uploadChallengeCover(
                        challenge.id,
                        coverFile
                    );


                uploadedPath =
                    uploaded.path;


                const {
                    error:
                        updateError
                } =
                    await supabase
                        .from("challenges")
                        .update({

                            cover_image_url:
                                uploaded.url,

                            updated_at:
                                new Date()
                                    .toISOString()

                        })
                        .eq(
                            "id",
                            challenge.id
                        )
                        .eq(
                            "created_by",
                            state.user.id
                        );


                if (updateError) {

                    throw updateError;
                }


            } catch (coverError) {

                if (
                    uploadedPath
                ) {

                    await removeChallengeCover(
                        uploadedPath
                    );
                }


                await supabase
                    .from("challenges")
                    .delete()
                    .eq(
                        "id",
                        challenge.id
                    )
                    .eq(
                        "created_by",
                        state.user.id
                    );


                throw coverError;
            }
        }


        return challenge;
    }


    /* =====================================================
       UPLOAD CHALLENGE COVER
       ===================================================== */

    async function uploadChallengeCover(
        challengeId,
        file
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        validateCoverFile(
            file
        );


        const extension =
            getFileExtension(
                file
            );


        const safeName =
            file.name
                .split(".")
                .slice(
                    0,
                    -1
                )
                .join(".")
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                )
                .substring(
                    0,
                    60
                ) ||
                "cover";


        const filePath =
            `${challengeId}/` +
            `${Date.now()}-` +
            `${generateId()}-` +
            `${safeName}.` +
            `${extension}`;


        const {
            error
        } =
            await supabase
                .storage
                .from(
                    "challenge-covers"
                )
                .upload(
                    filePath,
                    file,
                    {

                        cacheControl:
                            "3600",

                        upsert:
                            false,

                        contentType:
                            file.type

                    }
                );


        if (error) {

            console.error(
                "Challenge cover upload error:",
                error
            );

            throw error;
        }


        const {
            data
        } =
            supabase
                .storage
                .from(
                    "challenge-covers"
                )
                .getPublicUrl(
                    filePath
                );


        if (
            !data?.publicUrl
        ) {

            throw new Error(
                "Unable to create the challenge cover URL."
            );
        }


        return {

            path:
                filePath,

            url:
                data.publicUrl

        };
    }


    /* =====================================================
       DELETE CHALLENGE
       ===================================================== */

    async function deleteChallenge(
        challengeId
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        if (
            !state.user ||
            !state.authorized
        ) {

            throw new Error(
                "Administrator permission required."
            );
        }


        const challenge =
            state.challenges.find(
                item =>
                    item.id ===
                    challengeId
            );


        if (!challenge) {

            throw new Error(
                "Challenge not found."
            );
        }


        /*
         * Delete database row first.
         *
         * Note:
         * The current schema uses cascading
         * deletes for submissions.
         */

        const {
            error
        } =
            await supabase
                .from("challenges")
                .delete()
                .eq(
                    "id",
                    challengeId
                );


        if (error) {

            throw error;
        }


        /*
         * Remove cover from Storage.
         */

        if (
            challenge.cover_image_url
        ) {

            const path =
                extractStoragePath(
                    challenge.cover_image_url,
                    "challenge-covers"
                );


            if (path) {

                await removeChallengeCover(
                    path
                );
            }
        }


        state.challenges =
            state.challenges.filter(
                item =>
                    item.id !==
                    challengeId
            );


        renderChallengeList(
            state.challenges
        );


        return true;
    }


    /* =====================================================
       HANDLE DELETE
       ===================================================== */

    async function handleDeleteChallenge(
        challengeId,
        button
    ) {

        const challenge =
            state.challenges.find(
                item =>
                    item.id ===
                    challengeId
            );


        if (!challenge) {

            return;
        }


        const confirmed =
            window.confirm(
                `Delete "${challenge.title}"? This may permanently remove submissions associated with it.`
            );


        if (!confirmed) {

            return;
        }


        const originalHTML =
            button.innerHTML;


        try {

            button.disabled =
                true;


            button.innerHTML = `

                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

            `;


            await deleteChallenge(
                challengeId
            );


            showAdminToast(
                "Challenge deleted successfully.",
                "success"
            );


            await loadPlatformStats();


        } catch (error) {

            console.error(
                "Challenge delete error:",
                error
            );


            button.disabled =
                false;


            button.innerHTML =
                originalHTML;


            showAdminToast(
                getAdminErrorMessage(
                    error
                ),
                "error"
            );
        }
    }


    /* =====================================================
       REMOVE COVER
       ===================================================== */

    async function removeChallengeCover(
        path
    ) {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !path
        ) {

            return;
        }


        const {
            error
        } =
            await supabase
                .storage
                .from(
                    "challenge-covers"
                )
                .remove([
                    path
                ]);


        if (error) {

            console.warn(
                "Challenge cover cleanup error:",
                error
            );
        }
    }


    /* =====================================================
       UNIQUE SLUG
       ===================================================== */

    async function createUniqueSlug(
        title
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const baseSlug =
            slugify(
                title
            ) ||
            "challenge";


        const {
            data: existing,
            error
        } =
            await supabase
                .from("challenges")
                .select("id")
                .eq(
                    "slug",
                    baseSlug
                )
                .maybeSingle();


        if (error) {

            throw error;
        }


        if (!existing) {

            return baseSlug;
        }


        for (
            let i = 2;
            i <= 100;
            i++
        ) {

            const candidate =
                `${baseSlug}-${i}`;


            const {
                data,
                error:
                    candidateError
            } =
                await supabase
                    .from("challenges")
                    .select("id")
                    .eq(
                        "slug",
                        candidate
                    )
                    .maybeSingle();


            if (candidateError) {

                throw candidateError;
            }


            if (!data) {

                return candidate;
            }
        }


        return (
            `${baseSlug}-` +
            Date.now()
        );
    }


    /* =====================================================
       CHALLENGE VALIDATION
       ===================================================== */

    function validateChallengeData({

        title,

        description,

        category,

        startsAt,

        endsAt,

        votingEndsAt,

        points

    }) {

        if (
            !String(
                title || ""
            )
                .trim()
        ) {

            throw new Error(
                "Please enter a challenge title."
            );
        }


        if (
            String(title)
                .trim()
                .length >
            100
        ) {

            throw new Error(
                "Challenge title must be 100 characters or fewer."
            );
        }


        if (
            !String(
                description || ""
            )
                .trim()
        ) {

            throw new Error(
                "Please enter a challenge description."
            );
        }


        if (!category) {

            throw new Error(
                "Please select a challenge category."
            );
        }


        const start =
            parseDate(
                startsAt
            );


        const end =
            parseDate(
                endsAt
            );


        const votingEnd =
            votingEndsAt
                ? parseDate(
                    votingEndsAt
                )
                : null;


        if (
            start === null ||
            end === null
        ) {

            throw new Error(
                "Please provide valid start and submission deadline dates."
            );
        }


        if (
            end <= start
        ) {

            throw new Error(
                "The submission deadline must be after the challenge start time."
            );
        }


        /*
         * Voting period is optional until
         * voting_ends_at exists in the schema.
         */

        if (
            votingEndsAt &&
            (
                votingEnd === null ||
                votingEnd <= end
            )
        ) {

            throw new Error(
                "The voting deadline must be after the submission deadline."
            );
        }


        const minimumSubmissionPeriod =
            60 * 60 * 1000;


        if (
            end - start <
            minimumSubmissionPeriod
        ) {

            throw new Error(
                "The submission period must be at least 1 hour."
            );
        }


        if (
            votingEndsAt &&
            votingEnd - end <
            60 * 60 * 1000
        ) {

            throw new Error(
                "The voting period must be at least 1 hour."
            );
        }


        const numericPoints =
            Number(points);


        if (
            !Number.isInteger(
                numericPoints
            ) ||
            numericPoints < 1
        ) {

            throw new Error(
                "XP reward must be a positive whole number."
            );
        }
    }


    /* =====================================================
       COVER VALIDATION
       ===================================================== */

    function validateCoverFile(
        file
    ) {

        if (!file) {

            throw new Error(
                "Please select a challenge cover."
            );
        }


        const allowedTypes = [

            "image/jpeg",

            "image/png",

            "image/webp",

            "image/gif"

        ];


        const maxSize =
            10 *
            1024 *
            1024;


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            throw new Error(
                "Challenge cover must be JPG, PNG, WEBP or GIF."
            );
        }


        if (
            file.size >
            maxSize
        ) {

            throw new Error(
                "Challenge cover must be 10 MB or smaller."
            );
        }
    }


    /* =====================================================
       FORM SETUP
       ===================================================== */

    function setupChallengeForm() {

        const form =
            $("#challengeForm");


        if (!form) {

            return;
        }


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                if (
                    state.submitting
                ) {

                    return;
                }


                const title =
                    $("#challengeTitle")
                        ?.value ||
                    "";


                const description =
                    $("#challengeDescription")
                        ?.value ||
                    "";


                const brief =
                    $("#challengeBrief")
                        ?.value ||
                    "";


                const category =
                    $("#challengeCategory")
                        ?.value ||
                    "";


                const difficulty =
                    $("#challengeDifficulty")
                        ?.value ||
                    "medium";


                const prize =
                    $("#challengePrize")
                        ?.value ||
                    "";


                const points =
                    $("#challengePoints")
                        ?.value ||
                    "100";


                const maxSubmissions =
                    $("#maxSubmissions")
                        ?.value ||
                    "";


                const startsAt =
                    $("#challengeStartsAt")
                        ?.value ||
                    "";


                const endsAt =
                    $("#challengeEndsAt")
                        ?.value ||
                    "";


                const votingEndsAt =
                    $("#challengeVotingEndsAt")
                        ?.value ||
                    "";


                const rules =
                    $("#challengeRules")
                        ?.value ||
                    "";


                const coverFile =
                    $("#challengeCoverInput")
                        ?.files?.[0] ||
                    null;


                try {

                    state.submitting =
                        true;


                    setPublishButtonLoading(
                        true
                    );


                    const challenge =
                        await createChallenge({

                            title,

                            description,

                            brief,

                            category,

                            difficulty,

                            prize,

                            points,

                            maxSubmissions,

                            startsAt,

                            endsAt,

                            votingEndsAt,

                            rules,

                            coverFile

                        });


                    showAdminToast(
                        `Challenge "${challenge.title}" published successfully! 🏆`,
                        "success"
                    );


                    form.reset();


                    resetCoverUI();


                    updateFormPreview();


                    await loadChallenges();


                    await loadPlatformStats();


                } catch (error) {

                    console.error(
                        "Create challenge error:",
                        error
                    );


                    showAdminToast(
                        getAdminErrorMessage(
                            error
                        ),
                        "error"
                    );


                } finally {

                    state.submitting =
                        false;


                    setPublishButtonLoading(
                        false
                    );
                }

            }
        );
    }


    /* =====================================================
       PUBLISH BUTTON
       ===================================================== */

    function setPublishButtonLoading(
        loading
    ) {

        const button =
            $("#publishChallengeButton");


        if (!button) {

            return;
        }


        if (loading) {

            if (
                !button.dataset.originalText
            ) {

                button.dataset.originalText =
                    button.innerHTML;
            }


            button.disabled =
                true;


            button.innerHTML = `

                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

                &nbsp;

                Publishing...

            `;


        } else {

            button.disabled =
                false;


            button.innerHTML =
                button.dataset.originalText ||
                `

                    <i
                        class="fa-solid fa-rocket"
                    ></i>

                    Publish Challenge

                `;
        }
    }


    /* =====================================================
       LIVE PREVIEW
       ===================================================== */

    function setupPreview() {

        const fields = [

            "#challengeTitle",

            "#challengeDescription",

            "#challengeCategory",

            "#challengeDifficulty",

            "#challengePoints",

            "#challengePrize",

            "#challengeStartsAt",

            "#challengeEndsAt",

            "#challengeVotingEndsAt"

        ];


        fields.forEach(
            selector => {

                const element =
                    $(selector);


                element?.addEventListener(
                    "input",
                    updateFormPreview
                );


                element?.addEventListener(
                    "change",
                    updateFormPreview
                );

            }
        );


        updateFormPreview();
    }


    function updateFormPreview() {

        const title =
            $("#challengeTitle")
                ?.value
                .trim() ||
            "New Challenge";


        const description =
            $("#challengeDescription")
                ?.value
                .trim() ||
            "Your challenge description will appear here.";


        const category =
            $("#challengeCategory")
                ?.value ||
            "other";


        const difficulty =
            $("#challengeDifficulty")
                ?.value ||
            "medium";


        const points =
            $("#challengePoints")
                ?.value ||
            "100";


        const prize =
            $("#challengePrize")
                ?.value
                .trim() ||
            "—";


        const startsAt =
            $("#challengeStartsAt")
                ?.value ||
            "";


        const endsAt =
            $("#challengeEndsAt")
                ?.value ||
            "";


        const votingEndsAt =
            $("#challengeVotingEndsAt")
                ?.value ||
            "";


        setText(
            "#previewTitle",
            title
        );


        setText(
            "#previewCoverTitle",
            title
        );


        setText(
            "#previewDescription",
            description
        );


        setText(
            "#previewCategory",
            formatCategory(
                category
            )
        );


        setText(
            "#previewDifficulty",
            capitalize(
                difficulty
            )
        );


        setText(
            "#previewPoints",
            `${formatNumber(points)} XP`
        );


        setText(
            "#previewPrize",
            prize
        );


        setText(
            "#previewStartsAt",
            formatPreviewDate(
                startsAt
            )
        );


        setText(
            "#previewEndsAt",
            formatPreviewDate(
                endsAt
            )
        );


        setText(
            "#previewVotingEndsAt",
            votingEndsAt
                ? formatPreviewDate(
                    votingEndsAt
                )
                : "Not set"
        );
    }


    /* =====================================================
       COVER PREVIEW
       ===================================================== */

    function setupCoverPreview() {

        const input =
            $("#challengeCoverInput");


        const uploadZone =
            $("#coverUpload");


        const preview =
            $("#coverPreview");


        const previewImage =
            $("#coverPreviewImage");


        const previewName =
            $("#coverPreviewName");


        const changeButton =
            $("#changeCoverButton");


        if (!input) {

            return;
        }


        input.addEventListener(
            "change",
            () => {

                handleCoverSelection(
                    input.files?.[0]
                );

            }
        );


        changeButton?.addEventListener(
            "click",
            event => {

                event.preventDefault();

                input.click();

            }
        );


        [
            "dragenter",
            "dragover"
        ]
        .forEach(
            eventName => {

                uploadZone?.addEventListener(
                    eventName,
                    event => {

                        event.preventDefault();

                        uploadZone.classList.add(
                            "dragover"
                        );

                    }
                );

            }
        );


        [
            "dragleave",
            "drop"
        ]
        .forEach(
            eventName => {

                uploadZone?.addEventListener(
                    eventName,
                    event => {

                        event.preventDefault();

                        uploadZone.classList.remove(
                            "dragover"
                        );

                    }
                );

            }
        );


        uploadZone?.addEventListener(
            "drop",
            event => {

                const file =
                    event.dataTransfer
                        ?.files?.[0];


                if (!file) {

                    return;
                }


                try {

                    const transfer =
                        new DataTransfer();


                    transfer.items.add(
                        file
                    );


                    input.files =
                        transfer.files;

                } catch {

                    /*
                     * Some browsers restrict
                     * FileList assignment.
                     */

                }


                handleCoverSelection(
                    file
                );
            }
        );


        function handleCoverSelection(
            file
        ) {

            try {

                validateCoverFile(
                    file
                );


            } catch (error) {

                showAdminToast(
                    error.message,
                    "error"
                );


                input.value =
                    "";


                return;
            }


            if (
                state.coverObjectUrl
            ) {

                URL.revokeObjectURL(
                    state.coverObjectUrl
                );
            }


            state.coverObjectUrl =
                URL.createObjectURL(
                    file
                );


            if (previewImage) {

                previewImage.src =
                    state.coverObjectUrl;
            }


            if (previewName) {

                previewName.textContent =
                    file.name;
            }


            preview?.classList.add(
                "visible"
            );


            if (uploadZone) {

                uploadZone.style.display =
                    "none";
            }


            const previewCardImage =
                $("#previewCoverImage");


            const placeholder =
                $("#previewCoverPlaceholder");


            if (previewCardImage) {

                previewCardImage.src =
                    state.coverObjectUrl;

                previewCardImage.style.display =
                    "block";
            }


            if (placeholder) {

                placeholder.style.display =
                    "none";
            }
        }
    }


    /* =====================================================
       RESET COVER
       ===================================================== */

    function resetCoverUI() {

        const input =
            $("#challengeCoverInput");


        const upload =
            $("#coverUpload");


        const preview =
            $("#coverPreview");


        const previewCardImage =
            $("#previewCoverImage");


        const placeholder =
            $("#previewCoverPlaceholder");


        if (
            state.coverObjectUrl
        ) {

            URL.revokeObjectURL(
                state.coverObjectUrl
            );


            state.coverObjectUrl =
                null;
        }


        if (input) {

            input.value =
                "";
        }


        preview?.classList.remove(
            "visible"
        );


        if (upload) {

            upload.style.display =
                "";
        }


        if (previewCardImage) {

            previewCardImage.src =
                "";

            previewCardImage.style.display =
                "none";
        }


        if (placeholder) {

            placeholder.style.display =
                "";
        }
    }


    /* =====================================================
       STATUS
       ===================================================== */

    function calculateInitialStatus({

        startsAt,

        endsAt,

        votingEndsAt

    }) {

        const now =
            Date.now();


        const start =
            parseDate(
                startsAt
            );


        const end =
            parseDate(
                endsAt
            );


        const votingEnd =
            votingEndsAt
                ? parseDate(
                    votingEndsAt
                )
                : null;


        if (
            start !== null &&
            now < start
        ) {

            return "upcoming";
        }


        if (
            start !== null &&
            end !== null &&
            now >= start &&
            now < end
        ) {

            return "active";
        }


        if (
            end !== null &&
            votingEnd !== null &&
            now >= end &&
            now < votingEnd
        ) {

            return "voting";
        }


        /*
         * Without a voting_ends_at field,
         * ending the submission period means
         * the challenge becomes completed.
         */

        return "completed";
    }


    function calculateStatus(
        challenge
    ) {

        if (
            challenge.status ===
            "cancelled"
        ) {

            return "cancelled";
        }


        return calculateInitialStatus({

            startsAt:
                challenge.starts_at,

            endsAt:
                challenge.ends_at,

            votingEndsAt:
                challenge.voting_ends_at

        });
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    function formatStatus(
        status
    ) {

        const map = {

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
            map[status] ||
            "Unknown"
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


    function capitalize(
        value
    ) {

        const text =
            String(
                value ||
                ""
            );


        return (
            text.charAt(0)
                .toUpperCase() +
            text.slice(1)
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


    function formatPreviewDate(
        value
    ) {

        if (!value) {

            return "Not set";
        }


        const date =
            parseDate(
                value
            );


        if (
            date === null
        ) {

            return "Invalid";
        }


        return new Date(
            date
        ).toLocaleString(
            undefined,
            {
                month:
                    "short",

                day:
                    "numeric",

                hour:
                    "numeric",

                minute:
                    "2-digit"
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


    function toISOString(
        value
    ) {

        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            throw new Error(
                "Invalid date."
            );
        }


        return date.toISOString();
    }


    function slugify(
        value
    ) {

        return String(
            value ||
            ""
        )
            .trim()
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .substring(
                0,
                80
            );
    }


    function getFileExtension(
        file
    ) {

        const extension =
            file.name
                .split(".")
                .pop()
                .toLowerCase();


        const allowed = [

            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif"

        ];


        if (
            allowed.includes(
                extension
            )
        ) {

            return extension;
        }


        const mimeMap = {

            "image/jpeg":
                "jpg",

            "image/png":
                "png",

            "image/webp":
                "webp",

            "image/gif":
                "gif"

        };


        return (
            mimeMap[
                file.type
            ] ||
            "jpg"
        );
    }


    function generateId() {

        if (
            typeof crypto !==
                "undefined" &&
            typeof crypto.randomUUID ===
                "function"
        ) {

            return crypto.randomUUID();
        }


        return (
            Date.now()
                .toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .substring(
                    2,
                    10
                )
        );
    }


    /* =====================================================
       SET TEXT
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


    /* =====================================================
       STORAGE PATH
       ===================================================== */

    function extractStoragePath(
        url,
        bucket
    ) {

        if (!url) {

            return null;
        }


        try {

            const publicMarker =
                `/storage/v1/object/public/${bucket}/`;


            const signedMarker =
                `/storage/v1/object/sign/${bucket}/`;


            let index =
                url.indexOf(
                    publicMarker
                );


            let marker =
                publicMarker;


            if (
                index === -1
            ) {

                index =
                    url.indexOf(
                        signedMarker
                    );


                marker =
                    signedMarker;
            }


            if (
                index === -1
            ) {

                return null;
            }


            const path =
                url.substring(
                    index +
                    marker.length
                );


            return decodeURIComponent(
                path.split("?")[0]
            );

        } catch {

            return null;
        }
    }


    /* =====================================================
       ERROR MESSAGE
       ===================================================== */

    function getAdminErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to complete that action."
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
                "Supabase blocked this action. Make sure your account has administrator permission."
            );
        }


        if (
            lower.includes(
                "duplicate key"
            ) &&
            lower.includes(
                "slug"
            )
        ) {

            return (
                "A challenge with that URL slug already exists."
            );
        }


        if (
            lower.includes(
                "voting_ends_at"
            )
        ) {

            return (
                "Your challenges table does not currently contain the voting_ends_at column required for a voting period."
            );
        }


        if (
            lower.includes(
                "bucket"
            ) &&
            lower.includes(
                "not found"
            )
        ) {

            return (
                "The challenge-covers Storage bucket was not found."
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

    function showAdminToast(
        message,
        type = "info"
    ) {

        let container =
            document.querySelector(
                ".admin-toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "admin-toast-container";


            container.style.cssText = `
                position:fixed;
                right:18px;
                bottom:18px;
                z-index:3000;
                display:flex;
                flex-direction:column;
                gap:8px;
                width:min(
                    380px,
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


        const borderColor =
            type === "success"
                ? "rgba(34,197,94,.25)"
                : type === "error"
                    ? "rgba(239,68,68,.25)"
                    : "rgba(168,85,247,.25)";


        toast.style.cssText = `
            display:flex;
            align-items:center;
            gap:10px;
            padding:13px 14px;
            border:1px solid ${borderColor};
            border-radius:13px;
            background:rgba(10,10,16,.94);
            color:white;
            box-shadow:0 20px 50px rgba(0,0,0,.35);
            backdrop-filter:blur(18px);
            font:10px/1.5 Inter,sans-serif;
        `;


        toast.innerHTML = `

            <i
                class="fa-solid ${icon}"
                style="
                    color:${iconColor};
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


    function showToast(
        message,
        type = "info"
    ) {

        showAdminToast(
            message,
            type
        );
    }


    /* =====================================================
       ROOT URL HELPERS
       ===================================================== */

    function getSiteRoot() {

        const pathname =
            window.location.pathname;


        const marker =
            "/pages/";


        const index =
            pathname.indexOf(
                marker
            );


        if (
            index !== -1
        ) {

            return (
                pathname.substring(
                    0,
                    index
                ) +
                "/"
            );
        }


        return "/";
    }


    function getAuthPageUrl(
        page
    ) {

        return (
            getSiteRoot() +
            "pages/auth/" +
            page
        );
    }


    function getRootPageUrl(
        page
    ) {

        return (
            getSiteRoot() +
            page
        );
    }


    function saveReturnUrl() {

        try {

            sessionStorage.setItem(
                "designverse_redirect",
                window.location.href
            );

        } catch {

            /*
             * Ignore storage failures.
             */

        }
    }


    /* =====================================================
       ESCAPE HELPERS
       ===================================================== */

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
       ADMIN PAGE TYPE
       ===================================================== */

    function getAdminPageType() {

        const path =
            window.location.pathname
                .toLowerCase();


        if (
            path.endsWith(
                "/admin/index.html"
            )
        ) {

            return "overview";
        }


        if (
            path.endsWith(
                "/admin/challenges.html"
            )
        ) {

            return "challenges";
        }


        if (
            path.endsWith(
                "/admin/submissions.html"
            )
        ) {

            return "submissions";
        }


        if (
            path.endsWith(
                "/admin/users.html"
            )
        ) {

            return "users";
        }


        if (
            path.endsWith(
                "/admin/reports.html"
            )
        ) {

            return "reports";
        }


        return "unknown";
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
         * Only run on admin pages.
         */

        const pageType =
            getAdminPageType();


        if (
            pageType ===
            "unknown"
        ) {

            return;
        }


        /*
         * Verify admin access FIRST.
         */

        const allowed =
            await requireAdmin();


        if (!allowed) {

            state.initialized =
                true;

            return;
        }


        state.initialized =
            true;


        /*
         * Load common admin UI.
         */

        renderAdminProfile();


        /*
         * Load overview-specific
         * statistics.
         */

        if (
            pageType ===
            "overview"
        ) {

            await loadPlatformStats();

            return;
        }


        /*
         * Challenge manager.
         */

        if (
            pageType ===
            "challenges"
        ) {

            setupChallengeForm();

            setupPreview();

            setupCoverPreview();

            await loadChallenges();

            return;
        }


        /*
         * Other admin sections are
         * initialized by their future
         * page-specific systems.
         */

        if (
            pageType ===
            "submissions"
        ) {

            console.log(
                "DESIGNVERSE: Admin submissions page authorized."
            );

            return;
        }


        if (
            pageType ===
            "users"
        ) {

            console.log(
                "DESIGNVERSE: Admin users page authorized."
            );

            return;
        }


        if (
            pageType ===
            "reports"
        ) {

            console.log(
                "DESIGNVERSE: Admin reports page authorized."
            );

            return;
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        state,

        init,

        requireAdmin,

        getCurrentUser,

        getAdminProfile,

        loadPlatformStats,

        loadChallenges,

        createChallenge,

        deleteChallenge,

        uploadChallengeCover,

        showToast,

        updateFormPreview,

        isAdmin: () =>
            state.authorized &&
            state.profile?.role ===
                "admin"

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVAdmin =
    DVAdmin;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVAdmin.init();

    }
);


/* =========================================================
   DESIGNVERSE ADMIN SYSTEM COMPLETE
   ========================================================= */