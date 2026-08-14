/* =========================================================
   DESIGNVERSE — DESIGNS SYSTEM
   js/designs.js

   Handles:
   - Loading user's designs
   - Uploading designs
   - Supabase Storage
   - Creating database records
   - Searching
   - Filtering
   - Deleting designs
   - Design statistics
   - Submit form
   ========================================================= */

"use strict";


/* =========================================================
   DESIGNVERSE DESIGNS
   ========================================================= */

const DVDesigns = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        designs: [],

        filteredDesigns: [],

        userId: null,

        search: "",

        category: "all",

        initialized: false,

        submitting: false

    };


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (!window.supabaseClient) {

            console.error(
                "DESIGNVERSE: Supabase client not available."
            );

            return null;
        }


        return window.supabaseClient;
    }


    /* =====================================================
       DOM HELPERS
       ===================================================== */

    function $(selector) {

        return document.querySelector(
            selector
        );
    }


    function $$(selector) {

        return [
            ...document.querySelectorAll(
                selector
            )
        ];
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

            console.error(
                "DESIGNVERSE user error:",
                error
            );

            return null;
        }


        return data.user || null;
    }


    /* =====================================================
       LOAD USER DESIGNS
       ===================================================== */

    async function loadDesigns() {

        const supabase =
            getSupabase();


        if (!supabase) {

            showError(
                "Unable to connect to DESIGNVERSE."
            );

            return [];
        }


        const user =
            await getCurrentUser();


        if (!user) {

            return [];
        }


        state.userId =
            user.id;


        showLoading();


        const {
            data,
            error
        } =
            await supabase
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
                        ascending: false
                    }
                );


        if (error) {

            console.error(
                "DESIGNVERSE designs load error:",
                error
            );


            hideLoading();


            showError(
                getDesignErrorMessage(
                    error
                )
            );


            return [];
        }


        state.designs =
            data || [];


        state.filteredDesigns =
            [...state.designs];


        hideLoading();

        updateStats();

        renderDesigns();


        return state.designs;
    }


    /* =====================================================
       STATISTICS
       ===================================================== */

    function updateStats() {

        const totalDesigns =
            state.designs.length;


        const totalViews =
            state.designs.reduce(
                (
                    total,
                    design
                ) => {

                    return (
                        total +
                        Number(
                            design.views || 0
                        )
                    );

                },
                0
            );


        const totalLikes =
            state.designs.reduce(
                (
                    total,
                    design
                ) => {

                    return (
                        total +
                        Number(
                            design.likes_count || 0
                        )
                    );

                },
                0
            );


        const totalVotes =
            state.designs.reduce(
                (
                    total,
                    design
                ) => {

                    return (
                        total +
                        Number(
                            design.votes_count || 0
                        )
                    );

                },
                0
            );


        setText(
            "#totalDesigns",
            formatNumber(
                totalDesigns
            )
        );


        setText(
            "#totalViews",
            formatCompactNumber(
                totalViews
            )
        );


        setText(
            "#totalLikes",
            formatCompactNumber(
                totalLikes
            )
        );


        setText(
            "#totalVotes",
            formatCompactNumber(
                totalVotes
            )
        );
    }


    /* =====================================================
       RENDER DESIGNS
       ===================================================== */

    function renderDesigns() {

        const grid =
            $("#designsGrid");


        if (!grid) {
            return;
        }


        grid.innerHTML = "";


        if (
            state.filteredDesigns.length ===
            0
        ) {

            grid.hidden = true;

            showEmptyState();

            return;
        }


        hideEmptyState();


        state.filteredDesigns
            .forEach(
                design => {

                    grid.appendChild(
                        createDesignCard(
                            design
                        )
                    );

                }
            );


        grid.hidden =
            false;
    }


    /* =====================================================
       DESIGN CARD
       ===================================================== */

    function createDesignCard(
        design
    ) {

        const article =
            document.createElement(
                "article"
            );


        article.className =
            "user-design-card";


        article.dataset.designCard =
            "";


        article.dataset.designId =
            design.id;


        article.dataset.category =
            design.category ||
            "other";


        article.dataset.title =
            design.title ||
            "";


        const imageSource =
            design.thumbnail_url ||
            design.image_url;


        const categoryLabel =
            formatCategory(
                design.category
            );


        const visibility =
            design.is_public
                ? "Public"
                : "Private";


        const visibilityIcon =
            design.is_public
                ? "fa-globe"
                : "fa-lock";


        const imageMarkup =
            imageSource

                ? `
                    <img
                        src="${escapeAttribute(
                            imageSource
                        )}"
                        alt="${escapeAttribute(
                            design.title ||
                            "Design"
                        )}"
                        loading="lazy"
                    >
                `

                : createPlaceholder(
                    design
                );


        article.innerHTML = `

            <div class="user-design-image">

                ${imageMarkup}

                <div class="user-design-overlay">

                    <div class="design-overlay-actions">

                        <button
                            type="button"
                            class="design-overlay-button"
                            data-design-view
                            aria-label="View design"
                            title="View design"
                        >
                            <i class="fa-solid fa-eye"></i>
                        </button>


                        <button
                            type="button"
                            class="design-overlay-button"
                            data-design-edit
                            aria-label="Edit design"
                            title="Edit design"
                        >
                            <i class="fa-solid fa-pen"></i>
                        </button>


                        <button
                            type="button"
                            class="design-overlay-button"
                            data-design-delete
                            aria-label="Delete design"
                            title="Delete design"
                        >
                            <i class="fa-solid fa-trash"></i>
                        </button>

                    </div>

                </div>

            </div>


            <div class="user-design-body">

                <div class="user-design-title-row">

                    <h2 class="user-design-title">
                        ${escapeHTML(
                            design.title ||
                            "Untitled Design"
                        )}
                    </h2>


                    <span class="design-visibility">

                        <i
                            class="fa-solid ${visibilityIcon}"
                        ></i>

                        ${visibility}

                    </span>

                </div>


                <div class="user-design-meta">

                    <div class="user-design-meta-left">

                        <span>

                            <i
                                class="fa-regular fa-eye"
                            ></i>

                            ${formatCompactNumber(
                                design.views || 0
                            )}

                        </span>


                        <span>

                            <i
                                class="fa-regular fa-heart"
                            ></i>

                            ${formatCompactNumber(
                                design.likes_count || 0
                            )}

                        </span>


                        <span>

                            <i
                                class="fa-solid fa-bolt"
                            ></i>

                            ${formatCompactNumber(
                                design.votes_count || 0
                            )}

                        </span>

                    </div>


                    <span>

                        ${escapeHTML(
                            categoryLabel
                        )}

                    </span>

                </div>

            </div>

        `;


        const viewButton =
            article.querySelector(
                "[data-design-view]"
            );


        viewButton?.addEventListener(
            "click",
            () => {

                openDesign(
                    design
                );

            }
        );


        const editButton =
            article.querySelector(
                "[data-design-edit]"
            );


        editButton?.addEventListener(
            "click",
            () => {

                editDesign(
                    design
                );

            }
        );


        const deleteButton =
            article.querySelector(
                "[data-design-delete]"
            );


        deleteButton?.addEventListener(
            "click",
            async () => {

                await handleDelete(
                    design,
                    deleteButton,
                    article
                );

            }
        );


        return article;
    }


    /* =====================================================
       IMAGE PLACEHOLDER
       ===================================================== */

    function createPlaceholder(
        design
    ) {

        const variations = {

            branding: "blue",

            poster: "",

            "ui-ux": "pink",

            illustration: "orange",

            logo: "blue",

            motion: "pink",

            other: ""

        };


        const variation =
            variations[
                design.category
            ] || "";


        return `

            <div
                class="design-placeholder ${variation}"
            >

                <span>
                    DESIGNVERSE
                </span>

                <strong>
                    ${escapeHTML(
                        truncateTitle(
                            design.title ||
                            "DESIGN",
                            18
                        )
                    )}
                </strong>

            </div>

        `;
    }


    /* =====================================================
       SEARCH
       ===================================================== */

    function searchDesigns(
        query
    ) {

        state.search =
            String(
                query || ""
            )
            .trim()
            .toLowerCase();


        applyFilters();
    }


    /* =====================================================
       CATEGORY FILTER
       ===================================================== */

    function filterByCategory(
        category
    ) {

        state.category =
            category ||
            "all";


        applyFilters();
    }


    /* =====================================================
       APPLY FILTERS
       ===================================================== */

    function applyFilters() {

        state.filteredDesigns =
            state.designs.filter(
                design => {

                    const title =
                        String(
                            design.title ||
                            ""
                        )
                        .toLowerCase();


                    const description =
                        String(
                            design.description ||
                            ""
                        )
                        .toLowerCase();


                    const tags =
                        Array.isArray(
                            design.tags
                        )
                            ? design.tags
                            : [];


                    const tagText =
                        tags
                            .join(" ")
                            .toLowerCase();


                    const matchesSearch =
                        !state.search ||
                        title.includes(
                            state.search
                        ) ||
                        description.includes(
                            state.search
                        ) ||
                        tagText.includes(
                            state.search
                        );


                    const matchesCategory =
                        state.category ===
                            "all" ||
                        design.category ===
                            state.category;


                    return (
                        matchesSearch &&
                        matchesCategory
                    );

                }
            );


        renderDesigns();
    }


    /* =====================================================
       UPLOAD VALIDATION
       ===================================================== */

    function validateDesignFile(
        file
    ) {

        const allowedTypes = [

            "image/jpeg",

            "image/png",

            "image/webp",

            "image/gif"

        ];


        const maxSize =
            10 *
            1024 *
            1024;


        if (!file) {

            return {

                valid: false,

                message:
                    "Please select an image."

            };
        }


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            return {

                valid: false,

                message:
                    "Please upload a JPG, PNG, WEBP or GIF image."

            };
        }


        if (
            file.size >
            maxSize
        ) {

            return {

                valid: false,

                message:
                    "Your design must be smaller than 10 MB."

            };
        }


        return {

            valid: true,

            message: ""

        };
    }


    /* =====================================================
       GENERATE STORAGE PATH
       ===================================================== */

    function generateDesignPath(
        userId,
        file
    ) {

        const originalName =
            file.name
                .split(".")
                .shift()
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                );


        const extension =
            getFileExtension(
                file
            );


        const uniqueId =
            generateId();


        const safeName =
            originalName ||
            "design";


        /*
         * IMPORTANT:
         *
         * The first folder is USER UUID.
         * This matches our Storage RLS policy.
         *
         * designs/
         *     USER_UUID/
         *         unique-file.webp
         */

        return (
            `${userId}/` +
            `${Date.now()}-` +
            `${uniqueId}-` +
            `${safeName}.` +
            `${extension}`
        );
    }


    /* =====================================================
       UPLOAD FILE TO STORAGE
       ===================================================== */

    async function uploadDesignFile(
        file
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in before uploading a design."
            );
        }


        const validation =
            validateDesignFile(
                file
            );


        if (!validation.valid) {

            throw new Error(
                validation.message
            );
        }


        const filePath =
            generateDesignPath(
                user.id,
                file
            );


        const {
            error
        } =
            await supabase
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
                "Storage upload error:",
                error
            );

            throw error;
        }


        const {
            data
        } =
            supabase
                .storage
                .from("designs")
                .getPublicUrl(
                    filePath
                );


        const publicUrl =
            data?.publicUrl;


        if (!publicUrl) {

            throw new Error(
                "Unable to create the design image URL."
            );
        }


        return {

            path:
                filePath,

            url:
                publicUrl

        };
    }


    /* =====================================================
       CREATE DATABASE DESIGN RECORD
       ===================================================== */

    async function createDesignRecord({
        title,
        description,
        category,
        tags,
        isPublic,
        imageUrl
    }) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in before publishing."
            );
        }


        const {
            data,
            error
        } =
            await supabase
                .from("designs")
                .insert({

                    designer_id:
                        user.id,

                    title:
                        title.trim(),

                    description:
                        description.trim() ||
                        null,

                    category:
                        category,

                    image_url:
                        imageUrl,

                    thumbnail_url:
                        null,

                    tags:
                        tags,

                    views:
                        0,

                    likes_count:
                        0,

                    votes_count:
                        0,

                    is_public:
                        isPublic

                })
                .select()
                .single();


        if (error) {

            console.error(
                "Design database insert error:",
                error
            );

            throw error;
        }


        return data;
    }


    /* =====================================================
       PUBLISH DESIGN
       ===================================================== */

    async function publishDesign({
        file,
        title,
        description,
        category,
        tags,
        isPublic
    }) {

        if (
            state.submitting
        ) {

            throw new Error(
                "Your design is already being uploaded."
            );
        }


        state.submitting =
            true;


        let uploadedPath =
            null;


        try {

            /* ---------------------------------------------
               VALIDATE FORM
               --------------------------------------------- */

            validatePublishData({

                file,

                title,

                category

            });


            /* ---------------------------------------------
               UPLOAD IMAGE
               --------------------------------------------- */

            const uploaded =
                await uploadDesignFile(
                    file
                );


            uploadedPath =
                uploaded.path;


            /* ---------------------------------------------
               CREATE DB RECORD
               --------------------------------------------- */

            let design;


            try {

                design =
                    await createDesignRecord({

                        title,

                        description,

                        category,

                        tags,

                        isPublic,

                        imageUrl:
                            uploaded.url

                    });

            } catch (databaseError) {

                /*
                 * If the database insert fails,
                 * remove the newly uploaded file
                 * so we don't leave an orphaned
                 * Storage object.
                 */

                await removeStorageFile(
                    uploadedPath
                );


                throw databaseError;
            }


            return design;

        } finally {

            state.submitting =
                false;
        }
    }


    /* =====================================================
       VALIDATE PUBLISH DATA
       ===================================================== */

    function validatePublishData({
        file,
        title,
        category
    }) {

        const validation =
            validateDesignFile(
                file
            );


        if (!validation.valid) {

            throw new Error(
                validation.message
            );
        }


        if (
            !String(title || "")
                .trim()
        ) {

            throw new Error(
                "Please enter a title for your design."
            );
        }


        if (
            String(title)
                .trim()
                .length >
            80
        ) {

            throw new Error(
                "Design title must be 80 characters or fewer."
            );
        }


        if (!category) {

            throw new Error(
                "Please select a design category."
            );
        }
    }


    /* =====================================================
       REMOVE STORAGE FILE
       ===================================================== */

    async function removeStorageFile(
        filePath
    ) {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !filePath
        ) {

            return;
        }


        const {
            error
        } =
            await supabase
                .storage
                .from("designs")
                .remove([
                    filePath
                ]);


        if (error) {

            console.warn(
                "Storage cleanup error:",
                error
            );
        }
    }


    /* =====================================================
       DELETE DESIGN
       ===================================================== */

    async function deleteDesign(
        design
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "You must be logged in."
            );
        }


        if (
            design.designer_id !==
            user.id
        ) {

            throw new Error(
                "You cannot delete this design."
            );
        }


        /*
         * Delete database record.
         */

        const {
            error
        } =
            await supabase
                .from("designs")
                .delete()
                .eq(
                    "id",
                    design.id
                )
                .eq(
                    "designer_id",
                    user.id
                );


        if (error) {

            throw error;
        }


        /*
         * Find Storage path.
         */

        const filePaths =
            [];


        const imagePath =
            extractStoragePath(
                design.image_url,
                "designs"
            );


        const thumbnailPath =
            extractStoragePath(
                design.thumbnail_url,
                "designs"
            );


        if (imagePath) {

            filePaths.push(
                imagePath
            );
        }


        if (
            thumbnailPath &&
            !filePaths.includes(
                thumbnailPath
            )
        ) {

            filePaths.push(
                thumbnailPath
            );
        }


        /*
         * Delete Storage files.
         */

        if (
            filePaths.length
        ) {

            const {
                error:
                    storageError
            } =
                await supabase
                    .storage
                    .from("designs")
                    .remove(
                        filePaths
                    );


            if (storageError) {

                console.warn(
                    "Storage cleanup warning:",
                    storageError
                );
            }
        }


        /*
         * Update local state.
         */

        state.designs =
            state.designs.filter(
                item =>
                    item.id !==
                    design.id
            );


        applyFilters();

        updateStats();


        return true;
    }


    /* =====================================================
       HANDLE DELETE
       ===================================================== */

    async function handleDelete(
        design,
        button,
        card
    ) {

        const confirmed =
            window.confirm(
                `Delete "${design.title || "this design"}"? This cannot be undone.`
            );


        if (!confirmed) {

            return;
        }


        const originalHTML =
            button.innerHTML;


        try {

            button.disabled =
                true;


            button.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
            `;


            if (card) {

                card.style.opacity =
                    "0.55";

                card.style.pointerEvents =
                    "none";
            }


            await deleteDesign(
                design
            );


            showToast(
                "Design deleted successfully.",
                "success"
            );


        } catch (error) {

            console.error(
                "Delete error:",
                error
            );


            if (card) {

                card.style.opacity =
                    "";

                card.style.pointerEvents =
                    "";
            }


            button.disabled =
                false;


            button.innerHTML =
                originalHTML;


            showToast(
                getDesignErrorMessage(
                    error
                ),
                "error"
            );
        }
    }


    /* =====================================================
       SETUP SEARCH & FILTER
       ===================================================== */

    function setupControls() {

        const search =
            $("#designSearch");


        const category =
            $("#designCategoryFilter");


        search?.addEventListener(
            "input",
            event => {

                searchDesigns(
                    event.target.value
                );

            }
        );


        category?.addEventListener(
            "change",
            event => {

                filterByCategory(
                    event.target.value
                );

            }
        );
    }


    /* =====================================================
       SUBMIT PAGE FORM
       ===================================================== */

    function setupSubmitForm() {

        const form =
            $("#designSubmitForm");


        if (!form) {

            return;
        }


        const imageInput =
            $("#designImageInput");


        const titleInput =
            $("#designTitle");


        const descriptionInput =
            $("#designDescription");


        const categoryInput =
            $("#designCategory");


        const tagsInput =
            $("#designTags");


        const publishButton =
            $("#publishDesignButton");


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                if (
                    state.submitting
                ) {

                    return;
                }


                const file =
                    imageInput
                        ?.files?.[0];


                const title =
                    titleInput
                        ?.value ||
                    "";


                const description =
                    descriptionInput
                        ?.value ||
                    "";


                const category =
                    categoryInput
                        ?.value ||
                    "";


                /*
                 * The submit page stores tags
                 * as JSON in the hidden input.
                 */

                let tags =
                    [];


                try {

                    const raw =
                        tagsInput
                            ?.value ||
                        "[]";


                    const parsed =
                        JSON.parse(
                            raw
                        );


                    if (
                        Array.isArray(
                            parsed
                        )
                    ) {

                        tags =
                            parsed
                                .map(
                                    tag =>
                                        String(
                                            tag
                                        )
                                        .trim()
                                        .toLowerCase()
                                )
                                .filter(
                                    Boolean
                                );
                    }

                } catch {

                    tags = [];
                }


                const visibility =
                    form.querySelector(
                        'input[name="visibility"]:checked'
                    );


                const isPublic =
                    visibility?.value !==
                    "private";


                try {

                    setSubmitLoading(
                        publishButton,
                        true
                    );


                    const design =
                        await publishDesign({

                            file,

                            title,

                            description,

                            category,

                            tags,

                            isPublic

                        });


                    showSubmitSuccess();


                    /*
                     * After success, take the
                     * designer to their designs.
                     */

                    setTimeout(
                        () => {

                            window.location.href =
                                "dashboard/my-designs.html";

                        },
                        1000
                    );


                } catch (error) {

                    console.error(
                        "Publish design error:",
                        error
                    );


                    showSubmitError(
                        getDesignErrorMessage(
                            error
                        )
                    );


                } finally {

                    setSubmitLoading(
                        publishButton,
                        false
                    );
                }
            }
        );
    }


    /* =====================================================
       SUBMIT BUTTON LOADING
       ===================================================== */

    function setSubmitLoading(
        button,
        loading
    ) {

        if (!button) {

            return;
        }


        if (loading) {

            if (
                !button.dataset.originalText
            ) {

                button.dataset.originalText =
                    button.innerHTML;
            }


            button.disabled =
                true;


            button.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                &nbsp;
                Publishing...
            `;

        } else {

            button.disabled =
                false;


            button.innerHTML =
                button.dataset.originalText ||
                `
                    <i class="fa-solid fa-rocket"></i>
                    Publish Design
                `;
        }
    }


    /* =====================================================
       SUBMIT SUCCESS
       ===================================================== */

    function showSubmitSuccess() {

        showToast(
            "Design published successfully! 🎨",
            "success"
        );


        const form =
            $("#designSubmitForm");


        if (form) {

            form.classList.add(
                "submission-success"
            );
        }
    }


    /* =====================================================
       SUBMIT ERROR
       ===================================================== */

    function showSubmitError(
        message
    ) {

        showToast(
            message,
            "error"
        );
    }


    /* =====================================================
       OPEN DESIGN
       ===================================================== */

    function openDesign(
        design
    ) {

        window.location.href =
            `../design.html?id=${encodeURIComponent(
                design.id
            )}`;
    }


    /* =====================================================
       EDIT DESIGN
       ===================================================== */

    function editDesign(
        design
    ) {

        window.location.href =
            `../submit.html?edit=${encodeURIComponent(
                design.id
            )}`;
    }


    /* =====================================================
       PUBLIC STORAGE URL
       ===================================================== */

    function getPublicImageUrl(
        filePath
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            return null;
        }


        const {
            data
        } =
            supabase
                .storage
                .from("designs")
                .getPublicUrl(
                    filePath
                );


        return (
            data?.publicUrl ||
            null
        );
    }


    /* =====================================================
       EXTRACT STORAGE PATH
       ===================================================== */

    function extractStoragePath(
        url,
        bucket
    ) {

        if (!url) {

            return null;
        }


        try {

            const publicMarker =
                `/storage/v1/object/public/${bucket}/`;


            const signedMarker =
                `/storage/v1/object/sign/${bucket}/`;


            let index =
                url.indexOf(
                    publicMarker
                );


            let marker =
                publicMarker;


            if (
                index === -1
            ) {

                index =
                    url.indexOf(
                        signedMarker
                    );


                marker =
                    signedMarker;
            }


            if (
                index === -1
            ) {

                return null;
            }


            const path =
                url.substring(
                    index +
                    marker.length
                );


            return decodeURIComponent(
                path
                    .split("?")[0]
            );

        } catch {

            return null;
        }
    }


    /* =====================================================
       LOADING
       ===================================================== */

    function showLoading() {

        const loading =
            $("#designsLoading");


        const grid =
            $("#designsGrid");


        const empty =
            $("#designsEmpty");


        loading?.removeAttribute(
            "hidden"
        );


        if (grid) {

            grid.hidden =
                true;
        }


        empty?.classList.remove(
            "visible"
        );
    }


    function hideLoading() {

        const loading =
            $("#designsLoading");


        loading?.setAttribute(
            "hidden",
            ""
        );
    }


    /* =====================================================
       EMPTY STATE
       ===================================================== */

    function showEmptyState() {

        const empty =
            $("#designsEmpty");


        if (!empty) {
            return;
        }


        empty.classList.add(
            "visible"
        );


        empty.style.display =
            "flex";
    }


    function hideEmptyState() {

        const empty =
            $("#designsEmpty");


        if (!empty) {
            return;
        }


        empty.classList.remove(
            "visible"
        );


        empty.style.display =
            "";
    }


    /* =====================================================
       ERROR STATE
       ===================================================== */

    function showError(
        message
    ) {

        hideLoading();


        const grid =
            $("#designsGrid");


        if (!grid) {
            return;
        }


        grid.innerHTML = `

            <div
                class="designs-empty visible"
                style="
                    display:flex;
                    grid-column:1/-1;
                "
            >

                <div
                    class="designs-empty-icon"
                >

                    <i
                        class="fa-solid fa-triangle-exclamation"
                    ></i>

                </div>


                <h2>
                    Something went wrong
                </h2>


                <p>
                    ${escapeHTML(
                        message
                    )}
                </p>


                <button
                    type="button"
                    class="btn btn-primary"
                    id="retryDesignsButton"
                >

                    <i
                        class="fa-solid fa-rotate"
                    ></i>

                    Try Again

                </button>

            </div>

        `;


        grid.hidden =
            false;


        $("#retryDesignsButton")
            ?.addEventListener(
                "click",
                () => {

                    loadDesigns();

                }
            );
    }


    /* =====================================================
       TOAST
       ===================================================== */

    function showToast(
        message,
        type = "info"
    ) {

        let container =
            $(".toast-container");


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "toast-container";


            document.body.appendChild(
                container
            );
        }


        const toast =
            document.createElement(
                "div"
            );


        toast.className =
            `toast toast-${type}`;


        const icon =
            type === "success"
                ? "fa-check"
                : type === "error"
                    ? "fa-triangle-exclamation"
                    : "fa-info";


        toast.innerHTML = `

            <div class="toast-icon">

                <i
                    class="fa-solid ${icon}"
                ></i>

            </div>


            <div class="toast-body">

                <div class="toast-message">

                    ${escapeHTML(
                        message
                    )}

                </div>

            </div>

        `;


        container.appendChild(
            toast
        );


        requestAnimationFrame(
            () => {

                toast.classList.add(
                    "show"
                );

            }
        );


        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );


                setTimeout(
                    () => {

                        toast.remove();

                    },
                    300
                );

            },
            3500
        );
    }


    /* =====================================================
       ERROR MESSAGES
       ===================================================== */

    function getDesignErrorMessage(
        error
    ) {

        if (!error) {

            return (
                "Unable to complete that action."
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
                "DESIGNVERSE blocked that action because you don't have permission."
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


        if (
            lower.includes(
                "bucket"
            ) &&
            lower.includes(
                "not found"
            )
        ) {

            return (
                "The DESIGNVERSE designs storage bucket could not be found."
            );
        }


        if (
            lower.includes(
                "duplicate"
            )
        ) {

            return (
                "A design with that information already exists."
            );
        }


        if (
            lower.includes(
                "payload too large"
            )
        ) {

            return (
                "The selected image is too large."
            );
        }


        return message;
    }


    /* =====================================================
       NUMBER FORMATTING
       ===================================================== */

    function formatNumber(
        number
    ) {

        return new Intl.NumberFormat(
            "en-US"
        ).format(
            Number(number) || 0
        );
    }


    function formatCompactNumber(
        number
    ) {

        return new Intl.NumberFormat(
            "en-US",
            {
                notation:
                    "compact",

                maximumFractionDigits:
                    1
            }
        ).format(
            Number(number) || 0
        );
    }


    /* =====================================================
       CATEGORY
       ===================================================== */

    function formatCategory(
        category
    ) {

        if (!category) {

            return "Other";
        }


        const map = {

            "ui-ux":
                "UI / UX",

            branding:
                "Branding",

            poster:
                "Poster",

            illustration:
                "Illustration",

            logo:
                "Logo",

            motion:
                "Motion",

            other:
                "Other"

        };


        if (
            map[category]
        ) {

            return map[category];
        }


        return String(
            category
        )
        .replace(
            /[-_]/g,
            " "
        )
        .replace(
            /\b\w/g,
            char =>
                char.toUpperCase()
        );
    }


    /* =====================================================
       UTILITIES
       ===================================================== */

    function setText(
        selector,
        value
    ) {

        const element =
            $(selector);


        if (element) {

            element.textContent =
                value;
        }
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
                value ?? ""
            );


        return element.innerHTML;
    }


    function escapeAttribute(
        value
    ) {

        return escapeHTML(
            value
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
    }


    function getFileExtension(
        file
    ) {

        const extension =
            file.name
                .split(".")
                .pop()
                .toLowerCase();


        const allowed = [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif"
        ];


        if (
            allowed.includes(
                extension
            )
        ) {

            return extension;
        }


        /*
         * Use a sensible extension
         * fallback based on MIME.
         */

        const mimeMap = {

            "image/jpeg":
                "jpg",

            "image/png":
                "png",

            "image/webp":
                "webp",

            "image/gif":
                "gif"

        };


        return (
            mimeMap[
                file.type
            ] ||
            "jpg"
        );
    }


    function generateId() {

        if (
            crypto &&
            typeof crypto.randomUUID ===
            "function"
        ) {

            return crypto.randomUUID();
        }


        return (
            Date.now()
            .toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .substring(2, 10)
        );
    }


    function truncateTitle(
        text,
        length
    ) {

        const value =
            String(
                text || ""
            );


        if (
            value.length <=
            length
        ) {

            return value;
        }


        return (
            value.substring(
                0,
                length
            ) +
            "..."
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


        const isDesignsPage =
            !!$("#designsGrid") ||
            !!$("#designsLoading");


        const isSubmitPage =
            !!$("#designSubmitForm");


        if (
            !isDesignsPage &&
            !isSubmitPage
        ) {

            return;
        }


        state.initialized =
            true;


        /*
         * Submit page only needs upload
         * functionality.
         */

        if (isSubmitPage) {

            setupSubmitForm();
        }


        /*
         * My Designs page needs database
         * loading + search + filters.
         */

        if (isDesignsPage) {

            setupControls();

            await loadDesigns();
        }
    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        state,

        init,

        loadDesigns,

        renderDesigns,

        updateStats,

        searchDesigns,

        filterByCategory,

        validateDesignFile,

        uploadDesignFile,

        createDesignRecord,

        publishDesign,

        deleteDesign,

        getPublicImageUrl,

        getCurrentUser

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVDesigns =
    DVDesigns;


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVDesigns.init();

    }
);


/* =========================================================
   DESIGNVERSE DESIGNS SYSTEM COMPLETE
   ========================================================= */