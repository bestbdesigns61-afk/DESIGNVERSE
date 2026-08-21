/* =========================================================
   DESIGNVERSE — DASHBOARD CONTROLLER
   dashboard.js
   ========================================================= */

"use strict";


const DVDashboard = (() => {

    /* =====================================================
       STATE
       ===================================================== */

    const state = {
        user: null,
        profile: null,
        initialized: false
    };


    /* =====================================================
       HELPERS
       ===================================================== */

    const $ = (selector, parent = document) =>
        parent.querySelector(selector);


    const $$ = (selector, parent = document) =>
        [...parent.querySelectorAll(selector)];


    /* =====================================================
       GET SUPABASE
       ===================================================== */

    const getSupabase = () => {

        if (!window.supabaseClient) {

            console.error(
                "DESIGNVERSE: Supabase client not found."
            );

            return null;
        }

        return window.supabaseClient;
    };


    /* =====================================================
       GET CURRENT USER
       ===================================================== */

    const getCurrentUser = async () => {

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
                "Dashboard user error:",
                error
            );

            return null;
        }


        return data.user || null;
    };


    /* =====================================================
       GET USER PROFILE
       ===================================================== */

    const getProfile = async (userId) => {

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
                .eq("id", userId)
                .single();


        if (error) {

            console.error(
                "Dashboard profile error:",
                error
            );

            return null;
        }


        return data;
    };


    /* =====================================================
       UPDATE PROFILE ELEMENTS
       ===================================================== */

    const updateProfileUI = (
        profile
    ) => {

        if (!profile) {
            return;
        }


        /* ---------- Display Name ---------- */

        $$(
            '[data-profile="display-name"]'
        ).forEach(element => {

            element.textContent =
                profile.display_name ||
                "Designer";

        });


        /* ---------- Username ---------- */

        $$(
            '[data-profile="username"]'
        ).forEach(element => {

            element.textContent =
                profile.username
                    ? `@${profile.username}`
                    : "@designer";

        });


        /* ---------- Bio ---------- */

        $$(
            '[data-profile="bio"]'
        ).forEach(element => {

            element.textContent =
                profile.bio ||
                "Your creative story starts here.";

        });


        /* ---------- Avatar ---------- */

        $$(
            '[data-profile="avatar"]'
        ).forEach(element => {

            if (profile.avatar_url) {

                element.src =
                    profile.avatar_url;

                element.alt =
                    profile.display_name ||
                    "Designer";

            }

        });


        /* ---------- XP ---------- */

        $$(
            '[data-profile="points"]'
        ).forEach(element => {

            element.textContent =
                Number(
                    profile.total_points || 0
                ).toLocaleString();

        });


        /* ---------- Wins ---------- */

        $$(
            '[data-profile="wins"]'
        ).forEach(element => {

            element.textContent =
                Number(
                    profile.total_wins || 0
                ).toLocaleString();

        });


        /* ---------- Votes ---------- */

        $$(
            '[data-profile="votes"]'
        ).forEach(element => {

            element.textContent =
                Number(
                    profile.total_votes || 0
                ).toLocaleString();

        });


        /* ---------- Followers ---------- */

        $$(
            '[data-profile="followers"]'
        ).forEach(element => {

            element.textContent =
                Number(
                    profile.followers_count || 0
                ).toLocaleString();

        });


        /* ---------- Following ---------- */

        $$(
            '[data-profile="following"]'
        ).forEach(element => {

            element.textContent =
                Number(
                    profile.following_count || 0
                ).toLocaleString();

        });
    };


    /* =====================================================
       ADMIN PANEL SWITCH
       ===================================================== */

    const setupAdminSwitch = (
        profile
    ) => {

        const sidebar =
            $("#dashboardSidebar");


        if (!sidebar) {
            return;
        }


        /* Remove any old injected admin section */

        sidebar
            .querySelector(
                "[data-admin-section]"
            )
            ?.remove();


        /*
         * Only admins should see this.
         */

        if (
            profile?.role !==
            "admin"
        ) {

            return;
        }


        /* =================================================
           CREATE ADMIN SECTION
           ================================================= */

        const section =
            document.createElement(
                "div"
            );

        section.setAttribute(
            "data-admin-section",
            ""
        );


        section.innerHTML = `

            <div
                class="dashboard-sidebar-divider"
            ></div>

            <div
                class="dashboard-sidebar-title"
            >
                Administration
            </div>

            <nav
                class="dashboard-nav"
                aria-label="Administration"
            >

                <a
                    href="../admin/index.html"
                    class="admin-panel-link"
                >

                    <i
                        class="fa-solid fa-shield-halved"
                        aria-hidden="true"
                    ></i>

                    <span>
                        Admin Panel
                    </span>

                </a>

            </nav>

        `;


        sidebar.appendChild(
            section
        );


        /* =================================================
           ADD ADMIN BADGE TO PROFILE CHIP
           ================================================= */

        const profileChip =
            $(".dashboard-profile-chip");


        if (
            profileChip &&
            !profileChip.querySelector(
                "[data-admin-badge]"
            )
        ) {

            const badge =
                document.createElement(
                    "span"
                );

            badge.setAttribute(
                "data-admin-badge",
                ""
            );

            badge.innerHTML = `
                <i class="fa-solid fa-crown"></i>
                ADMIN
            `;


            badge.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 4px;
                margin-left: 5px;
                padding: 4px 7px;
                border: 1px solid rgba(251,191,36,0.22);
                border-radius: 999px;
                background: rgba(251,191,36,0.08);
                color: #fbbf24;
                font-size: 7px;
                font-weight: 800;
                letter-spacing: 0.08em;
            `;


            profileChip.appendChild(
                badge
            );
        }
    };


    /* =====================================================
       LOAD ADMIN BUTTON ONCE
       ===================================================== */

    const setupAdminQuickAccess = (
        profile
    ) => {

        /*
         * Only admins receive this.
         * We'll add it to the main content
         * without changing the existing HTML.
         */

        if (
            profile?.role !==
            "admin"
        ) {

            return;
        }


        const actions =
            $(".dashboard-top-actions");


        if (!actions) {
            return;
        }


        if (
            actions.querySelector(
                "[data-admin-dashboard-link]"
            )
        ) {

            return;
        }


        const link =
            document.createElement(
                "a"
            );


        link.href =
            "../admin/index.html";


        link.className =
            "btn btn-secondary btn-small";


        link.setAttribute(
            "data-admin-dashboard-link",
            ""
        );


        link.innerHTML = `
            <i
                class="fa-solid fa-shield-halved"
            ></i>
            Admin Panel
        `;


        actions.prepend(
            link
        );
    };


    /* =====================================================
       ADMIN PROFILE SECURITY CHECK
       ===================================================== */

    const isAdmin = () => {

        return (
            state.profile?.role ===
            "admin"
        );
    };


    /* =====================================================
       REFRESH DASHBOARD
       ===================================================== */

    const refresh = async () => {

        const user =
            await getCurrentUser();


        if (!user) {

            console.warn(
                "No authenticated user found."
            );

            return;
        }


        const profile =
            await getProfile(
                user.id
            );


        if (!profile) {

            console.warn(
                "No profile found for current user."
            );

            return;
        }


        state.user =
            user;

        state.profile =
            profile;


        /* Update all dashboard data */

        updateProfileUI(
            profile
        );


        /* Admin-only interface */

        setupAdminSwitch(
            profile
        );


        setupAdminQuickAccess(
            profile
        );


        /* Store useful global state */

        document.documentElement.dataset.userRole =
            profile.role || "designer";


        document.documentElement.dataset.userId =
            user.id;
    };


    /* =====================================================
       AUTH STATE LISTENER
       ===================================================== */

    const setupAuthListener = () => {

        const supabase =
            getSupabase();


        if (!supabase) {
            return;
        }


        supabase.auth.onAuthStateChange(
            async (
                event,
                session
            ) => {

                if (
                    event ===
                    "SIGNED_IN"
                ) {

                    if (session?.user) {

                        await refresh();
                    }
                }


                if (
                    event ===
                    "USER_UPDATED"
                ) {

                    await refresh();
                }


                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    state.user =
                        null;

                    state.profile =
                        null;

                    window.location.href =
                        "../auth/login.html";
                }
            }
        );
    };


    /* =====================================================
       WELCOME MESSAGE
       ===================================================== */

    const updateWelcomeMessage = (
        profile
    ) => {

        if (!profile) {
            return;
        }


        const heading =
            $(".dashboard-welcome h1");


        if (!heading) {
            return;
        }


        /*
         * The HTML already contains:
         *
         * Welcome back,
         * <span data-profile="display-name">
         * </span>
         * 👋
         *
         * So the profile updater handles the
         * actual name. We only ensure it isn't
         * blank.
         */

        const nameElement =
            heading.querySelector(
                '[data-profile="display-name"]'
            );


        if (
            nameElement &&
            !nameElement.textContent.trim()
        ) {

            nameElement.textContent =
                profile.display_name ||
                "Designer";
        }
    };


    /* =====================================================
       INITIALIZE
       ===================================================== */

    const init = async () => {

        if (
            state.initialized
        ) {

            return;
        }


        /*
         * Make sure we're on the
         * authenticated dashboard.
         */

        const user =
            await getCurrentUser();


        if (!user) {

            window.location.href =
                "../auth/login.html";

            return;
        }


        await refresh();


        updateWelcomeMessage(
            state.profile
        );


        setupAuthListener();


        state.initialized =
            true;


        console.log(
            "📊 DESIGNVERSE dashboard initialized."
        );


        if (
            state.profile?.role ===
            "admin"
        ) {

            console.log(
                "👑 Admin dashboard access enabled."
            );
        }
    };


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        init,

        refresh,

        getCurrentUser,

        isAdmin,

        getProfile: () =>
            state.profile,

        getUser: () =>
            state.user
    };

})();


/* =========================================================
   START DASHBOARD
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVDashboard.init();

    }
);


/* =========================================================
   GLOBAL ACCESS
   ========================================================= */

window.DVDashboard =
    DVDashboard;