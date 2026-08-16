/* =========================================================
   DESIGNVERSE — DESIGNS SYSTEM
   js/designs.js

   Handles:
   - Normal design creation
   - Design image upload
   - Design metadata
   - Tags
   - Public/private visibility
   - My Designs loading
   - Design deletion
   - Edit/update support
   - Challenge-aware separation

   IMPORTANT:

   NORMAL DESIGN FLOW
      submit.html
         ↓
      designs.js
         ↓
      designs table

   CHALLENGE ENTRY FLOW
      challenge.html
         ↓
      submit.html?challenge=ID
         ↓
      submissions.js
         ↓
      submissions table

   designs.js NEVER creates a submission record.
   ========================================================= */

"use strict";


const DVDesigns = (() => {


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        initialized: false,

        user: null,

        designs: [],

        currentDesign: null,

        editing: false,

        submitting: false,

        imageObjectUrl: null

    };


    /* =====================================================
       DOM
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
                "DESIGNVERSE: Supabase client unavailable."
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

            console.error(
                "DESIGNVERSE user error:",
                error
            );

            return null;
        }


        state.user =
            data?.user ||
            null;


        return state.user;
    }


    /* =====================================================
       CHALLENGE MODE DETECTION
       ===================================================== */

    function isChallengeMode() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return Boolean(
            params.get("challenge") ||
            params.get("challenge_id")
        );
    }


    /* =====================================================
       LOAD USER DESIGNS
       ===================================================== */

    async function loadMyDesigns() {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in to view your designs."
            );
        }


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

            throw error;
        }


        state.designs =
            data || [];


        return state.designs;
    }


    /* =====================================================
       LOAD SINGLE DESIGN
       ===================================================== */

    async function loadDesign(
        designId
    ) {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !designId
        ) {

            return null;
        }


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
                    "id",
                    designId
                )
                .single();


        if (error) {

            console.error(
                "DESIGNVERSE design load error:",
                error
            );

            throw error;
        }


        state.currentDesign =
            data;


        return data;
    }


    /* =====================================================
       VALIDATE DESIGN DATA
       ===================================================== */

    function validateDesignData({

        title,

        description,

        category,

        tags,

        isPublic

    }) {

        const cleanTitle =
            String(
                title || ""
            )
            .trim();


        if (!cleanTitle) {

            throw new Error(
                "Please enter a design title."
            );
        }


        if (
            cleanTitle.length >
            80
        ) {

            throw new Error(
                "Design title must be 80 characters or fewer."
            );
        }


        if (
            String(
                description || ""
            ).length >
            1000
        ) {

            throw new Error(
                "Design description must be 1000 characters or fewer."
            );
        }


        if (!category) {

            throw new Error(
                "Please select a design category."
            );
        }


        if (
            !Array.isArray(
                tags
            )
        ) {

            throw new Error(
                "Invalid design tags."
            );
        }


        if (
            tags.length >
            8
        ) {

            throw new Error(
                "You can add up to 8 tags."
            );
        }


        const normalizedTags =
            normalizeTags(
                tags
            );


        if (
            normalizedTags.some(
                tag =>
                    tag.length >
                    24
            )
        ) {

            throw new Error(
                "Each tag must be 24 characters or fewer."
            );
        }


        return {

            title:
                cleanTitle,

            description:
                String(
                    description || ""
                )
                .trim(),

            category,

            tags:
                normalizedTags,

            isPublic:
                Boolean(
                    isPublic
                )

        };
    }


    /* =====================================================
       CREATE DESIGN
       ===================================================== */

    async function createDesign({

        title,

        description,

        category,

        tags,

        isPublic,

        imageFile

    }) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in before publishing a design."
            );
        }


        const validated =
            validateDesignData({

                title,

                description,

                category,

                tags,

                isPublic

            });


        validateImageFile(
            imageFile
        );


        /*
         * Create database row FIRST so we obtain
         * the design UUID for Storage.
         */

        const {
            data: design,
            error: insertError
        } =
            await supabase
                .from("designs")
                .insert({

                    designer_id:
                        user.id,

                    title:
                        validated.title,

                    description:
                        validated.description ||
                        null,

                    category:
                        validated.category,

                    tags:
                        validated.tags,

                    is_public:
                        validated.isPublic

                })
                .select()
                .single();


        if (insertError) {

            console.error(
                "DESIGNVERSE design insert error:",
                insertError
            );

            throw insertError;
        }


        let uploadedPath =
            null;


        try {

            const uploaded =
                await uploadDesignImage(
                    design.id,
                    imageFile
                );


            uploadedPath =
                uploaded.path;


            const {
                data:
                    updatedDesign,
                error:
                    updateError
            } =
                await supabase
                    .from("designs")
                    .update({

                        image_url:
                            uploaded.url,

                        thumbnail_url:
                            uploaded.url,

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "id",
                        design.id
                    )
                    .eq(
                        "designer_id",
                        user.id
                    )
                    .select()
                    .single();


            if (updateError) {

                throw updateError;
            }


            state.designs = [

                updatedDesign,

                ...state.designs

            ];


            state.currentDesign =
                updatedDesign;


            return updatedDesign;


        } catch (error) {

            /*
             * Rollback database row and Storage file
             * if image upload/update fails.
             */

            if (
                uploadedPath
            ) {

                await removeDesignImage(
                    uploadedPath
                );
            }


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


            throw error;
        }
    }


    /* =====================================================
       UPDATE DESIGN
       ===================================================== */

    async function updateDesign(

        designId,

        {

            title,

            description,

            category,

            tags,

            isPublic,

            imageFile

        }

    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in before editing a design."
            );
        }


        const validated =
            validateDesignData({

                title,

                description,

                category,

                tags,

                isPublic

            });


        const existing =
            state.designs.find(
                design =>
                    design.id ===
                    designId
            ) ||
            await loadDesign(
                designId
            );


        if (!existing) {

            throw new Error(
                "Design not found."
            );
        }


        if (
            existing.designer_id !==
            user.id
        ) {

            throw new Error(
                "You can only edit your own designs."
            );
        }


        let imageUrl =
            existing.image_url ||
            null;


        let thumbnailUrl =
            existing.thumbnail_url ||
            null;


        let newPath =
            null;


        try {

            /*
             * Optional image replacement.
             */

            if (
                imageFile
            ) {

                validateImageFile(
                    imageFile
                );


                const uploaded =
                    await uploadDesignImage(
                        designId,
                        imageFile,
                        {
                            replace:
                                true
                        }
                    );


                newPath =
                    uploaded.path;


                imageUrl =
                    uploaded.url;


                thumbnailUrl =
                    uploaded.url;
            }


            const {
                data,
                error
            } =
                await supabase
                    .from("designs")
                    .update({

                        title:
                            validated.title,

                        description:
                            validated.description ||
                            null,

                        category:
                            validated.category,

                        tags:
                            validated.tags,

                        is_public:
                            validated.isPublic,

                        image_url:
                            imageUrl,

                        thumbnail_url:
                            thumbnailUrl,

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


            state.currentDesign =
                data;


            const index =
                state.designs.findIndex(
                    design =>
                        design.id ===
                        designId
                );


            if (
                index !== -1
            ) {

                state.designs[index] =
                    data;
            }


            return data;


        } catch (error) {

            /*
             * If replacing an image succeeds but
             * the database update fails, remove the
             * newly uploaded file.
             */

            if (
                newPath
            ) {

                await removeDesignImage(
                    newPath
                );
            }


            throw error;
        }
    }


    /* =====================================================
       UPLOAD DESIGN IMAGE
       ===================================================== */

    async function uploadDesignImage(
        designId,
        file,
        options = {}
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        validateImageFile(
            file
        );


        const extension =
            getFileExtension(
                file
            );


        const safeName =
            file.name
                .split(".")
                .slice(
                    0,
                    -1
                )
                .join(".")
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    "-"
                )
                .replace(
                    /^-+|-+$/g,
                    ""
                )
                .substring(
                    0,
                    60
                ) ||
            "design";


        const filePath =
            `${designId}/` +
            `${Date.now()}-` +
            `${generateId()}-` +
            `${safeName}.` +
            `${extension}`;


        const {
            error
        } =
            await supabase
                .storage
                .from(
                    "designs"
                )
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
                "DESIGNVERSE design upload error:",
                error
            );

            throw error;
        }


        const {
            data
        } =
            supabase
                .storage
                .from(
                    "designs"
                )
                .getPublicUrl(
                    filePath
                );


        if (
            !data?.publicUrl
        ) {

            throw new Error(
                "Unable to generate the design image URL."
            );
        }


        return {

            path:
                filePath,

            url:
                data.publicUrl

        };
    }


    /* =====================================================
       DELETE DESIGN
       ===================================================== */

    async function deleteDesign(
        designId
    ) {

        const supabase =
            getSupabase();


        if (!supabase) {

            throw new Error(
                "Supabase is unavailable."
            );
        }


        const user =
            state.user ||
            await getCurrentUser();


        if (!user) {

            throw new Error(
                "Please sign in."
            );
        }


        const design =
            state.designs.find(
                item =>
                    item.id ===
                    designId
            ) ||
            await loadDesign(
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
         * Delete database row.
         *
         * Your database currently has ON DELETE
         * CASCADE from submissions.design_id,
         * so deleting a design that has been used
         * in a challenge can also delete its
         * submissions.
         *
         * We therefore block deletion when the
         * design is already used in a submission.
         */

        const {
            count,
            error:
                submissionCheckError
        } =
            await supabase
                .from("submissions")
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
                    "design_id",
                    designId
                );


        if (
            submissionCheckError
        ) {

            console.warn(
                "Unable to verify design submissions:",
                submissionCheckError
            );

        } else if (
            Number(count || 0) >
            0
        ) {

            throw new Error(
                "This design has already been submitted to a challenge and cannot be deleted."
            );
        }


        const {
            error
        } =
            await supabase
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

            throw error;
        }


        /*
         * Remove Storage objects after the row
         * has been removed.
         */

        if (
            design.image_url
        ) {

            const path =
                extractStoragePath(
                    design.image_url,
                    "designs"
                );


            if (path) {

                await removeDesignImage(
                    path
                );
            }
        }


        state.designs =
            state.designs.filter(
                item =>
                    item.id !==
                    designId
            );


        if (
            state.currentDesign?.id ===
            designId
        ) {

            state.currentDesign =
                null;
        }


        return true;
    }


    /* =====================================================
       REMOVE DESIGN IMAGE
       ===================================================== */

    async function removeDesignImage(
        path
    ) {

        const supabase =
            getSupabase();


        if (
            !supabase ||
            !path
        ) {

            return;
        }


        const {
            error
        } =
            await supabase
                .storage
                .from(
                    "designs"
                )
                .remove([
                    path
                ]);


        if (error) {

            console.warn(
                "DESIGNVERSE design Storage cleanup failed:",
                error
            );
        }
    }


    /* =====================================================
       IMAGE VALIDATION
       ===================================================== */

    function validateImageFile(
        file
    ) {

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


        const maxSize =
            10 *
            1024 *
            1024;


        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            throw new Error(
                "Design image must be JPG, PNG, WEBP or GIF."
            );
        }


        if (
            file.size >
            maxSize
        ) {

            throw new Error(
                "Design image must be 10 MB or smaller."
            );
        }
    }


    /* =====================================================
       IMAGE PREVIEW
       ===================================================== */

    function setupImagePreview() {

        const input =
            $("#designImageInput");


        const uploadZone =
            $("#uploadZone");


        const uploadPreview =
            $("#uploadPreview");


        const previewImage =
            $("#designPreviewImage");


        const previewName =
            $("#previewFileName");


        const previewSize =
            $("#previewFileSize");


        const changeButton =
            $("#changeImageButton");


        if (!input) {

            return;
        }


        input.addEventListener(
            "change",
            () => {

                handleImageSelection(
                    input.files?.[0]
                );

            }
        );


        changeButton?.addEventListener(
            "click",
            event => {

                event.preventDefault();


                input.click();

            }
        );


        [
            "dragenter",
            "dragover"
        ]
        .forEach(
            eventName => {

                uploadZone?.addEventListener(
                    eventName,
                    event => {

                        event.preventDefault();


                        uploadZone.classList.add(
                            "dragover"
                        );

                    }
                );

            }
        );


        [
            "dragleave",
            "drop"
        ]
        .forEach(
            eventName => {

                uploadZone?.addEventListener(
                    eventName,
                    event => {

                        event.preventDefault();


                        uploadZone.classList.remove(
                            "dragover"
                        );

                    }
                );

            }
        );


        uploadZone?.addEventListener(
            "drop",
            event => {

                const file =
                    event.dataTransfer
                        ?.files?.[0];


                if (!file) {

                    return;
                }


                /*
                 * Attempt to sync the dropped file
                 * with the native file input.
                 */

                try {

                    const transfer =
                        new DataTransfer();


                    transfer.items.add(
                        file
                    );


                    input.files =
                        transfer.files;

                } catch {
                    /* Browser may block FileList assignment. */
                }


                handleImageSelection(
                    file
                );
            }
        );


        function handleImageSelection(
            file
        ) {

            clearImageError();


            try {

                validateImageFile(
                    file
                );

            } catch (error) {

                showImageError(
                    error.message
                );


                input.value =
                    "";


                return;
            }


            if (
                state.imageObjectUrl
            ) {

                URL.revokeObjectURL(
                    state.imageObjectUrl
                );
            }


            state.imageObjectUrl =
                URL.createObjectURL(
                    file
                );


            if (previewImage) {

                previewImage.src =
                    state.imageObjectUrl;
            }


            if (previewName) {

                previewName.textContent =
                    file.name;
            }


            if (previewSize) {

                previewSize.textContent =
                    formatBytes(
                        file.size
                    );
            }


            if (uploadZone) {

                uploadZone.style.display =
                    "none";
            }


            uploadPreview?.classList.add(
                "visible"
            );


            /*
             * Optional live validation marker.
             */

            input.dataset.valid =
                "true";
        }
    }


    /* =====================================================
       FORM SETUP
       ===================================================== */

    function setupForm() {

        const form =
            $("#designSubmitForm");


        if (!form) {

            return;
        }


        /*
         * DO NOT attach the form when we are in
         * challenge-selection-only mode.
         *
         * The normal design form remains available
         * on the page, but the challenge entry flow
         * is handled by submissions.js.
         */

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                /*
                 * A challenge URL does not disable
                 * normal design creation completely.
                 * But the user must intentionally be
                 * in "Upload Design" mode.
                 */

                if (
                    isChallengeMode() &&
                    getActiveSubmitMode() ===
                    "challenge"
                ) {

                    return;
                }


                if (
                    state.submitting
                ) {

                    return;
                }


                try {

                    state.submitting =
                        true;


                    setPublishButtonLoading(
                        true
                    );


                    const imageFile =
                        $("#designImageInput")
                            ?.files?.[0] ||
                        null;


                    const title =
                        $("#designTitle")
                            ?.value ||
                        "";


                    const description =
                        $("#designDescription")
                            ?.value ||
                        "";


                    const category =
                        $("#designCategory")
                            ?.value ||
                        "";


                    const isPublic =
                        getVisibilityValue();


                    const tags =
                        readTagsFromForm();


                    const design =
                        await createDesign({

                            title,

                            description,

                            category,

                            tags,

                            isPublic,

                            imageFile

                        });


                    showFormSuccess(
                        design
                    );


                    resetDesignForm();


                    /*
                     * Give the user a moment to see
                     * the success message.
                     */

                    setTimeout(
                        () => {

                            window.location.href =
                                "dashboard/my-designs.html";

                        },
                        1200
                    );


                } catch (error) {

                    console.error(
                        "DESIGNVERSE design publication error:",
                        error
                    );


                    showFormError(
                        getDesignErrorMessage(
                            error
                        )
                    );


                } finally {

                    state.submitting =
                        false;


                    setPublishButtonLoading(
                        false
                    );
                }

            }
        );


        /*
         * Character counter.
         */

        const description =
            $("#designDescription");


        const counter =
            $("#descriptionCount");


        description?.addEventListener(
            "input",
            () => {

                if (counter) {

                    counter.textContent =
                        `${description.value.length} / 1000`;
                }

            }
        );
    }


    /* =====================================================
       ACTIVE SUBMIT MODE
       ===================================================== */

    function getActiveSubmitMode() {

        const active =
            document.querySelector(
                "[data-submit-mode].active"
            );


        return (
            active?.dataset.submitMode ||
            "upload"
        );
    }


    /* =====================================================
       READ VISIBILITY
       ===================================================== */

    function getVisibilityValue() {

        const selected =
            document.querySelector(
                'input[name="visibility"]:checked'
            );


        return (
            selected?.value !==
            "private"
        );
    }


    /* =====================================================
       TAGS
       ===================================================== */

    function readTagsFromForm() {

        const hidden =
            $("#designTags");


        if (!hidden) {

            return [];
        }


        try {

            const parsed =
                JSON.parse(
                    hidden.value ||
                    "[]"
                );


            return normalizeTags(
                parsed
            );

        } catch {

            return [];
        }
    }


    function normalizeTags(
        tags
    ) {

        if (
            !Array.isArray(
                tags
            )
        ) {

            return [];
        }


        return [
            ...new Set(
                tags
                    .map(
                        tag =>
                            String(
                                tag ||
                                ""
                            )
                            .trim()
                            .toLowerCase()
                            .replace(
                                /^#/,
                                ""
                            )
                            .replace(
                                /\s+/g,
                                "-"
                            )
                    )
                    .filter(
                        Boolean
                    )
            )
        ]
        .slice(
            0,
            8
        );
    }


    /* =====================================================
       BUTTON LOADING
       ===================================================== */

    function setPublishButtonLoading(
        loading
    ) {

        const button =
            $("#publishDesignButton");


        if (!button) {

            return;
        }


        if (loading) {

            button.disabled =
                true;


            button.dataset.originalText =
                button.innerHTML;


            button.innerHTML = `

                <i
                    class="fa-solid fa-spinner fa-spin"
                ></i>

                &nbsp;

                Publishing...

            `;

        } else {

            button.disabled =
                false;


            button.innerHTML =
                button.dataset.originalText ||
                `

                    <i
                        class="fa-solid fa-rocket"
                    ></i>

                    Publish Design

                `;
        }
    }


    /* =====================================================
       FORM RESET
       ===================================================== */

    function resetDesignForm() {

        const form =
            $("#designSubmitForm");


        form?.reset();


        const tags =
            $("#designTags");


        if (tags) {

            tags.value =
                "[]";
        }


        /*
         * Clear external tag UI if submit.html
         * has created it.
         */

        const tagList =
            $("#tagList");


        if (tagList) {

            tagList.innerHTML =
                "";
        }


        const descriptionCount =
            $("#descriptionCount");


        if (descriptionCount) {

            descriptionCount.textContent =
                "0 / 1000";
        }


        const uploadZone =
            $("#uploadZone");


        const uploadPreview =
            $("#uploadPreview");


        if (state.imageObjectUrl) {

            URL.revokeObjectURL(
                state.imageObjectUrl
            );


            state.imageObjectUrl =
                null;
        }


        if (uploadZone) {

            uploadZone.style.display =
                "";
        }


        uploadPreview?.classList.remove(
            "visible"
        );


        const image =
            $("#designPreviewImage");


        if (image) {

            image.removeAttribute(
                "src"
            );
        }


        clearImageError();
    }


    /* =====================================================
       ERROR/SUCCESS UI
       ===================================================== */

    function showImageError(
        message
    ) {

        const error =
            $("#imageError");


        if (!error) {
            return;
        }


        error.textContent =
            message;


        error.classList.add(
            "visible"
        );
    }


    function clearImageError() {

        const error =
            $("#imageError");


        error?.classList.remove(
            "visible"
        );


        if (error) {

            error.textContent =
                "";
        }
    }


    function showFormSuccess(
        design
    ) {

        const element =
            $("#submissionSuccess");


        if (element) {

            element.textContent =
                `"${design.title}" was published successfully! 🎨`;


            element.classList.add(
                "visible"
            );
        }


        showToast(
            "Design published successfully! 🎨",
            "success"
        );
    }


    function showFormError(
        message
    ) {

        const element =
            $("#submissionError");


        if (element) {

            element.textContent =
                message;


            element.classList.add(
                "visible"
            );
        }


        showToast(
            message,
            "error"
        );
    }


    /* =====================================================
       DELETE UI
       ===================================================== */

    async function handleDelete(
        designId
    ) {

        const design =
            state.designs.find(
                item =>
                    item.id ===
                    designId
            );


        if (!design) {

            return;
        }


        const confirmed =
            window.confirm(
                `Delete "${design.title}"?`
            );


        if (!confirmed) {

            return;
        }


        try {

            await deleteDesign(
                designId
            );


            showToast(
                "Design deleted successfully.",
                "success"
            );


            renderMyDesigns();

        } catch (error) {

            console.error(
                "Delete design error:",
                error
            );


            showToast(
                getDesignErrorMessage(
                    error
                ),
                "error"
            );
        }
    }


    /* =====================================================
       RENDER MY DESIGNS
       ===================================================== */

    function renderMyDesigns() {

        const container =
            $("#myDesignsGrid");


        if (!container) {

            return;
        }


        container.innerHTML =
            "";


        if (
            !state.designs.length
        ) {

            container.innerHTML = `

                <div
                    class="designs-empty"
                    style="
                        grid-column:1/-1;
                        text-align:center;
                        padding:50px 20px;
                    "
                >

                    <i
                        class="fa-solid fa-palette"
                        style="
                            font-size:28px;
                            color:#c4b5fd;
                            margin-bottom:12px;
                        "
                    ></i>


                    <h3>
                        No designs yet
                    </h3>


                    <p>
                        Your creative journey starts here.
                    </p>


                    <a
                        href="../submit.html"
                        class="btn btn-primary btn-small"
                    >
                        Upload Design
                    </a>

                </div>

            `;


            return;
        }


        state.designs.forEach(
            design => {

                container.appendChild(
                    createDesignCard(
                        design
                    )
                );

            }
        );
    }


    /* =====================================================
       CREATE DESIGN CARD
       ===================================================== */

    function createDesignCard(
        design
    ) {

        const article =
            document.createElement(
                "article"
            );


        article.className =
            "design-card";


        article.dataset.designId =
            design.id;


        const image =
            design.image_url
                ? `
                    <img
                        src="${escapeAttribute(
                            design.image_url
                        )}"
                        alt="${escapeAttribute(
                            design.title
                        )}"
                        loading="lazy"
                    >
                `
                : `
                    <div
                        style="
                            width:100%;
                            height:100%;
                            display:grid;
                            place-items:center;
                            background:linear-gradient(
                                135deg,
                                #120825,
                                #153b75
                            );
                            color:#c4b5fd;
                        "
                    >
                        <i
                            class="fa-solid fa-palette"
                        ></i>
                    </div>
                `;


        article.innerHTML = `

            <div
                class="design-card-image"
            >

                ${image}

            </div>


            <div
                class="design-card-body"
            >

                <h3>
                    ${escapeHTML(
                        design.title ||
                        "Untitled Design"
                    )}
                </h3>


                <span>
                    ${escapeHTML(
                        formatCategory(
                            design.category
                        )
                    )}
                </span>


                <div
                    style="
                        display:flex;
                        gap:7px;
                        margin-top:10px;
                    "
                >

                    <a
                        href="../design.html?id=${encodeURIComponent(
                            design.id
                        )}"
                        class="btn btn-secondary btn-small"
                    >

                        View

                    </a>


                    <button
                        type="button"
                        class="btn btn-secondary btn-small"
                        data-delete-design="${escapeAttribute(
                            design.id
                        )}"
                    >

                        Delete

                    </button>

                </div>

            </div>

        `;


        article
            .querySelector(
                "[data-delete-design]"
            )
            ?.addEventListener(
                "click",
                () => {

                    handleDelete(
                        design.id
                    );

                }
            );


        return article;
    }


    /* =====================================================
       ERROR MESSAGE
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
                "Supabase blocked this action. Please check your account permissions."
            );
        }


        if (
            lower.includes(
                "foreign key"
            )
        ) {

            return (
                "The referenced account or record could not be found."
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
                "The designs Storage bucket was not found."
            );
        }


        if (
            lower.includes(
                "duplicate"
            )
        ) {

            return (
                "A design with these values already exists."
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
                ".design-toast-container"
            );


        if (!container) {

            container =
                document.createElement(
                    "div"
                );


            container.className =
                "design-toast-container";


            container.style.cssText = `
                position:fixed;
                right:18px;
                bottom:18px;
                z-index:4000;
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
                    : "fa-info-circle";


        const color =
            type === "success"
                ? "#86efac"
                : type === "error"
                    ? "#fca5a5"
                    : "#c4b5fd";


        toast.style.cssText = `
            display:flex;
            align-items:center;
            gap:10px;
            padding:13px 14px;
            border:1px solid rgba(255,255,255,.10);
            border-radius:13px;
            background:rgba(10,10,16,.95);
            color:white;
            box-shadow:0 20px 50px rgba(0,0,0,.35);
            backdrop-filter:blur(18px);
            font:10px/1.5 Inter,sans-serif;
        `;


        toast.innerHTML = `

            <i
                class="fa-solid ${icon}"
                style="
                    color:${color};
                "
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
            4000
        );
    }


    /* =====================================================
       FORMATTERS
       ===================================================== */

    function formatCategory(
        category
    ) {

        const map = {

            branding:
                "Branding",

            poster:
                "Poster",

            "ui-ux":
                "UI / UX",

            illustration:
                "Illustration",

            logo:
                "Logo",

            motion:
                "Motion",

            other:
                "Other"

        };


        return (
            map[category] ||
            "Other"
        );
    }


    function formatBytes(
        bytes
    ) {

        if (
            !Number.isFinite(
                bytes
            ) ||
            bytes <= 0
        ) {

            return "0 Bytes";
        }


        const units = [

            "Bytes",

            "KB",

            "MB",

            "GB"

        ];


        const index =
            Math.min(
                Math.floor(
                    Math.log(bytes) /
                    Math.log(1024)
                ),
                units.length - 1
            );


        return `${(
            bytes /
            Math.pow(
                1024,
                index
            )
        ).toFixed(
            index === 0
                ? 0
                : 2
        )} ${units[index]}`;
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
            typeof crypto !==
            "undefined" &&
            typeof crypto.randomUUID ===
            "function"
        ) {

            return crypto.randomUUID();
        }


        return (
            Date.now()
                .toString(36) +
            "-" +
            Math.random()
                .toString(36)
                .substring(
                    2,
                    10
                )
        );
    }


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
                path.split("?")[0]
            );

        } catch {

            return null;
        }
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


        /*
         * Only initialize on pages that actually
         * contain design-management elements.
         */

        const isSubmitPage =
            Boolean(
                $("#designSubmitForm")
            );


        const isDesignsPage =
            Boolean(
                $("#myDesignsGrid")
            );


        if (
            !isSubmitPage &&
            !isDesignsPage
        ) {

            return;
        }


        state.initialized =
            true;


        /*
         * Only load the form logic when the
         * normal design upload form exists.
         */

        if (
            isSubmitPage
        ) {

            await getCurrentUser();

            setupImagePreview();

            setupForm();

        }


        /*
         * My Designs page.
         */

        if (
            isDesignsPage
        ) {

            try {

                await getCurrentUser();

                await loadMyDesigns();

                renderMyDesigns();

            } catch (error) {

                console.error(
                    "Unable to load My Designs:",
                    error
                );

                showToast(
                    getDesignErrorMessage(
                        error
                    ),
                    "error"
                );
            }
        }
    }


    /* =====================================================
       CLEANUP
       ===================================================== */

    window.addEventListener(
        "pagehide",
        () => {

            if (
                state.imageObjectUrl
            ) {

                URL.revokeObjectURL(
                    state.imageObjectUrl
                );


                state.imageObjectUrl =
                    null;
            }

        }
    );


    /* =====================================================
       PUBLIC API
       ===================================================== */

    return {

        state,

        init,

        getCurrentUser,

        loadMyDesigns,

        loadDesign,

        createDesign,

        updateDesign,

        deleteDesign,

        uploadDesignImage,

        renderMyDesigns,

        validateImageFile,

        validateDesignData,

        isChallengeMode

    };

})();


/* =========================================================
   GLOBAL EXPORT
   ========================================================= */

window.DVDesigns =
    DVDesigns;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        DVDesigns.init();

    }
);


/* =========================================================
   DESIGNVERSE DESIGN SYSTEM COMPLETE
   ========================================================= */