'use strict';

require('dotenv').config();

const express             = require('express');
const jwt                 = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const http                = require('http');
const path                = require('path');
const fs                  = require('fs');
const cors                = require('cors');
const os                  = require('os');
const { exec }            = require('child_process');
const { customers, policies, claims } = require('./data/db');

function getNetworkIP() {
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of ifaces) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

function openBrowser(url) {
    const cmd = process.platform === 'darwin' ? `open "${url}"`
              : process.platform === 'win32'  ? `start "${url}"`
              : `xdg-open "${url}"`;
    exec(cmd, err => { if (err) console.error('  Could not open browser:', err.message); });
}

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─────────────────────────────────────────────────────────────────────────────
// Secrets — sourced at RUNTIME from process.env (populated from the gitignored
// .env, or from CI/CD variables / container ENV in the pipeline). No secret
// literals in this source file.
// ─────────────────────────────────────────────────────────────────────────────
const JWT_SECRET  = process.env.JWT_SECRET;
const APIM_KEY    = process.env.APIM_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS  = process.env.ADMIN_PASS;
const DB_CONN_STR = process.env.DB_CONN_STR;

const AAD_APP_ID       = process.env.AAD_APP_ID;
const AAD_APP_KEY      = process.env.AAD_APP_KEY;
const AAD_RESOURCE_KEY = process.env.AAD_RESOURCE_KEY;

const AAD_ADMIN_APP_ID       = process.env.AAD_ADMIN_APP_ID;
const AAD_ADMIN_APP_KEY      = process.env.AAD_ADMIN_APP_KEY;
const AAD_ADMIN_RESOURCE_KEY = process.env.AAD_ADMIN_RESOURCE_KEY;

const WS_INTERNAL_KEY = process.env.WS_INTERNAL_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Runtime-generated surfaces (injection path P7): these documents are assembled
// from process.env on each request — they live in NO committed file.
// ─────────────────────────────────────────────────────────────────────────────
function buildRuntimeConfig() {
    return {
        _comment: 'InsecureShield Azure AD app registration — production tenant',
        azure: {
            tenantId:      process.env.AZURE_TENANT_ID,
            clientId:      process.env.AZURE_CLIENT_ID,
            client_secret: process.env.AZURE_CLIENT_SECRET,
            authority:     process.env.AZURE_AUTHORITY,
            scope:         process.env.AZURE_SCOPE,
            redirectUri:   process.env.AZURE_REDIRECT_URI
        },
        apim: {
            baseUrl:         'https://acme-portal-api.azure-api.net',
            subscriptionKey: process.env.RUNTIME_APIM_SUBSCRIPTION_KEY,
            version:         'v2'
        },
        storage: {
            connectionString: process.env.STORAGE_CONNECTION_STRING,
            containerName:    process.env.STORAGE_CONTAINER
        },
        cache: {
            redisUrl:   process.env.REDIS_URL,
            ttlSeconds: 3600
        }
    };
}

function buildAssetManifest() {
    return {
        version:   '3.4.1',
        buildDate: '2024-12-01T00:00:00Z',
        files: {
            'config.js':   '/js/config.js',
            'env.js':      '/js/env.js',
            'firebase.js': '/js/firebase.js',
            'app.js':      '/js/app.js',
            'style.css':   '/css/style.css'
        },
        chunks: ['/js/config.js', '/js/env.js', '/js/firebase.js', '/js/app.js'],
        aws: {
            region:                process.env.VITE_AWS_REGION,
            s3_bucket:             'acme-portal-prod-assets',
            cloudfront_id:         'E2QWRUHEXAMPLE',
            aws_access_key_id:     process.env.VITE_AWS_ACCESS_KEY_ID,
            aws_secret_access_key: process.env.VITE_AWS_SECRET_ACCESS_KEY,
            deploy_role_arn:       'arn:aws:iam::123456789012:role/AcmePortalDeploy'
        },
        cdn: {
            baseUrl: 'https://d2f3g4h5j6k7l8.cloudfront.net',
            apiKey:  process.env.VITE_CDN_API_KEY
        }
    };
}

// Server-rendered hydration state (injection path P6): the server serializes an
// application state object into the page at render time so the client can
// "hydrate" without a round trip. Assembled from process.env, so it is in no
// committed file, yet it ships inline in the delivered HTML.
function buildHydrationState() {
    return {
        user: { role: 'guest', authenticated: false },
        apim: {
            baseUrl:         'https://acme-portal-api.azure-api.net',
            subscriptionKey: process.env.RUNTIME_APIM_SUBSCRIPTION_KEY
        },
        services: {
            serviceAccountKey: process.env.VITE_SERVICE_ACCOUNT_KEY,
            internalApiKey:    process.env.VITE_INTERNAL_API_KEY
        },
        build: { version: '3.4.1', renderedAt: new Date().toISOString() }
    };
}

// Legacy "internal API config" HTML comment — historically hardcoded in
// index.html; now injected into the served shell at request time (path P7).
function runtimeSecretsComment() {
    return `<!-- Internal API config — TODO: move to vault before prod release
         api_gateway_url: https://acme-portal-api.azure-api.net/v2
         apim-subscription-key: ${APIM_KEY}
         dev_admin: ${ADMIN_EMAIL} / (password rotated to Key Vault)
         db_conn: Server=prod-db.acme-portal.internal;Database=AcmePortalDB;User Id=sa;Password=${process.env.HTML_COMMENT_DB_PASSWORD};
    -->`;
}

app.use(cors());
app.use(express.json());

// Global no-cache for live-demo visibility
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma',  'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// ─── Runtime-generated documents (P7) ────────────────────────────────────────
app.get('/config.json', (req, res) => {
    res.type('application/json').send(JSON.stringify(buildRuntimeConfig(), null, 2));
});
app.get('/asset-manifest.json', (req, res) => {
    res.type('application/json').send(JSON.stringify(buildAssetManifest(), null, 2));
});

// ─── HTML shell with the runtime secrets comment injected (P7) ────────────────
function sendShell(file, res) {
    let html = fs.readFileSync(path.join(__dirname, 'public', file), 'utf8')
        .replace('<!--RUNTIME_SECRETS_COMMENT-->', runtimeSecretsComment());
    // P6: serialize server-rendered state into the delivered HTML
    const state = JSON.stringify(buildHydrationState());
    html = html.replace('<!--SSR_STATE-->',
        '<script>window.__APP_STATE__ = ' + state + ';</script>');
    res.type('html').send(html);
}
app.get(['/', '/index.html'], (req, res) => sendShell('index.html', res));
app.get('/dashboard.html',    (req, res) => sendShell('dashboard.html', res));

// Built front-end bundle (P4 secrets are inlined here by `vite build`)
app.use('/js', express.static(path.join(__dirname, 'dist', 'js'), {
    etag: false, lastModified: false
}));
// Static assets (css, vendor lib, sitemap) — index:false so '/' hits the route above
app.use(express.static(path.join(__dirname, 'public'), {
    index: false, etag: false, lastModified: false
}));

// In-memory revocation list
const revokedTokens = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Auth middleware
// ─────────────────────────────────────────────────────────────────────────────
function requireToken(req, res, next) {
    const subKey = req.headers['ocp-apim-subscription-key']
                || req.headers['apim-subscription-key'];
    if (!subKey || subKey !== APIM_KEY) {
        return res.status(401).json({ error: 'Missing or invalid Ocp-Apim-Subscription-Key' });
    }
    const auth  = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ error: 'No Bearer token provided' });
    if (revokedTokens.has(token)) return res.status(401).json({ error: 'Token has been revoked' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
    const { email, password } = req.body || {};
    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
        const token = jwt.sign({ role: 'admin', email }, JWT_SECRET, { expiresIn: '2h' });
        return res.json({ IsSuccess: true, token, role: 'admin', name: 'Admin User' });
    }
    const customer = customers.find(c => c.email === email);
    if (!customer) {
        return res.status(401).json({ IsSuccess: false, error: 'Invalid credentials' });
    }
    if (customer.password !== password) {
        const numericId = parseInt(String(customer.id).replace('CUST-', ''), 10);
        return res.status(401).json({
            IsSuccess:    false,
            error:        'Email exists but password is incorrect',
            email:        customer.email,
            userName:     customer.name,
            userProfileID:numericId,
            role:         customer.role || 'customer'
        });
    }
    const token = jwt.sign(
        { role: 'customer', customerId: customer.id, email },
        JWT_SECRET, { expiresIn: '2h' }
    );
    res.json({ IsSuccess: true, token, role: 'customer', name: customer.name, customerId: customer.id });
});

app.post('/api/logout', (req, res) => {
    const auth  = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (token) revokedTokens.add(token);
    res.json({ message: 'Logged out. Token revoked.' });
});

app.post('/api/auth/generate-token', (req, res) => {
    const appId       = req.headers['appid']       || (req.body && req.body.appId);
    const appKey      = req.headers['appkey']      || (req.body && req.body.appKey);
    const resourceKey = req.headers['resourcekey'] || (req.body && req.body.resourceKey);

    if (!appId || !appKey || !resourceKey) {
        return res.status(400).json({
            error: 'appId, appKey and resourceKey are required (as headers or in JSON body)'
        });
    }

    if (appId === AAD_APP_ID && appKey === AAD_APP_KEY && resourceKey === AAD_RESOURCE_KEY) {
        const token = jwt.sign(
            { role: 'admin', source: 'apim', app_id: appId },
            JWT_SECRET, { expiresIn: '4h' }
        );
        return res.json({
            access_token: token,
            resource_key: AAD_RESOURCE_KEY,
            token_type:   'Bearer',
            expires_in:   14400,
            scope:        'policies.read claims.read users.read'
        });
    }

    if (appId === AAD_ADMIN_APP_ID && appKey === AAD_ADMIN_APP_KEY && resourceKey === AAD_ADMIN_RESOURCE_KEY) {
        const token = jwt.sign(
            { role: 'superadmin', source: 'sp', app_id: appId },
            JWT_SECRET, { expiresIn: '4h' }
        );
        return res.json({
            access_token: token,
            resource_key: AAD_ADMIN_RESOURCE_KEY,
            token_type:   'Bearer',
            expires_in:   14400,
            scope:        'admin.config.read admin.diagnostics admin.dbconn'
        });
    }

    return res.status(401).json({ error: 'Invalid Azure AD application credentials' });
});

function requireSpToken(req, res, next) {
    requireToken(req, res, () => {
        if (req.user.source !== 'sp') {
            return res.status(403).json({ error: 'SP-sourced token required' });
        }
        next();
    });
}

app.get('/api/admin/internal-config', requireSpToken, (req, res) => {
    res.json({
        IsSuccess: true,
        config: {
            jwt_secret_fingerprint: 'SHA256:' + require('crypto').createHash('sha256').update(JWT_SECRET).digest('hex').slice(0,16),
            db_conn_string:         DB_CONN_STR,
            apim_subscription_key:  APIM_KEY,
            admin_email:            ADMIN_EMAIL,
            admin_password:         ADMIN_PASS,
            internal_services: [
                'https://claims-svc.acme-portal.internal/api/v1',
                'https://policy-svc.acme-portal.internal/api/v1',
                'https://reporting.acme-portal.internal/api'
            ]
        }
    });
});

app.get('/api/admin/diagnostics', requireSpToken, (req, res) => {
    res.json({
        IsSuccess: true,
        tenant: 'acme-portal-prod-2024',
        sp_id:  req.user.sp_id,
        privileges_granted_by_token: ['admin.config.read', 'admin.diagnostics', 'admin.dbconn'],
        runtime: {
            uptime_seconds:       Math.floor(process.uptime()),
            node_version:         process.version,
            customer_count:       customers.length,
            policy_count:         policies.length,
            claim_count:          claims.length
        }
    });
});

app.get('/api/policies', requireToken, (req, res) => {
    if (req.user.role === 'admin' || req.user.source === 'apim') {
        return res.json({ policies, total: policies.length });
    }
    const mine = policies.filter(p => p.customerId === req.user.customerId);
    res.json({ policies: mine, total: mine.length });
});

app.get('/api/claims/:policyId', requireToken, (req, res) => {
    const result = claims.filter(c => c.policyId === req.params.policyId);
    if (!result.length) return res.status(404).json({ error: 'No claims found for policy' });
    res.json({ claims: result, total: result.length });
});

app.get('/api/users', requireToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.source !== 'apim') {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const safe = customers.map(({ password, ...rest }) => rest);
    res.json({ users: safe, total: safe.length });
});

app.get('/api/me', requireToken, (req, res) => {
    if (req.user.role === 'admin') return res.json({ name: 'Admin', role: 'admin', email: ADMIN_EMAIL });
    const c = customers.find(x => x.id === req.user.customerId);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const { password, ...safe } = c;
    res.json(safe);
});

app.get('/api/stats', requireToken, (req, res) => {
    if (req.user.role !== 'admin' && req.user.source !== 'apim') {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    res.json({
        totalCustomers: customers.length,
        totalPolicies:  policies.length,
        totalClaims:    claims.length,
        openClaims:     claims.filter(c => c.status === 'Open').length,
        totalExposure:  claims.reduce((s, c) => s + c.amount, 0)
    });
});

app.get('/api/profile', requireToken, (req, res) => {
    if (req.query.id !== undefined) {
        const idx = parseInt(req.query.id, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= customers.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { password, ...profile } = customers[idx];
        return res.json({ ...profile, numericId: idx + 1 });
    }
    if (req.user.role === 'admin') {
        return res.json({ id: 'admin', numericId: 0, name: 'Admin User', email: ADMIN_EMAIL, role: 'admin', memberSince: '2014-01-01' });
    }
    const customer = customers.find(c => c.id === req.user.customerId);
    if (!customer) return res.status(404).json({ error: 'Profile not found' });
    const { password, ...profile } = customer;
    res.json({ ...profile, numericId: parseInt(customer.id.replace('CUST-', ''), 10) });
});

app.get('/api/profile/password', requireToken, (req, res) => {
    const idx = parseInt(req.query.id, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= customers.length) {
        return res.status(404).json({ IsSuccess: false, error: 'User not found' });
    }
    const c = customers[idx];
    const numericId = parseInt(String(c.id).replace('CUST-', ''), 10) || (idx + 1);
    res.json({
        IsSuccess:     true,
        userProfileID: numericId,
        userName:      c.name,
        email:         c.email,
        role:          c.role || 'customer',
        passwordHash:  c.passwordHash,
        salt:          c.salt
    });
});

app.put('/api/profile/password', requireToken, (req, res) => {
    const { id, currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (id !== undefined && id !== null) {
        const idx = parseInt(id, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= customers.length) {
            return res.status(404).json({ error: 'User not found' });
        }
        customers[idx].password = newPassword;
        return res.json({ message: 'Password updated', userId: customers[idx].id });
    }
    if (req.user.role === 'admin') {
        return res.json({ message: 'Admin password updated', userId: 'admin' });
    }
    const customer = customers.find(c => c.id === req.user.customerId);
    if (!customer) return res.status(404).json({ error: 'Profile not found' });
    if (customer.password !== currentPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    customer.password = newPassword;
    res.json({ message: 'Password updated', userId: customer.id });
});

app.post('/api/account/info', requireToken, (req, res) => {
    const id = req.body && req.body.userProfileID;
    const idx = parseInt(id, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= customers.length) {
        return res.status(404).json({ IsSuccess: false, error: 'User not found' });
    }
    const c = customers[idx];
    const policy = policies.find(p => p.customerId === c.id);
    const numericId = parseInt(String(c.id).replace('CUST-', ''), 10) || (idx + 1);
    res.json({
        IsSuccess:     true,
        userProfileID: numericId,
        userName:      c.name,
        email:         c.email,
        policyNumber:  policy ? policy.policyId : null
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// HTTP + WebSocket server
// ─────────────────────────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws/notifications' });

wss.on('connection', (ws, req) => {
    const url   = new URL(req.url, `http://localhost:${PORT}`);
    const token = url.searchParams.get('token') || '';
    console.log('[WS] Client connected, token prefix:', token.substring(0, 30) + '…');

    ws.send(JSON.stringify({
        type:    'welcome',
        message: 'Connected to InsecureShield live notifications',
        server:  'prod-ws.acme-portal.internal',
        apiKey:  WS_INTERNAL_KEY
    }));

    const interval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type:      'notification',
                message:   `Claim CLAIM-${Math.floor(Math.random() * 9000 + 1000)} status updated`,
                timestamp: new Date().toISOString()
            }));
        }
    }, 15000);

    ws.on('close', () => clearInterval(interval));
});

server.listen(PORT, '0.0.0.0', () => {
    const networkIP  = getNetworkIP();
    const networkUrl = `http://${networkIP}:${PORT}`;

    console.log('\n  ╔══════════════════════════════════════╗');
    console.log('  ║   InsecureShield Claims Portal Demo    ║');
    console.log('  ╚══════════════════════════════════════╝');
    console.log(`\n  Local:    http://localhost:${PORT}`);
    console.log(`  Network:  ${networkUrl}`);
    if (process.env.OPEN_BROWSER === '1') openBrowser(networkUrl);
});
