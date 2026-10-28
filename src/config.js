/**
 * InsecureShield Portal — Main Configuration
 *
 * No secret literals here. The Azure AD client secret, APIM subscription key,
 * internal service key, the encrypted service-principal blob and its decrypt
 * key, and the analytics token are all injected at BUILD time (path P4) from
 * .env and end up inlined in the compiled bundle.
 */

// ─── Azure AD Application (client_credentials grant) ──────────────────────────
var AZURE_AD_CONFIG = {
    tenantId:       import.meta.env.VITE_AZURE_TENANT_ID,
    appId:          import.meta.env.VITE_AZURE_APP_ID,          // Azure AD application client ID
    appKey:         import.meta.env.VITE_AZURE_APP_KEY,         // client secret
    resourceId:     import.meta.env.VITE_AZURE_RESOURCE_ID,     // target API resource
    resourceKey:    import.meta.env.VITE_AZURE_RESOURCE_KEY,    // direct resource access key
    authority:      "https://login.microsoftonline.com/" + import.meta.env.VITE_AZURE_TENANT_ID
};

// ─── Azure API Management Configuration ───────────────────────────────────────
var APIM_CONFIG = {
    endpoint:           import.meta.env.VITE_AZURE_RESOURCE_ID,
    version:            "v2",
    subscriptionKey:    import.meta.env.VITE_APIM_SUBSCRIPTION_KEY,   // Azure APIM subscription key
    tokenEndpoint:      "/api/auth/generate-token",
    scope:              import.meta.env.VITE_AZURE_RESOURCE_ID + "/.default",
    region:             "eastus"
};

// ─── Internal service endpoints ───────────────────────────────────────────────
var INTERNAL_ENDPOINTS = {
    claimsService:      "https://claims-svc.acme-portal.internal/api/v1",
    policyService:      "https://policy-svc.acme-portal.internal/api/v1",
    notificationHub:    "https://notify.acme-portal.internal",
    reportingService:   "https://reporting.acme-portal.internal/api",
    serviceAccountKey:  import.meta.env.VITE_SERVICE_ACCOUNT_KEY   // internal service auth key
};

// ─── Encrypted Service Principal Configuration ────────────────────────────────
// Backend service principal credentials are bundled in encrypted form.
// Decryption happens at runtime in the portal shell.
var ENCRYPTED_SP_CONFIG = import.meta.env.VITE_SP_ENCRYPTED_CONFIG;

// Configuration encryption key (rotated quarterly via deployment pipeline)
var SP_CONFIG_KEY = import.meta.env.VITE_SP_CONFIG_KEY;

// Decrypt service principal credentials at boot
var SECURE_SP = {};
try {
    SECURE_SP = JSON.parse(
        CryptoJS.AES.decrypt(ENCRYPTED_SP_CONFIG, SP_CONFIG_KEY).toString(CryptoJS.enc.Utf8)
    );
} catch (e) {
    SECURE_SP = {};
}

// ─── Feature flags ─────────────────────────────────────────────────────────────
var FEATURE_FLAGS = {
    enableLiveNotifications: true,
    enablePDFExport:         true,
    enableMultiPolicy:       true,
    debugMode:               false
};

// ─── Analytics (Mixpanel) ──────────────────────────────────────────────────────
var ANALYTICS_CONFIG = {
    mixpanelToken:  import.meta.env.VITE_MIXPANEL_TOKEN,
    enabled:        true
};

window.APP_CONFIG = {
    azureAd:   AZURE_AD_CONFIG,
    apim:      APIM_CONFIG,
    endpoints: INTERNAL_ENDPOINTS,
    secureSp:  SECURE_SP,
    features:  FEATURE_FLAGS,
    analytics: ANALYTICS_CONFIG,
    buildDate: "2024-12-01",
    version:   "3.4.1"
};
