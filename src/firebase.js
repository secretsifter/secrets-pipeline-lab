/**
 * InsecureShield — Firebase SDK Initialization
 * Used for real-time claim status updates and push notifications.
 *
 * No secret literals here: apiKey, the service-account private key, etc. are
 * injected at build time (path P4) from .env. They land in the compiled bundle.
 */

var firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Service account credentials (should be server-side only — TODO: move to backend)
var FIREBASE_SERVICE_ACCOUNT = {
    type:                        "service_account",
    project_id:                  import.meta.env.VITE_FIREBASE_PROJECT_ID,
    private_key_id:              import.meta.env.VITE_FIREBASE_PRIVATE_KEY_ID,
    private_key:                 import.meta.env.VITE_FIREBASE_PRIVATE_KEY,
    client_email:                import.meta.env.VITE_FIREBASE_CLIENT_EMAIL,
    client_id:                   import.meta.env.VITE_FIREBASE_CLIENT_ID,
    auth_uri:                    "https://accounts.google.com/o/oauth2/auth",
    token_uri:                   "https://oauth2.googleapis.com/token"
};

window.firebaseConfig          = firebaseConfig;
window.FIREBASE_SERVICE_ACCOUNT = FIREBASE_SERVICE_ACCOUNT;

// NOTE: Firebase app init is commented out — SDK not loaded in this demo build
// firebase.initializeApp(firebaseConfig);
