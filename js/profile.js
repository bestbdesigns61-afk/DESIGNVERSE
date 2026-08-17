/* =========================================================
   DESIGNVERSE — PROFILE SYSTEM
   js/profile.js

   Uses the ACTUAL profiles schema:

   id
   username
   display_name
   bio
   avatar_url
   website_url
   location
   role
   total_points
   total_votes
   total_wins
   followers_count
   following_count
   created_at
   updated_at
   ========================================================= */

"use strict";


const DVProfile = (() => {

    const state = {

        initialized: false,

        user: null,

        profile: null,

        publicProfile: null,

        designs: [],

        submissions: [],

        statistics: {

            designs: 0,

            challenges: 0,

            wins: 0,

            votes: 0,

            views: 0,

            points: 0,

            followers: 0,

            following: 0

        },

        loading: false,

        avatarObjectUrl: null

    };


    /* =====================================================
       DOM
       ===================================================== */

    function $(selector) {

        return document.querySelector(selector);
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

        const supabase = getSupabase();

        if (!supabase) {
            return null;
        }

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {

            console.warn(
                "DESIGNVERSE profile auth lookup:",
                error
            );

            return null;
        }

        state.user =
            data?.user || null;

        return state.user;
    }


    /* =====================================================
       LOAD PROFILE BY ID
       ===================================================== */

    async function getProfile(
        userId = null
    ) {

        const supabase = getSupabase();

        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const currentUser =
            state.user ||
            await getCurrentUser();


        const id =
            userId ||
            currentUser?.id;


        if (!id) {

            throw new Error(
                "No user was specified."
            );
        }


        const {
            data,
            error
        } = await supabase
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
                created_at,
                updated_at
            `)
            .eq(
                "id",
                id
            )
            .single();


        if (error) {

            throw error;
        }


        if (
            state.user?.id === id
        ) {

            state.profile =
                data;
        }


        state.publicProfile =
            data;


        return data;
    }


    /* =====================================================
       LOAD PROFILE BY USERNAME
       ===================================================== */

    async function getProfileByUsername(
        username
    ) {

        const supabase = getSupabase();

        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const cleanUsername =
            String(
                username || ""
            )
            .trim()
            .toLowerCase()
            .replace(
                /^@/,
                ""
            );


        if (!cleanUsername) {

            throw new Error(
                "A username is required."
            );
        }


        const {
            data,
            error
        } = await supabase
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
                created_at,
                updated_at
            `)
            .eq(
                "username",
                cleanUsername
            )
            .single();


        if (error) {

            throw error;
        }


        state.publicProfile =
            data;


        return data;
    }


    /* =====================================================
       UPDATE PROFILE
       ===================================================== */

    async function updateProfile({

        username,

        displayName,

        bio,

        websiteUrl,

        location

    }) {

        const supabase = getSupabase();

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
                "Please sign in to edit your profile."
            );
        }


        const validated =
            validateProfileData({

                username,

                displayName,

                bio,

                websiteUrl,

                location

            });


        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .update({

                username:
                    validated.username,

                display_name:
                    validated.displayName,

                bio:
                    validated.bio || null,

                website_url:
                    validated.websiteUrl || null,

                location:
                    validated.location || null,

                updated_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                user.id
            )
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
                created_at,
                updated_at
            `)
            .single();


        if (error) {

            const message =
                String(
                    error.message || ""
                ).toLowerCase();


            if (
                message.includes("duplicate") &&
                message.includes("username")
            ) {

                throw new Error(
                    "That username is already taken."
                );
            }


            if (
                message.includes(
                    "row-level security"
                )
            ) {

                throw new Error(
                    "You don't have permission to update this profile."
                );
            }


            throw error;
        }


        state.profile =
            data;

        state.publicProfile =
            data;


        return data;
    }


    /* =====================================================
       VALIDATION
       ===================================================== */

    function validateProfileData({

        username,

        displayName,

        bio,

        websiteUrl,

        location

    }) {

        let cleanUsername =
            String(
                username || ""
            )
            .trim()
            .toLowerCase()
            .replace(
                /^@/,
                ""
            );


        const cleanDisplayName =
            String(
                displayName || ""
            ).trim();


        const cleanBio =
            String(
                bio || ""
            ).trim();


        const cleanWebsiteUrl =
            String(
                websiteUrl || ""
            ).trim();


        const cleanLocation =
            String(
                location || ""
            ).trim();


        if (!cleanUsername) {

            throw new Error(
                "Please enter a username."
            );
        }


        if (
            !/^[a-z0-9_]{3,30}$/.test(
                cleanUsername
            )
        ) {

            throw new Error(
                "Username must be 3–30 characters and use only letters, numbers and underscores."
            );
        }


        if (
            cleanDisplayName.length >
            80
        ) {

            throw new Error(
                "Display name must be 80 characters or fewer."
            );
        }


        if (
            cleanBio.length >
            500
        ) {

            throw new Error(
                "Bio must be 500 characters or fewer."
            );
        }


        if (
            cleanLocation.length >
            80
        ) {

            throw new Error(
                "Location must be 80 characters or fewer."
            );
        }


        let normalizedWebsite =
            cleanWebsiteUrl;


        if (
            normalizedWebsite &&
            !/^https?:\/\//i.test(
                normalizedWebsite
            )
        ) {

            normalizedWebsite =
                `https://${normalizedWebsite}`;
        }


        if (
            normalizedWebsite
        ) {

            try {

                new URL(
                    normalizedWebsite
                );

            } catch {

                throw new Error(
                    "Please enter a valid website URL."
                );
            }
        }


        return {

            username:
                cleanUsername,

            displayName:
                cleanDisplayName,

            bio:
                cleanBio,

            websiteUrl:
                normalizedWebsite,

            location:
                cleanLocation

        };
    }


    /* =====================================================
       AVATAR
       ===================================================== */

    function validateAvatarFile(
        file
    ) {

        if (!file) {

            throw new Error(
                "Please select an avatar image."
            );
        }


        const allowedTypes = [

            "image/jpeg",

            "image/png",

            "image/webp"

        ];


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            throw new Error(
                "Avatar must be JPG, PNG or WEBP."
            );
        }


        if (
            file.size >
            5 * 1024 * 1024
        ) {

            throw new Error(
                "Avatar must be 5 MB or smaller."
            );
        }
    }


    async function uploadAvatar(
        file
    ) {

        const supabase =
            getSupabase();


        const user =
            state.user ||
            await getCurrentUser();


        if (!supabase || !user) {

            throw new Error(
                "Please sign in before uploading an avatar."
            );
        }


        validateAvatarFile(
            file
        );


        const extension =
            getFileExtension(
                file
            );


        const filePath =
            `${user.id}/avatar.${extension}`;


        const {
            error: uploadError
        } = await supabase
            .storage
            .from("avatars")
            .upload(
                filePath,
                file,
                {

                    cacheControl:
                        "3600",

                    upsert:
                        true,

                    contentType:
                        file.type

                }
            );


        if (uploadError) {

            throw uploadError;
        }


        const {
            data
        } =
            supabase
                .storage
                .from("avatars")
                .getPublicUrl(
                    filePath
                );


        if (
            !data?.publicUrl
        ) {

            throw new Error(
                "Unable to generate the avatar URL."
            );
        }


        const avatarUrl =
            `${data.publicUrl}?v=${Date.now()}`;


        const {
            data:
                updatedProfile,
            error
        } =
            await supabase
                .from("profiles")
                .update({

                    avatar_url:
                        avatarUrl,

                    updated_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    user.id
                )
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
                    created_at,
                    updated_at
                `)
                .single();


        if (error) {

            throw error;
        }


        state.profile =
            updatedProfile;

        state.publicProfile =
            updatedProfile;


        return updatedProfile;
    }


    async function removeAvatar() {

        const supabase =
            getSupabase();


        const user =
            state.user ||
            await getCurrentUser();


        if (!supabase || !user) {

            throw new Error(
                "Please sign in."
            );
        }


        /*
         * Remove the common avatar formats.
         */

        await supabase
            .storage
            .from("avatars")
            .remove([
                `${user.id}/avatar.jpg`,
                `${user.id}/avatar.png`,
                `${user.id}/avatar.webp`
            ]);


        const {
            data,
            error
        } =
            await supabase
                .from("profiles")
                .update({

                    avatar_url:
                        null,

                    updated_at:
                        new Date()
                            .toISOString()

                })
                .eq(
                    "id",
                    user.id
                )
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
                    created_at,
                    updated_at
                `)
                .single();


        if (error) {

            throw error;
        }


        state.profile =
            data;

        state.publicProfile =
            data;


        return data;
    }


    /* =====================================================
       DESIGNS
       ===================================================== */

    async function loadUserDesigns(
        userId
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const id =
            userId ||
            state.publicProfile?.id ||
            state.profile?.id ||
            state.user?.id;


        if (!id) {

            throw new Error(
                "No designer was specified."
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
                    id
                )
                .eq(
                    "is_public",
                    true
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                );


        if (error) {

            throw error;
        }


        state.designs =
            data || [];


        return state.designs;
    }


    /* =====================================================
       SUBMISSIONS
       ===================================================== */

    async function loadUserSubmissions(
        userId
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const id =
            userId ||
            state.publicProfile?.id ||
            state.profile?.id ||
            state.user?.id;


        if (!id) {

            throw new Error(
                "No designer was specified."
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
                        image_url,
                        thumbnail_url,
                        category
                    ),
                    challenge:challenges (
                        id,
                        title,
                        slug,
                        prize,
                        points,
                        ends_at,
                        voting_ends_at,
                        status
                    )
                `)
                .eq(
                    "designer_id",
                    id
                )
                .order(
                    "submitted_at",
                    {
                        ascending:
                            false
                    }
                );


        if (error) {

            throw error;
        }


        state.submissions =
            data || [];


        return state.submissions;
    }


    /* =====================================================
       STATISTICS
       ===================================================== */

    async function loadStatistics(
        userId
    ) {

        const id =
            userId ||
            state.publicProfile?.id ||
            state.profile?.id ||
            state.user?.id;


        if (!id) {

            throw new Error(
                "No designer was specified."
            );
        }


        /*
         * We deliberately use the counters in
         * profiles as the primary source.
         */

        const profile =
            state.publicProfile ||
            state.profile ||
            await getProfile(
                id
            );


        /*
         * Design count.
         */

        const supabase =
            getSupabase();


        let designCount =
            0;


        let views =
            0;


        if (supabase) {

            const {
                count
            } =
                await supabase
                    .from("designs")
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
                        "designer_id",
                        id
                    )
                    .eq(
                        "is_public",
                        true
                    );


            designCount =
                count || 0;


            const {
                data:
                    viewRows
            } =
                await supabase
                    .from("designs")
                    .select(
                        "views"
                    )
                    .eq(
                        "designer_id",
                        id
                    )
                    .eq(
                        "is_public",
                        true
                    );


            views =
                (
                    viewRows || []
                )
                .reduce(
                    (
                        total,
                        row
                    ) =>
                        total +
                        Number(
                            row.views || 0
                        ),
                    0
                );
        }


        state.statistics = {

            designs:
                designCount,

            challenges:
                state.submissions.length,

            wins:
                Number(
                    profile.total_wins ||
                    0
                ),

            votes:
                Number(
                    profile.total_votes ||
                    0
                ),

            views,

            points:
                Number(
                    profile.total_points ||
                    0
                ),

            followers:
                Number(
                    profile.followers_count ||
                    0
                ),

            following:
                Number(
                    profile.following_count ||
                    0
                )

        };


        return state.statistics;
    }


    /* =====================================================
       COMPLETE PROFILE
       ===================================================== */

    async function loadCompleteProfile(
        userId
    ) {

        state.loading =
            true;


        try {

            const profile =
                await getProfile(
                    userId
                );


            await loadUserDesigns(
                profile.id
            );


            await loadUserSubmissions(
                profile.id
            );


            await loadStatistics(
                profile.id
            );


            return {

                profile,

                designs:
                    state.designs,

                submissions:
                    state.submissions,

                statistics:
                    state.statistics

            };

        } finally {

            state.loading =
                false;
        }
    }


    /* =====================================================
       PUBLIC PROFILE RENDER
       ===================================================== */

    function renderPublicProfile() {

        const profile =
            state.publicProfile;


        if (!profile) {

            return;
        }


        const stats =
            state.statistics;


        setText(
            "#designerName",
            profile.display_name ||
            profile.username ||
            "Designer"
        );


        setText(
            "#designerUsername",
            profile.username
                ? `@${profile.username}`
                : ""
        );


        setText(
            "#designerBio",
            profile.bio ||
            "Designer on DESIGNVERSE."
        );


        setText(
            "#designerLocation",
            profile.location ||
            ""
        );


        setText(
            "#designerDesignCount",
            formatNumber(
                stats.designs
            )
        );


        setText(
            "#designerChallengeCount",
            formatNumber(
                stats.challenges
            )
        );


        setText(
            "#designerWins",
            formatNumber(
                stats.wins
            )
        );


        setText(
            "#designerVotes",
            formatNumber(
                stats.votes
            )
        );


        setText(
            "#designerXP",
            formatNumber(
                stats.points
            )
        );


        setText(
            "#designerFollowers",
            formatNumber(
                stats.followers
            )
        );


        setText(
            "#designerFollowing",
            formatNumber(
                stats.following
            )
        );


        setProfileAvatar(
            profile.avatar_url
        );


        const website =
            $("#designerWebsite");


        if (website) {

            if (
                profile.website_url
            ) {

                website.href =
                    profile.website_url;

                website.textContent =
                    cleanWebsiteDisplay(
                        profile.website_url
                    );

                website.hidden =
                    false;

            } else {

                website.hidden =
                    true;
            }
        }


        renderDesignerDesigns();
    }


    /* =====================================================
       DESIGN GRID
       ===================================================== */

    function renderDesignerDesigns() {

        const container =
            $("#designerDesignsGrid");


        if (!container) {

            return;
        }


        container.innerHTML =
            "";


        if (
            !state.designs.length
        ) {

            container.innerHTML = `

                <div
                    style="
                        grid-column:1/-1;
                        padding:45px 20px;
                        text-align:center;
                    "
                >

                    <i
                        class="fa-solid fa-palette"
                        style="
                            display:block;
                            margin-bottom:12px;
                            color:#c4b5fd;
                            font-size:26px;
                        "
                    ></i>


                    <h3
                        style="
                            margin:0 0 6px;
                            color:white;
                        "
                    >
                        No public designs yet
                    </h3>


                    <p
                        style="
                            margin:0;
                            color:#71717a;
                            font-size:9px;
                        "
                    >
                        This designer hasn't published
                        any public designs yet.
                    </p>

                </div>

            `;


            return;
        }


        state.designs.forEach(
            design => {

                const article =
                    document.createElement(
                        "article"
                    );


                article.innerHTML = `

                    <a
                        href="design.html?id=${encodeURIComponent(
                            design.id
                        )}"
                    >

                        ${
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
                                        style="
                                            aspect-ratio:1;
                                            display:grid;
                                            place-items:center;
                                            background:linear-gradient(
                                                135deg,
                                                #120825,
                                                #153b75
                                            );
                                            color:#c4b5fd;
                                        "
                                    >
                                        <i
                                            class="fa-solid fa-palette"
                                        ></i>
                                    </div>
                                  `
                        }

                    </a>


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

                `;


                container.appendChild(
                    article
                );

            }
        );
    }


    /* =====================================================
       AVATAR FORM
       ===================================================== */

    function setupAvatarForm() {

        const input =
            $("#avatarInput");


        if (!input) {

            return;
        }


        input.addEventListener(
            "change",
            async () => {

                const file =
                    input.files?.[0];


                if (!file) {

                    return;
                }


                try {

                    validateAvatarFile(
                        file
                    );


                    await uploadAvatar(
                        file
                    );


                    setProfileAvatar(
                        state.profile?.avatar_url
                    );


                    showToast(
                        "Avatar updated successfully.",
                        "success"
                    );

                } catch (error) {

                    showToast(
                        getProfileErrorMessage(
                            error
                        ),
                        "error"
                    );
                }

            }
        );


        $("#removeAvatarButton")
            ?.addEventListener(
                "click",
                async () => {

                    try {

                        await removeAvatar();


                        setProfileAvatar(
                            null
                        );


                        showToast(
                            "Avatar removed.",
                            "success"
                        );

                    } catch (error) {

                        showToast(
                            getProfileErrorMessage(
                                error
                            ),
                            "error"
                        );
                    }
                }
            );
    }


    /* =====================================================
       PROFILE FORM
       ===================================================== */

    function setupProfileForm() {

        const form =
            $("#profileForm");


        if (!form) {

            return;
        }


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const button =
                    form.querySelector(
                        '[type="submit"]'
                    );


                try {

                    setButtonLoading(
                        button,
                        true
                    );


                    const profile =
                        await updateProfile({

                            username:
                                $("#username")
                                    ?.value,

                            displayName:
                                $("#displayName")
                                    ?.value,

                            bio:
                                $("#bio")
                                    ?.value,

                            websiteUrl:
                                $("#websiteUrl")
                                    ?.value,

                            location:
                                $("#location")
                                    ?.value

                        });


                    fillProfileForm(
                        profile
                    );


                    showToast(
                        "Profile updated successfully.",
                        "success"
                    );


                } catch (error) {

                    showToast(
                        getProfileErrorMessage(
                            error
                        ),
                        "error"
                    );

                } finally {

                    setButtonLoading(
                        button,
                        false
                    );
                }

            }
        );
    }


    function fillProfileForm(
        profile
    ) {

        if (!profile) {

            return;
        }


        setValue(
            "#username",
            profile.username
        );


        setValue(
            "#displayName",
            profile.display_name
        );


        setValue(
            "#bio",
            profile.bio
        );


        setValue(
            "#websiteUrl",
            profile.website_url
        );


        setValue(
            "#location",
            profile.location
        );


        setProfileAvatar(
            profile.avatar_url
        );
    }


    /* =====================================================
       AVATAR UI
       ===================================================== */

    function setProfileAvatar(
        avatarUrl
    ) {

        document
            .querySelectorAll(
                "#profileAvatar, #avatarPreview, #designerAvatar, [data-profile-avatar]"
            )
            .forEach(
                element => {

                    if (
                        element.tagName ===
                        "IMG"
                    ) {

                        if (
                            avatarUrl
                        ) {

                            element.src =
                                avatarUrl;

                            element.hidden =
                                false;

                        } else {

                            element.removeAttribute(
                                "src"
                            );
                        }
                    }
                }
            );
    }


    /* =====================================================
       HELPERS
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


    function setValue(
        selector,
        value
    ) {

        const element =
            $(selector);


        if (
            element &&
            "value" in element
        ) {

            element.value =
                value || "";
        }
    }


    function setButtonLoading(
        button,
        loading
    ) {

        if (!button) {

            return;
        }


        if (loading) {

            if (
                !button.dataset.originalHtml
            ) {

                button.dataset.originalHtml =
                    button.innerHTML;
            }


            button.disabled =
                true;


            button.innerHTML = `

                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

                Saving...

            `;

        } else {

            button.disabled =
                false;


            button.innerHTML =
                button.dataset.originalHtml ||
                "Save";
        }
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


    function cleanWebsiteDisplay(
        url
    ) {

        try {

            return new URL(
                url
            )
            .hostname
            .replace(
                /^www\./,
                ""
            );

        } catch {

            return String(
                url || ""
            )
            .replace(
                /^https?:\/\//,
                ""
            )
            .replace(
                /^www\./,
                ""
            )
            .replace(
                /\/$/,
                ""
            );
        }
    }


    function getFileExtension(
        file
    ) {

        const extension =
            file.name
                .split(".")
                .pop()
                .toLowerCase();


        const map = {

            jpg:
                "jpg",

            jpeg:
                "jpg",

            png:
                "png",

            webp:
                "webp"

        };


        return (
            map[extension] ||
            "jpg"
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


    function getProfileErrorMessage(
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
                "duplicate"
            ) &&
            lower.includes(
                "username"
            )
        ) {

            return (
                "That username is already taken."
            );
        }


        if (
            lower.includes(
                "row-level security"
            )
        ) {

            return (
                "Supabase blocked this profile action because of your permissions."
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
                "The avatars Storage bucket could not be found."
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
                ".profile-toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "profile-toast-container";


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
       INITIALIZE
       ===================================================== */

    async function init() {

        if (
            state.initialized
        ) {

            return;
        }


        const hasProfileForm =
            Boolean(
                $("#profileForm")
            );


        const hasAvatarInput =
            Boolean(
                $("#avatarInput")
            );


        const isPublicProfile =
            Boolean(
                document.body.dataset.profilePage ||
                $("#designerDesignsGrid") ||
                $("#designerName")
            );


        if (
            !hasProfileForm &&
            !hasAvatarInput &&
            !isPublicProfile
        ) {

            return;
        }


        state.initialized =
            true;


        try {

            await getCurrentUser();


            /*
             * Public designer profile.
             */

            if (
                isPublicProfile
            ) {

                const params =
                    new URLSearchParams(
                        window.location.search
                    );


                const profileId =
                    params.get(
                        "id"
                    );


                const username =
                    params.get(
                        "username"
                    );


                if (
                    profileId
                ) {

                    await loadCompleteProfile(
                        profileId
                    );

                } else if (
                    username
                ) {

                    const profile =
                        await getProfileByUsername(
                            username
                        );


                    await loadUserDesigns(
                        profile.id
                    );


                    await loadUserSubmissions(
                        profile.id
                    );


                    await loadStatistics(
                        profile.id
                    );

                } else if (
                    state.user
                ) {

                    await loadCompleteProfile(
                        state.user.id
                    );
                }


                renderPublicProfile();
            }


            /*
             * Settings/profile editing.
             */

            if (
                hasProfileForm ||
                hasAvatarInput
            ) {

                if (
                    !state.user
                ) {

                    throw new Error(
                        "Please sign in to manage your profile."
                    );
                }


                state.profile =
                    await getProfile(
                        state.user.id
                    );


                fillProfileForm(
                    state.profile
                );


                setupProfileForm();

                setupAvatarForm();
            }


        } catch (error) {

            console.error(
                "DESIGNVERSE profile initialization error:",
                error
            );


            showToast(
                getProfileErrorMessage(
                    error
                ),
                "error"
            );
        }
    }


    /* =====================================================
       CLEANUP
       ===================================================== */

    window.addEventListener(
        "pagehide",
        () => {

            if (
                state.avatarObjectUrl
            ) {

                URL.revokeObjectURL(
                    state.avatarObjectUrl
                );

                state.avatarObjectUrl =
                    null;
            }
        }
    );


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        state,

        init,

        getCurrentUser,

        getProfile,

        getProfileByUsername,

        updateProfile,

        uploadAvatar,

        removeAvatar,

        loadUserDesigns,

        loadUserSubmissions,

        loadStatistics,

        loadCompleteProfile,

        renderPublicProfile,

        validateProfileData,

        validateAvatarFile

    };

})();


/* =========================================================
   GLOBAL
   ========================================================= */

window.DVProfile =
    DVProfile;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVProfile.init();

    }
);