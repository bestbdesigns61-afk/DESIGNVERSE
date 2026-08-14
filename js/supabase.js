/* =========================================================
   DESIGNVERSE — SUPABASE CONFIGURATION
   supabase.js
   ========================================================= */

"use strict";


/* =========================================================
   SUPABASE PROJECT CONFIG
   ========================================================= */

const SUPABASE_URL =
    "https://qhxtzqgddgfrdvsjrwca.supabase.co";


const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_bzAcfM7sJjmH47Ywg0wftg_qMWsgD1j";


/* =========================================================
   CHECK SUPABASE LIBRARY
   ========================================================= */

if (
    typeof window.supabase ===
    "undefined"
) {

    console.error(
        "DESIGNVERSE: Supabase library was not loaded."
    );

} else {


    /* =====================================================
       CREATE SUPABASE CLIENT
       ===================================================== */

    window.supabaseClient =
        window.supabase.createClient(

            SUPABASE_URL,

            SUPABASE_PUBLISHABLE_KEY,

            {

                auth: {

                    /*
                     * Keep the user's session
                     * in browser storage.
                     */

                    persistSession: true,


                    /*
                     * Automatically refresh
                     * expired access tokens.
                     */

                    autoRefreshToken: true,


                    /*
                     * Detect authentication
                     * information in the URL.
                     *
                     * Important for password
                     * recovery links.
                     */

                    detectSessionInUrl: true

                }

            }

        );


    /* =====================================================
       CONFIRM CLIENT
       ===================================================== */

    console.log(
        "DESIGNVERSE: Supabase initialized successfully."
    );

}


/* =========================================================
   GLOBAL CONFIG ACCESS
   ========================================================= */

window.DESIGNVERSE_CONFIG = {

    supabaseUrl:
        SUPABASE_URL

};