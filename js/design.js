/* =========================================================
   DESIGNVERSE — DESIGN DETAIL PAGE
   js/design.js

   Handles:
   - Loading a single design by ID
   - Rendering design details
   - Rendering designer info
   - Vote button state
   - Share functionality
   - Bookmark functionality
   - Owner actions (edit / delete)
   - Comments system
   - More designs grid
   - Design view increment (via RPC placeholder)
   ========================================================= */

"use strict";


const DVDesignPage = (() => {

    /* =====================================================
       STATE
       ===================================================== */

    const state = {
        design: null,
        user: null,
        comments: [],
        initialized: false,
        bookmarked: false
    };


    /* =====================================================
       DOM
       ===================================================== */

    function $(selector) {
        return document.querySelector(selector);
    }


    function $$(selector) {
        return [...document.querySelectorAll(selector)];
    }


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (!window.supabaseClient) {
            console.error("DESIGNVERSE: Supabase client unavailable.");
            return null;
        }

        return window.supabaseClient;
    }


    /* =====================================================
       CURRENT USER
       ===================================================== */

    async function getCurrentUser() {

        const supabase = getSupabase();

        if (!supabase) return null;

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.warn("DESIGNVERSE design page user lookup:", error);
            return null;
        }

        state.user = data?.user || null;

        return state.user;
    }


    /* =====================================================
       URL PARAMETER
       ===================================================== */

    function getDesignId() {

        const params = new URLSearchParams(
            window.location.search
        );

        return params.get("id");
    }


    /* =====================================================
       LOAD DESIGN
       ===================================================== */

    async function loadDesign() {

        const supabase = getSupabase();

        if (!supabase) {
            throw new Error("Supabase is unavailable.");
        }

        const designId = getDesignId();

        if (!designId) {
            throw new Error("No design ID specified.");
        }

        const {
            data,
            error
        } = await supabase
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
                updated_at,
                profiles:designer_id (
                    id,
                    username,
                    display_name,
                    avatar_url,
                    bio,
                    website_url,
                    location
                )
            `)
            .eq("id", designId)
            .single();

        if (error) {
            console.error("DESIGNVERSE design load error:", error);
            throw error;
        }

        if (!data) {
            throw new Error("Design not found.");
        }

        state.design = data;

        return data;
    }


    /* =====================================================
       TITLE & META
       ===================================================== */

    function setText(selector, value) {

        const element = $(selector);

        if (element) {
            element.textContent = value ?? "";
        }
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    function formatNumber(value) {

        return new Intl.NumberFormat("en-US").format(
            Number(value) || 0
        );
    }


    function formatDate(value) {

        if (!value) return "\u2014";

        const timestamp = new Date(value).getTime();

        if (Number.isNaN(timestamp)) return "\u2014";

        return new Date(timestamp).toLocaleDateString(
            undefined,
            {
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );
    }


    function formatCategory(category) {

        const map = {
            branding: "Branding",
            "logo-design": "Logo Design",
            poster: "Poster",
            "social-media": "Social Media",
            "ui-ux": "UI / UX",
            illustration: "Illustration",
            typography: "Typography",
            packaging: "Packaging",
            motion: "Motion",
            "3d": "3D Design",
            other: "Other"
        };

        return map[category] || "Design";
    }


    function escapeHTML(value) {

        const element = document.createElement("div");

        element.textContent = String(value ?? "");

        return element.innerHTML;
    }


    function escapeAttribute(value) {

        return escapeHTML(value)
            .replace(/"/g, "\u0022")
            .replace(/'/g, "\u0027");
    }


    /* =====================================================
       RENDER DESIGN
       ===================================================== */

    function renderDesign(design) {

        document.title = `${design.title} \u2014 DESIGNVERSE`;

        setText("#designTitle", design.title);
        setText("#designDescription", design.description || "No description provided.");
        setText("#designCategory", formatCategory(design.category));
        setText("#designDate", formatDate(design.created_at));
        setText("#designViews", formatNumber(design.views));

        const image = $("#designImage");

        if (image) {
            image.src = design.image_url || "";
            image.alt = design.title || "Design";
        }

        renderDesigner(design.profiles);

        renderOwnerActions(design);

        renderVoteState();

        setText("#designVoteCount", formatNumber(
            Number(design.votes_count || 0)
        ));
    }


    /* =====================================================
       RENDER DESIGNER
       ===================================================== */

    function renderDesigner(designer) {

        if (!designer) return;

        const displayName = designer.display_name || designer.username || "Designer";
        const username = designer.username ? `@${designer.username}` : "";

        setText("#designerName", displayName);
        setText("#designerUsername", username);

        const designerLink = $("#designDesigner");

        if (designerLink) {
            designerLink.href =
                designer.username
                    ? `designer.html?username=${encodeURIComponent(designer.username)}`
                    : `designer.html?id=${encodeURIComponent(designer.id)}`;
        }

        const avatar = $("#designerAvatar");
        const placeholder = $("#designerAvatarPlaceholder");

        if (avatar && designer.avatar_url) {
            avatar.src = designer.avatar_url;
            avatar.alt = `${displayName} avatar`;
            avatar.classList.remove("hidden");

            if (placeholder) placeholder.classList.add("hidden");
        } else {
            if (avatar) avatar.classList.add("hidden");
            if (placeholder) placeholder.classList.remove("hidden");
        }
    }


    /* =====================================================
       OWNER ACTIONS
       ===================================================== */

    function renderOwnerActions(design) {

        const container = $("#designOwnerActions");

        if (!container) return;

        const isOwner =
            state.user &&
            design.designer_id === state.user.id;

        if (isOwner) {
            container.classList.remove("hidden");
        } else {
            container.classList.add("hidden");
        }
    }


    /* =====================================================
       RENDER VOTE STATE
       ===================================================== */

    function renderVoteState() {

        if (typeof window.DVVoting !== "undefined") {

            const designId = getDesignId();

            if (designId && typeof window.DVVoting.loadVotingState === "function") {
                window.DVVoting.loadVotingState(designId);
            }
        }
    }


    /* =====================================================
       SHARE
       ===================================================== */

    function openShareModal() {

        const modal = $("#shareModal");

        if (!modal) return;

        const shareUrl = window.location.href;

        setText("#shareUrl", shareUrl);

        modal.classList.remove("hidden");
        modal.classList.add("open");

        document.body.classList.add("modal-open");
    }


    function closeShareModal() {

        const modal = $("#shareModal");

        if (!modal) return;

        modal.classList.add("hidden");
        modal.classList.remove("open");

        document.body.classList.remove("modal-open");
    }


    async function handleShare(dataAction) {

        const shareUrl = window.location.href;

        if (dataAction === "copy") {

            try {
                await navigator.clipboard.writeText(shareUrl);

                showDesignToast("Link copied to clipboard.", "success");
            } catch {
                showDesignToast("Unable to copy link.", "error");
            }

            closeShareModal();

            return;
        }

        if (dataAction === "native") {

            try {

                if (navigator.share) {
                    await navigator.share({
                        title: document.title,
                        url: shareUrl
                    });
                } else {
                    await navigator.clipboard.writeText(shareUrl);
                    showDesignToast("Link copied to clipboard.", "success");
                }
            } catch {
                /* User cancelled share - no error needed */
            }

            closeShareModal();

            return;
        }
    }


    /* =====================================================
       DELETE DESIGN
       ===================================================== */

    async function handleDeleteDesign() {

        const designId = getDesignId();

        if (!designId) return;

        if (!window.DVDesigns || typeof window.DVDesigns.deleteDesign !== "function") {
            showDesignToast("Unable to delete design. Please try again.", "error");
            return;
        }

        const button = $("#confirmDeleteBtn");

        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
        }

        try {

            await window.DVDesigns.deleteDesign(designId);

            closeDeleteModal();

            showDesignToast("Design deleted successfully.", "success");

            setTimeout(() => {
                window.location.href = "explore.html";
            }, 800);

        } catch (error) {

            console.error("DESIGNVERSE delete design error:", error);

            showDesignToast(
                error?.message || "Unable to delete design.",
                "error"
            );

            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fa-solid fa-trash"></i> Delete Design';
            }
        }
    }


    function openDeleteModal() {

        const modal = $("#deleteModal");

        if (!modal) return;

        modal.classList.remove("hidden");
        modal.classList.add("open");

        document.body.classList.add("modal-open");
    }


    function closeDeleteModal() {

        const modal = $("#deleteModal");

        if (!modal) return;

        modal.classList.add("hidden");
        modal.classList.remove("open");

        document.body.classList.remove("modal-open");
    }


    /* =====================================================
       LIKE
       ===================================================== */

    async function toggleLike() {

        const designId = getDesignId();

        if (!designId) return;

        if (!window.DVDesigns || typeof window.DVDesigns.toggleDesignLike !== "function") {
            showDesignToast("Unable to like design. Please try again.", "error");
            return;
        }

        const button = $("#designLikeBtn");

        if (button) button.disabled = true;

        try {

            const result = await window.DVDesigns.toggleDesignLike(designId);

            state.liked = result.liked;

            renderLikeButton();

            if (result.liked) {
                showDesignToast("You liked this design! ❤️", "success");
            } else {
                showDesignToast("Like removed.", "success");
            }

        } catch (error) {

            console.error("DESIGNVERSE like error:", error);

            showDesignToast(
                error?.message || "Unable to like design.",
                "error"
            );

        } finally {

            if (button) button.disabled = false;
        }
    }


    function renderLikeButton() {

        const button = $("#designLikeBtn");

        if (!button) return;

        const icon = $("#designLikeIcon");

        if (state.liked) {
            button.classList.add("active");
            icon?.classList.remove("fa-regular");
            icon?.classList.add("fa-solid");
        } else {
            button.classList.remove("active");
            icon?.classList.remove("fa-solid");
            icon?.classList.add("fa-regular");
        }
    }


    async function loadLikeState() {

        const designId = getDesignId();

        if (!designId) return;

        if (!window.DVDesigns) return;

        /* Load like count */

        if (typeof window.DVDesigns.getLikeCount === "function") {

            try {

                const count = await window.DVDesigns.getLikeCount(designId);

                setText("#designLikeCount", formatLikeCount(count));

            } catch (error) {

                console.warn("Load like count error:", error);
            }
        }

        /* Load whether user liked */

        if (typeof window.DVDesigns.getUserLikes === "function") {

            try {

                const likedIds = await window.DVDesigns.getUserLikes([designId]);

                state.liked = likedIds.includes(designId);

                renderLikeButton();

            } catch (error) {

                console.warn("Load user like error:", error);
            }
        }
    }


    function formatLikeCount(count) {

        if (!count || count < 1) return "0";

        if (count >= 1000000) {
            return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
        }

        if (count >= 1000) {
            return (count / 1000).toFixed(1).replace(/\.0$/, "") + "K";
        }

        return String(count);
    }


    /* =====================================================
       BOOKMARK / SAVE
       ===================================================== */

    function toggleBookmark() {

        const designId = getDesignId();

        if (!designId) return;

        const key = "designverse_bookmarks";

        let bookmarks = [];

        try {

            bookmarks = JSON.parse(localStorage.getItem(key) || "[]");
        } catch {
            bookmarks = [];
        }

        state.bookmarked = bookmarks.includes(designId);

        if (state.bookmarked) {
            bookmarks = bookmarks.filter(id => id !== designId);
        } else {
            bookmarks.push(designId);
        }

        try {

            localStorage.setItem(key, JSON.stringify(bookmarks));

            state.bookmarked = !state.bookmarked;

            renderBookmarkButton();

            showDesignToast(
                state.bookmarked ? "Design saved." : "Design removed from saved.",
                "success"
            );

        } catch {
            showDesignToast("Unable to save design.", "error");
        }
    }


    function renderBookmarkButton() {

        const button = $("#designBookmarkBtn");

        if (!button) return;

        const icon = button.querySelector("i");

        if (state.bookmarked) {
            button.classList.add("active");
            icon?.classList.remove("fa-regular");
            icon?.classList.add("fa-solid");
        } else {
            button.classList.remove("active");
            icon?.classList.remove("fa-solid");
            icon?.classList.add("fa-regular");
        }
    }


    function loadBookmarkState() {

        const designId = getDesignId();

        if (!designId) return;

        const key = "designverse_bookmarks";

        let bookmarks = [];

        try {
            bookmarks = JSON.parse(localStorage.getItem(key) || "[]");
        } catch {
            bookmarks = [];
        }

        state.bookmarked = bookmarks.includes(designId);

        renderBookmarkButton();
    }


    /* =====================================================
       LOAD MORE DESIGNS
       ===================================================== */

    async function loadMoreDesigns() {

        const container = $("#moreDesignsGrid");

        if (!container) return;

        if (typeof window.DVDesigns !== "undefined" &&
            typeof window.DVDesigns.loadDesignGrid === "function") {

            try {

                await window.DVDesigns.loadDesignGrid({
                    selector: "#moreDesignsGrid",
                    limit: 8
                });

            } catch (error) {

                console.error("More designs load error:", error);

                container.innerHTML = `
                    <div class="design-empty">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <p>Unable to load more designs.</p>
                    </div>
                `;
            }
        }
    }


    /* =====================================================
       COMMENTS
       ===================================================== */

    async function loadComments() {

        const supabase = getSupabase();

        const designId = getDesignId();

        if (!supabase || !designId) return [];

        /*
         * Comments table is optional in the current
         * schema. If it does not exist, we gracefully
         * show an empty state.
         */

        const {
            data,
            error
        } = await supabase
            .from("design_comments")
            .select(`
                id,
                design_id,
                user_id,
                comment,
                created_at,
                profiles:user_id (
                    id,
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .eq("design_id", designId)
            .order("created_at", { ascending: true });

        if (error) {

            console.warn("DESIGNVERSE comments load:", error);

            state.comments = [];

            renderComments();

            return [];
        }

        state.comments = data || [];

        renderComments();

        return state.comments;
    }


    async function submitComment(event) {

        event.preventDefault();

        const supabase = getSupabase();

        if (!supabase) return;

        const designId = getDesignId();

        const input = $("#commentInput");

        const text = input?.value?.trim() || "";

        if (!text) return;

        const button = $("#commentSubmitBtn");

        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting...';
        }

        try {
            const user = state.user || await getCurrentUser();

            if (!user) {
                window.location.href = "auth/login.html";
                return;
            }

            const {
                data,
                error
            } = await supabase
                .from("design_comments")
                .insert({
                    design_id: designId,
                    user_id: user.id,
                    comment: text
                })
                .select(`
                    id,
                    design_id,
                    user_id,
                    comment,
                    created_at,
                    profiles:user_id (
                        id,
                        username,
                        display_name,
                        avatar_url
                    )
                `)
                .single();

            if (error) throw error;

            state.comments.push(data);

            renderComments();

            if (input) input.value = "";

            const counter = $("#commentCharacters");
            if (counter) counter.textContent = "0";

            showDesignToast("Comment posted.", "success");

        } catch (error) {

            console.error("DESIGNVERSE comment error:", error);

            showDesignToast(
                error?.message || "Unable to post comment.",
                "error"
            );

        } finally {

            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Comment';
            }
        }
    }


    function renderComments() {

        const list = $("#commentsList");

        if (!list) return;

        const countElement = $("#commentCount");

        if (countElement) {
            countElement.textContent = String(state.comments.length);
        }

        list.innerHTML = "";

        if (!state.comments.length) {

            list.innerHTML = `
                <div class="comments-empty">
                    <i class="fa-regular fa-comment-dots"></i>
                    <p>No comments yet. Be the first to share your thoughts.</p>
                </div>
            `;

            return;
        }

        state.comments.forEach(comment => {

            const profile = comment.profiles || {};

            const displayName = profile.display_name || profile.username || "Designer";

            const avatarHtml = profile.avatar_url
                ? `<img src="${escapeAttribute(profile.avatar_url)}" alt="${escapeAttribute(displayName)}" class="comment-avatar">`
                : `<div class="comment-avatar comment-avatar-placeholder"><i class="fa-solid fa-user"></i></div>`;

            const item = document.createElement("article");

            item.className = "comment-item";

            item.innerHTML = `
                ${avatarHtml}
                <div class="comment-body">
                    <div class="comment-header">
                        <strong>${escapeHTML(displayName)}</strong>
                        <span>${escapeHTML(formatRelativeTime(comment.created_at))}</span>
                    </div>
                    <p>${escapeHTML(comment.comment)}</p>
                </div>
            `;

            list.appendChild(item);
        });
    }


    function formatRelativeTime(value) {

        if (!value) return "";

        const timestamp = new Date(value).getTime();

        if (Number.isNaN(timestamp)) return "";

        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return "Just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

        return new Date(timestamp).toLocaleDateString();
    }


    /* =====================================================
       TOAST
       ===================================================== */

    function showDesignToast(message, type = "info") {

        let container = $(".toast-container");

        if (!container) {
            container = document.createElement("div");
            container.className = "toast-container";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");

        toast.className = `toast toast-${type}`;

        toast.setAttribute("role", "status");

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${escapeHTML(message)}</span>
                <button class="toast-close" type="button" aria-label="Close notification">&times;</button>
            </div>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        const closeButton = toast.querySelector(".toast-close");

        closeButton?.addEventListener("click", () => {
            removeToast(toast);
        });

        setTimeout(() => {
            removeToast(toast);
        }, 3500);
    }


    function removeToast(toast) {

        if (!toast) return;

        toast.classList.remove("show");

        setTimeout(() => {
            toast.remove();
        }, 300);
    }


    /* =====================================================
       SHOW / HIDE CONTENT
       ===================================================== */

    function showContent() {

        const loading = $("#designLoading");

        if (loading) loading.classList.add("hidden");

        const content = $("#designContent");

        if (content) content.classList.remove("hidden");

        const error = $("#designError");

        if (error) error.classList.add("hidden");
    }


    function showError() {

        const loading = $("#designLoading");

        if (loading) loading.classList.add("hidden");

        const content = $("#designContent");

        if (content) content.classList.add("hidden");

        const error = $("#designError");

        if (error) error.classList.remove("hidden");
    }


    /* =====================================================
       EVENT SETUP
       ===================================================== */

    function setupEvents() {

        /* Share */

        $("#designShareBtn")?.addEventListener("click", () => {
            openShareModal();
        });

        $$("[data-close-modal]").forEach(element => {
            element.addEventListener("click", () => {
                closeShareModal();
                closeDeleteModal();
            });
        });

        $$("[data-share]").forEach(element => {
            element.addEventListener("click", () => {
                handleShare(element.dataset.share);
            });
        });

        /* Like */

        $("#designLikeBtn")?.addEventListener("click", () => {
            toggleLike();
        });

        /* Bookmark */

        $("#designBookmarkBtn")?.addEventListener("click", () => {
            toggleBookmark();
        });

        /* Owner actions */

        $("#editDesignBtn")?.addEventListener("click", () => {
            const designId = getDesignId();

            if (designId) {
                window.location.href = `submit.html?edit=${encodeURIComponent(designId)}`;
            }
        });

        $("#deleteDesignBtn")?.addEventListener("click", () => {
            openDeleteModal();
        });

        $("#confirmDeleteBtn")?.addEventListener("click", () => {
            handleDeleteDesign();
        });

        /* Comments */

        $("#commentForm")?.addEventListener("submit", submitComment);

        $("#commentInput")?.addEventListener("input", event => {

            const counter = $("#commentCharacters");

            if (counter) {
                counter.textContent = String(event.target.value.length);
            }
        });

        /* Escape key to close modals */

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeShareModal();
                closeDeleteModal();
            }
        });

        /* Design loaded event for voting system */

        document.dispatchEvent(new CustomEvent("designverse:design-loaded", {
            detail: state.design
        }));
    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function init() {

        if (state.initialized) return;

        state.initialized = true;

        try {

            await getCurrentUser();

            const design = await loadDesign();

            renderDesign(design);

            loadBookmarkState();

            loadLikeState();

            setupEvents();

            showContent();

            loadMoreDesigns();

            loadComments();

            /* Increment views placeholder */
            if (design?.id && window.DVDesigns?.incrementDesignViews) {
                window.DVDesigns.incrementDesignViews(design.id);
            }

        } catch (error) {

            console.error("DESIGNVERSE design page error:", error);

            showError();
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {
        state,
        init,
        loadDesign,
        renderDesign,
        loadComments,
        submitComment,
        showDesignToast
    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVDesignPage = DVDesignPage;


/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    DVDesignPage.init();
});


/* =========================================================
   DESIGNVERSE DESIGN PAGE COMPLETE
   ========================================================= */
