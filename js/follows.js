/* =========================================================
   DESIGNVERSE — FOLLOW SYSTEM
   js/follows.js

   Handles:
   - Follow designer
   - Unfollow designer
   - Check follow state
   - Followers count
   - Following count
   - Follow button UI
   - Authentication checks
   - Duplicate-follow protection
   - Self-follow protection

   Database:
       follows

   Columns:
       id
       follower_id
       following_id
       created_at

   RLS:
       SELECT  -> public
       INSERT  -> authenticated own follower_id
       DELETE  -> authenticated own follower_id

   Counter trigger:
       follows_counter_trigger
   ========================================================= */

"use strict";


const DVFollows = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        user: null,

        targetProfile: null,

        isFollowing: false,

        loading: false,

        actionInProgress: false

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

            console.warn(
                "DESIGNVERSE follow auth lookup:",
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
       URL TARGET
       ===================================================== */

    function getTargetIdentifier() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return {

            id:
                params.get(
                    "id"
                ),

            username:
                params.get(
                    "username"
                )

        };
    }


    /* =====================================================
       LOAD TARGET PROFILE
       ===================================================== */

    async function loadTargetProfile() {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const identifier =
            getTargetIdentifier();


        /*
         * If profile.js has already loaded the
         * public profile, use it.
         */

        if (
            window.DVProfile?.state?.publicProfile
        ) {

            const cached =
                window.DVProfile.state.publicProfile;


            if (
                (
                    identifier.id &&
                    cached.id === identifier.id
                ) ||
                (
                    identifier.username &&
                    cached.username?.toLowerCase() ===
                    identifier.username.toLowerCase()
                )
            ) {

                state.targetProfile =
                    cached;


                return cached;
            }
        }


        let query =
            supabase
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar_url,
                    followers_count,
                    following_count
                `);


        if (
            identifier.id
        ) {

            query =
                query.eq(
                    "id",
                    identifier.id
                );

        } else if (
            identifier.username
        ) {

            query =
                query.eq(
                    "username",
                    identifier.username
                        .trim()
                        .toLowerCase()
                );

        } else {

            throw new Error(
                "No designer was specified."
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
                "Designer not found."
            );
        }


        state.targetProfile =
            data;


        return data;
    }


    /* =====================================================
       SELF FOLLOW CHECK
       ===================================================== */

    function isSelfFollow() {

        return Boolean(
            state.user &&
            state.targetProfile &&
            state.user.id ===
                state.targetProfile.id
        );
    }


    /* =====================================================
       CHECK FOLLOW STATUS
       ===================================================== */

    async function checkFollowStatus() {

        const supabase =
            getSupabase();


        const user =
            state.user ||
            await getCurrentUser();


        const target =
            state.targetProfile;


        /*
         * Visitors who aren't logged in simply
         * aren't following.
         */

        if (
            !supabase ||
            !user ||
            !target
        ) {

            state.isFollowing =
                false;

            return false;
        }


        /*
         * Never allow a user to follow themselves.
         */

        if (
            isSelfFollow()
        ) {

            state.isFollowing =
                false;

            return false;
        }


        const {
            data,
            error
        } =
            await supabase
                .from("follows")
                .select(
                    "id"
                )
                .eq(
                    "follower_id",
                    user.id
                )
                .eq(
                    "following_id",
                    target.id
                )
                .maybeSingle();


        if (error) {

            console.warn(
                "DESIGNVERSE follow status error:",
                error
            );

            state.isFollowing =
                false;

            return false;
        }


        state.isFollowing =
            Boolean(
                data
            );


        return state.isFollowing;
    }


    /* =====================================================
       FOLLOW
       ===================================================== */

    async function follow() {

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


        const target =
            state.targetProfile ||
            await loadTargetProfile();


        if (!user) {

            throw new Error(
                "Please sign in to follow designers."
            );
        }


        if (!target) {

            throw new Error(
                "Designer not found."
            );
        }


        if (
            user.id ===
            target.id
        ) {

            throw new Error(
                "You cannot follow yourself."
            );
        }


        /*
         * Check first to avoid unnecessary insert
         * requests.
         */

        const alreadyFollowing =
            await checkFollowStatus();


        if (
            alreadyFollowing
        ) {

            return true;
        }


        const {
            error
        } =
            await supabase
                .from("follows")
                .insert({

                    follower_id:
                        user.id,

                    following_id:
                        target.id

                });


        if (error) {

            console.error(
                "DESIGNVERSE follow error:",
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

                state.isFollowing =
                    true;

                return true;
            }


            if (
                message.includes(
                    "row-level security"
                )
            ) {

                throw new Error(
                    "You don't have permission to follow this designer."
                );
            }


            throw error;
        }


        state.isFollowing =
            true;


        /*
         * Optimistically update the local target
         * profile. The database trigger performs
         * the authoritative update.
         */

        if (
            state.targetProfile
        ) {

            state.targetProfile.followers_count =
                Math.max(
                    0,
                    Number(
                        state.targetProfile
                            .followers_count ||
                        0
                    ) + 1
                );
        }


        /*
         * Also update profile.js cached profile
         * when available.
         */

        syncProfileState();


        return true;
    }


    /* =====================================================
       UNFOLLOW
       ===================================================== */

    async function unfollow() {

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


        const target =
            state.targetProfile;


        if (!user) {

            throw new Error(
                "Please sign in."
            );
        }


        if (!target) {

            throw new Error(
                "Designer not found."
            );
        }


        if (
            user.id ===
            target.id
        ) {

            throw new Error(
                "You cannot unfollow yourself."
            );
        }


        if (
            !state.isFollowing
        ) {

            return false;
        }


        const {
            error
        } =
            await supabase
                .from("follows")
                .delete()
                .eq(
                    "follower_id",
                    user.id
                )
                .eq(
                    "following_id",
                    target.id
                );


        if (error) {

            console.error(
                "DESIGNVERSE unfollow error:",
                error
            );


            if (
                String(
                    error.message ||
                    ""
                )
                .toLowerCase()
                .includes(
                    "row-level security"
                )
            ) {

                throw new Error(
                    "You don't have permission to unfollow this designer."
                );
            }


            throw error;
        }


        state.isFollowing =
            false;


        /*
         * Trigger updates the actual counter.
         */

        if (
            state.targetProfile
        ) {

            state.targetProfile.followers_count =
                Math.max(
                    0,
                    Number(
                        state.targetProfile
                            .followers_count ||
                        0
                    ) - 1
                );
        }


        syncProfileState();


        return true;
    }


    /* =====================================================
       TOGGLE
       ===================================================== */

    async function toggleFollow() {

        if (
            state.actionInProgress
        ) {

            return;
        }


        const button =
            getFollowButton();


        try {

            state.actionInProgress =
                true;


            setButtonLoading(
                button,
                true
            );


            if (
                state.isFollowing
            ) {

                await unfollow();


            } else {

                await follow();

            }


            renderFollowButton();


            renderFollowerCount();


            showToast(
                state.isFollowing
                    ? `You're now following ${
                        state.targetProfile
                            ?.display_name ||
                        state.targetProfile
                            ?.username ||
                        "this designer"
                    }.`
                    : "You unfollowed this designer.",
                "success"
            );


        } catch (error) {

            console.error(
                "DESIGNVERSE follow toggle error:",
                error
            );


            showToast(
                getFollowErrorMessage(
                    error
                ),
                "error"
            );


            renderFollowButton();


        } finally {

            state.actionInProgress =
                false;
        }
    }


    /* =====================================================
       GET FOLLOW BUTTON
       ===================================================== */

    function getFollowButton() {

        return (
            $("#followDesignerButton") ||
            document.querySelector(
                "[data-follow-designer]"
            )
        );
    }


    /* =====================================================
       RENDER BUTTON
       ===================================================== */

    function renderFollowButton() {

        const button =
            getFollowButton();


        if (!button) {

            return;
        }


        /*
         * Own profile:
         * hide / disable follow.
         */

        if (
            isSelfFollow()
        ) {

            button.disabled =
                true;


            button.className =
                "btn btn-secondary btn-small";


            button.innerHTML = `

                <i
                    class="fa-solid fa-user"
                ></i>

                Your Profile

            `;


            button.setAttribute(
                "aria-label",
                "Your profile"
            );


            return;
        }


        /*
         * Visitor is logged out.
         *
         * We keep the button visible but clicking
         * sends them to login.
         */

        if (
            !state.user
        ) {

            button.disabled =
                false;


            button.className =
                "btn btn-primary btn-small";


            button.innerHTML = `

                <i
                    class="fa-solid fa-user-plus"
                ></i>

                Follow

            `;


            button.setAttribute(
                "aria-label",
                "Sign in to follow this designer"
            );


            return;
        }


        /*
         * Following.
         */

        if (
            state.isFollowing
        ) {

            button.disabled =
                false;


            button.className =
                "btn btn-secondary btn-small";


            button.innerHTML = `

                <i
                    class="fa-solid fa-user-check"
                ></i>

                Following

            `;


            button.setAttribute(
                "aria-pressed",
                "true"
            );


            return;
        }


        /*
         * Not following.
         */

        button.disabled =
            false;


        button.className =
            "btn btn-primary btn-small";


        button.innerHTML = `

            <i
                class="fa-solid fa-user-plus"
            ></i>

            Follow

        `;


        button.setAttribute(
            "aria-pressed",
            "false"
        );
    }


    /* =====================================================
       FOLLOWER COUNT
       ===================================================== */

    function renderFollowerCount() {

        const target =
            state.targetProfile;


        if (!target) {

            return;
        }


        const count =
            Number(
                target.followers_count ||
                0
            );


        /*
         * Main stats.
         */

        [
            "#designerFollowers",

            "[data-followers-count]"

        ]
        .forEach(
            selector => {

                document
                    .querySelectorAll(
                        selector
                    )
                    .forEach(
                        element => {

                            element.textContent =
                                formatNumber(
                                    count
                                );

                        }
                    );

            }
        );
    }


    /* =====================================================
       SYNC PROFILE STATE
       ===================================================== */

    function syncProfileState() {

        if (
            !window.DVProfile
        ) {

            return;
        }


        const profileState =
            window.DVProfile.state;


        if (
            profileState.publicProfile &&
            state.targetProfile &&
            profileState.publicProfile.id ===
                state.targetProfile.id
        ) {

            profileState.publicProfile
                .followers_count =
                    state.targetProfile
                        .followers_count;
        }


        if (
            profileState.profile &&
            state.targetProfile &&
            profileState.profile.id ===
                state.targetProfile.id
        ) {

            profileState.profile
                .followers_count =
                    state.targetProfile
                        .followers_count;
        }
    }


    /* =====================================================
       LOGIN REDIRECT
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
       ERROR MESSAGE
       ===================================================== */

    function getFollowErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to update your follow status."
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
                "Supabase blocked this follow action because of your permissions."
            );
        }


        if (
            lower.includes(
                "duplicate"
            ) ||
            lower.includes(
                "unique"
            )
        ) {

            return (
                "You already follow this designer."
            );
        }


        if (
            lower.includes(
                "foreign key"
            )
        ) {

            return (
                "The designer account could not be found."
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
       BUTTON LOADING
       ===================================================== */

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

                Working...

            `;

        } else {

            button.disabled =
                false;
        }
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
                ".follow-toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "follow-toast-container";


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
       FORMAT
       ===================================================== */

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


    /* =====================================================
       SETUP BUTTON
       ===================================================== */

    function setupFollowButton() {

        const button =
            getFollowButton();


        if (!button) {

            return;
        }


        /*
         * Remove any old click listeners by replacing
         * the element with a clone.
         *
         * This is useful because the previous
         * designer.html had a placeholder listener.
         */

        const freshButton =
            button.cloneNode(
                true
            );


        button.replaceWith(
            freshButton
        );


        freshButton.addEventListener(
            "click",
            async () => {

                /*
                 * Not signed in → login.
                 */

                if (
                    !state.user
                ) {

                    redirectToLogin();

                    return;
                }


                await toggleFollow();

            }
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
         * Only initialize on a designer profile.
         */

        const button =
            getFollowButton();


        const isProfilePage =
            Boolean(
                document.body.dataset.profilePage
            ) ||
            Boolean(
                button
            );


        if (
            !isProfilePage
        ) {

            return;
        }


        state.initialized =
            true;


        state.loading =
            true;


        try {

            await getCurrentUser();


            await loadTargetProfile();


            /*
             * Determine whether the current user
             * already follows the target.
             */

            if (
                state.user &&
                !isSelfFollow()
            ) {

                await checkFollowStatus();
            }


            setupFollowButton();

            renderFollowButton();

            renderFollowerCount();


        } catch (error) {

            console.error(
                "DESIGNVERSE follows initialization error:",
                error
            );


            /*
             * Don't break the whole designer page
             * if following fails to initialize.
             */

            renderFollowButton();

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

        loadTargetProfile,

        checkFollowStatus,

        follow,

        unfollow,

        toggleFollow,

        renderFollowButton,

        renderFollowerCount

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVFollows =
    DVFollows;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVFollows.init();

    }
);


/* =========================================================
   DESIGNVERSE FOLLOW SYSTEM COMPLETE
   ========================================================= */