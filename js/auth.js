/* =========================================================
   DESIGNVERSE — AUTHENTICATION SYSTEM
   auth.js
   ========================================================= */

"use strict";


/* =========================================================
   SUPABASE CLIENT
   ========================================================= */

const getSupabaseClient = () => {

    if (!window.supabaseClient) {

        console.error(
            "DESIGNVERSE: Supabase client is not available."
        );

        return null;
    }

    return window.supabaseClient;
};


/* =========================================================
   HELPERS
   ========================================================= */

const getElement = (selector) => {
    return document.querySelector(selector);
};


const getErrorMessage = (error) => {

    if (!error) {
        return "Something went wrong.";
    }

    const message =
        error.message ||
        String(error);


    if (
        message.toLowerCase().includes(
            "invalid login credentials"
        )
    ) {
        return "Incorrect email or password.";
    }


    if (
        message.toLowerCase().includes(
            "email not confirmed"
        )
    ) {
        return "Please confirm your email before logging in.";
    }


    if (
        message.toLowerCase().includes(
            "user already registered"
        )
    ) {
        return "An account with this email already exists.";
    }


    if (
        message.toLowerCase().includes(
            "password should be at least"
        )
    ) {
        return "Your password is too short.";
    }


    if (
        message.toLowerCase().includes(
            "rate limit"
        )
    ) {
        return "Too many attempts. Please wait a moment and try again.";
    }


    if (
        message.toLowerCase().includes(
            "row-level security"
        )
    ) {
        return "You don't have permission to perform this action.";
    }


    return message;
};


/* =========================================================
   SHOW AUTH MESSAGE
   ========================================================= */

const showAuthMessage = (
    message,
    type = "error"
) => {

    let container =
        document.querySelector(
            "[data-auth-message]"
        );


    if (!container) {

        container =
            document.createElement(
                "div"
            );

        container.setAttribute(
            "data-auth-message",
            ""
        );

        container.className =
            "auth-message";

        const form =
            document.querySelector(
                "form"
            );

        if (form) {

            form.parentNode.insertBefore(
                container,
                form
            );

        } else {

            document.body.prepend(
                container
            );
        }
    }


    container.textContent =
        message;

    container.className =
        `auth-message ${type}`;


    container.classList.remove(
        "hidden"
    );


    clearTimeout(
        container._hideTimer
    );


    container._hideTimer =
        setTimeout(
            () => {

                container.classList.add(
                    "hidden"
                );

            },
            5000
        );
};


/* =========================================================
   BUTTON LOADING STATE
   ========================================================= */

const setButtonLoading = (
    button,
    loading,
    loadingText = "Please wait..."
) => {

    if (!button) {
        return;
    }


    if (loading) {

        button.dataset.originalText =
            button.innerHTML;

        button.disabled =
            true;

        button.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            ${loadingText}
        `;

    } else {

        button.disabled =
            false;

        button.innerHTML =
            button.dataset.originalText ||
            "Continue";
    }
};


/* =========================================================
   GET CURRENT USER
   ========================================================= */

const getCurrentUser = async () => {

    const supabase =
        getSupabaseClient();


    if (!supabase) {
        return null;
    }


    const {
        data,
        error
    } = await supabase.auth.getUser();


    if (error) {

        console.error(
            "Get user error:",
            error
        );

        return null;
    }


    return data.user || null;
};


/* =========================================================
   GET CURRENT SESSION
   ========================================================= */

const getCurrentSession = async () => {

    const supabase =
        getSupabaseClient();


    if (!supabase) {
        return null;
    }


    const {
        data,
        error
    } = await supabase.auth.getSession();


    if (error) {

        console.error(
            "Get session error:",
            error
        );

        return null;
    }


    return data.session || null;
};


/* =========================================================
   REGISTER
   ========================================================= */

const registerUser = async ({
    email,
    password,
    username,
    displayName
}) => {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    email =
        email.trim().toLowerCase();

    username =
        username.trim().toLowerCase();

    displayName =
        displayName.trim();


    if (!email) {

        throw new Error(
            "Please enter your email."
        );
    }


    if (!username) {

        throw new Error(
            "Please choose a username."
        );
    }


    if (!displayName) {

        throw new Error(
            "Please enter your display name."
        );
    }


    if (password.length < 8) {

        throw new Error(
            "Password must contain at least 8 characters."
        );
    }


    /*
     * Store username and display name
     * in user metadata.
     *
     * Our Supabase database trigger
     * uses these values to create
     * the profiles row.
     */

    const {
        data,
        error
    } = await supabase.auth.signUp({

        email,

        password,

        options: {

            data: {

                username,

                display_name:
                    displayName

            },

            emailRedirectTo:
                getRedirectUrl(
                    "login.html"
                )
        }
    });


    if (error) {

        console.error(
            "Registration error:",
            error
        );

        throw error;
    }


    return data;
};


/* =========================================================
   LOGIN
   ========================================================= */

const loginUser = async ({
    email,
    password,
    remember = true
}) => {

    const supabase =
        getSupabaseClient();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    email =
        email.trim().toLowerCase();


    if (!email) {

        throw new Error(
            "Please enter your email."
        );
    }


    if (!password) {

        throw new Error(
            "Please enter your password."
        );
    }


    /*
     * Supabase handles the actual
     * session persistence.
     *
     * The remember parameter is kept
     * for compatibility with the UI.
     */

    const {
        data,
        error
    } = await supabase.auth.signInWithPassword({

        email,

        password

    });


    if (error) {

        console.error(
            "Login error:",
            error
        );

        throw error;
    }


    return data;
};


/* =========================================================
   LOGOUT
   ========================================================= */

const logoutUser = async () => {

    const supabase =
        getSupabaseClient();


    if (!supabase) {
        return;
    }


    const {
        error
    } = await supabase.auth.signOut();


    if (error) {

        console.error(
            "Logout error:",
            error
        );

        throw error;
    }


    /*
     * Send user back to login.
     */

    window.location.href =
        getRedirectUrl(
            "login.html"
        );
};


/* =========================================================
   RESET PASSWORD EMAIL
   ========================================================= */

const sendPasswordReset =
    async (email) => {

        const supabase =
            getSupabaseClient();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        email =
            email.trim().toLowerCase();


        if (!email) {

            throw new Error(
                "Please enter your email."
            );
        }


        const {
            error
        } = await supabase.auth
            .resetPasswordForEmail(
                email,
                {
                    redirectTo:
                        getRedirectUrl(
                            "reset-password.html"
                        )
                }
            );


        if (error) {

            console.error(
                "Password reset error:",
                error
            );

            throw error;
        }


        return true;
    };


/* =========================================================
   UPDATE PASSWORD
   ========================================================= */

const updatePassword =
    async (password) => {

        const supabase =
            getSupabaseClient();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        if (!password) {

            throw new Error(
                "Please enter a new password."
            );
        }


        if (password.length < 8) {

            throw new Error(
                "Password must contain at least 8 characters."
            );
        }


        const {
            data,
            error
        } = await supabase.auth.updateUser({

            password

        });


        if (error) {

            console.error(
                "Password update error:",
                error
            );

            throw error;
        }


        return data;
    };


/* =========================================================
   RESEND CONFIRMATION EMAIL
   ========================================================= */

const resendConfirmation =
    async (email) => {

        const supabase =
            getSupabaseClient();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        email =
            email.trim().toLowerCase();


        if (!email) {

            throw new Error(
                "Please enter your email."
            );
        }


        const {
            error
        } = await supabase.auth.resend({

            type: "signup",

            email,

            options: {

                emailRedirectTo:
                    getRedirectUrl(
                        "login.html"
                    )
            }
        });


        if (error) {

            throw error;
        }


        return true;
    };


/* =========================================================
   REDIRECT URL HELPER
   ========================================================= */

const getRedirectUrl = (
    page
) => {

    /*
     * Works both during local development
     * and when deployed.
     */

    const currentUrl =
        new URL(
            window.location.href
        );


    /*
     * If the current page is inside:
     *
     * /pages/auth/
     *
     * go two levels up to the
     * DESIGNVERSE root.
     */

    if (
        currentUrl.pathname.includes(
            "/pages/auth/"
        )
    ) {

        return new URL(
            `../../${page}`,
            currentUrl.href
        ).href;
    }


    /*
     * Fallback.
     */

    return new URL(
        page,
        currentUrl.origin +
        currentUrl.pathname
    ).href;
};


/* =========================================================
   REQUIRE AUTHENTICATION
   ========================================================= */

const requireAuth = async () => {

    const session =
        await getCurrentSession();


    if (!session) {

        window.location.href =
            getRedirectUrl(
                "login.html"
            );

        return null;
    }


    return session;
};


/* =========================================================
   REDIRECT IF ALREADY LOGGED IN
   ========================================================= */

const redirectIfAuthenticated =
    async () => {

        const session =
            await getCurrentSession();


        if (session) {

            window.location.href =
                getRedirectUrl(
                    "../../pages/dashboard/dashboard.html"
                );
        }
    };


/* =========================================================
   LOGIN FORM
   ========================================================= */

const setupLoginForm = () => {

    const form =
        getElement(
            "#loginForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const email =
                getElement(
                    "#email"
                )?.value || "";


            const password =
                getElement(
                    "#password"
                )?.value || "";


            const button =
                form.querySelector(
                    "button[type='submit']"
                );


            try {

                setButtonLoading(
                    button,
                    true,
                    "Signing in..."
                );


                await loginUser({

                    email,

                    password

                });


                showAuthMessage(
                    "Login successful! Welcome to DESIGNVERSE.",
                    "success"
                );


                /*
                 * Small delay allows the
                 * success message to appear.
                 */

                setTimeout(
                    () => {

                        window.location.href =
                            getRedirectUrl(
                                "../../pages/dashboard/dashboard.html"
                            );

                    },
                    700
                );


            } catch (error) {

                console.error(
                    error
                );


                showAuthMessage(
                    getErrorMessage(
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
};


/* =========================================================
   REGISTER FORM
   ========================================================= */

const setupRegisterForm = () => {

    const form =
        getElement(
            "#registerForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const email =
                getElement(
                    "#email"
                )?.value || "";


            const password =
                getElement(
                    "#password"
                )?.value || "";


            const confirmPassword =
                getElement(
                    "#confirmPassword"
                )?.value || "";


            const username =
                getElement(
                    "#username"
                )?.value || "";


            const displayName =
                getElement(
                    "#displayName"
                )?.value || "";


            const button =
                form.querySelector(
                    "button[type='submit']"
                );


            if (
                password !==
                confirmPassword
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

                        email,

                        password,

                        username,

                        displayName

                    });


                /*
                 * Supabase may require
                 * email confirmation.
                 */

                if (
                    result.user &&
                    !result.session
                ) {

                    showAuthMessage(
                        "Account created! Check your email to confirm your account.",
                        "success"
                    );

                } else {

                    showAuthMessage(
                        "Account created successfully!",
                        "success"
                    );

                }


                setTimeout(
                    () => {

                        window.location.href =
                            getRedirectUrl(
                                "login.html"
                            );

                    },
                    1800
                );


            } catch (error) {

                console.error(
                    error
                );


                showAuthMessage(
                    getErrorMessage(
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
};


/* =========================================================
   FORGOT PASSWORD FORM
   ========================================================= */

const setupForgotPasswordForm =
    () => {

        const form =
            getElement(
                "#forgotPasswordForm"
            );


        if (!form) {
            return;
        }


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const email =
                    getElement(
                        "#email"
                    )?.value || "";


                const button =
                    form.querySelector(
                        "button[type='submit']"
                    );


                try {

                    setButtonLoading(
                        button,
                        true,
                        "Sending..."
                    );


                    await sendPasswordReset(
                        email
                    );


                    showAuthMessage(
                        "Password reset instructions have been sent to your email.",
                        "success"
                    );


                } catch (error) {

                    console.error(
                        error
                    );


                    showAuthMessage(
                        getErrorMessage(
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
    };


/* =========================================================
   RESET PASSWORD FORM
   ========================================================= */

const setupResetPasswordForm =
    () => {

        const form =
            getElement(
                "#resetPasswordForm"
            );


        if (!form) {
            return;
        }


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const password =
                    getElement(
                        "#password"
                    )?.value || "";


                const confirmPassword =
                    getElement(
                        "#confirmPassword"
                    )?.value || "";


                const button =
                    form.querySelector(
                        "button[type='submit']"
                    );


                if (
                    password !==
                    confirmPassword
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
                        password
                    );


                    showAuthMessage(
                        "Password updated successfully!",
                        "success"
                    );


                    setTimeout(
                        () => {

                            window.location.href =
                                getRedirectUrl(
                                    "login.html"
                                );

                        },
                        1500
                    );


                } catch (error) {

                    console.error(
                        error
                    );


                    showAuthMessage(
                        getErrorMessage(
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
    };


/* =========================================================
   LOGOUT BUTTONS
   ========================================================= */

const setupLogoutButtons =
    () => {

        const buttons =
            document.querySelectorAll(
                "[data-logout]"
            );


        buttons.forEach(
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
                                error
                            );


                            button.disabled =
                                false;


                            showAuthMessage(
                                getErrorMessage(
                                    error
                                ),
                                "error"
                            );

                        }

                    }
                );

            }
        );
    };


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

const setupAuthListener =
    () => {

        const supabase =
            getSupabaseClient();


        if (!supabase) {
            return;
        }


        supabase.auth.onAuthStateChange(
            (
                event,
                session
            ) => {

                console.log(
                    "DESIGNVERSE auth:",
                    event
                );


                /*
                 * When the password recovery
                 * link is opened, Supabase
                 * creates a recovery session.
                 */

                if (
                    event ===
                    "PASSWORD_RECOVERY"
                ) {

                    console.log(
                        "Password recovery session detected."
                    );

                }


                /*
                 * SIGNED_OUT can be used by
                 * dashboard pages to update UI.
                 */

                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    console.log(
                        "User signed out."
                    );

                }

            }
        );
    };


/* =========================================================
   INITIALIZE AUTH
   ========================================================= */

const initAuth = async () => {

    setupLoginForm();

    setupRegisterForm();

    setupForgotPasswordForm();

    setupResetPasswordForm();

    setupLogoutButtons();

    setupAuthListener();


    /*
     * Protect pages marked with:
     *
     * <body data-protected>
     */

    if (
        document.body.hasAttribute(
            "data-protected"
        )
    ) {

        await requireAuth();
    }

};


/* =========================================================
   GLOBAL DESIGNVERSE AUTH API
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

    redirectIfAuthenticated,

    showAuthMessage,

    getErrorMessage

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