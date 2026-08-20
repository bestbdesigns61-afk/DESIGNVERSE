/* =========================================================
   DESIGNVERSE — DESIGNS SYSTEM
   js/designs.js
   ========================================================= */

"use strict";


/* =========================================================
   SUPABASE
   ========================================================= */

const getDesignSupabase = () => {

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

const designQuery = (selector) => {
    return document.querySelector(selector);
};


const getDesignUser = async () => {

    const supabase =
        getDesignSupabase();

    if (!supabase) {
        return null;
    }

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {

        console.error(
            "DESIGNVERSE user error:",
            error
        );

        return null;
    }

    return data.user || null;
};


/* =========================================================
   FILE VALIDATION
   ========================================================= */

const validateDesignFile = (file) => {

    if (!file) {

        throw new Error(
            "Please select a design image."
        );
    }


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


    const maxSize =
        10 * 1024 * 1024;


    if (
        file.size >
        maxSize
    ) {

        throw new Error(
            "Your design must be smaller than 10 MB."
        );
    }


    return true;
};


/* =========================================================
   CREATE SAFE FILE NAME
   ========================================================= */

const createDesignFileName = (
    file
) => {

    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const randomPart =
        crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;


    return `design-${randomPart}.${extension}`;
};


/* =========================================================
   UPLOAD DESIGN IMAGE
   ========================================================= */

const uploadDesignImage = async (
    file
) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    const user =
        await getDesignUser();


    if (!user) {

        throw new Error(
            "Please log in before uploading a design."
        );
    }


    validateDesignFile(file);


    const fileName =
        createDesignFileName(
            file
        );


    /*
     * Storage structure:
     *
     * designs/
     *   USER_UUID/
     *       design-xxxxx.webp
     */

    const filePath =
        `${user.id}/${fileName}`;


    const {
        error
    } = await supabase
        .storage
        .from("designs")
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
            "Design upload error:",
            error
        );

        throw error;
    }


    const {
        data
    } = supabase
        .storage
        .from("designs")
        .getPublicUrl(
            filePath
        );


    return {

        path:
            filePath,

        url:
            data.publicUrl

    };
};


/* =========================================================
   CREATE DESIGN RECORD
   ========================================================= */

const createDesign = async ({
    title,
    description = "",
    category = "",
    imageUrl,
    imagePath = "",
    isPublic = true
}) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    const user =
        await getDesignUser();


    if (!user) {

        throw new Error(
            "Please log in first."
        );
    }


    title =
        String(title || "")
            .trim();


    description =
        String(description || "")
            .trim();


    category =
        String(category || "")
            .trim();


    if (!title) {

        throw new Error(
            "Please enter a design title."
        );
    }


    if (!imageUrl) {

        throw new Error(
            "Design image is required."
        );
    }


    /*
     * IMPORTANT:
     *
     * We use the authenticated user's
     * ID from Supabase Auth.
     *
     * Never accept designer_id
     * directly from the frontend.
     */

    const designData = {

        designer_id:
            user.id,

        title,

        description,

        category,

        image_url:
            imageUrl,

        image_path:
            imagePath,

        is_public:
            Boolean(isPublic)

    };


    const {
        data,
        error
    } = await supabase
        .from("designs")
        .insert(
            designData
        )
        .select()
        .single();


    if (error) {

        console.error(
            "Create design error:",
            error
        );

        throw error;
    }


    return data;
};


/* =========================================================
   UPLOAD + CREATE DESIGN
   ========================================================= */

const publishDesign = async ({
    file,
    title,
    description = "",
    category = "",
    isPublic = true
}) => {

    /*
     * Step 1:
     * Upload image to Storage.
     */

    const upload =
        await uploadDesignImage(
            file
        );


    try {

        /*
         * Step 2:
         * Create database record.
         */

        const design =
            await createDesign({

                title,

                description,

                category,

                imageUrl:
                    upload.url,

                imagePath:
                    upload.path,

                isPublic

            });


        return {

            design,

            upload

        };


    } catch (error) {

        /*
         * If database creation fails
         * after the image was uploaded,
         * remove the orphaned image.
         */

        try {

            const supabase =
                getDesignSupabase();


            await supabase
                .storage
                .from("designs")
                .remove([
                    upload.path
                ]);

        } catch (cleanupError) {

            console.error(
                "Storage cleanup error:",
                cleanupError
            );
        }


        throw error;
    }
};


/* =========================================================
   GET SINGLE DESIGN
   ========================================================= */

const getDesign = async (
    designId
) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {
        return null;
    }


    if (!designId) {
        return null;
    }


    const {
        data,
        error
    } = await supabase
        .from("designs")
        .select(`
            *,
            profiles:designer_id (
                id,
                username,
                display_name,
                avatar_url
            )
        `)
        .eq(
            "id",
            designId
        )
        .single();


    if (error) {

        console.error(
            "Get design error:",
            error
        );

        return null;
    }


    return data;
};


/* =========================================================
   GET PUBLIC DESIGNS
   ========================================================= */

const getPublicDesigns = async ({
    limit = 24,
    offset = 0,
    category = "",
    search = ""
} = {}) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {
        return [];
    }


    let query =
        supabase
            .from("designs")
            .select(`
                *,
                profiles:designer_id (
                    id,
                    username,
                    display_name,
                    avatar_url
                )
            `)
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
            )
            .range(
                offset,
                offset + limit - 1
            );


    if (category) {

        query =
            query.eq(
                "category",
                category
            );
    }


    if (search) {

        const safeSearch =
            search
                .trim()
                .replace(
                    /[%_]/g,
                    ""
                );


        if (safeSearch) {

            query =
                query.or(
                    `title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`
                );
        }
    }


    const {
        data,
        error
    } = await query;


    if (error) {

        console.error(
            "Public designs error:",
            error
        );

        return [];
    }


    return data || [];
};


/* =========================================================
   GET CURRENT USER DESIGNS
   ========================================================= */

const getMyDesigns = async ({
    limit = 50,
    offset = 0
} = {}) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {
        return [];
    }


    const user =
        await getDesignUser();


    if (!user) {
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
            user.id
        )
        .order(
            "created_at",
            {
                ascending:
                    false
            }
        )
        .range(
            offset,
            offset + limit - 1
        );


    if (error) {

        console.error(
            "My designs error:",
            error
        );

        return [];
    }


    return data || [];
};


/* =========================================================
   GET DESIGNS BY DESIGNER
   ========================================================= */

const getDesignsByDesigner = async (
    designerId
) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {
        return [];
    }


    if (!designerId) {
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
            designerId
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


/* =========================================================
   UPDATE DESIGN
   ========================================================= */

const updateDesign = async (
    designId,
    updates
) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    const user =
        await getDesignUser();


    if (!user) {

        throw new Error(
            "Please log in first."
        );
    }


    if (!designId) {

        throw new Error(
            "Design ID is required."
        );
    }


    const allowedFields = [
        "title",
        "description",
        "category",
        "is_public"
    ];


    const cleanUpdates = {};


    allowedFields.forEach(
        field => {

            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        updates,
                        field
                    )
            ) {

                cleanUpdates[field] =
                    updates[field];
            }

        }
    );


    if (
        typeof cleanUpdates.title ===
        "string"
    ) {

        cleanUpdates.title =
            cleanUpdates.title
                .trim();
    }


    if (
        typeof cleanUpdates.description ===
        "string"
    ) {

        cleanUpdates.description =
            cleanUpdates.description
                .trim();
    }


    if (
        typeof cleanUpdates.category ===
        "string"
    ) {

        cleanUpdates.category =
            cleanUpdates.category
                .trim();
    }


    cleanUpdates.updated_at =
        new Date().toISOString();


    const {
        data,
        error
    } = await supabase
        .from("designs")
        .update(
            cleanUpdates
        )
        .eq(
            "id",
            designId
        )
        .eq(
            "designer_id",
            user.id
        )
        .select()
        .single();


    if (error) {

        console.error(
            "Update design error:",
            error
        );

        throw error;
    }


    return data;
};


/* =========================================================
   REPLACE DESIGN IMAGE
   ========================================================= */

const replaceDesignImage = async (
    designId,
    file
) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    const user =
        await getDesignUser();


    if (!user) {

        throw new Error(
            "Please log in first."
        );
    }


    validateDesignFile(
        file
    );


    /*
     * Get existing design.
     */

    const design =
        await getDesign(
            designId
        );


    if (!design) {

        throw new Error(
            "Design not found."
        );
    }


    if (
        design.designer_id !==
        user.id
    ) {

        throw new Error(
            "You can only edit your own designs."
        );
    }


    /*
     * Upload new image.
     */

    const upload =
        await uploadDesignImage(
            file
        );


    try {

        /*
         * Update database.
         */

        const {
            data,
            error
        } = await supabase
            .from("designs")
            .update({

                image_url:
                    upload.url,

                image_path:
                    upload.path,

                updated_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                designId
            )
            .eq(
                "designer_id",
                user.id
            )
            .select()
            .single();


        if (error) {
            throw error;
        }


        /*
         * Delete old image.
         */

        if (
            design.image_path
        ) {

            await supabase
                .storage
                .from("designs")
                .remove([
                    design.image_path
                ]);
        }


        return data;


    } catch (error) {

        /*
         * Cleanup new image if
         * database update failed.
         */

        await supabase
            .storage
            .from("designs")
            .remove([
                upload.path
            ]);


        throw error;
    }
};


/* =========================================================
   DELETE DESIGN
   ========================================================= */

const deleteDesign = async (
    designId
) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {

        throw new Error(
            "Supabase is unavailable."
        );
    }


    const user =
        await getDesignUser();


    if (!user) {

        throw new Error(
            "Please log in first."
        );
    }


    /*
     * Get design first so we know
     * which Storage file to remove.
     */

    const design =
        await getDesign(
            designId
        );


    if (!design) {

        throw new Error(
            "Design not found."
        );
    }


    if (
        design.designer_id !==
        user.id
    ) {

        throw new Error(
            "You can only delete your own designs."
        );
    }


    /*
     * Delete database record.
     */

    const {
        error
    } = await supabase
        .from("designs")
        .delete()
        .eq(
            "id",
            designId
        )
        .eq(
            "designer_id",
            user.id
        );


    if (error) {

        console.error(
            "Delete design error:",
            error
        );

        throw error;
    }


    /*
     * Delete Storage file.
     */

    if (
        design.image_path
    ) {

        const {
            error:
                storageError
        } = await supabase
            .storage
            .from("designs")
            .remove([
                design.image_path
            ]);


        if (storageError) {

            console.warn(
                "Design database record deleted, but Storage cleanup failed:",
                storageError
            );
        }
    }


    return true;
};


/* =========================================================
   RENDER DESIGN CARD
   ========================================================= */

const renderDesignCard = (
    design,
    container
) => {

    if (!container) {
        return;
    }


    const designer =
        design.profiles || {};


    const card =
        document.createElement(
            "article"
        );


    card.className =
        "design-card";


    card.dataset.designId =
        design.id;


    const title =
        escapeDesignHtml(
            design.title ||
            "Untitled Design"
        );


    const description =
        escapeDesignHtml(
            design.description ||
            ""
        );


    const displayName =
        escapeDesignHtml(
            designer.display_name ||
            "Designer"
        );


    const username =
        designer.username
            ? `@${escapeDesignHtml(
                designer.username
            )}`
            : "";


    card.innerHTML = `

        <a
            class="design-card-image"
            href="design.html?id=${encodeURIComponent(
                design.id
            )}"
        >

            <img
                src="${escapeDesignAttribute(
                    design.image_url
                )}"
                alt="${escapeDesignAttribute(
                    design.title ||
                    "Design"
                )}"
                loading="lazy"
            >

        </a>


        <div class="design-card-content">

            <h3 class="design-card-title">
                ${title}
            </h3>


            ${
                description
                    ? `
                    <p class="design-card-description">
                        ${description}
                    </p>
                    `
                    : ""
            }


            <div class="design-card-designer">

                ${
                    designer.avatar_url
                        ? `
                        <img
                            src="${escapeDesignAttribute(
                                designer.avatar_url
                            )}"
                            alt="${displayName}"
                            class="design-card-avatar"
                        >
                        `
                        : `
                        <div class="design-card-avatar-placeholder">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        `
                }


                <div>

                    <span>
                        ${displayName}
                    </span>

                    ${
                        username
                            ? `
                            <small>
                                ${username}
                            </small>
                            `
                            : ""
                    }

                </div>

            </div>

        </div>
    `;


    container.appendChild(
        card
    );


    return card;
};


/* =========================================================
   ESCAPE HTML
   ========================================================= */

const escapeDesignHtml = (
    value
) => {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
};


/* =========================================================
   ESCAPE ATTRIBUTE
   ========================================================= */

const escapeDesignAttribute = (
    value
) => {

    return escapeDesignHtml(
        value
    );
};


/* =========================================================
   LOAD DESIGN GRID
   ========================================================= */

const loadDesignGrid = async ({
    selector = "[data-design-grid]",
    limit = 24,
    category = "",
    search = "",
    append = false
} = {}) => {

    const container =
        document.querySelector(
            selector
        );


    if (!container) {
        return [];
    }


    if (!append) {

        container.innerHTML = `
            <div class="design-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Loading designs...</span>
            </div>
        `;
    }


    const designs =
        await getPublicDesigns({

            limit,

            category,

            search

        });


    if (!append) {

        container.innerHTML = "";
    }


    if (
        designs.length ===
        0
    ) {

        if (!append) {

            container.innerHTML = `
                <div class="design-empty">
                    <i class="fa-regular fa-image"></i>

                    <h3>
                        No designs found
                    </h3>

                    <p>
                        Be the first designer to showcase your work.
                    </p>
                </div>
            `;

        }

        return [];
    }


    designs.forEach(
        design => {

            renderDesignCard(
                design,
                container
            );

        }
    );


    return designs;
};


/* =========================================================
   DESIGN UPLOAD FORM
   ========================================================= */

const setupDesignUploadForm =
    () => {

        const form =
            document.querySelector(
                "#designUploadForm"
            );


        if (!form) {
            return;
        }


        const fileInput =
            form.querySelector(
                "#designFile"
            );


        const preview =
            form.querySelector(
                "[data-design-preview]"
            );


        const previewImage =
            form.querySelector(
                "[data-design-preview-image]"
            );


        /*
         * File preview
         */

        if (fileInput) {

            fileInput.addEventListener(
                "change",
                () => {

                    const file =
                        fileInput.files?.[0];


                    if (!file) {
                        return;
                    }


                    try {

                        validateDesignFile(
                            file
                        );


                        if (
                            preview &&
                            previewImage
                        ) {

                            const url =
                                URL.createObjectURL(
                                    file
                                );


                            previewImage.src =
                                url;


                            preview.classList.remove(
                                "hidden"
                            );
                        }


                    } catch (error) {

                        fileInput.value =
                            "";


                        showDesignMessage(
                            error.message,
                            "error"
                        );

                    }

                }
            );
        }


        /*
         * Submit
         */

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const button =
                    form.querySelector(
                        "button[type='submit']"
                    );


                const file =
                    fileInput?.files?.[0];


                const title =
                    form.querySelector(
                        "#designTitle"
                    )?.value || "";


                const description =
                    form.querySelector(
                        "#designDescription"
                    )?.value || "";


                const category =
                    form.querySelector(
                        "#designCategory"
                    )?.value || "";


                const isPublic =
                    form.querySelector(
                        "#designPublic"
                    )?.checked ??
                    true;


                try {

                    validateDesignFile(
                        file
                    );


                    if (button) {

                        button.disabled =
                            true;

                        button.dataset
                            .originalText =
                            button.innerHTML;

                        button.innerHTML = `
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            Publishing...
                        `;
                    }


                    const result =
                        await publishDesign({

                            file,

                            title,

                            description,

                            category,

                            isPublic

                        });


                    showDesignMessage(
                        "Your design has been published successfully! 🎨",
                        "success"
                    );


                    form.reset();


                    if (
                        preview
                    ) {

                        preview.classList.add(
                            "hidden"
                        );
                    }


                    /*
                     * Allow dashboard/grid
                     * to refresh itself.
                     */

                    document.dispatchEvent(
                        new CustomEvent(
                            "designverse:design-created",
                            {
                                detail:
                                    result.design
                            }
                        )
                    );


                } catch (error) {

                    console.error(
                        "Publish design error:",
                        error
                    );


                    showDesignMessage(
                        getDesignErrorMessage(
                            error
                        ),
                        "error"
                    );


                } finally {

                    if (button) {

                        button.disabled =
                            false;

                        button.innerHTML =
                            button.dataset
                                .originalText ||
                            "Publish Design";
                    }

                }

            }
        );
    };


/* =========================================================
   DESIGN MESSAGE
   ========================================================= */

const showDesignMessage = (
    message,
    type = "success"
) => {

    let element =
        document.querySelector(
            "[data-design-message]"
        );


    if (!element) {

        element =
            document.createElement(
                "div"
            );

        element.setAttribute(
            "data-design-message",
            ""
        );

        document.body.prepend(
            element
        );
    }


    element.textContent =
        message;


    element.className =
        `design-message ${type}`;


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
            5000
        );
};


/* =========================================================
   DESIGN ERROR HANDLER
   ========================================================= */

const getDesignErrorMessage = (
    error
) => {

    if (!error) {

        return "Something went wrong.";
    }


    const message =
        error.message ||
        String(error);


    if (
        message
            .toLowerCase()
            .includes(
                "row-level security"
            )
    ) {

        return (
            "You don't have permission to perform this action."
        );
    }


    if (
        message
            .toLowerCase()
            .includes(
                "duplicate"
            )
    ) {

        return (
            "This design already exists."
        );
    }


    if (
        message
            .toLowerCase()
            .includes(
                "payload too large"
            )
    ) {

        return (
            "The image is too large."
        );
    }


    return message;
};


/* =========================================================
   INITIALIZE
   ========================================================= */

const initDesigns = () => {

    setupDesignUploadForm();

};


/* =========================================================
   PUBLIC API
   ========================================================= */

window.DVDesigns = {

    uploadDesignImage,

    createDesign,

    publishDesign,

    getDesign,

    getPublicDesigns,

    getMyDesigns,

    getDesignsByDesigner,

    updateDesign,

    replaceDesignImage,

    deleteDesign,

    renderDesignCard,

    loadDesignGrid,

    validateDesignFile,

    showDesignMessage

};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initDesigns();

    }
);