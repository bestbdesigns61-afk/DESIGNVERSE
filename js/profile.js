/* =========================================================
   DESIGNVERSE — PROFILE SYSTEM
   profile.js
   ========================================================= */

"use strict";


const DVProfile = (() => {

    /* =====================================================
       SUPABASE
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
       HELPERS
       ===================================================== */

    const $ = (selector) =>
        document.querySelector(selector);


    const getUser = async () => {

        const supabase = getSupabase();

        if (!supabase) {
            return null;
        }

        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.error(
                "Unable to get user:",
                error
            );

            return null;
        }

        return data.user || null;
    };


    const getUserId = async () => {

        const user = await getUser();

        return user?.id || null;
    };


    /* =====================================================
       GET PROFILE
       ===================================================== */

    const getProfile = async (
        userId = null
    ) => {

        const supabase = getSupabase();

        if (!supabase) {
            return null;
        }

        if (!userId) {
            userId = await getUserId();
        }

        if (!userId) {
            return null;
        }

        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error) {

            console.error(
                "Profile fetch error:",
                error
            );

            return null;
        }

        return data;
    };


    /* =====================================================
       UPDATE PROFILE
       ===================================================== */

    const updateProfile = async ({
        displayName,
        username,
        bio,
        websiteUrl,
        location
    }) => {

        const supabase = getSupabase();

        if (!supabase) {
            throw new Error(
                "Supabase is unavailable."
            );
        }

        const userId =
            await getUserId();

        if (!userId) {
            throw new Error(
                "You must be logged in to update your profile."
            );
        }


        const updates = {};


        if (
            typeof displayName ===
            "string"
        ) {
            updates.display_name =
                displayName.trim();
        }


        if (
            typeof username ===
            "string"
        ) {
            updates.username =
                username
                    .trim()
                    .toLowerCase();
        }


        if (
            typeof bio ===
            "string"
        ) {
            updates.bio =
                bio.trim();
        }


        if (
            typeof websiteUrl ===
            "string"
        ) {
            updates.website_url =
                websiteUrl.trim();
        }


        if (
            typeof location ===
            "string"
        ) {
            updates.location =
                location.trim();
        }


        updates.updated_at =
            new Date().toISOString();


        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", userId)
            .select()
            .single();


        if (error) {

            console.error(
                "Profile update error:",
                error
            );

            throw error;
        }


        return data;
    };


    /* =====================================================
       UPLOAD AVATAR
       ===================================================== */

    const uploadAvatar = async (
        file
    ) => {

        const supabase =
            getSupabase();

        if (!supabase) {
            throw new Error(
                "Supabase is unavailable."
            );
        }


        const userId =
            await getUserId();


        if (!userId) {
            throw new Error(
                "You must be logged in to upload an avatar."
            );
        }


        if (!file) {
            throw new Error(
                "Please select an image."
            );
        }


        /* ---------------------------------------------
           VALIDATE FILE TYPE
           --------------------------------------------- */

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            throw new Error(
                "Please upload a JPG, PNG, WEBP or GIF image."
            );
        }


        /* ---------------------------------------------
           VALIDATE SIZE
           --------------------------------------------- */

        const maxSize =
            5 * 1024 * 1024;


        if (
            file.size >
            maxSize
        ) {

            throw new Error(
                "Avatar must be smaller than 5 MB."
            );
        }


        /* ---------------------------------------------
           CREATE FILE PATH
           --------------------------------------------- */

        const extension =
            file.name
                .split(".")
                .pop()
                .toLowerCase();


        const filePath =
            `${userId}/profile-${Date.now()}.${extension}`;


        /* ---------------------------------------------
           UPLOAD
           --------------------------------------------- */

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
                        false,

                    contentType:
                        file.type
                }
            );


        if (uploadError) {

            console.error(
                "Avatar upload error:",
                uploadError
            );

            throw uploadError;
        }


        /* ---------------------------------------------
           GET PUBLIC URL
           --------------------------------------------- */

        const {
            data: publicData
        } = supabase
            .storage
            .from("avatars")
            .getPublicUrl(
                filePath
            );


        const avatarUrl =
            publicData.publicUrl;


        /* ---------------------------------------------
           SAVE URL TO PROFILE
           --------------------------------------------- */

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .update({
                avatar_url:
                    avatarUrl,

                updated_at:
                    new Date().toISOString()
            })
            .eq("id", userId)
            .select()
            .single();


        if (profileError) {

            console.error(
                "Avatar profile update error:",
                profileError
            );

            throw profileError;
        }


        return {
            url: avatarUrl,
            path: filePath,
            profile
        };
    };


    /* =====================================================
       DELETE AVATAR
       ===================================================== */

    const deleteAvatar = async (
        avatarUrl = null
    ) => {

        const supabase =
            getSupabase();

        if (!supabase) {
            throw new Error(
                "Supabase is unavailable."
            );
        }


        const userId =
            await getUserId();


        if (!userId) {
            throw new Error(
                "You must be logged in."
            );
        }


        /*
         * If no URL was supplied,
         * get the current profile.
         */

        if (!avatarUrl) {

            const profile =
                await getProfile(
                    userId
                );

            avatarUrl =
                profile?.avatar_url;
        }


        if (avatarUrl) {

            /*
             * Extract the file path from
             * the public Supabase URL.
             */

            const marker =
                "/storage/v1/object/public/avatars/";


            const index =
                avatarUrl.indexOf(
                    marker
                );


            if (index !== -1) {

                const filePath =
                    decodeURIComponent(
                        avatarUrl.substring(
                            index +
                            marker.length
                        )
                    );


                const {
                    error
                } = await supabase
                    .storage
                    .from("avatars")
                    .remove([
                        filePath
                    ]);


                if (error) {

                    console.error(
                        "Avatar delete error:",
                        error
                    );

                    throw error;
                }
            }
        }


        /* ---------------------------------------------
           Remove avatar URL
           --------------------------------------------- */

        const {
            data,
            error
        } = await supabase
            .from("profiles")
            .update({
                avatar_url: null,

                updated_at:
                    new Date().toISOString()
            })
            .eq("id", userId)
            .select()
            .single();


        if (error) {
            throw error;
        }


        return data;
    };


    /* =====================================================
       GET DESIGNER PROFILE
       ===================================================== */

    const getDesigner =
        async (username) => {

            const supabase =
                getSupabase();

            if (!supabase) {
                return null;
            }


            if (!username) {
                return null;
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
                    created_at
                `)
                .eq(
                    "username",
                    username
                        .trim()
                        .toLowerCase()
                )
                .single();


            if (error) {

                console.error(
                    "Designer profile error:",
                    error
                );

                return null;
            }


            return data;
        };


    /* =====================================================
       GET DESIGNER'S DESIGNS
       ===================================================== */

    const getDesignerDesigns =
        async (userId) => {

            const supabase =
                getSupabase();

            if (!supabase) {
                return [];
            }


            if (!userId) {
                return [];
            }


            const {
                data,
                error
            } = await supabase
                .from("designs")
                .select("*")
                .eq(
                    "designer_id",
                    userId
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

                console.error(
                    "Designer designs error:",
                    error
                );

                return [];
            }


            return data || [];
        };


    /* =====================================================
       FOLLOW USER
       ===================================================== */

    const followUser =
        async (followingId) => {

            const supabase =
                getSupabase();

            if (!supabase) {
                throw new Error(
                    "Supabase is unavailable."
                );
            }


            const followerId =
                await getUserId();


            if (!followerId) {
                throw new Error(
                    "Please log in first."
                );
            }


            if (
                followerId ===
                followingId
            ) {

                throw new Error(
                    "You cannot follow yourself."
                );
            }


            const {
                data,
                error
            } = await supabase
                .from("follows")
                .insert({

                    follower_id:
                        followerId,

                    following_id:
                        followingId

                })
                .select()
                .single();


            if (error) {

                if (
                    error.code ===
                    "23505"
                ) {

                    throw new Error(
                        "You already follow this designer."
                    );
                }

                throw error;
            }


            return data;
        };


    /* =====================================================
       UNFOLLOW USER
       ===================================================== */

    const unfollowUser =
        async (followingId) => {

            const supabase =
                getSupabase();

            if (!supabase) {
                throw new Error(
                    "Supabase is unavailable."
                );
            }


            const followerId =
                await getUserId();


            if (!followerId) {
                throw new Error(
                    "Please log in first."
                );
            }


            const {
                error
            } = await supabase
                .from("follows")
                .delete()
                .eq(
                    "follower_id",
                    followerId
                )
                .eq(
                    "following_id",
                    followingId
                );


            if (error) {
                throw error;
            }


            return true;
        };


    /* =====================================================
       CHECK FOLLOW STATUS
       ===================================================== */

    const isFollowing =
        async (followingId) => {

            const supabase =
                getSupabase();

            if (!supabase) {
                return false;
            }


            const followerId =
                await getUserId();


            if (!followerId) {
                return false;
            }


            const {
                data,
                error
            } = await supabase
                .from("follows")
                .select("id")
                .eq(
                    "follower_id",
                    followerId
                )
                .eq(
                    "following_id",
                    followingId
                )
                .maybeSingle();


            if (error) {

                console.error(
                    "Follow status error:",
                    error
                );

                return false;
            }


            return !!data;
        };


    /* =====================================================
       UPDATE FOLLOW COUNTS
       ===================================================== */

    const getFollowCounts =
        async (userId) => {

            const supabase =
                getSupabase();

            if (!supabase) {
                return {
                    followers: 0,
                    following: 0
                };
            }


            const {
                count: followers
            } = await supabase
                .from("follows")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "following_id",
                    userId
                );


            const {
                count: following
            } = await supabase
                .from("follows")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "follower_id",
                    userId
                );


            return {

                followers:
                    followers || 0,

                following:
                    following || 0

            };
        };


    /* =====================================================
       UPDATE PROFILE COUNTS
       ===================================================== */

    const refreshFollowCounts =
        async () => {

            const supabase =
                getSupabase();

            if (!supabase) {
                return null;
            }


            const userId =
                await getUserId();


            if (!userId) {
                return null;
            }


            const counts =
                await getFollowCounts(
                    userId
                );


            const {
                data,
                error
            } = await supabase
                .from("profiles")
                .update({

                    followers_count:
                        counts.followers,

                    following_count:
                        counts.following,

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    userId
                )
                .select()
                .single();


            if (error) {
                throw error;
            }


            return data;
        };


    /* =====================================================
       LOAD CURRENT PROFILE INTO PAGE
       ===================================================== */

    const loadCurrentProfile =
        async () => {

            const profile =
                await getProfile();


            if (!profile) {
                return null;
            }


            /*
             * These IDs/classes can be used
             * on dashboard/profile pages.
             */

            const elements = {

                displayName:
                    document.querySelectorAll(
                        "[data-profile='display-name']"
                    ),

                username:
                    document.querySelectorAll(
                        "[data-profile='username']"
                    ),

                bio:
                    document.querySelectorAll(
                        "[data-profile='bio']"
                    ),

                avatar:
                    document.querySelectorAll(
                        "[data-profile='avatar']"
                    ),

                location:
                    document.querySelectorAll(
                        "[data-profile='location']"
                    ),

                website:
                    document.querySelectorAll(
                        "[data-profile='website']"
                    ),

                points:
                    document.querySelectorAll(
                        "[data-profile='points']"
                    ),

                wins:
                    document.querySelectorAll(
                        "[data-profile='wins']"
                    ),

                votes:
                    document.querySelectorAll(
                        "[data-profile='votes']"
                    ),

                followers:
                    document.querySelectorAll(
                        "[data-profile='followers']"
                    ),

                following:
                    document.querySelectorAll(
                        "[data-profile='following']"
                    )

            };


            elements.displayName
                .forEach(
                    element => {

                        element.textContent =
                            profile.display_name ||
                            "DESIGNVERSE User";
                    }
                );


            elements.username
                .forEach(
                    element => {

                        element.textContent =
                            profile.username
                                ? `@${profile.username}`
                                : "";
                    }
                );


            elements.bio
                .forEach(
                    element => {

                        element.textContent =
                            profile.bio || "";
                    }
                );


            elements.location
                .forEach(
                    element => {

                        element.textContent =
                            profile.location || "";
                    }
                );


            elements.points
                .forEach(
                    element => {

                        element.textContent =
                            profile.total_points || 0;
                    }
                );


            elements.wins
                .forEach(
                    element => {

                        element.textContent =
                            profile.total_wins || 0;
                    }
                );


            elements.votes
                .forEach(
                    element => {

                        element.textContent =
                            profile.total_votes || 0;
                    }
                );


            elements.followers
                .forEach(
                    element => {

                        element.textContent =
                            profile.followers_count || 0;
                    }
                );


            elements.following
                .forEach(
                    element => {

                        element.textContent =
                            profile.following_count || 0;
                    }
                );


            elements.avatar
                .forEach(
                    element => {

                        if (
                            profile.avatar_url
                        ) {

                            element.src =
                                profile.avatar_url;

                            element.alt =
                                profile.display_name ||
                                "Designer";

                        }

                    }
                );


            elements.website
                .forEach(
                    element => {

                        if (
                            profile.website_url
                        ) {

                            element.href =
                                profile.website_url;

                            element.textContent =
                                profile.website_url;

                        }

                    }
                );


            return profile;
        };


    /* =====================================================
       PROFILE FORM
       ===================================================== */

    const setupProfileForm =
        () => {

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
                            "button[type='submit']"
                        );


                    const originalText =
                        button?.innerHTML;


                    try {

                        if (button) {

                            button.disabled =
                                true;

                            button.innerHTML = `
                                <i class="fa-solid fa-spinner fa-spin"></i>
                                Saving...
                            `;
                        }


                        const profile =
                            await updateProfile({

                                displayName:
                                    $("#displayName")
                                        ?.value || "",

                                username:
                                    $("#username")
                                        ?.value || "",

                                bio:
                                    $("#bio")
                                        ?.value || "",

                                websiteUrl:
                                    $("#websiteUrl")
                                        ?.value || "",

                                location:
                                    $("#location")
                                        ?.value || ""

                            });


                        showProfileMessage(
                            "Profile updated successfully!",
                            "success"
                        );


                        await loadCurrentProfile();


                    } catch (error) {

                        console.error(
                            "Profile form error:",
                            error
                        );


                        showProfileMessage(
                            getErrorMessage(
                                error
                            ),
                            "error"
                        );


                    } finally {

                        if (button) {

                            button.disabled =
                                false;

                            button.innerHTML =
                                originalText ||
                                "Save Changes";
                        }

                    }

                }
            );
        };


    /* =====================================================
       AVATAR FORM
       ===================================================== */

    const setupAvatarUpload =
        () => {

            const input =
                $("#avatarInput");


            const form =
                $("#avatarForm");


            if (!input) {
                return;
            }


            const upload = async (
                file
            ) => {

                try {

                    const result =
                        await uploadAvatar(
                            file
                        );


                    const preview =
                        document.querySelector(
                            "[data-profile='avatar']"
                        );


                    if (preview) {

                        preview.src =
                            result.url;
                    }


                    showProfileMessage(
                        "Profile picture updated!",
                        "success"
                    );


                } catch (error) {

                    console.error(
                        "Avatar error:",
                        error
                    );


                    showProfileMessage(
                        getErrorMessage(
                            error
                        ),
                        "error"
                    );

                }

            };


            input.addEventListener(
                "change",
                event => {

                    const file =
                        event.target.files?.[0];


                    if (file) {
                        upload(file);
                    }

                }
            );


            if (form) {

                form.addEventListener(
                    "submit",
                    event => {

                        event.preventDefault();

                        const file =
                            input.files?.[0];


                        if (file) {
                            upload(file);
                        }

                    }
                );

            }

        };


    /* =====================================================
       ERROR HANDLER
       ===================================================== */

    const getErrorMessage =
        error => {

            if (!error) {

                return "Something went wrong.";
            }


            const message =
                error.message ||
                String(error);


            if (
                message.includes(
                    "duplicate key"
                )
            ) {

                return "That username is already taken.";
            }


            if (
                message.includes(
                    "row-level security"
                )
            ) {

                return "You don't have permission to perform this action.";
            }


            if (
                message.includes(
                    "not found"
                )
            ) {

                return "The requested profile could not be found.";
            }


            return message;
        };


    /* =====================================================
       MESSAGE
       ===================================================== */

    const showProfileMessage =
        (
            message,
            type = "success"
        ) => {

            let container =
                document.querySelector(
                    "[data-profile-message]"
                );


            if (!container) {

                container =
                    document.createElement(
                        "div"
                    );

                container.setAttribute(
                    "data-profile-message",
                    ""
                );

                document.body.prepend(
                    container
                );
            }


            container.textContent =
                message;


            container.className =
                `profile-message ${type}`;


            setTimeout(
                () => {

                    container.classList.add(
                        "hidden"
                    );

                },
                4000
            );

        };


    /* =====================================================
       INITIALIZE
       ===================================================== */

    const init =
        async () => {

            /*
             * Only load the profile when
             * a profile-related page is open.
             */

            const hasProfileElements =
                document.querySelector(
                    "[data-profile], #profileForm, #avatarInput"
                );


            if (!hasProfileElements) {
                return;
            }


            const user =
                await getUser();


            if (!user) {
                return;
            }


            await loadCurrentProfile();

            setupProfileForm();

            setupAvatarUpload();

        };


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        getProfile,

        updateProfile,

        uploadAvatar,

        deleteAvatar,

        getDesigner,

        getDesignerDesigns,

        followUser,

        unfollowUser,

        isFollowing,

        getFollowCounts,

        refreshFollowCounts,

        loadCurrentProfile,

        init

    };

})();


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVProfile.init();

    }
);


/* =========================================================
   GLOBAL ACCESS
   ========================================================= */

window.DVProfile = DVProfile;