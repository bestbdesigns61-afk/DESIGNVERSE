/* =========================================================
   DESIGNVERSE — NOTIFICATIONS SYSTEM
   js/notifications.js

   ACTUAL DATABASE SCHEMA:

   notifications
   ├── id
   ├── user_id
   ├── type
   ├── title
   ├── message
   ├── link
   ├── is_read
   └── created_at

   Current notification sources:
   ✅ Follow notifications

   Upcoming:
   ⏳ Vote notifications
   ⏳ Challenge result notifications

   RLS:
   ✅ Users can SELECT their own notifications
   ✅ Users can UPDATE their own notifications

   There is currently NO DELETE policy.
   Therefore this file does not attempt deletion.
   ========================================================= */

"use strict";


const DVNotifications = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        user: null,

        notifications: [],

        unreadCount: 0,

        loading: false,

        pageSize: 50

    };


    /* =====================================================
       DOM HELPER
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
                "DESIGNVERSE notification auth error:",
                error
            );

            state.user =
                null;

            return null;
        }


        state.user =
            data?.user ||
            null;


        return state.user;
    }


    /* =====================================================
       LOAD NOTIFICATIONS
       ===================================================== */

    async function loadNotifications(
        options = {}
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            return [];
        }


        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            state.notifications =
                [];

            state.unreadCount =
                0;

            updateNotificationBadges();

            renderNotifications();


            return [];
        }


        state.loading =
            true;


        try {

            const limit =
                Math.min(
                    100,
                    Math.max(
                        1,
                        Number(
                            options.limit ||
                            state.pageSize
                        )
                    )
                );


            const {
                data,
                error
            } =
                await supabase
                    .from("notifications")
                    .select(`
                        id,
                        user_id,
                        type,
                        title,
                        message,
                        link,
                        is_read,
                        created_at
                    `)
                    .eq(
                        "user_id",
                        user.id
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                false
                        }
                    )
                    .limit(
                        limit
                    );


            if (error) {

                console.error(
                    "DESIGNVERSE notification load error:",
                    error
                );

                throw error;
            }


            state.notifications =
                data || [];


            /*
             * The loaded notification set may be limited,
             * so also calculate the actual unread count
             * separately.
             */

            await getUnreadCount();


            updateNotificationBadges();


            renderNotifications();


            return state.notifications;


        } finally {

            state.loading =
                false;
        }
    }


    /* =====================================================
       UNREAD COUNT
       ===================================================== */

    async function getUnreadCount() {

        const supabase =
            getSupabase();


        const user =
            state.user ||
            await getCurrentUser();


        if (
            !supabase ||
            !user
        ) {

            state.unreadCount =
                0;

            updateNotificationBadges();

            return 0;
        }


        const {
            count,
            error
        } =
            await supabase
                .from("notifications")
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
                    "user_id",
                    user.id
                )
                .eq(
                    "is_read",
                    false
                );


        if (error) {

            console.warn(
                "DESIGNVERSE unread notification count error:",
                error
            );

            return state.unreadCount;
        }


        state.unreadCount =
            count || 0;


        updateNotificationBadges();


        return state.unreadCount;
    }


    /* =====================================================
       MARK ONE READ
       ===================================================== */

    async function markAsRead(
        notificationId
    ) {

        const supabase =
            getSupabase();


        const user =
            state.user ||
            await getCurrentUser();


        if (
            !supabase ||
            !user
        ) {

            throw new Error(
                "Please sign in to manage notifications."
            );
        }


        if (!notificationId) {

            throw new Error(
                "Notification ID is required."
            );
        }


        const notification =
            state.notifications.find(
                item =>
                    item.id ===
                    notificationId
            );


        /*
         * Don't make a database request if the
         * notification is already read.
         */

        if (
            notification?.is_read
        ) {

            return true;
        }


        const {
            error
        } =
            await supabase
                .from("notifications")
                .update({

                    is_read:
                        true

                })
                .eq(
                    "id",
                    notificationId
                )
                .eq(
                    "user_id",
                    user.id
                );


        if (error) {

            console.error(
                "DESIGNVERSE mark notification read error:",
                error
            );

            throw error;
        }


        if (
            notification
        ) {

            notification.is_read =
                true;
        }


        state.unreadCount =
            Math.max(
                0,
                state.unreadCount - 1
            );


        updateNotificationBadges();


        return true;
    }


    /* =====================================================
       MARK ALL READ
       ===================================================== */

    async function markAllAsRead() {

        const supabase =
            getSupabase();


        const user =
            state.user ||
            await getCurrentUser();


        if (
            !supabase ||
            !user
        ) {

            throw new Error(
                "Please sign in to manage notifications."
            );
        }


        if (
            state.unreadCount ===
            0
        ) {

            return true;
        }


        const {
            error
        } =
            await supabase
                .from("notifications")
                .update({

                    is_read:
                        true

                })
                .eq(
                    "user_id",
                    user.id
                )
                .eq(
                    "is_read",
                    false
                );


        if (error) {

            console.error(
                "DESIGNVERSE mark all notifications read error:",
                error
            );

            throw error;
        }


        state.notifications =
            state.notifications.map(
                notification => ({

                    ...notification,

                    is_read:
                        true

                })
            );


        state.unreadCount =
            0;


        updateNotificationBadges();


        renderNotifications();


        return true;
    }


    /* =====================================================
       NOTIFICATION ICON
       ===================================================== */

    function getNotificationIcon(
        type
    ) {

        const normalized =
            String(
                type || ""
            )
            .trim()
            .toLowerCase();


        if (
            normalized ===
            "follow" ||
            normalized.includes(
                "follow"
            )
        ) {

            return {

                icon:
                    "fa-user-plus",

                className:
                    "follow"

            };
        }


        if (
            normalized ===
            "vote" ||
            normalized.includes(
                "vote"
            )
        ) {

            return {

                icon:
                    "fa-heart",

                className:
                    "vote"

            };
        }


        if (
            normalized ===
            "win" ||
            normalized ===
            "winner" ||
            normalized.includes(
                "win"
            )
        ) {

            return {

                icon:
                    "fa-trophy",

                className:
                    "win"

            };
        }


        if (
            normalized.includes(
                "challenge"
            )
        ) {

            return {

                icon:
                    "fa-trophy",

                className:
                    "challenge"

            };
        }


        if (
            normalized.includes(
                "submission"
            )
        ) {

            return {

                icon:
                    "fa-upload",

                className:
                    "submission"

            };
        }


        return {

            icon:
                "fa-bell",

            className:
                "default"

        };
    }


    /* =====================================================
       TIME FORMAT
       ===================================================== */

    function formatNotificationTime(
        value
    ) {

        if (!value) {

            return "";
        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "";
        }


        const now =
            Date.now();


        const difference =
            Math.max(
                0,
                now -
                date.getTime()
            );


        const minute =
            60 * 1000;


        const hour =
            60 * minute;


        const day =
            24 * hour;


        const week =
            7 * day;


        if (
            difference <
            minute
        ) {

            return "Just now";
        }


        if (
            difference <
            hour
        ) {

            return `${Math.floor(
                difference / minute
            )}m ago`;
        }


        if (
            difference <
            day
        ) {

            return `${Math.floor(
                difference / hour
            )}h ago`;
        }


        if (
            difference <
            week
        ) {

            return `${Math.floor(
                difference / day
            )}d ago`;
        }


        return date.toLocaleDateString(
            undefined,
            {
                month:
                    "short",

                day:
                    "numeric",

                year:
                    date.getFullYear() !==
                    new Date().getFullYear()
                        ? "numeric"
                        : undefined
            }
        );
    }


    /* =====================================================
       RENDER PAGE / CONTAINER
       ===================================================== */

    function renderNotifications(
        container = null
    ) {

        const target =
            container ||
            $(
                "#notificationsList"
            );


        if (!target) {

            return;
        }


        target.innerHTML =
            "";


        if (
            !state.notifications.length
        ) {

            renderEmptyState(
                target
            );


            return;
        }


        state.notifications.forEach(
            notification => {

                target.appendChild(
                    createNotificationElement(
                        notification
                    )
                );

            }
        );
    }


    /* =====================================================
       CREATE NOTIFICATION
       ===================================================== */

    function createNotificationElement(
        notification
    ) {

        const item =
            document.createElement(
                "article"
            );


        item.className =
            `notification-item ${
                notification.is_read
                    ? "read"
                    : "unread"
            }`;


        item.dataset.notificationId =
            notification.id;


        const visual =
            getNotificationIcon(
                notification.type
            );


        item.innerHTML = `

            <div
                class="
                    notification-icon
                    ${visual.className}
                "
            >

                <i
                    class="fa-solid ${visual.icon}"
                ></i>

            </div>


            <div
                class="notification-content"
            >

                <div
                    class="notification-title-row"
                >

                    <h3>
                        ${escapeHTML(
                            notification.title ||
                            "Notification"
                        )}
                    </h3>


                    ${
                        !notification.is_read
                            ? `
                                <span
                                    class="notification-new"
                                >
                                    NEW
                                </span>
                              `
                            : ""
                    }

                </div>


                ${
                    notification.message
                        ? `
                            <p>
                                ${escapeHTML(
                                    notification.message
                                )}
                            </p>
                          `
                        : ""
                }


                <span
                    class="notification-time"
                >

                    ${formatNotificationTime(
                        notification.created_at
                    )}

                </span>

            </div>


            ${
                notification.link
                    ? `
                        <button
                            type="button"
                            class="notification-open"
                            data-open-notification
                            aria-label="Open notification"
                        >

                            <i
                                class="fa-solid fa-arrow-right"
                            ></i>

                        </button>
                      `
                    : ""
            }

        `;


        /*
         * Notification click.
         */

        item.addEventListener(
            "click",
            async event => {

                if (
                    event.target.closest(
                        "[data-open-notification]"
                    )
                ) {

                    return;
                }


                await handleNotificationClick(
                    notification
                );
            }
        );


        /*
         * Dedicated arrow button.
         */

        item.querySelector(
            "[data-open-notification]"
        )?.addEventListener(
            "click",
            async event => {

                event.stopPropagation();


                await handleNotificationClick(
                    notification
                );
            }
        );


        return item;
    }


    /* =====================================================
       HANDLE CLICK
       ===================================================== */

    async function handleNotificationClick(
        notification
    ) {

        try {

            if (
                !notification.is_read
            ) {

                await markAsRead(
                    notification.id
                );
            }


            navigateFromNotification(
                notification
            );

        } catch (error) {

            console.error(
                "DESIGNVERSE notification click error:",
                error
            );


            showToast(
                getNotificationErrorMessage(
                    error
                ),
                "error"
            );
        }
    }


    /* =====================================================
       SAFE NAVIGATION
       ===================================================== */

    function navigateFromNotification(
        notification
    ) {

        const link =
            String(
                notification.link ||
                ""
            ).trim();


        if (!link) {

            return;
        }


        /*
         * Same-origin absolute URL.
         */

        if (
            /^https?:\/\//i.test(
                link
            )
        ) {

            try {

                const url =
                    new URL(
                        link,
                        window.location.origin
                    );


                if (
                    url.origin !==
                    window.location.origin
                ) {

                    return;
                }


                window.location.href =
                    url.href;

            } catch {

                return;
            }


            return;
        }


        /*
         * Root-relative URL.
         */

        if (
            link.startsWith("/")
        ) {

            window.location.href =
                link;

            return;
        }


        /*
         * Relative URL.
         */

        window.location.href =
            link;
    }


    /* =====================================================
       EMPTY STATE
       ===================================================== */

    function renderEmptyState(
        container
    ) {

        container.innerHTML = `

            <div
                class="notifications-empty"
            >

                <div
                    class="notifications-empty-icon"
                >

                    <i
                        class="fa-regular fa-bell-slash"
                    ></i>

                </div>


                <h3>
                    You're all caught up
                </h3>


                <p>
                    New DESIGNVERSE activity will appear here.
                </p>

            </div>

        `;
    }


    /* =====================================================
       BADGES
       ===================================================== */

    function updateNotificationBadges() {

        document
            .querySelectorAll(
                "#notificationBadge, [data-notification-badge]"
            )
            .forEach(
                badge => {

                    const count =
                        state.unreadCount;


                    if (
                        count > 0
                    ) {

                        badge.textContent =
                            count > 99
                                ? "99+"
                                : String(
                                    count
                                );

                        badge.hidden =
                            false;

                    } else {

                        badge.textContent =
                            "0";

                        badge.hidden =
                            true;
                    }

                }
            );


        document
            .querySelectorAll(
                "[data-unread-count]"
            )
            .forEach(
                element => {

                    element.textContent =
                        String(
                            state.unreadCount
                        );

                }
            );
    }


    /* =====================================================
       NOTIFICATION BELL
       ===================================================== */

    function setupNotificationBell() {

        const bell =
            document.querySelector(
                "#notificationBell, [data-notification-button]"
            );


        if (!bell) {

            return;
        }


        /*
         * Prevent duplicate listeners if init is
         * accidentally called more than once.
         */

        if (
            bell.dataset.notificationsBound ===
            "true"
        ) {

            return;
        }


        bell.dataset.notificationsBound =
            "true";


        bell.addEventListener(
            "click",
            async event => {

                event.preventDefault();


                await toggleNotificationPanel(
                    bell
                );
            }
        );
    }


    /* =====================================================
       PANEL
       ===================================================== */

    async function toggleNotificationPanel(
        anchor
    ) {

        let panel =
            $(
                "#notificationPanel"
            );


        if (!panel) {

            panel =
                createNotificationPanel();


            document.body.appendChild(
                panel
            );
        }


        if (
            panel.dataset.open ===
            "true"
        ) {

            closeNotificationPanel(
                panel
            );


            return;
        }


        positionNotificationPanel(
            panel,
            anchor
        );


        panel.hidden =
            false;


        panel.dataset.open =
            "true";


        /*
         * Refresh panel data.
         */

        await loadNotifications({
            limit:
                8
        });


        renderNotifications(
            panel.querySelector(
                "#notificationPanelList"
            )
        );
    }


    /* =====================================================
       CREATE PANEL
       ===================================================== */

    function createNotificationPanel() {

        const panel =
            document.createElement(
                "div"
            );


        panel.id =
            "notificationPanel";


        panel.hidden =
            true;


        panel.dataset.open =
            "false";


        panel.style.cssText = `

            position:fixed;

            z-index:9999;

            width:min(
                390px,
                calc(100vw - 24px)
            );

            max-height:
                min(
                    560px,
                    calc(
                        100vh - 100px
                    )
                );

            overflow:hidden;

            border:
                1px solid
                rgba(255,255,255,.10);

            border-radius:
                18px;

            background:
                rgba(10,10,16,.97);

            box-shadow:
                0 30px 80px
                rgba(0,0,0,.45);

            backdrop-filter:
                blur(20px);

        `;


        panel.innerHTML = `

            <div
                style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:10px;
                    padding:14px 15px;
                    border-bottom:1px solid rgba(255,255,255,.07);
                "
            >

                <div>

                    <strong
                        style="
                            display:block;
                            color:white;
                            font:600 13px/1.2 'Space Grotesk',sans-serif;
                        "
                    >
                        Notifications
                    </strong>


                    <span
                        style="
                            display:block;
                            margin-top:4px;
                            color:#71717a;
                            font:8px/1.4 Inter,sans-serif;
                        "
                    >
                        Your latest DESIGNVERSE activity
                    </span>

                </div>


                <button
                    type="button"
                    id="notificationPanelMarkAll"
                    style="
                        border:0;
                        background:transparent;
                        color:#c4b5fd;
                        cursor:pointer;
                        font:700 8px Inter,sans-serif;
                    "
                >
                    Mark all read
                </button>

            </div>


            <div
                id="notificationPanelList"
                style="
                    max-height:435px;
                    overflow:auto;
                    padding:6px;
                "
            ></div>


            <a
                href="dashboard/notifications.html"
                style="
                    display:block;
                    padding:12px 15px;
                    border-top:1px solid rgba(255,255,255,.07);
                    color:#c4b5fd;
                    font:700 8px Inter,sans-serif;
                    text-decoration:none;
                "
            >

                View all notifications

                <i
                    class="fa-solid fa-arrow-right"
                    style="margin-left:4px;"
                ></i>

            </a>

        `;


        panel.querySelector(
            "#notificationPanelMarkAll"
        )
        ?.addEventListener(
            "click",
            async event => {

                event.stopPropagation();


                try {

                    await markAllAsRead();


                    renderNotifications(
                        panel.querySelector(
                            "#notificationPanelList"
                        )
                    );

                } catch (error) {

                    showToast(
                        getNotificationErrorMessage(
                            error
                        ),
                        "error"
                    );
                }
            }
        );


        /*
         * Close when clicking outside.
         */

        document.addEventListener(
            "click",
            event => {

                if (
                    panel.dataset.open !==
                    "true"
                ) {

                    return;
                }


                if (
                    panel.contains(
                        event.target
                    )
                ) {

                    return;
                }


                const bell =
                    document.querySelector(
                        "#notificationBell, [data-notification-button]"
                    );


                if (
                    bell &&
                    bell.contains(
                        event.target
                    )
                ) {

                    return;
                }


                closeNotificationPanel(
                    panel
                );
            }
        );


        return panel;
    }


    /* =====================================================
       POSITION PANEL
       ===================================================== */

    function positionNotificationPanel(
        panel,
        anchor
    ) {

        panel.hidden =
            false;


        const rect =
            anchor?.getBoundingClientRect();


        if (!rect) {

            panel.style.right =
                "12px";

            panel.style.top =
                "72px";

            return;
        }


        const panelWidth =
            Math.min(
                390,
                window.innerWidth - 24
            );


        let left =
            rect.right -
            panelWidth;


        left =
            Math.max(
                12,
                Math.min(
                    left,
                    window.innerWidth -
                    panelWidth -
                    12
                )
            );


        let top =
            rect.bottom +
            10;


        const maxTop =
            window.innerHeight -
            100;


        if (
            top >
            maxTop
        ) {

            top =
                Math.max(
                    12,
                    rect.top -
                    10 -
                    435
                );
        }


        panel.style.left =
            `${left}px`;


        panel.style.top =
            `${top}px`;
    }


    /* =====================================================
       CLOSE PANEL
       ===================================================== */

    function closeNotificationPanel(
        panel =
            $("#notificationPanel")
    ) {

        if (!panel) {

            return;
        }


        panel.dataset.open =
            "false";


        panel.hidden =
            true;
    }


    /* =====================================================
       REFRESH
       ===================================================== */

    async function refresh() {

        if (!state.user) {

            await getCurrentUser();
        }


        if (!state.user) {

            state.notifications =
                [];

            state.unreadCount =
                0;

            updateNotificationBadges();

            renderNotifications();

            return [];
        }


        return loadNotifications();
    }


    /* =====================================================
       REALTIME
       ===================================================== */

    function subscribeToNotifications() {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !state.user
        ) {

            return null;
        }


        /*
         * Supabase Realtime can update the bell
         * without refreshing the page.
         */

        const channel =
            supabase
                .channel(
                    `notifications:${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "notifications",

                        filter:
                            `user_id=eq.${state.user.id}`
                    },
                    payload => {

                        const notification =
                            payload.new;


                        state.notifications =
                            [
                                notification,
                                ...state.notifications
                            ]
                            .slice(
                                0,
                                state.pageSize
                            );


                        state.unreadCount =
                            state.unreadCount +
                            (
                                notification.is_read
                                    ? 0
                                    : 1
                            );


                        updateNotificationBadges();


                        /*
                         * If the notifications list is
                         * currently visible, refresh it.
                         */

                        renderNotifications();


                        showToast(
                            notification.title ||
                            "New notification",
                            "info"
                        );

                    }
                )
                .subscribe();


        return channel;
    }


    /* =====================================================
       ERROR
       ===================================================== */

    function getNotificationErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to update notifications."
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
                "Supabase blocked this notification action because of your permissions."
            );
        }


        if (
            lower.includes(
                "not authenticated"
            )
        ) {

            return (
                "Please sign in to view your notifications."
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
                ".notification-toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "notification-toast-container";


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
                    : "fa-bell";


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
                style="color:#c4b5fd;"
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
       UTILS
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


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function init() {

        if (
            state.initialized
        ) {

            return;
        }


        const hasNotificationPage =
            Boolean(
                $("#notificationsList")
            );


        const hasBell =
            Boolean(
                $(
                    "#notificationBell, [data-notification-button]"
                )
            );


        const hasBadge =
            Boolean(
                $(
                    "#notificationBadge, [data-notification-badge]"
                )
            );


        if (
            !hasNotificationPage &&
            !hasBell &&
            !hasBadge
        ) {

            return;
        }


        state.initialized =
            true;


        try {

            await getCurrentUser();


            if (
                !state.user
            ) {

                state.notifications =
                    [];

                state.unreadCount =
                    0;

                updateNotificationBadges();

                renderNotifications();


                return;
            }


            await loadNotifications();


            setupNotificationBell();


            subscribeToNotifications();


        } catch (error) {

            console.error(
                "DESIGNVERSE notifications initialization error:",
                error
            );


            showToast(
                getNotificationErrorMessage(
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

        loadNotifications,

        getUnreadCount,

        markAsRead,

        markAllAsRead,

        getNotificationIcon,

        formatNotificationTime,

        renderNotifications,

        updateNotificationBadges,

        refresh,

        subscribeToNotifications,

        showToast

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVNotifications =
    DVNotifications;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVNotifications.init();

    }
);


/* =========================================================
   DESIGNVERSE NOTIFICATIONS SYSTEM COMPLETE
   ========================================================= */