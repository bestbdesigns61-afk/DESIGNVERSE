/* =========================================================
   DESIGNVERSE — DESIGNS SYSTEM
   js/designs.js

   Database schema used:

   designs
   ├── id
   ├── designer_id
   ├── title
   ├── description
   ├── category
   ├── image_url
   ├── thumbnail_url
   ├── tags
   ├── views
   ├── likes_count
   ├── votes_count
   ├── is_public
   ├── created_at
   └── updated_at

   IMPORTANT:
   - There is NO image_path column.
   - Storage paths are handled separately from the
     database record.
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

const designQuery = (selector, parent = document) => {

    return parent.querySelector(
        selector
    );
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


    return data?.user || null;
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


    /*
     * Supabase Storage bucket:
     * designs
     *
     * Maximum:
     * 10 MB
     */

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
   TAG NORMALIZATION
   ========================================================= */

const normalizeDesignTags = (
    tags
) => {

    if (!tags) {
        return [];
    }


    if (
        Array.isArray(tags)
    ) {

        return tags
            .map(
                tag =>
                    String(tag)
                        .trim()
                        .toLowerCase()
            )
            .filter(Boolean);

    }


    if (
        typeof tags ===
        "string"
    ) {

        return tags
            .split(",")
            .map(
                tag =>
                    tag
                        .trim()
                        .toLowerCase()
            )
            .filter(Boolean);
    }


    return [];
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
        (
            typeof crypto !==
            "undefined" &&
            typeof crypto.randomUUID ===
            "function"
        )

            ? crypto.randomUUID()

            : `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;


    return (
        `design-${randomPart}.${extension}`
    );
};


/* =========================================================
   CREATE STORAGE PATH
   ========================================================= */

const createDesignStoragePath = (
    userId,
    fileName
) => {

    return (
        `${userId}/${fileName}`
    );
};


/* =========================================================
   GET STORAGE PATH FROM PUBLIC URL
   ========================================================= */

/*
 * Since `designs` does not have an image_path
 * column, we derive the Storage path from
 * the public URL when cleanup is necessary.
 *
 * Expected public URL:
 *
 * .../storage/v1/object/public/designs/USER_UUID/file.webp
 */

const getDesignStoragePathFromUrl = (
    imageUrl
) => {

    if (!imageUrl) {
        return null;
    }


    const marker =
        "/storage/v1/object/public/designs/";


    const index =
        imageUrl.indexOf(
            marker
        );


    if (
        index === -1
    ) {

        return null;
    }


    return decodeURIComponent(
        imageUrl.substring(
            index +
            marker.length
        )
    );
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


    validateDesignFile(
        file
    );


    const fileName =
        createDesignFileName(
            file
        );


    const filePath =
        createDesignStoragePath(
            user.id,
            fileName
        );


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


    if (
        !data?.publicUrl
    ) {

        /*
         * Clean up the uploaded
         * object if a public URL
         * could not be generated.
         */

        try {

            await supabase
                .storage
                .from("designs")
                .remove([
                    filePath
                ]);

        } catch (cleanupError) {

            console.warn(
                "Storage cleanup failed:",
                cleanupError
            );
        }


        throw new Error(
            "Unable to create the design image URL."
        );
    }


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
    category,
    imageUrl,
    thumbnailUrl = null,
    tags = [],
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
        String(
            title || ""
        ).trim();


    description =
        String(
            description || ""
        ).trim();


    category =
        String(
            category || ""
        ).trim();


    const normalizedTags =
        normalizeDesignTags(
            tags
        );


    if (!title) {

        throw new Error(
            "Please enter a design title."
        );
    }


    if (!category) {

        throw new Error(
            "Please select a design category."
        );
    }


    if (!imageUrl) {

        throw new Error(
            "Design image is required."
        );
    }


    /*
     * These are the real columns
     * in the current designs table.
     *
     * Deliberately NOT included:
     *
     * image_path
     */

    const designData = {

        designer_id:
            user.id,

        title,

        description,

        category,

        image_url:
            imageUrl,

        thumbnail_url:
            thumbnailUrl,

        tags:
            normalizedTags,

        is_public:
            Boolean(
                isPublic
            )

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
   PUBLISH DESIGN
   ========================================================= */

const publishDesign = async ({
    file,
    title,
    description = "",
    category,
    tags = [],
    isPublic = true
}) => {

    /*
     * Step 1:
     * Upload image.
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

                thumbnailUrl:
                    null,

                tags,

                isPublic

            });


        return {

            design,

            upload

        };


    } catch (error) {

        /*
         * If database creation fails,
         * remove the uploaded image.
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
                "Uploaded image cleanup failed:",
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


    /*
     * Private designs are available
     * to their owners through the
     * existing designs RLS policy.
     */

    return data;
};


/* =========================================================
   GET PUBLIC DESIGNS
   ========================================================= */

const getPublicDesigns = async ({
    limit = 24,
    offset = 0,
    category = "",
    search = "",
    orderBy = "created_at",
    ascending = false
} = {}) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {
        return [];
    }


    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 24,
                100
            )
        );


    const safeOffset =
        Math.max(
            0,
            Number(offset) || 0
        );


    const allowedOrderColumns = [

        "created_at",

        "views",

        "likes_count",

        "votes_count",

        "title"

    ];


    if (
        !allowedOrderColumns.includes(
            orderBy
        )
    ) {

        orderBy =
            "created_at";
    }


    let query =
        supabase
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
                    avatar_url
                )
            `)
            .eq(
                "is_public",
                true
            )
            .order(
                orderBy,
                {
                    ascending:
                        Boolean(
                            ascending
                        )
                }
            )
            .range(
                safeOffset,
                safeOffset +
                safeLimit -
                1
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
            String(
                search
            )
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


    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 50,
                100
            )
        );


    const safeOffset =
        Math.max(
            0,
            Number(offset) || 0
        );


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
            updated_at
        `)
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
            safeOffset,
            safeOffset +
            safeLimit -
            1
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
    designerId,
    {
        limit = 50,
        offset = 0
    } = {}
) => {

    const supabase =
        getDesignSupabase();


    if (!supabase) {
        return [];
    }


    if (!designerId) {
        return [];
    }


    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 50,
                100
            )
        );


    const safeOffset =
        Math.max(
            0,
            Number(offset) || 0
        );


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
            updated_at
        `)
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
        )
        .range(
            safeOffset,
            safeOffset +
            safeLimit -
            1
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
   INCREMENT DESIGN VIEWS
   ========================================================= */

/*
 * This function does NOT directly update
 * views from the browser.
 *
 * The current RLS policy shown for `designs`
 * only defines owner updates. Therefore we
 * leave view increments for a database
 * function/RPC later rather than bypassing RLS.
 */

const incrementDesignViews = async (
    designId
) => {

    if (!designId) {
        return null;
    }


    /*
     * Placeholder until we create a
     * secure Supabase RPC for view counts.
     */

    console.info(
        "DESIGNVERSE: view increment will be handled by a secure database RPC."
    );


    return null;
};


/* =========================================================
   UPDATE DESIGN
   ========================================================= */

const updateDesign = async (
    designId,
    updates = {}
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

        "thumbnail_url",

        "tags",

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


    if (
        Object.prototype
            .hasOwnProperty
            .call(
                cleanUpdates,
                "tags"
            )
    ) {

        cleanUpdates.tags =
            normalizeDesignTags(
                cleanUpdates.tags
            );
    }


    if (
        Object.keys(
            cleanUpdates
        ).length === 0
    ) {

        throw new Error(
            "No changes were provided."
        );
    }


    cleanUpdates.updated_at =
        new Date()
            .toISOString();


    /*
     * Ownership is enforced by
     * both the query and Supabase RLS.
     */

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

/*
 * There is no image_path column.
 *
 * We therefore:
 *
 * 1. Read the existing image_url.
 * 2. Upload the replacement.
 * 3. Update image_url.
 * 4. Derive the OLD Storage path from image_url.
 * 5. Remove the old Storage object.
 */

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


    if (!designId) {

        throw new Error(
            "Design ID is required."
        );
    }


    validateDesignFile(
        file
    );


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


    const oldImageUrl =
        design.image_url;


    const oldStoragePath =
        getDesignStoragePathFromUrl(
            oldImageUrl
        );


    /*
     * Upload replacement first.
     */

    const upload =
        await uploadDesignImage(
            file
        );


    try {

        /*
         * Update the real image_url
         * column only.
         */

        const {
            data,
            error
        } = await supabase
            .from("designs")
            .update({

                image_url:
                    upload.url,

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
         * Remove the old Storage object
         * after the database update succeeds.
         */

        if (
            oldStoragePath &&
            oldStoragePath !==
                upload.path
        ) {

            const {
                error:
                    storageError
            } = await supabase
                .storage
                .from("designs")
                .remove([
                    oldStoragePath
                ]);


            if (storageError) {

                console.warn(
                    "Old design image cleanup failed:",
                    storageError
                );
            }
        }


        return data;


    } catch (error) {

        /*
         * Database update failed.
         * Remove the newly uploaded object.
         */

        try {

            await supabase
                .storage
                .from("designs")
                .remove([
                    upload.path
                ]);

        } catch (cleanupError) {

            console.warn(
                "Replacement image cleanup failed:",
                cleanupError
            );
        }


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


    if (!designId) {

        throw new Error(
            "Design ID is required."
        );
    }


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


    const storagePath =
        getDesignStoragePathFromUrl(
            design.image_url
        );


    /*
     * Delete database record first.
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
     * Then remove the Storage object.
     */

    if (storagePath) {

        const {
            error:
                storageError
        } = await supabase
            .storage
            .from("designs")
            .remove([
                storagePath
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
   FORMAT CATEGORY
   ========================================================= */

const formatDesignCategory = (
    category
) => {

    if (!category) {
        return "Design";
    }


    return String(
        category
    )
        .replace(
            /[-_]+/g,
            " "
        )
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );
};


/* =========================================================
   RENDER DESIGN CARD
   ========================================================= */

const renderDesignCard = (
    design,
    container
) => {

    if (!container) {
        return null;
    }


    if (!design) {
        return null;
    }


    const designer =
        design.profiles ||
        {};


    const card =
        document.createElement(
            "article"
        );


    card.className =
        "design-card";


    card.dataset.designId =
        design.id;


    const designUrl =
        `/design?id=${encodeURIComponent(
            design.id
        )}`;


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
            designer.username ||
            "Designer"
        );


    const username =
        designer.username
            ? `@${escapeDesignHtml(
                designer.username
            )}`
            : "";


    const imageUrl =
        design.thumbnail_url ||
        design.image_url ||
        "";


    const safeImageUrl =
        escapeDesignAttribute(
            imageUrl
        );


    const safeTitle =
        escapeDesignAttribute(
            design.title ||
            "Design"
        );


    const avatarHtml =
        designer.avatar_url

            ? `
                <img
                    src="${escapeDesignAttribute(
                        designer.avatar_url
                    )}"
                    alt="${displayName}"
                    class="design-card-avatar"
                    loading="lazy"
                >
            `

            : `
                <div
                    class="design-card-avatar-placeholder"
                    aria-hidden="true"
                >

                    <i
                        class="fa-solid fa-user"
                    ></i>

                </div>
            `;


    card.innerHTML = `

        <a
            class="design-card-image"
            href="${designUrl}"
            aria-label="View ${safeTitle}"
        >

            <img
                src="${safeImageUrl}"
                alt="${safeTitle}"
                loading="lazy"
            >

        </a>


        <div
            class="design-card-content"
        >

            <h3
                class="design-card-title"
            >

                <a
                    href="${designUrl}"
                >

                    ${title}

                </a>

            </h3>


            ${
                description
                    ? `
                        <p
                            class="design-card-description"
                        >
                            ${description}
                        </p>
                    `
                    : ""
            }


            <div
                class="design-card-designer"
            >

                ${avatarHtml}


                <div
                    class="design-card-designer-info"
                >

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


            <div
                class="design-card-stats"
            >

                ${
                    Number(
                        design.likes_count
                    ) > 0

                        ? `
                            <span>
                                <i class="fa-regular fa-heart"></i>
                                ${escapeDesignHtml(
                                    formatDesignNumber(
                                        design.likes_count
                                    )
                                )}
                            </span>
                        `
                        : ""
                }


                ${
                    Number(
                        design.votes_count
                    ) > 0

                        ? `
                            <span>
                                <i class="fa-solid fa-trophy"></i>
                                ${escapeDesignHtml(
                                    formatDesignNumber(
                                        design.votes_count
                                    )
                                )}
                            </span>
                        `
                        : ""
                }

            </div>

        </div>

    `;


    container.appendChild(
        card
    );


    return card;
};


/* =========================================================
   FORMAT NUMBERS
   ========================================================= */

const formatDesignNumber = (
    value
) => {

    const number =
        Number(value) || 0;


    if (
        number >= 1000000
    ) {

        return (
            `${(
                number / 1000000
            ).toFixed(
                number % 1000000 ===
                0
                    ? 0
                    : 1
            )}M`
        );
    }


    if (
        number >= 1000
    ) {

        return (
            `${(
                number / 1000
            ).toFixed(
                number % 1000 ===
                0
                    ? 0
                    : 1
            )}K`
        );
    }


    return String(
        number
    );
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
    selector =
        "[data-design-grid]",

    limit = 24,

    offset = 0,

    category = "",

    search = "",

    orderBy =
        "created_at",

    ascending =
        false,

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
            <div
                class="design-loading"
            >

                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

                <span>
                    Loading designs...
                </span>

            </div>
        `;
    }


    try {

        const designs =
            await getPublicDesigns({

                limit,

                offset,

                category,

                search,

                orderBy,

                ascending

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
                    <div
                        class="design-empty"
                    >

                        <i
                            class="fa-regular fa-image"
                        ></i>


                        <h3>
                            No designs found
                        </h3>


                        <p>
                            Be the first designer
                            to showcase your work.
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


    } catch (error) {

        console.error(
            "Load design grid error:",
            error
        );


        if (!append) {

            container.innerHTML = `
                <div
                    class="design-empty"
                >

                    <i
                        class="fa-solid fa-triangle-exclamation"
                    ></i>


                    <h3>
                        Unable to load designs
                    </h3>


                    <p>
                        Please try again later.
                    </p>

                </div>
            `;
        }


        return [];
    }
};


/* =========================================================
   DESIGN UPLOAD FORM
   ========================================================= */

const setupDesignUploadForm = () => {

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


    let previewUrl =
        null;


    /* -----------------------------------------------------
       FILE PREVIEW
       ----------------------------------------------------- */

    if (fileInput) {

        fileInput.addEventListener(
            "change",
            () => {

                const file =
                    fileInput.files?.[0];


                if (!file) {

                    if (preview) {

                        preview.classList.add(
                            "hidden"
                        );
                    }

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

                        if (previewUrl) {

                            URL.revokeObjectURL(
                                previewUrl
                            );
                        }


                        previewUrl =
                            URL.createObjectURL(
                                file
                            );


                        previewImage.src =
                            previewUrl;


                        preview.classList.remove(
                            "hidden"
                        );
                    }


                } catch (error) {

                    fileInput.value =
                        "";


                    if (preview) {

                        preview.classList.add(
                            "hidden"
                        );
                    }


                    showDesignMessage(
                        error.message,
                        "error"
                    );
                }

            }
        );
    }


    /* -----------------------------------------------------
       SUBMIT
       ----------------------------------------------------- */

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


            const tagsInput =
                form.querySelector(
                    "#designTags"
                )?.value || "";


            const tags =
                normalizeDesignTags(
                    tagsInput
                );


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
                        <i
                            class="fa-solid fa-spinner fa-spin"
                        ></i>

                        Publishing...
                    `;
                }


                const result =
                    await publishDesign({

                        file,

                        title,

                        description,

                        category,

                        tags,

                        isPublic

                    });


                showDesignMessage(
                    "Your design has been published successfully! 🎨",
                    "success"
                );


                form.reset();


                if (preview) {

                    preview.classList.add(
                        "hidden"
                    );
                }


                if (previewUrl) {

                    URL.revokeObjectURL(
                        previewUrl
                    );


                    previewUrl =
                        null;
                }


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


        element.className =
            "design-message";


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
   ERROR HANDLER
   ========================================================= */

const getDesignErrorMessage = (
    error
) => {

    if (!error) {

        return (
            "Something went wrong."
        );
    }


    const message =
        String(
            error.message ||
            error
        );


    const lowerMessage =
        message.toLowerCase();


    if (
        lowerMessage.includes(
            "row-level security"
        ) ||
        lowerMessage.includes(
            "violates row-level security policy"
        )
    ) {

        return (
            "You don't have permission to perform this action."
        );
    }


    if (
        lowerMessage.includes(
            "duplicate"
        ) ||
        lowerMessage.includes(
            "unique"
        )
    ) {

        return (
            "This design already exists."
        );
    }


    if (
        lowerMessage.includes(
            "payload too large"
        ) ||
        lowerMessage.includes(
            "maximum allowed size"
        ) ||
        lowerMessage.includes(
            "file size"
        )
    ) {

        return (
            "The image is too large."
        );
    }


    if (
        lowerMessage.includes(
            "invalid input"
        )
    ) {

        return (
            "Some of the design information is invalid."
        );
    }


    if (
        lowerMessage.includes(
            "jwt"
        ) ||
        lowerMessage.includes(
            "not authenticated"
        )
    ) {

        return (
            "Your session has expired. Please log in again."
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

    incrementDesignViews,

    renderDesignCard,

    loadDesignGrid,

    validateDesignFile,

    normalizeDesignTags,

    getDesignStoragePathFromUrl,

    formatDesignCategory,

    formatDesignNumber,

    showDesignMessage,

    getDesignErrorMessage

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