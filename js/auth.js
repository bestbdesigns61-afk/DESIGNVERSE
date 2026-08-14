/* =========================================================
   DESIGNVERSE — AUTHENTICATION SYSTEM
   js/auth.js
   ========================================================= */

"use strict";


/* =========================================================
   SUPABASE CLIENT
   ========================================================= */

function getSupabaseClient() {

    if (!window.supabaseClient) {

        console.error(
            "DESIGNVERSE: Supabase client is not available."
        );

        return null;
    }

    return window.supabaseClient;
}


/* =========================================================
   DOM HELPER
   ========================================================= */

function $(selector) {
    return document.querySelector(selector);
}


/* =========================================================
   FRIENDLY AUTH ERRORS
   ========================================================= */

function getFriendlyError(error) {

    if (!error) {
        return "Something went wrong. Please try again.";
    }

    const message =
        String(
            error.message || error
        );

    const lower =
        message.toLowerCase();


    if (
        lower.includes("invalid login credentials")
    ) {
        return "Incorrect email or password.";
    }


    if (
        lower.includes("email not confirmed")
    ) {
        return "Please confirm your email address before signing in.";
    }


    if (
        lower.includes("user already registered")
    ) {
        return "An account with this email already exists.";
    }


    if (
        lower.includes("password should be at least")
    ) {
        return "Your password is too short.";
    }


    if (
        lower.includes("rate limit")
    ) {
        return "Too many requests. Please wait a little and try again.";
    }


    if (
        lower.includes("network")
    ) {
        return "Network error. Check your internet connection.";
    }


    if (
        lower.includes("row-level security")
    ) {
        return "You don't have permission to perform this action.";
    }


    return message;
}


/* =========================================================
   AUTH MESSAGE
   ========================================================= */

function showAuthMessage(
    message,
    type = "error"
) {

    let messageBox =
        document.querySelector(
            ".auth-message"
        );


    if (!messageBox) {

        messageBox =
            document.createElement(
                "div"
            );

        messageBox.className =
            "auth-message";


        const card =
            document.querySelector(
                ".auth-card"
            );


        if (card) {

            const form =
                card.querySelector("form");


            if (form) {

                card.insertBefore(
                    messageBox,
                    form
                );

            } else {

                card.prepend(
                    messageBox
                );
            }

        } else {

            document.body.prepend(
                messageBox
            );
        }
    }


    messageBox.className =
        `auth-message ${type}`;


    messageBox.textContent =
        message;


    messageBox.setAttribute(
        "role",
        type === "error"
            ? "alert"
            : "status"
    );
}


/* =========================================================
   BUTTON LOADING
   ========================================================= */

function setButtonLoading(
    button,
    loading,
    loadingText = "Please wait..."
) {

    if (!button) return;


    if (loading) {

        if (
            !button.dataset.originalText
        ) {

            button.dataset.originalText =
                button.innerHTML;
        }


        button.disabled = true;


        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            &nbsp;
            ${loadingText}
        `;

    } else {

        button.disabled = false;


        button.innerHTML =
            button.dataset.originalText ||
            "Continue";
    }
}


/* =========================================================
   VALIDATION
   ========================================================= */

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            String(email)
                .trim()
                .toLowerCase()
        );
}


function isValidUsername(username) {

    return /^[a-zA-Z0-9_]{3,30}$/
        .test(
            String(username)
                .trim()
        );
}


function getPasswordScore(password) {

    let score = 0;


    if (password.length >= 8) {
        score++;
    }


    if (/[A-Z]/.test(password)) {
        score++;
    }


    if (/[0-9]/.test(password)) {
        score++;
    }


    if (
        /[^A-Za-z0-9]/.test(password)
    ) {
        score++;
    }


    return score;
}


/* =========================================================
   SITE PATH HELPERS
   ========================================================= */

/*
 * DESIGNVERSE structure:
 *
 * /
 * ├── index.html
 * └── pages/
 *     ├── auth/
 *     └── dashboard/
 *
 * This works on a deployed domain and
 * on localhost.
 */

function getSiteRoot() {

    const pathname =
        window.location.pathname;


    const pagesIndex =
        pathname.indexOf(
            "/pages/"
        );


    if (pagesIndex !== -1) {

        return (
            pathname.substring(
                0,
                pagesIndex
            ) + "/"
        );
    }


    return "/";
}


function getRootPageUrl(page) {

    return (
        getSiteRoot() +
        page
    );
}


function getAuthPageUrl(page) {

    return (
        getSiteRoot() +
        "pages/auth/" +
        page
    );
}


function getDashboardPageUrl(
    page = "dashboard.html"
) {

    return (
        getSiteRoot() +
        "pages/dashboard/" +
        page
    );
}


/* =========================================================
   GET CURRENT USER
   ========================================================= */

async function getCurrentUser() {

    const supabase =
        getSupabaseClient();


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
            "Current user error:",
            error
        );

        return null;
    }


    return data.user || null;
}


/* =========================================================
   GET CURRENT SESSION
   ========================================================= */

async function getCurrentSession() {

    const supabase =
        getSupabaseClient();


    if (!supabase) {
        return null;
    }


    const {
        data,
        error
    } =
        await supabase.auth.getSession();


    if (error) {

        console.error(
            "Session error:",
            error
        );

        return null;
    }


    return data.session || null;
}


/* =========================================================
   REGISTER
   ========================================================= */

async function registerUser({
    email,
    password,
    username,
    displayName
}) {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Authentication service is unavailable."
        );
    }


    email =
        String(email || "")
            .trim()
            .toLowerCase();


    username =
        String(username || "")
            .trim()
            .toLowerCase();


    displayName =
        String(displayName || "")
            .trim();


    if (!displayName) {

        throw new Error(
            "Please enter your display name."
        );
    }


    if (
        !isValidUsername(username)
    ) {

        throw new Error(
            "Username must be 3–30 characters and may only contain letters, numbers and underscores."
        );
    }


    if (
        !isValidEmail(email)
    ) {

        throw new Error(
            "Please enter a valid email address."
        );
    }


    if (
        password.length < 8
    ) {

        throw new Error(
            "Password must contain at least 8 characters."
        );
    }


    if (
        getPasswordScore(password) < 2
    ) {

        throw new Error(
            "Please choose a stronger password."
        );
    }


    const {
        data,
        error
    } =
        await supabase.auth.signUp({

            email,

            password,

            options: {

                data: {

                    username,

                    display_name:
                        displayName
                },

                emailRedirectTo:
                    getAuthPageUrl(
                        "login.html"
                    )
            }
        });


    if (error) {
        throw error;
    }


    return data;
}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser({
    email,
    password
}) {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Authentication service is unavailable."
        );
    }


    email =
        String(email || "")
            .trim()
            .toLowerCase();


    if (
        !isValidEmail(email)
    ) {

        throw new Error(
            "Please enter a valid email address."
        );
    }


    if (!password) {

        throw new Error(
            "Please enter your password."
        );
    }


    const {
        data,
        error
    } =
        await supabase.auth
            .signInWithPassword({

                email,

                password
            });


    if (error) {
        throw error;
    }


    return data;
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {

    const supabase =
        getSupabaseClient();


    if (!supabase) {
        return;
    }


    const {
        error
    } =
        await supabase.auth.signOut();


    if (error) {
        throw error;
    }


    window.location.href =
        getAuthPageUrl(
            "login.html"
        );
}


/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

async function sendPasswordReset(email) {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Authentication service is unavailable."
        );
    }


    email =
        String(email || "")
            .trim()
            .toLowerCase();


    if (
        !isValidEmail(email)
    ) {

        throw new Error(
            "Please enter a valid email address."
        );
    }


    const {
        error
    } =
        await supabase.auth
            .resetPasswordForEmail(
                email,
                {
                    redirectTo:
                        getAuthPageUrl(
                            "reset-password.html"
                        )
                }
            );


    if (error) {
        throw error;
    }


    return true;
}


/* =========================================================
   UPDATE PASSWORD
   ========================================================= */

async function updatePassword(password) {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Authentication service is unavailable."
        );
    }


    if (
        password.length < 8
    ) {

        throw new Error(
            "Password must contain at least 8 characters."
        );
    }


    if (
        getPasswordScore(password) < 2
    ) {

        throw new Error(
            "Please choose a stronger password."
        );
    }


    const {
        data,
        error
    } =
        await supabase.auth.updateUser({
            password
        });


    if (error) {
        throw error;
    }


    return data;
}


/* =========================================================
   RESEND CONFIRMATION
   ========================================================= */

async function resendConfirmation(email) {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Authentication service is unavailable."
        );
    }


    email =
        String(email || "")
            .trim()
            .toLowerCase();


    if (
        !isValidEmail(email)
    ) {

        throw new Error(
            "Please enter a valid email address."
        );
    }


    const {
        error
    } =
        await supabase.auth.resend({

            type: "signup",

            email,

            options: {

                emailRedirectTo:
                    getAuthPageUrl(
                        "login.html"
                    )
            }
        });


    if (error) {
        throw error;
    }


    return true;
}


/* =========================================================
   LOGIN FORM
   ========================================================= */

function setupLoginForm() {

    const form =
        $("#loginForm");


    if (!form) return;


    const emailInput =
        $("#loginEmail");


    const passwordInput =
        $("#loginPassword");


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                form.querySelector(
                    'button[type="submit"]'
                );


            try {

                setButtonLoading(
                    button,
                    true,
                    "Signing in..."
                );


                await loginUser({

                    email:
                        emailInput?.value || "",

                    password:
                        passwordInput?.value || ""

                });


                showAuthMessage(
                    "Login successful! Welcome back 👋",
                    "success"
                );


                setTimeout(
                    () => {

                        /*
                         * First check whether the user
                         * originally tried to open a
                         * protected page.
                         */

                        const redirect =
                            sessionStorage.getItem(
                                "designverse_redirect"
                            );


                        if (redirect) {

                            sessionStorage.removeItem(
                                "designverse_redirect"
                            );


                            window.location.href =
                                redirect;

                            return;
                        }


                        window.location.href =
                            getDashboardPageUrl();

                    },
                    700
                );


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );


                showAuthMessage(
                    getFriendlyError(error),
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


/* =========================================================
   REGISTER FORM
   ========================================================= */

function setupRegisterForm() {

    const form =
        $("#registerForm");


    if (!form) return;


    const displayName =
        $("#displayName");


    const username =
        $("#username");


    const email =
        $("#registerEmail");


    const password =
        $("#registerPassword");


    const confirmPassword =
        $("#confirmPassword");


    const terms =
        $("#terms");


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                form.querySelector(
                    'button[type="submit"]'
                );


            if (
                terms &&
                !terms.checked
            ) {

                showAuthMessage(
                    "Please accept the DESIGNVERSE rules before creating your account.",
                    "error"
                );

                return;
            }


            if (
                password?.value !==
                confirmPassword?.value
            ) {

                showAuthMessage(
                    "Passwords do not match.",
                    "error"
                );

                return;
            }


            try {

                setButtonLoading(
                    button,
                    true,
                    "Creating account..."
                );


                const result =
                    await registerUser({

                        displayName:
                            displayName?.value || "",

                        username:
                            username?.value || "",

                        email:
                            email?.value || "",

                        password:
                            password?.value || ""

                    });


                if (
                    result.user &&
                    !result.session
                ) {

                    showAuthMessage(
                        "Account created! Check your email to confirm your DESIGNVERSE account.",
                        "success"
                    );


                    form.reset();

                } else {

                    showAuthMessage(
                        "Account created successfully! Welcome to DESIGNVERSE 🚀",
                        "success"
                    );


                    setTimeout(
                        () => {

                            window.location.href =
                                getDashboardPageUrl();

                        },
                        900
                    );
                }


            } catch (error) {

                console.error(
                    "Registration error:",
                    error
                );


                showAuthMessage(
                    getFriendlyError(error),
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


/* =========================================================
   FORGOT PASSWORD FORM
   ========================================================= */

function setupForgotPasswordForm() {

    const form =
        $("#forgotPasswordForm");


    if (!form) return;


    const email =
        $("#forgotEmail");


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const button =
                form.querySelector(
                    'button[type="submit"]'
                );


            try {

                setButtonLoading(
                    button,
                    true,
                    "Sending..."
                );


                await sendPasswordReset(
                    email?.value || ""
                );


                showAuthMessage(
                    "If an account exists for that email, a password reset link has been sent.",
                    "success"
                );


                form.reset();


            } catch (error) {

                console.error(
                    "Password reset error:",
                    error
                );


                showAuthMessage(
                    getFriendlyError(error),
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


/* =========================================================
   RESET PASSWORD FORM
   ========================================================= */

async function setupResetPasswordForm() {

    const form =
        $("#resetPasswordForm");


    if (!form) return;


    /*
     * Give Supabase a moment to process
     * the recovery URL/session.
     */

    const supabase =
        getSupabaseClient();


    if (!supabase) return;


    const {
        data: sessionData
    } =
        await supabase.auth.getSession();


    if (!sessionData.session) {

        showAuthMessage(
            "This password reset link is invalid or has expired. Please request a new one.",
            "error"
        );


        const button =
            form.querySelector(
                'button[type="submit"]'
            );


        if (button) {
            button.disabled = true;
        }


        return;
    }


    const password =
        $("#newPassword");


    const confirmPassword =
        $("#confirmPassword");


    const button =
        form.querySelector(
            'button[type="submit"]'
        );


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            if (
                password?.value !==
                confirmPassword?.value
            ) {

                showAuthMessage(
                    "Passwords do not match.",
                    "error"
                );

                return;
            }


            try {

                setButtonLoading(
                    button,
                    true,
                    "Updating..."
                );


                await updatePassword(
                    password?.value || ""
                );


                showAuthMessage(
                    "Password updated successfully! 🎉",
                    "success"
                );


                form.reset();


                setTimeout(
                    async () => {

                        try {

                            await supabase.auth.signOut();

                        } finally {

                            window.location.href =
                                getAuthPageUrl(
                                    "login.html"
                                );
                        }

                    },
                    1200
                );


            } catch (error) {

                console.error(
                    "Password update error:",
                    error
                );


                showAuthMessage(
                    getFriendlyError(error),
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


/* =========================================================
   LOGOUT BUTTONS
   ========================================================= */

function setupLogoutButtons() {

    document
        .querySelectorAll(
            "[data-logout]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();


                        try {

                            button.disabled =
                                true;


                            await logoutUser();

                        } catch (error) {

                            console.error(
                                "Logout error:",
                                error
                            );


                            button.disabled =
                                false;


                            showAuthMessage(
                                getFriendlyError(error),
                                "error"
                            );
                        }

                    }
                );

            }
        );
}


/* =========================================================
   PROTECTED PAGES
   ========================================================= */

async function requireAuth() {

    const session =
        await getCurrentSession();


    if (session) {

        return session;
    }


    /*
     * Save the page the user wanted.
     */

    sessionStorage.setItem(
        "designverse_redirect",
        window.location.href
    );


    window.location.href =
        getAuthPageUrl(
            "login.html"
        );


    return null;
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function setupAuthStateListener() {

    const supabase =
        getSupabaseClient();


    if (!supabase) return;


    supabase.auth.onAuthStateChange(
        (
            event,
            session
        ) => {

            console.log(
                "DESIGNVERSE auth event:",
                event
            );


            window.dispatchEvent(
                new CustomEvent(
                    "designverse:auth",
                    {
                        detail: {
                            event,
                            session,
                            user:
                                session?.user ||
                                null
                        }
                    }
                )
            );

        }
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

async function initAuth() {

    setupLoginForm();

    setupRegisterForm();

    setupForgotPasswordForm();

    await setupResetPasswordForm();

    setupLogoutButtons();

    setupAuthStateListener();


    /*
     * Any page with:
     *
     * <body data-protected>
     *
     * requires a valid Supabase session.
     */

    if (
        document.body.hasAttribute(
            "data-protected"
        )
    ) {

        await requireAuth();
    }
}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.DVAuth = {

    registerUser,

    loginUser,

    logoutUser,

    getCurrentUser,

    getCurrentSession,

    sendPasswordReset,

    updatePassword,

    resendConfirmation,

    requireAuth,

    showAuthMessage,

    getFriendlyError
};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initAuth();

    }
);