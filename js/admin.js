/* =========================================================
   DESIGNVERSE — ADMIN SYSTEM
   js/admin.js

   Handles:
   - Admin authentication/authorization
   - Challenge creation
   - Challenge cover upload
   - Challenge listing
   - Challenge status calculation
   - Challenge deletion
   - Admin form validation
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

        initialized: false

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
        return document.querySelector(selector);
    }


    /* =====================================================
       GET CURRENT USER
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
       GET ADMIN PROFILE
       ===================================================== */

    async function getAdminProfile(
        userId
    ) {

        const supabase =
            getSupabase();

        if (!supabase) {
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
                    avatar_url,
                    role
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


            showAdminNotice(
                "You do not have administrator permission to access this area.",
                "error"
            );


            setTimeout(
                () => {

                    window.location.href =
                        getRootPageUrl(
                            "index.html"
                        );

                },
                1200
            );


            return false;
        }


        state.user =
            user;

        state.profile =
            profile;


        return true;
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
                    category,
                    difficulty,
                    cover_image_url,
                    prize,
                    points,
                    starts_at,
                    ends_at,
                    status,
                    created_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


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


        list.innerHTML = "";


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
                            )} XP
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


        if (!state.user) {

            throw new Error(
                "You must be logged in."
            );
        }


        /* -----------------------------------------------
           VALIDATION
           ----------------------------------------------- */

        validateChallengeData({

            title,
            description,
            category,
            startsAt,
            endsAt,
            points

        });


        const slug =
            await createUniqueSlug(
                title
            );


        /*
         * IMPORTANT:
         *
         * We create the challenge FIRST because
         * the Storage policy requires:
         *
         * challenge-covers/CHALLENGE_ID/filename
         *
         * Once we have the challenge ID, we can
         * safely upload the cover.
         */

        const {
            data: challenge,
            error: createError
        } =
            await supabase
                .from("challenges")
                .insert({

                    title:
                        title.trim(),

                    slug,

                    description:
                        description.trim(),

                    brief:
                        brief?.trim() ||
                        null,

                    category,

                    difficulty:
                        difficulty ||
                        "medium",

                    rules:
                        rules?.trim() ||
                        null,

                    prize:
                        prize?.trim() ||
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
                        new Date(
                            startsAt
                        ).toISOString(),

                    ends_at:
                        new Date(
                            endsAt
                        ).toISOString(),

                    status:
                        calculateInitialStatus(
                            startsAt,
                            endsAt
                        ),

                    created_by:
                        state.user.id

                })
                .select()
                .single();


        if (createError) {

            console.error(
                "Challenge create error:",
                createError
            );

            throw createError;
        }


        /* -----------------------------------------------
           COVER UPLOAD
           ----------------------------------------------- */

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

                /*
                 * Clean up if the cover upload/update
                 * fails so the challenge isn't left
                 * half-created.
                 */

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
                .slice(0, -1)
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
                )
                ||
                "cover";


        const filePath =
            `${challengeId}/` +
            `${Date.now()}-` +
            `${safeName}.` +
            `${extension}`;


        const {
            error
        } =
            await supabase
                .storage
                .from("challenge-covers")
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
                .from("challenge-covers")
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
         * Delete database row.
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
                )
                .eq(
                    "created_by",
                    state.user.id
                );


        if (error) {

            throw error;
        }


        /*
         * Remove cover if present.
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
                `Delete "${challenge.title}"? This may affect submissions associated with it.`
            );


        if (!confirmed) {
            return;
        }


        const originalHTML =
            button.innerHTML;


        try {

            button.disabled =
                true;


            button.innerHTML =
                `
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
                .from("challenge-covers")
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
            );


        let slug =
            baseSlug ||
            "challenge";


        /*
         * Try the base slug first.
         */

        const {
            data: existing
        } =
            await supabase
                .from("challenges")
                .select("id")
                .eq(
                    "slug",
                    slug
                )
                .maybeSingle();


        if (!existing) {

            return slug;
        }


        /*
         * Generate a suffix when the
         * slug already exists.
         */

        for (
            let i = 2;
            i <= 100;
            i++
        ) {

            const candidate =
                `${baseSlug}-${i}`;


            const {
                data
            } =
                await supabase
                    .from("challenges")
                    .select("id")
                    .eq(
                        "slug",
                        candidate
                    )
                    .maybeSingle();


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
       VALIDATION
       ===================================================== */

    function validateChallengeData({
        title,
        description,
        category,
        startsAt,
        endsAt,
        points
    }) {

        if (
            !String(title || "")
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
            !String(description || "")
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
            new Date(
                startsAt
            );


        const end =
            new Date(
                endsAt
            );


        if (
            Number.isNaN(
                start.getTime()
            ) ||
            Number.isNaN(
                end.getTime()
            )
        ) {

            throw new Error(
                "Please provide valid start and end dates."
            );
        }


        if (
            end.getTime() <=
            start.getTime()
        ) {

            throw new Error(
                "Challenge end time must be after the start time."
            );
        }


        const minimumDuration =
            60 * 60 * 1000;


        if (
            end.getTime() -
            start.getTime() <
            minimumDuration
        ) {

            throw new Error(
                "A challenge must run for at least 1 hour."
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
       FORM PREVIEW
       ===================================================== */

    function setupPreview() {

        const fields = [

            "#challengeTitle",

            "#challengeDescription",

            "#challengeCategory",

            "#challengeDifficulty",

            "#challengePoints",

            "#challengePrize"

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


        const previewTitle =
            $("#previewTitle");


        const previewCoverTitle =
            $("#previewCoverTitle");


        const previewDescription =
            $("#previewDescription");


        const previewCategory =
            $("#previewCategory");


        const previewDifficulty =
            $("#previewDifficulty");


        const previewPoints =
            $("#previewPoints");


        const previewPrize =
            $("#previewPrize");


        if (previewTitle) {

            previewTitle.textContent =
                title;
        }


        if (previewCoverTitle) {

            previewCoverTitle.textContent =
                title;
        }


        if (previewDescription) {

            previewDescription.textContent =
                description;
        }


        if (previewCategory) {

            previewCategory.textContent =
                formatCategory(
                    category
                );
        }


        if (previewDifficulty) {

            previewDifficulty.textContent =
                capitalize(
                    difficulty
                );
        }


        if (previewPoints) {

            previewPoints.textContent =
                `${formatNumber(points)} XP`;
        }


        if (previewPrize) {

            previewPrize.textContent =
                prize;
        }
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
                    /* Browser restriction is okay. */
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
       RESET COVER UI
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
                ) + "/"
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
            /* Ignore storage errors. */
        }
    }


    /* =====================================================
       STATUS
       ===================================================== */

    function calculateInitialStatus(
        startsAt,
        endsAt
    ) {

        const now =
            Date.now();


        const start =
            new Date(
                startsAt
            ).getTime();


        const end =
            new Date(
                endsAt
            ).getTime();


        if (
            now < start
        ) {

            return "upcoming";
        }


        if (
            now >= start &&
            now < end
        ) {

            return "active";
        }


        return "completed";
    }


    function calculateStatus(
        challenge
    ) {

        const now =
            Date.now();


        const start =
            new Date(
                challenge.starts_at
            ).getTime();


        const end =
            new Date(
                challenge.ends_at
            ).getTime();


        if (
            challenge.status ===
            "cancelled"
        ) {

            return "cancelled";
        }


        if (
            now < start
        ) {

            return "upcoming";
        }


        if (
            now >= start &&
            now < end
        ) {

            return (
                challenge.status ===
                "voting"
                    ? "voting"
                    : "active"
            );
        }


        return (
            challenge.status ===
            "voting"
                ? "voting"
                : "completed"
        );
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
       ADMIN ERROR
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
                max-width:min(
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


        toast.style.cssText = `
            display:flex;
            align-items:center;
            gap:10px;
            padding:13px 14px;
            border:1px solid ${
                type === "error"
                    ? "rgba(239,68,68,.25)"
                    : type === "success"
                        ? "rgba(34,197,94,.25)"
                        : "rgba(168,85,247,.25)"
            };
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
                    color:${
                        type === "error"
                            ? "#fca5a5"
                            : type === "success"
                                ? "#86efac"
                                : "#c4b5fd"
                    };
                "
            ></i>

            <span>
                ${escapeHTML(message)}
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
       NOTICE
       ===================================================== */

    function showAdminNotice(
        message,
        type = "info"
    ) {

        showAdminToast(
            message,
            type
        );
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
       INITIALIZE
       ===================================================== */

    async function init() {

        if (
            state.initialized
        ) {
            return;
        }


        /*
         * Only run on admin pages that contain
         * the challenge manager.
         */

        const isAdminChallengePage =
            !!$("#challengeForm");


        if (!isAdminChallengePage) {

            return;
        }


        state.initialized =
            true;


        /*
         * Verify administrator access BEFORE
         * loading challenge data or enabling
         * the form.
         */

        const allowed =
            await requireAdmin();


        if (!allowed) {

            return;
        }


        setupChallengeForm();

        setupPreview();

        setupCoverPreview();

        await loadChallenges();
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        state,

        init,

        requireAdmin,

        loadChallenges,

        createChallenge,

        deleteChallenge,

        uploadChallengeCover,

        getAdminProfile

    };

})();


/* =========================================================
   GLOBAL
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