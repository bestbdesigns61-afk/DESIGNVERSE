/* =========================================================
   DESIGNVERSE — VOTING SYSTEM
   js/voting.js
   ========================================================= */

"use strict";


/* =========================================================
   SUPABASE
   ========================================================= */

const getVotingSupabase = () => {

    if (!window.supabaseClient) {

        console.error(
            "DESIGNVERSE: Supabase client not found."
        );

        return null;
    }

    return window.supabaseClient;
};


/* =========================================================
   HELPERS
   ========================================================= */

const getVotingUser = async () => {

    const supabase =
        getVotingSupabase();

    if (!supabase) {
        return null;
    }

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {

        console.error(
            "DESIGNVERSE voting user error:",
            error
        );

        return null;
    }

    return data?.user || null;
};


const getCurrentDesignId = () => {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get("id");
};


const votingQuery = (
    selector,
    parent = document
) => {

    return parent.querySelector(
        selector
    );
};


/* =========================================================
   FIND VOTING TABLE
   ========================================================= */

/*
 * Designverse uses the votes table for individual votes.
 *
 * Expected structure:
 *
 * votes
 * ├── id
 * ├── design_id
 * ├── user_id
 * └── created_at
 *
 * The UNIQUE constraint should normally
 * prevent one user from voting twice.
 */


/* =========================================================
   GET VOTE COUNT
   ========================================================= */

const getVoteCount = async (
    designId
) => {

    const supabase =
        getVotingSupabase();

    if (!supabase) {
        return 0;
    }

    if (!designId) {
        return 0;
    }


    const {
        count,
        error
    } = await supabase
        .from("votes")
        .select(
            "id",
            {
                count: "exact",
                head: true
            }
        )
        .eq(
            "design_id",
            designId
        );


    if (error) {

        console.error(
            "Get vote count error:",
            error
        );

        return 0;
    }


    return count || 0;
};


/* =========================================================
   CHECK WHETHER USER VOTED
   ========================================================= */

const hasUserVoted = async (
    designId,
    userId = null
) => {

    const supabase =
        getVotingSupabase();

    if (!supabase) {
        return false;
    }

    if (!designId) {
        return false;
    }


    let user =
        userId;


    if (!user) {

        user =
            await getVotingUser();
    }


    if (!user) {
        return false;
    }


    const {
        data,
        error
    } = await supabase
        .from("votes")
        .select("id")
        .eq(
            "design_id",
            designId
        )
        .eq(
            "user_id",
            user.id
        )
        .maybeSingle();


    if (error) {

        console.error(
            "Check vote error:",
            error
        );

        return false;
    }


    return Boolean(data);
};


/* =========================================================
   GET VOTING STATUS
   ========================================================= */

const getVotingStatus = async (
    designId
) => {

    const user =
        await getVotingUser();


    const count =
        await getVoteCount(
            designId
        );


    let voted = false;


    if (user) {

        voted =
            await hasUserVoted(
                designId,
                user.id
            );
    }


    return {

        count,

        voted,

        loggedIn:
            Boolean(user),

        user

    };
};


/* =========================================================
   ADD VOTE
   ========================================================= */

const addVote = async (
    designId
) => {

    const supabase =
        getVotingSupabase();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    if (!designId) {

        throw new Error(
            "Design ID is required."
        );
    }


    const user =
        await getVotingUser();


    if (!user) {

        throw new Error(
            "Please log in to vote."
        );
    }


    /*
     * Prevent duplicate votes.
     */

    const alreadyVoted =
        await hasUserVoted(
            designId,
            user.id
        );


    if (alreadyVoted) {

        throw new Error(
            "You have already voted for this design."
        );
    }


    /*
     * Prevent voting on your own design.
     */

    const {
        data: design,
        error: designError
    } = await supabase
        .from("designs")
        .select(
            "id, designer_id"
        )
        .eq(
            "id",
            designId
        )
        .maybeSingle();


    if (designError) {

        console.error(
            "Get design for vote error:",
            designError
        );

        throw designError;
    }


    if (!design) {

        throw new Error(
            "Design not found."
        );
    }


    if (
        design.designer_id ===
        user.id
    ) {

        throw new Error(
            "You cannot vote for your own design."
        );
    }


    /*
     * Insert vote.
     */

    const {
        data,
        error
    } = await supabase
        .from("votes")
        .insert({

            design_id:
                designId,

            user_id:
                user.id

        })
        .select()
        .single();


    if (error) {

        console.error(
            "Add vote error:",
            error
        );


        /*
         * Handle duplicate constraint
         * gracefully even if another tab
         * voted at the same time.
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
                "You have already voted for this design."
            );
        }


        throw error;
    }


    const count =
        await getVoteCount(
            designId
        );


    return {

        vote:
            data,

        count,

        voted:
            true

    };
};


/* =========================================================
   REMOVE VOTE
   ========================================================= */

const removeVote = async (
    designId
) => {

    const supabase =
        getVotingSupabase();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    if (!designId) {

        throw new Error(
            "Design ID is required."
        );
    }


    const user =
        await getVotingUser();


    if (!user) {

        throw new Error(
            "Please log in first."
        );
    }


    const {
        error
    } = await supabase
        .from("votes")
        .delete()
        .eq(
            "design_id",
            designId
        )
        .eq(
            "user_id",
            user.id
        );


    if (error) {

        console.error(
            "Remove vote error:",
            error
        );

        throw error;
    }


    const count =
        await getVoteCount(
            designId
        );


    return {

        count,

        voted:
            false

    };
};


/* =========================================================
   TOGGLE VOTE
   ========================================================= */

const toggleVote = async (
    designId
) => {

    const status =
        await getVotingStatus(
            designId
        );


    if (
        status.voted
    ) {

        return await removeVote(
            designId
        );
    }


    return await addVote(
        designId
    );
};


/* =========================================================
   FORMAT VOTE COUNT
   ========================================================= */

const formatVoteCount = (
    count
) => {

    const number =
        Number(count) || 0;


    if (
        number >=
        1000000
    ) {

        return (
            (number / 1000000)
                .toFixed(
                    number % 1000000 === 0
                        ? 0
                        : 1
                )
            + "M"
        );
    }


    if (
        number >=
        1000
    ) {

        return (
            (number / 1000)
                .toFixed(
                    number % 1000 === 0
                        ? 0
                        : 1
                )
            + "K"
        );
    }


    return String(
        number
    );
};


/* =========================================================
   UPDATE VOTE UI
   ========================================================= */

const updateVoteUI = ({
    count = 0,
    voted = false,
    loggedIn = false
} = {}) => {

    /*
     * Vote count
     */

    const countElements =
        document.querySelectorAll(
            "[data-vote-count], #designVoteCount"
        );


    countElements.forEach(
        element => {

            element.textContent =
                formatVoteCount(
                    count
                );

        }
    );


    /*
     * Vote buttons
     */

    const buttons =
        document.querySelectorAll(
            "[data-vote-button], #designVoteBtn"
        );


    buttons.forEach(
        button => {

            button.dataset.voted =
                voted
                    ? "true"
                    : "false";


            button.setAttribute(
                "aria-pressed",
                voted
                    ? "true"
                    : "false"
            );


            button.classList.toggle(
                "active",
                voted
            );


            button.classList.toggle(
                "voted",
                voted
            );


            const icon =
                button.querySelector(
                    "i"
                );


            if (icon) {

                icon.classList.toggle(
                    "fa-regular",
                    !voted
                );


                icon.classList.toggle(
                    "fa-solid",
                    voted
                );

            }


            /*
             * Do not disable the button
             * merely because the user isn't
             * logged in.
             *
             * Clicking it should trigger
             * the login message.
             */

            button.disabled =
                false;


            button.title =
                loggedIn
                    ? (
                        voted
                            ? "Remove your vote"
                            : "Vote for this design"
                    )
                    : "Log in to vote";


            const label =
                button.querySelector(
                    "[data-vote-label]"
                );


            if (label) {

                label.textContent =
                    voted
                        ? "Voted"
                        : "Vote";

            }

        }
    );
};


/* =========================================================
   SHOW VOTING MESSAGE
   ========================================================= */

const showVotingMessage = (
    message,
    type = "success"
) => {

    let element =
        document.querySelector(
            "[data-voting-message]"
        );


    if (!element) {

        element =
            document.createElement(
                "div"
            );


        element.setAttribute(
            "data-voting-message",
            ""
        );


        element.className =
            "voting-message";


        document.body.prepend(
            element
        );
    }


    element.textContent =
        message;


    element.className =
        `voting-message ${type}`;


    element.classList.remove(
        "hidden"
    );


    clearTimeout(
        element._timer
    );


    element._timer =
        setTimeout(
            () => {

                element.classList.add(
                    "hidden"
                );

            },
            4000
        );
};


/* =========================================================
   VOTING ERROR MESSAGE
   ========================================================= */

const getVotingErrorMessage = (
    error
) => {

    if (!error) {

        return (
            "Something went wrong while voting."
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
        ) ||
        lower.includes(
            "permission denied"
        )
    ) {

        return (
            "You don't have permission to vote."
        );
    }


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
            "own design"
        )
    ) {

        return (
            "You cannot vote for your own design."
        );
    }


    if (
        lower.includes(
            "not authenticated"
        ) ||
        lower.includes(
            "log in"
        )
    ) {

        return (
            "Please log in to vote."
        );
    }


    return message;
};


/* =========================================================
   HANDLE VOTE CLICK
   ========================================================= */

const handleVoteClick = async (
    button
) => {

    if (!button) {
        return;
    }


    const designId =
        button.dataset.designId ||
        getCurrentDesignId();


    if (!designId) {

        showVotingMessage(
            "Design ID is missing.",
            "error"
        );

        return;
    }


    const user =
        await getVotingUser();


    /*
     * Login required.
     */

    if (!user) {

        showVotingMessage(
            "Please log in to vote.",
            "error"
        );


        /*
         * If auth.js provides a
         * login redirect helper,
         * use it.
         */

        if (
            typeof window.DVAuth
                ?.redirectToLogin ===
            "function"
        ) {

            window.DVAuth
                .redirectToLogin(
                    window.location.href
                );

        } else {

            const loginPath =
                "/pages/auth/login.html";


            /*
             * Preserve the page the
             * user was viewing.
             */

            const returnUrl =
                encodeURIComponent(
                    window.location.href
                );


            setTimeout(
                () => {

                    window.location.href =
                        `${loginPath}?redirect=${returnUrl}`;

                },
                800
            );
        }


        return;
    }


    /*
     * Prevent multiple requests.
     */

    if (
        button.dataset.loading ===
        "true"
    ) {

        return;
    }


    button.dataset.loading =
        "true";


    button.disabled =
        true;


    const originalHTML =
        button.innerHTML;


    button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span data-vote-label>Voting...</span>
    `;


    try {

        const result =
            await toggleVote(
                designId
            );


        updateVoteUI({

            count:
                result.count,

            voted:
                result.voted,

            loggedIn:
                true

        });


        showVotingMessage(

            result.voted
                ? "Vote added! 🏆"
                : "Vote removed.",

            "success"

        );


        /*
         * Let other systems know
         * that the vote changed.
         */

        document.dispatchEvent(
            new CustomEvent(
                "designverse:vote-changed",
                {
                    detail: {

                        designId,

                        count:
                            result.count,

                        voted:
                            result.voted

                    }
                }
            )
        );


    } catch (error) {

        console.error(
            "Voting error:",
            error
        );


        showVotingMessage(
            getVotingErrorMessage(
                error
            ),
            "error"
        );


    } finally {

        button.dataset.loading =
            "false";


        button.disabled =
            false;


        /*
         * Restore the button.
         * updateVoteUI() will update
         * the icon/state afterward.
         */

        button.innerHTML =
            originalHTML;


        try {

            const status =
                await getVotingStatus(
                    designId
                );


            updateVoteUI(
                status
            );

        } catch (refreshError) {

            console.warn(
                "Vote UI refresh failed:",
                refreshError
            );

        }

    }
};


/* =========================================================
   INITIALIZE VOTE BUTTONS
   ========================================================= */

const setupVoteButtons = () => {

    const buttons =
        document.querySelectorAll(
            "[data-vote-button], #designVoteBtn"
        );


    buttons.forEach(
        button => {

            /*
             * Prevent duplicate listeners.
             */

            if (
                button.dataset
                    .votingInitialized ===
                "true"
            ) {

                return;
            }


            button.dataset
                .votingInitialized =
                "true";


            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();


                    handleVoteClick(
                        button
                    );

                }
            );

        }
    );
};


/* =========================================================
   LOAD VOTING STATE
   ========================================================= */

const loadVotingState = async (
    designId = null
) => {

    const id =
        designId ||
        getCurrentDesignId();


    if (!id) {
        return null;
    }


    const status =
        await getVotingStatus(
            id
        );


    updateVoteUI(
        status
    );


    /*
     * Give every vote button
     * the design ID.
     */

    const buttons =
        document.querySelectorAll(
            "[data-vote-button], #designVoteBtn"
        );


    buttons.forEach(
        button => {

            button.dataset.designId =
                id;

        }
    );


    return status;
};


/* =========================================================
   VOTE EVENT LISTENER
   ========================================================= */

document.addEventListener(
    "designverse:design-loaded",
    event => {

        const design =
            event.detail;


        const designId =
            design?.id ||
            getCurrentDesignId();


        if (designId) {

            loadVotingState(
                designId
            );

        }

    }
);


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

const listenForVotingAuthChanges = () => {

    const supabase =
        getVotingSupabase();


    if (!supabase) {
        return;
    }


    supabase.auth.onAuthStateChange(
        () => {

            const designId =
                getCurrentDesignId();


            if (designId) {

                loadVotingState(
                    designId
                );

            }

        }
    );
};


/* =========================================================
   INITIALIZE
   ========================================================= */

const initVoting = async () => {

    setupVoteButtons();


    const designId =
        getCurrentDesignId();


    if (designId) {

        await loadVotingState(
            designId
        );

    }


    listenForVotingAuthChanges();
};


/* =========================================================
   PUBLIC API
   ========================================================= */

window.DVVoting = {

    getVoteCount,

    hasUserVoted,

    getVotingStatus,

    addVote,

    removeVote,

    toggleVote,

    formatVoteCount,

    updateVoteUI,

    showVotingMessage,

    getVotingErrorMessage,

    loadVotingState,

    setupVoteButtons

};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initVoting();

    }
);