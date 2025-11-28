function readCookie(name) {
    return document.cookie.split(';').map(c => c.trim()).filter(Boolean).reduce((acc, pair) => {
        if (acc) return acc;
        const [k, ...rest] = pair.split('=');
        if (k === name) return decodeURIComponent(rest.join('='));
        return '';
    }, '') || null;
}

function normalizeToken(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return null;
    return trimmed;
}

const state = {
    token: normalizeToken(localStorage.getItem('blueSpokeToken') || readCookie('blue_spoke_token')),
    user: null,
    view: 'overview',
    shellReady: false,
    customers: [],
    customerQuery: { q: '', page: 1, size: 25 },
    selectedCustomerId: null,
    customerWarranties: [],
    inventory: [],
    inventoryQuery: { q: '', brand: '', page: 1, size: 25 },
    workOrders: [],
    workOrderQuery: { status: 'open,in_progress,awaiting_parts', page: 1, size: 25 },
    workOrderDetail: null,
    timeClockStatus: [],
    nextSlot: null,
    mechanicDay: [],
    mechanicDayMeta: null,
};

const dom = {};
const root = document.getElementById('app');
const toastRoot = document.createElement('div');
toastRoot.className = 'flash-stack';
document.body.appendChild(toastRoot);

function notify(message, type = 'info', timeout = 4200) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastRoot.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => el.remove(), 220);
    }, timeout);
}

function formatMinutes(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    const minutes = Math.max(0, Number(value));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function handleLogout(silent = false) {
    state.token = null;
    state.user = null;
    state.shellReady = false;
    localStorage.removeItem('blueSpokeToken');
    document.cookie = 'blue_spoke_token=; Max-Age=0; path=/; SameSite=Lax';
    if (!silent) notify('Signed out', 'info');
    renderLogin();
}

const AUTH_DEV_COMPAT = (() => {
    try { return localStorage.getItem('authDevCompat') === '1'; } catch { return false; }
})();

async function apiRequest(path, { method = 'GET', body, query, auth = true } = {}) {
    let url = path;
    const qp = query ? { ...query } : {};
    if (auth && state.token && AUTH_DEV_COMPAT) { qp.token = state.token; }
    if (qp && Object.keys(qp).length) {
        const params = new URLSearchParams();
        Object.entries(qp).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.append(String(key), String(value));
            }
        });
        const qs = params.toString();
        if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    const headers = {};
    if (auth && state.token) {
        headers.Authorization = `Bearer ${state.token}`;
        headers['X-Auth-Token'] = state.token;
    }
    let payload;
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        let payloadBody = body;
        // add token redundantly into the body for non-GET
        if (AUTH_DEV_COMPAT && auth && state.token && typeof body === 'object' && body !== null && method.toUpperCase() !== 'GET' && !('token' in body)) {
            payloadBody = { ...body, token: state.token };
        }
        payload = JSON.stringify(payloadBody);
    }
    let res = await fetch(url, { method, headers, body: payload, credentials: 'include' });
    async function parse(res) {
        let data = null; const text = await res.text();
        if (text) { try { data = JSON.parse(text); } catch { data = text; } }
        return data;
    }
    let data = await parse(res);
    if (res.status === 401 && auth) {
        // Try silent refresh at once
        try {
            const r = await fetch('/auth/refresh', {
                method: 'POST',
                headers: state.token ? { 'Authorization': `Bearer ${state.token}` } : undefined,
                credentials: 'include',
            });
            if (r.ok) {
                const j = await r.json();
                const newToken = normalizeToken(j.token);
                if (newToken) {
                    state.token = newToken;
                    localStorage.setItem('blueSpokeToken', newToken);
                    document.cookie = `blue_spoke_token=${encodeURIComponent(newToken)}; Path=/; SameSite=Lax`;
                    // rebuild the payload with fresh token if needed
                    let retryPayload = payload;
                    if (body !== undefined && typeof body === 'object' && body !== null && method.toUpperCase() !== 'GET') {
                        const bodyObj = { ...body, token: newToken };
                        retryPayload = JSON.stringify(bodyObj);
                    }
                    // retry original request once with updated token in headers; rebuild URL without an old token query
                    const retryHeaders = {};
                    retryHeaders['Authorization'] = `Bearer ${newToken}`;
                    retryHeaders['X-Auth-Token'] = newToken;
                    if (body !== undefined) retryHeaders['Content-Type'] = 'application/json';
                    let retryUrl = path;
                    const p = new URLSearchParams();
                    // include original non-token query params
                    if (query && Object.keys(query).length) {
                        Object.entries(query).forEach(([k,v])=>{ if (k !== 'token' && v!==undefined && v!==null && v!=='') p.append(String(k), String(v)); });
                    }
                    // add fresh token explicitly so servers that rely on a query can auth
                    if (AUTH_DEV_COMPAT) p.append('token', newToken);
                    const qs = p.toString();
                    if (qs) retryUrl += (retryUrl.includes('?') ? '&' : '?') + qs;
                    res = await fetch(retryUrl, { method, headers: retryHeaders, body: retryPayload, credentials: 'include' });
                    data = await parse(res);
                }
            }
        } catch { /* ignore */ }
        if (res.status === 401) {
            // Do not auto-logout - Added for debugging purposes
            notify('Unauthorized (401). Please try again.', 'error');
            throw new Error('Unauthorized (401)');
        }
    }
    if (!res.ok) {
        const msg = data?.error || (typeof data === 'string' ? data : res.statusText);
        throw new Error(msg);
    }
    return data;
}

function renderLogin() {
    root.innerHTML = `
        <div class="login-wrapper">
            <section class="login-card">
                <h1>Blue Spoke</h1>
                <p>Sign In</p>
                <form id="login-form">
                    <label>Email
                        <input type="email" name="email" placeholder="Email" required>
                    </label>
                    <label>Password
                        <input type="password" name="password" placeholder="••••••••" required>
                    </label>
                    <button type="submit" class="btn-primary">Sign in</button>
                </form>
            </section>
        </div>
    `;
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        const fd = new FormData(form);
        const email = fd.get('email');
        const password = fd.get('password');
        try {
            const res = await apiRequest('/auth/login', { method: 'POST', body: { email, password }, auth: false });
            const token = normalizeToken(res.token);
            if (!token) {
                notify('Login succeeded but no token returned by API', 'error');
                return;
            }
            state.token = token;
            localStorage.setItem('blueSpokeToken', token);
            document.cookie = `blue_spoke_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
            const user = res.user || {};
            state.user = user;
            const { full_name: fullName = 'there' } = user;
            notify(`Welcome back, ${fullName}`, 'success');
            await bootstrap();
        } catch (err) {
            notify(err.message, 'error');
        }
    });
}

function ensureShell() {
    if (state.shellReady) return;
    root.innerHTML = `
        <div class="app-shell">
            <aside class="sidebar">
                <div class="brand-stack">
                    <div class="brand">Blue Spoke</div>
                    <p class="muted">Service Console</p>
                </div>
                <div class="side-clock clock-control">
                    <div class="user-chip small">
                        <strong id="side-user-name">—</strong>
                        <button type="button" id="side-user-toggle" class="btn-ghost" title="Show roster">▾</button>
                    </div>
                    <span id="side-clock-chip" class="badge status-bad" title="Click to clock in/out">OUT</span>
                    <div id="side-clock-dropdown" class="clock-dropdown" hidden>
                        <h4>On shift</h4>
                        <ul id="side-roster-in"></ul>
                        <h4>Off shift</h4>
                        <ul id="side-roster-out"></ul>
                    </div>
                </div>
                <nav>
                    <button data-view="overview" class="active"><span class="nav-icon">🏠</span> Overview</button>
                    <button data-view="customers"><span class="nav-icon">👤</span> Customers</button>
                    <button data-view="inventory"><span class="nav-icon">📦</span> Inventory</button>
                    <button data-view="workorders"><span class="nav-icon">🗂️</span> Work Orders</button>
                    <button data-view="scheduling"><span class="nav-icon">📅</span> Scheduling</button>
                    <button data-view="warranties"><span class="nav-icon">🛡️</span> Warranties</button>
                </nav>
                <button id="logout-btn" class="btn-ghost">Sign out</button>
            </aside>
            <section class="main">
                <div class="content">
                    <section id="view-overview" class="view active">
                        <div class="module-grid">
                            <button class="module-tile" data-jump="#inventory-search">
                                <span class="tile-icon">🔍</span>
                                <strong>Item Search</strong>
                                <span>Find items and view details</span>
                            </button>
                            <button class="module-tile" data-jump="#inventory-create">
                                <span class="tile-icon">➕</span>
                                <strong>New Item</strong>
                                <span>Catalog a product</span>
                            </button>
                            <button class="module-tile" data-jump="#workorders-list">
                                <span class="tile-icon">🗂️</span>
                                <strong>Work Orders</strong>
                                <span>Monitor the queue</span>
                            </button>
                            <button class="module-tile" data-jump="#workorder-create">
                                <span class="tile-icon">🛠️</span>
                                <strong>Create Ticket</strong>
                                <span>Intake service jobs</span>
                            </button>
                            <button class="module-tile" data-jump="#schedule-next">
                                <span class="tile-icon">📅</span>
                                <strong>Scheduling</strong>
                                <span>Find bay availability</span>
                            </button>
                            <button class="module-tile" data-jump="#customers-search">
                                <span class="tile-icon">👤</span>
                                <strong>Customers</strong>
                                <span>Search and edit riders</span>
                            </button>
                        </div>
                        
                        
                    </section>

                    <section id="view-customers" class="view">
                        <div class="section-nav">
                            <button class="nav-card" data-section="customers-search">
                                <span class="tile-icon">🔍</span>
                                Customer search
                                <span>Lookup and filter CRM</span>
                            </button>
                            <button class="nav-card" data-section="customer-create">
                                <span class="tile-icon">➕</span>
                                New customer
                                <span>Add walk-ins or VIP riders</span>
                            </button>
                        </div>
                        <div class="section-panels">
                            <article class="card section-panel active" id="customers-search">
                                <h2>Customers</h2>
                                <form id="customers-search-form" class="two-col">
                                    <label>Search
                                        <input type="text" name="q" placeholder="Name or email">
                                    </label>
                                    <label>Page
                                        <input type="number" name="page" min="1" value="1">
                                    </label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Search</button>
                                        <button class="btn-ghost" type="button" id="customers-reset">Reset</button>
                                    </div>
                                </form>
                                <div class="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Phone</th>
                                                <th>City</th>
                                            </tr>
                                        </thead>
                                        <tbody id="customer-table-body">
                                            <tr><td colspan="4">No data yet.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="grid two" style="margin-top:1.25rem;">
                                    <div class="detail-block">
                                        <h3>Selected customer</h3>
                                        <div id="customer-detail" class="muted">Select a row to view more.</div>
                                    </div>
                                    <div class="detail-block">
                                        <h3>Warranties</h3>
                                        <div id="customer-warranties" class="muted">Select a customer to load warranties.</div>
                                    </div>
                                </div>
                            </article>
                            <article class="card section-panel" id="customer-create">
                                <h2>Create customer</h2>
                                <form id="customer-create-form" class="two-col">
                                    <label>First name<input name="first_name" required></label>
                                    <label>Last name<input name="last_name" required></label>
                                    <label>Email<input name="email" type="email"></label>
                                    <label>Phone<input name="phone"></label>
                                    <label>Street<input name="street"></label>
                                    <label>City<input name="city"></label>
                                    <label>Region<input name="region"></label>
                                    <label>Postal code<input name="postal_code"></label>
                                    <label>Country<input name="country"></label>
                                    <label class="full">Notes<textarea name="notes"></textarea></label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Save</button>
                                    </div>
                                </form>
                            </article>
                        </div>
                    </section>

                    <section id="view-inventory" class="view">
                        <div class="section-nav">
                            <button class="nav-card" data-section="inventory-search">
                                <span class="tile-icon">📦</span>
                                Search inventory
                                <span>Find parts, bikes, and kits</span>
                            </button>
                            <button class="nav-card" data-section="inventory-create">
                                <span class="tile-icon">➕</span>
                                Add inventory item
                                <span>Catalog new stock</span>
                            </button>
                        </div>
                        <div class="section-panels">
                            <article class="card section-panel active" id="inventory-search">
                                <h2>Inventory</h2>
                                <form id="inventory-search-form" class="two-col">
                                    <label>Search<input name="q" placeholder="SKU or name"></label>
                                    <label>Brand<input name="brand" placeholder="Exact brand name"></label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Search</button>
                                    </div>
                                </form>
                                <div class="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>SKU</th>
                                                <th>Name</th>
                                                <th>Brand</th>
                                                <th>Category</th>
                                                <th>Price</th>
                                            </tr>
                                        </thead>
                                        <tbody id="inventory-table-body">
                                            <tr><td colspan="5">No data yet.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                            <article class="card section-panel" id="inventory-create">
                                <h2>Create an inventory item</h2>
                                <p class="muted">Brand and category expect existing IDs; leave blank if unknown.</p>
                                <form id="inventory-create-form" class="two-col">
                                    <label>SKU<input name="sku" required></label>
                                    <label>Name<input name="name" required></label>
                                    <label>Brand ID<input name="brand_id" type="number" min="1"></label>
                                    <label>Category ID<input name="category_id" type="number" min="1"></label>
                                    <label>Cost<input name="cost" type="number" step="0.01"></label>
                                    <label>Price<input name="price" type="number" step="0.01"></label>
                                    <label>Reorder level<input name="reorder_level" type="number"></label>
                                    <label>Serialized?
                                        <select name="is_serialized">
                                            <option value="0">No</option>
                                            <option value="1">Yes</option>
                                        </select>
                                    </label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Create item</button>
                                    </div>
                                </form>
                            </article>
                        </div>
                    </section>

                    <section id="view-workorders" class="view">
                        <div class="section-nav">
                            <button class="nav-card" data-section="workorders-list">
                                <span class="tile-icon">🗂️</span>
                                Active tickets
                                <span>Monitor the queue</span>
                            </button>
                            <button class="nav-card" data-section="workorder-create">
                                <span class="tile-icon">📝</span>
                                New work order
                                <span>Book service and intake bikes</span>
                            </button>
                            <button class="nav-card" data-section="workorders-calendar">
                                <span class="tile-icon">📆</span>
                                Calendar
                                <span>Current tickets by day</span>
                            </button>
                            <button class="nav-card" data-section="workorder-edit">
                                <span class="tile-icon">✏️</span>
                                Edit ticket
                                <span>Modify an existing order</span>
                            </button>
                        </div>
                        <div class="section-panels">
                            <article class="card section-panel active" id="workorders-list">
                                <h2>Work orders</h2>
                                <form id="workorders-filter-form" class="two-col">
                                    <label>Status filter
                                        <input name="status" placeholder="open,in_progress,awaiting_parts">
                                    </label>
                                    <label>Page
                                        <input type="number" name="page" min="1" value="1">
                                    </label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Apply</button>
                                    </div>
                                </form>
                                <div class="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Status</th>
                                                <th>Opened</th>
                                                <th>Customer</th>
                                                <th>Bike</th>
                                                <th>Assigned</th>
                                            </tr>
                                        </thead>
                                        <tbody id="wo-table-body">
                                            <tr><td colspan="6">No data yet.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="grid two" style="margin-top:1.25rem;">
                                    <div class="detail-block">
                                        <h3>Details</h3>
                                        <div id="wo-detail" class="muted">Select a work order to inspect.</div>
                                    </div>
                                    <div class="detail-block">
                                        <h3>Update & parts</h3>
                                        <form id="status-update-form">
                                            <label>New status
                                                <input name="status" placeholder="completed">
                                            </label>
                                            <button class="btn-secondary" type="submit">Update status</button>
                                        </form>
                                        <hr>
                                        <form id="parts-form">
                                            <label>Item ID<input name="item_id" type="number" required></label>
                                            <label>Quantity<input name="quantity" type="number" min="1" value="1"></label>
                                            <label>Notes<input name="notes"></label>
                                            <button class="btn-secondary" type="submit">Add part</button>
                                        </form>
                                    </div>
                                </div>
                            </article>
                            <article class="card section-panel workorder-shell" id="workorder-create">
                                <form id="workorder-create-form" class="workorder-form lightspeed">
                                    <div class="wo-layout">
                                        <div class="wo-status-column">
                                            <span class="wo-status-label">WAITING</span>
                                        </div>
                                        <div class="wo-content">
                                            <section class="wo-panel">
                                                <header class="wo-panel-header">
                                                    <div>
                                                        <p class="muted tiny-label">CUSTOMER</p>
                                                        <h3 class="wo-customer-name"><span id="wo-selected-customer-name">Walk-in Customer</span></h3>
                                                    </div>
                                                    <div class="wo-actions">
                                                        <button type="button" class="btn-flat" id="wo-find-customer">Find Customer</button>
                                                        <button type="button" class="btn-flat" id="wo-new-customer">New Customer</button>
                                                    </div>
                                                </header>
                                                <div class="wo-grid slim">
                                                    <label>Status<select name="status" id="wo-status-select">
                                                        <option value="waiting">Waiting</option>
                                                        <option value="open">Open</option>
                                                        <option value="in_progress">In Progress</option>
                                                        <option value="awaiting_parts">Awaiting Parts</option>
                                                        <option value="finished">Finished</option>
                                                        <option value="cancelled">Cancelled</option>
                                                        <option value="estimate">Estimate</option>
                                                    </select></label>
                                                    <input name="customer_id" id="wo-customer-id" type="hidden" required>
                                                    <label>Employee
                                                        <select name="assigned_to" id="wo-employee-select">
                                                            <option value="">Select employee…</option>
                                                        </select>
                                                    </label>
                                                    <label>Customer Item<select name="bike_id" id="wo-customer-bike">
                                                        <option value="">None or New Item</option>
                                                    </select></label>
                                                    <label>Date In<input name="promised_at" type="datetime-local"></label>
                                                </div>
                                                <!-- Description/Color/Size/Serial moved to Bike Details -->
                                            </section>
                                            <section class="wo-panel">
                                                <header class="wo-panel-header">
                                                    <h3>Bike Details</h3>
                                                </header>
                                                <div class="wo-grid slim">
                                                    <label>Brand<input name="bike_brand"></label>
                                                    <label>Model<input name="bike_model"></label>
                                                    <label>Year<input name="bike_year" type="number"></label>
                                                    <label>Description<input name="bike_notes"></label>
                                                    <label>Color<input name="bike_color"></label>
                                                    <label>Size<input name="bike_size"></label>
                                                    <label>Serial<input name="bike_serial"></label>
                                                </div>
                                            </section>
                                            <section class="wo-panel">
                                                <header class="wo-panel-header"><h3>Internal Note</h3></header>
                                                <textarea name="internal_notes" rows="3" placeholder="Internal note"></textarea>
                                            </section>
                                            <section class="wo-panel">
                                                <header class="wo-panel-header">
                                                    <h3>Items & Labor</h3>
                                                </header>
                                                <div class="addline-toolbar">
                                                    <div class="addline-group">
                                                        <input id="add-part-q" placeholder="Search inventory…">
                                                        <button type="button" id="add-part-search" class="btn-flat">Search Items</button>
                                                    </div>
                                                    <div class="addline-group">
                                                        <input id="add-service-q" placeholder="Search services…">
                                                        <button type="button" id="add-service-search" class="btn-flat">Search Services</button>
                                                    </div>
                                                </div>
                                                <div class="addline-results" id="addline-results"></div>
                                                <div class="table-container" style="margin-top:0.6rem;">
                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                <th>Type</th><th>Description</th><th>Employee</th><th>Status</th><th>Price/Time</th><th>Qty</th><th>Reserved</th><th>Subtotal</th><th></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody id="staged-lines">
                                                            <tr><td colspan="6">No lines added yet.</td></tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </section>
                                        </div>
                                        <aside class="wo-summary-column">
                                            <div class="wo-summary-card">
                                                <h4>Estimate</h4>
                                                <dl>
                                                    <div><dt>Labor</dt><dd>$0.00</dd></div>
                                                    <div><dt>Parts</dt><dd>$0.00</dd></div>
                                                    <div><dt>Tax</dt><dd>$0.00</dd></div>
                                                </dl>
                                                <div class="wo-total">
                                                    <span>Total</span>
                                                    <strong>$0.00</strong>
                                                </div>
                                                <button class="btn-primary" type="submit">Create Work Order</button>
                                            </div>
                                        </aside>
                                    </div>
                                </form>
                                <!-- Customer Picker Modal -->
                                <div class="modal" id="customer-picker" hidden>
                                    <div class="modal-card">
                                        <div class="modal-header">
                                            <strong id="customer-picker-title">Find Customer</strong>
                                            <button type="button" class="btn-ghost" id="customer-picker-close">✕</button>
                                        </div>
                                        <div class="modal-body" id="customer-picker-search-pane">
                                            <input id="customer-picker-search" placeholder="Search by name or email" />
                                            <div class="table-container" style="margin-top:0.5rem; max-height:260px; overflow:auto;">
                                                <table>
                                                    <thead><tr><th>Name</th><th>Email</th><th>City</th></tr></thead>
                                                    <tbody id="customer-picker-results"><tr><td colspan="3">Type to search…</td></tr></tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div class="modal-body" id="customer-picker-create-pane" hidden>
                                            <form id="customer-create-inline-form" class="two-col">
                                                <label>First<input name="first_name" required></label>
                                                <label>Last<input name="last_name" required></label>
                                                <label>Email<input name="email" type="email"></label>
                                                <label>Phone<input name="phone"></label>
                                                <div class="form-actions full">
                                                    <button class="btn-primary" type="submit">Create & Attach</button>
                                                    <button class="btn-ghost" type="button" id="customer-picker-cancel">Cancel</button>
                                                </div>
                                            </form>
                                        </div>
                                        <div class="modal-footer">
                                            <button class="btn-secondary" type="button" id="customer-picker-switch-new">Create New</button>
                                            <button class="btn-secondary" type="button" id="customer-picker-switch-search">Search</button>
                                        </div>
                                    </div>
                                </div>
                            </article>
                            <article class="card section-panel" id="workorders-calendar">
                                <div class="cal-header">
                                    <button class="btn-secondary" type="button" id="cal-prev">‹</button>
                                    <strong id="cal-title"></strong>
                                    <button class="btn-secondary" type="button" id="cal-next">›</button>
                                </div>
                                <div class="calendar-grid" id="calendar-grid"></div>
                                <div class="cal-detail" id="calendar-detail">
                                    <div class="muted">Select a ticket to view/edit.</div>
                                </div>
                            </article>
                            <article class="card section-panel" id="workorder-edit">
                                <form id="workorder-edit-form" class="workorder-form lightspeed">
                                    <div class="wo-layout">
                                        <div class="wo-status-column" id="woe-rail">
                                            <span class="wo-status-label" id="woe-rail-label">OPEN</span>
                                        </div>
                                        <div class="wo-content">
                                            <section class="wo-panel">
                                                <header class="wo-panel-header">
                                                    <div>
                                                        <p class="muted tiny-label">CUSTOMER</p>
                                                        <h3 class="wo-customer-name"><span id="woe-selected-customer-name">—</span></h3>
                                                    </div>
                                                    <div class="wo-actions">
                                                        <button type="button" class="btn-flat" id="woe-find-customer">Find Customer</button>
                                                        <button type="button" class="btn-flat" id="woe-new-customer">New Customer</button>
                                                    </div>
                                                </header>
                                                <div class="wo-grid slim">
                                                    <input type="hidden" id="woe-workorder-id" name="id">
                                                    <label>Status<select name="status" id="woe-status-select">
                                                        <option value="waiting">Waiting</option>
                                                        <option value="open">Open</option>
                                                        <option value="in_progress">In Progress</option>
                                                        <option value="awaiting_parts">Awaiting Parts</option>
                                                        <option value="finished">Finished</option>
                                                        <option value="cancelled">Cancelled</option>
                                                        <option value="estimate">Estimate</option>
                                                    </select></label>
                                                    <input name="customer_id" id="woe-customer-id" type="hidden" required>
                                                    <label>Employee
                                                        <select name="assigned_to" id="woe-employee-select">
                                                            <option value="">Select employee…</option>
                                                        </select>
                                                    </label>
                                                    <label>Customer Item<select name="bike_id" id="woe-customer-bike">
                                                        <option value="">None or New Item</option>
                                                    </select></label>
                                                    <label>Date In<input name="promised_at" id="woe-promised-at" type="datetime-local"></label>
                                                </div>
                                            </section>
                                            <section class="wo-panel">
                                                <header class="wo-panel-header">
                                                    <h3>Bike Details</h3>
                                                </header>
                                                <div class="wo-grid slim">
                                                    <label>Brand<input name="bike_brand" id="woe-bike_brand"></label>
                                                    <label>Model<input name="bike_model" id="woe-bike_model"></label>
                                                    <label>Year<input name="bike_year" id="woe-bike_year" type="number"></label>
                                                    <label>Description<input name="bike_notes" id="woe-bike_notes"></label>
                                                    <label>Color<input name="bike_color" id="woe-bike_color"></label>
                                                    <label>Size<input name="bike_size" id="woe-bike_size"></label>
                                                    <label>Serial<input name="bike_serial" id="woe-bike_serial"></label>
                                                </div>
                                            </section>
                                            <section class="wo-panel">
                                                <header class="wo-panel-header"><h3>Internal Note</h3></header>
                                                <textarea name="internal_notes" id="woe-internal-notes" rows="3" placeholder="Internal notes"></textarea>
                                            </section>
                                            <section class="wo-panel">
                                                <header class="wo-panel-header"><h3>Items & Labor</h3></header>
                                                <div class="addline-toolbar">
                                                    <div class="addline-group">
                                                        <input id="add-part-q-edit" placeholder="Search inventory…">
                                                        <button type="button" id="add-part-search-edit" class="btn-flat">Search Items</button>
                                                    </div>
                                                    <div class="addline-group">
                                                        <input id="add-service-q-edit" placeholder="Search services…">
                                                        <button type="button" id="add-service-search-edit" class="btn-flat">Search Services</button>
                                                    </div>
                                                </div>
                                                <div id="edit-addline-results" class="pill-list" style="margin-top:0.5rem;"></div>
                                                <div class="table-container" style="margin-top:0.5rem;">
                                                    <table>
                                                        <thead><tr><th>Type</th><th>Description</th><th>Qty</th><th>Price</th><th>Subtotal</th><th></th></tr></thead>
                                                        <tbody id="woe-lines"><tr><td colspan="6">No lines</td></tr></tbody>
                                                    </table>
                                                </div>
                                            </section>
                                        </div>
                                        <aside class="wo-summary">
                                            <div class="wo-summary-card">
                                                <h3>Totals</h3>
                                                <dl>
                                                    <div><dt>Labor</dt><dd id="woe-labor">$0.00</dd></div>
                                                    <div><dt>Parts</dt><dd id="woe-parts">$0.00</dd></div>
                                                    <div><dt>Tax</dt><dd>$0.00</dd></div>
                                                </dl>
                                                <div class="wo-total">
                                                    <span>Total</span>
                                                    <strong id="woe-total">$0.00</strong>
                                                </div>
                                                <button class="btn-primary" type="submit">Save Changes</button>
                                            </div>
                                        </aside>
                                    </div>
                                </form>
                            </article>
                        </div>
                    </section>

                    <section id="view-scheduling" class="view">
                        <div class="section-nav">
                            <button class="nav-card" data-section="schedule-next">
                                <span class="tile-icon">📅</span>
                                Next slot finder
                                <span>Locate bay availability</span>
                            </button>
                            <button class="nav-card" data-section="mechanic-day">
                                <span class="tile-icon">👨‍🔧</span>
                                Mechanic day view
                                <span>See a tech's lineup</span>
                            </button>
                            <button class="nav-card" data-section="appointment-create">
                                <span class="tile-icon">⏱️</span>
                                Schedule appointment
                                <span>Book service windows</span>
                            </button>
                        </div>
                        <div class="section-panels">
                            <article class="card section-panel active" id="schedule-next">
                                <h2>Find the next slot</h2>
                                <form id="schedule-next-form" class="two-col">
                                    <label>Mechanic ID<input name="mechanic_id" type="number"></label>
                                    <label>Location ID<input name="location_id" type="number"></label>
                                    <label>Duration (minutes)<input name="duration_minutes" type="number" value="60"></label>
                                    <label>From<input name="from" type="datetime-local"></label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Lookup</button>
                                    </div>
                                </form>
                            </article>
                            <article class="card section-panel" id="mechanic-day">
                                <h2>Mechanic day</h2>
                                <form id="mechanic-day-form" class="two-col">
                                    <label>Mechanic ID<input name="mechanic_id" type="number" required></label>
                                    <label>Day<input name="day" type="date"></label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Load day</button>
                                    </div>
                                </form>
                                <div id="mechanic-day-results" class="detail-block" style="margin-top:1rem;"></div>
                            </article>
                            <article class="card section-panel" id="appointment-create">
                                <h2>Create appointment</h2>
                                <form id="appointment-form" class="two-col">
                                    <label>Work order ID<input name="work_order_id" type="number" required></label>
                                    <label>Start at<input name="start_at" type="datetime-local" required></label>
                                    <label>End at<input name="end_at" type="datetime-local" required></label>
                                    <label>Assigned to<input name="assigned_to" type="number"></label>
                                    <label>Location ID<input name="location_id" type="number"></label>
                                    <label>Status<input name="status" value="scheduled"></label>
                                    <label>Notes<textarea name="notes"></textarea></label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Create appointment</button>
                                    </div>
                                </form>
                            </article>
                        </div>
                    </section>

                    <section id="view-warranties" class="view">
                        <div class="section-nav">
                            <button class="nav-card" data-section="warranty-customer">
                                <span class="tile-icon">📇</span>
                                Customer warranties
                                <span>Lookup registrations</span>
                            </button>
                            <button class="nav-card" data-section="warranty-register">
                                <span class="tile-icon">🛡️</span>
                                Register warranty
                                <span>Add coverage for a bike</span>
                            </button>
                            <button class="nav-card" data-section="warranty-template">
                                <span class="tile-icon">⚙️</span>
                                Warranty templates
                                <span>Manage shop programs</span>
                            </button>
                        </div>
                        <div class="section-panels">
                            <article class="card section-panel active" id="warranty-customer">
                                <h2>Customer warranties</h2>
                                <form id="warranty-customer-form" class="two-col">
                                    <label>Customer ID<input name="customer_id" type="number" required></label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Load warranties</button>
                                    </div>
                                </form>
                                <div class="table-container" style="margin-top:1rem;">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Name</th>
                                                <th>Status</th>
                                                <th>Serial</th>
                                                <th>Dates</th>
                                            </tr>
                                        </thead>
                                        <tbody id="warranty-table-body">
                                            <tr><td colspan="5">No customer selected.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                            <article class="card section-panel" id="warranty-register">
                                <h2>Register warranty for a customer</h2>
                                <form id="warranty-register-form" class="two-col">
                                    <label>Customer ID<input name="customer_id" type="number" required></label>
                                    <label>Warranty template ID<input name="warranty_id" type="number" required></label>
                                    <label>Bike ID<input name="bike_id" type="number"></label>
                                    <label>Inventory item ID<input name="inventory_item_id" type="number"></label>
                                    <label>Serial number<input name="serial_number"></label>
                                    <label>Status<input name="status" value="active"></label>
                                    <label>Purchase date<input name="purchase_date" type="date"></label>
                                    <label>Start date<input name="start_date" type="date"></label>
                                    <label>Duration (months)<input name="duration_months" type="number"></label>
                                    <label>Notes<textarea name="notes"></textarea></label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Register warranty</button>
                                    </div>
                                </form>
                            </article>
                            <article class="card section-panel" id="warranty-template">
                                <h2>Create a warranty template <span class="muted">(owner / manager)</span></h2>
                                <form id="warranty-template-form" class="two-col">
                                    <label>Name<input name="name" required></label>
                                    <label>Brand ID<input name="brand_id" type="number"></label>
                                    <label>Item ID<input name="item_id" type="number"></label>
                                    <label>Duration (months)<input name="duration_months" type="number" value="12"></label>
                                    <label>Terms<textarea name="terms"></textarea></label>
                                    <div class="form-actions">
                                        <button class="btn-primary" type="submit">Create template</button>
                                    </div>
                                </form>
                            </article>
                        </div>
                    </section>
                </div>
            </section>
        </div>
    `;

    dom.navButtons = root.querySelectorAll('.sidebar button[data-view]');
    dom.heroGreeting = document.getElementById('hero-greeting');
    dom.logout = document.getElementById('logout-btn');
    dom.refresh = document.getElementById('refresh-all');
    dom.userName = document.getElementById('user-name');
    dom.userEmail = document.getElementById('user-email');
    dom.userRole = document.getElementById('user-role');
    dom.sideClockChip = document.getElementById('side-clock-chip');
    dom.sideClockDropdown = document.getElementById('side-clock-dropdown');
    dom.sideRosterIn = document.getElementById('side-roster-in');
    dom.sideRosterOut = document.getElementById('side-roster-out');
    dom.sideUserToggle = document.getElementById('side-user-toggle');
    dom.views = root.querySelectorAll('.view');
    dom.clockForm = document.getElementById('clock-form');

    dom.navButtons.forEach(btn => {
        btn.addEventListener('click', () => setActiveView(btn.dataset.view));
    });
    dom.logout.addEventListener('click', () => handleLogout());
    if (dom.refresh) dom.refresh.addEventListener('click', () => { void refreshEverything(); });
    if (dom.sideClockChip) dom.sideClockChip.addEventListener('click', () => promptClockToggle());
    if (dom.sideUserToggle) dom.sideUserToggle.addEventListener('click', () => {
        if (dom.sideClockDropdown) dom.sideClockDropdown.hidden = !dom.sideClockDropdown.hidden;
    });
    document.addEventListener('click', (e) => {
        const within = e.target.closest?.('.side-clock');
        if (!within && dom.sideClockDropdown) dom.sideClockDropdown.hidden = true;
    });

    root.querySelector('#customers-search-form').addEventListener('submit', handleCustomerSearch);
    root.querySelector('#customers-reset').addEventListener('click', async () => {
        state.customerQuery = { q: '', page: 1, size: 25 };
        root.querySelector('#customers-search-form').reset();
        await loadCustomers();
    });
    root.querySelector('#customer-create-form').addEventListener('submit', handleCustomerCreate);
    root.querySelector('#customer-table-body').addEventListener('click', async (evt) => {
        const row = evt.target.closest('tr[data-id]');
        if (!row) return;
        state.selectedCustomerId = Number(row.dataset.id);
        renderCustomerDetail();
        await loadWarranties(state.selectedCustomerId);
    });

    root.querySelector('#inventory-search-form').addEventListener('submit', handleInventorySearch);
    root.querySelector('#inventory-create-form').addEventListener('submit', handleInventoryCreate);

    root.querySelector('#workorders-filter-form').addEventListener('submit', handleWorkOrderFilter);
    root.querySelector('#wo-table-body').addEventListener('click', async (evt) => {
        const row = evt.target.closest('tr[data-id]');
        if (!row) return;
        await openWorkOrderEdit(Number(row.dataset.id));
    });
    root.querySelector('#workorder-create-form').addEventListener('submit', handleWorkOrderCreate);
    const editForm = root.querySelector('#workorder-edit-form');
    if (editForm) editForm.addEventListener('submit', handleWorkOrderUpdate);
    root.querySelector('#status-update-form').addEventListener('submit', handleStatusUpdate);
    root.querySelector('#parts-form').addEventListener('submit', handleAddPart);

    root.querySelector('#schedule-next-form').addEventListener('submit', handleNextSlot);
    root.querySelector('#appointment-form').addEventListener('submit', handleAppointmentCreate);
    root.querySelector('#mechanic-day-form').addEventListener('submit', handleMechanicDay);

    root.querySelector('#warranty-customer-form').addEventListener('submit', handleWarrantyLookup);
    root.querySelector('#warranty-register-form').addEventListener('submit', handleWarrantyRegister);
    root.querySelector('#warranty-template-form').addEventListener('submit', handleTemplateCreate);
    if (dom.clockForm) dom.clockForm.addEventListener('submit', handleClockForm);
    registerSectionNav();
    registerModuleTiles();

    // Status rail behavior on workorder creates
    const statusSelect = root.querySelector('#wo-status-select');
    const rail = root.querySelector('#workorder-create .wo-status-column');
    const railLabel = root.querySelector('#workorder-create .wo-status-label');
    if (statusSelect && rail && railLabel) {
        const applyRail = (uiStatus) => {
            const cls = {
                waiting: 'rail-waiting',
                open: 'rail-open',
                finished: 'rail-finished',
                cancelled: 'rail-cancelled',
                estimate: 'rail-estimate',
                in_progress: 'rail-progress',
                awaiting_parts: 'rail-awaiting',
            };
            rail.className = 'wo-status-column';
            rail.classList.add(cls[uiStatus] || 'rail-open');
            railLabel.textContent = (uiStatus || 'open').replace('_',' ').toUpperCase();
        };
        applyRail(statusSelect.value);
        statusSelect.addEventListener('change', () => applyRail(statusSelect.value));
    }
    // Status rail on an edit form
    const statusSelectEdit = root.querySelector('#woe-status-select');
    const railEdit = root.querySelector('#woe-rail');
    const railLabelEdit = root.querySelector('#woe-rail-label');
    if (statusSelectEdit && railEdit && railLabelEdit) {
        const applyRail = (uiStatus) => {
            const cls = { waiting:'rail-waiting', open:'rail-open', finished:'rail-finished', cancelled:'rail-cancelled', estimate:'rail-estimate', in_progress:'rail-progress', awaiting_parts:'rail-awaiting' };
            railEdit.className = 'wo-status-column';
            railEdit.classList.add(cls[uiStatus] || 'rail-open');
            railLabelEdit.textContent = (uiStatus || 'open').replace('_',' ').toUpperCase();
        };
        applyRail(statusSelectEdit.value);
        statusSelectEdit.addEventListener('change', () => applyRail(statusSelectEdit.value));
    }

    // Load employees for dropdown
    const employeeSelect = document.getElementById('wo-employee-select');
    async function loadEmployees() {
        if (!employeeSelect) return;
        try {
            const res = await apiRequest('/users');
            const items = res.items || [];
            state.employees = items;
            const opts = items.map(u => {
                const { id = '', full_name: fullName = '', role = '' } = u || {};
                const label = fullName ? `${fullName} (${role})` : `User #${id}`;
                return `<option value="${id}">${label}</option>`;
            }).join('');
            employeeSelect.innerHTML = '<option value="">Select employee…</option>' + opts;
        } catch (e) {
            // Keep a single fallback option
            employeeSelect.innerHTML = '<option value="">Select employee…</option>';
        }
    }
    void loadEmployees();

    // Customer picker wiring
    const openPicker = (mode) => {
        const modal = document.getElementById('customer-picker');
        if (!modal) return;
        modal.hidden = false;
        const searchPane = document.getElementById('customer-picker-search-pane');
        const createPane = document.getElementById('customer-picker-create-pane');
        if (mode === 'new') { createPane.hidden = false; searchPane.hidden = true; }
        else { createPane.hidden = true; searchPane.hidden = false; }
        if (!createPane.hidden) {
            const firstInput = createPane.querySelector('input[name="first_name"]');
            if (firstInput) firstInput.focus();
        } else {
            const search = document.getElementById('customer-picker-search');
            if (search) search.focus();
        }
    };
    const closePicker = () => { const modal = document.getElementById('customer-picker'); if (modal) modal.hidden = true; };

    const findBtn = document.getElementById('wo-find-customer');
    const newBtn = document.getElementById('wo-new-customer');
    const findBtnEdit = document.getElementById('woe-find-customer');
    const newBtnEdit = document.getElementById('woe-new-customer');
    const closeBtn = document.getElementById('customer-picker-close');
    const cancelInline = document.getElementById('customer-picker-cancel');
    const switchNew = document.getElementById('customer-picker-switch-new');
    const switchSearch = document.getElementById('customer-picker-switch-search');
    if (findBtn) findBtn.addEventListener('click', () => openPicker('search'));
    if (newBtn) newBtn.addEventListener('click', () => openPicker('new'));
    if (findBtnEdit) findBtnEdit.addEventListener('click', () => openPicker('search'));
    if (newBtnEdit) newBtnEdit.addEventListener('click', () => openPicker('new'));
    if (closeBtn) closeBtn.addEventListener('click', closePicker);
    if (cancelInline) cancelInline.addEventListener('click', closePicker);
    if (switchNew) switchNew.addEventListener('click', () => openPicker('new'));
    if (switchSearch) switchSearch.addEventListener('click', () => openPicker('search'));

    const resultsBody = document.getElementById('customer-picker-results');
    const searchBox = document.getElementById('customer-picker-search');
    let searchTimer = null;
    async function runSearch() {
        const q = (searchBox?.value || '').trim();
        if (!resultsBody) return;
        if (!q) { resultsBody.innerHTML = '<tr><td colspan="3">Type to search…</td></tr>'; return; }
        try {
            const res = await apiRequest('/customers', { query: { q, page: 1, size: 10 } });
            const items = res.items || [];
            if (!items.length) { resultsBody.innerHTML = '<tr><td colspan="3">No matches. Try different terms.</td></tr>'; return; }
            resultsBody.innerHTML = items.map((c = {}) => {
                const { id = '', first_name: firstName = '', last_name: lastName = '', email = '', city = '' } = c;
                const name = `${firstName} ${lastName}`.trim();
                return `
                <tr data-id="${id}" data-name="${name}">
                    <td>${name}</td>
                    <td>${email}</td>
                    <td>${city}</td>
                </tr>`;
            }).join('');
        } catch (e) { resultsBody.innerHTML = '<tr><td colspan="3">Search error</td></tr>'; }
    }
    if (searchBox) {
        searchBox.addEventListener('input', () => {
            clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 250);
        });
    }
    if (resultsBody) {
        resultsBody.addEventListener('click', (evt) => {
            const row = evt.target.closest('tr[data-id]'); if (!row) return;
            const id = Number(row.dataset.id);
            const name = row.dataset.name || `Customer #${id}`;
            const idInput = document.getElementById('wo-customer-id');
            const nameNode = document.getElementById('wo-selected-customer-name');
            if (idInput) idInput.value = String(id);
            if (nameNode) nameNode.textContent = name;
            const idInputEdit = document.getElementById('woe-customer-id');
            const nameNodeEdit = document.getElementById('woe-selected-customer-name');
            if (idInputEdit) idInputEdit.value = String(id);
            if (nameNodeEdit) nameNodeEdit.textContent = name;
            closePicker();
            updateCreateBtnState();
            void loadCustomerBikesForSelect(id);
            void loadCustomerBikesForSelectEdit(id);
        });
    }
    const inlineForm = document.getElementById('customer-create-inline-form');
    if (inlineForm) {
        inlineForm.addEventListener('submit', async (evt) => {
            evt.preventDefault();
            const fd = Object.fromEntries(new FormData(inlineForm).entries());
            try {
                const res = await apiRequest('/customers', { method: 'POST', body: fd });
                const id = res.id;
                const idInput = document.getElementById('wo-customer-id');
                const nameNode = document.getElementById('wo-selected-customer-name');
                if (idInput) idInput.value = String(id);
                if (nameNode) nameNode.textContent = `${fd.first_name||''} ${fd.last_name||''}`.trim() || `Customer #${id}`;
                const idInputEdit = document.getElementById('woe-customer-id');
                const nameNodeEdit = document.getElementById('woe-selected-customer-name');
                if (idInputEdit) idInputEdit.value = String(id);
                if (nameNodeEdit) nameNodeEdit.textContent = `${fd.first_name||''} ${fd.last_name||''}`.trim() || `Customer #${id}`;
                closePicker();
                updateCreateBtnState();
                void loadCustomerBikesForSelect(id);
                void loadCustomerBikesForSelectEdit(id);
            } catch (e) { notify(e.message || 'Create failed', 'error'); }
        });
    }

    // disable Create until customer is chosen
    updateCreateBtnState();

    state.shellReady = true;
}

function setActiveView(view) {
    state.view = view;
    dom.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    dom.views.forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
}

async function bootstrap() {
    ensureShell();
    try {
        const me = await apiRequest('/me');
        state.user = me.user;
        updateUserInfo();
        await refreshEverything();
    } catch (err) {
        notify(err.message, 'error');
        handleLogout(true);
    }
}

function updateUserInfo() {
    if (!state.user) return;
    const {
        full_name: fullName = 'Unknown user',
        email = '',
        role = '',
    } = state.user;
    if (dom.userName) dom.userName.textContent = fullName;
    const sideUser = document.getElementById('side-user-name');
    if (sideUser) sideUser.textContent = fullName;
    if (dom.userEmail) dom.userEmail.textContent = email;
    if (dom.userRole) dom.userRole.textContent = role;
    if (dom.heroGreeting) dom.heroGreeting.textContent = `Welcome back, ${fullName.split(' ')[0] || fullName}`;
    updateTopClockStatus();
}

async function refreshEverything() {
    updateUserInfo();
    await Promise.all([
        loadCustomers(),
        loadInventory(),
        loadWorkOrders(),
        loadTimeClockStatus(),
    ]);
    renderCalendar();
    updateTopClockStatus();
}

async function loadCustomers() {
    try {
        const { items = [] } = await apiRequest('/customers', { query: state.customerQuery }) || {};
        state.customers = items;
        renderCustomerTable();
        renderStats();
    } catch (err) {
        notify(`Customers: ${err.message}`, 'error');
    }
}

async function loadWarranties(customerId) {
    if (!customerId) return;
    try {
        state.customerWarranties = await apiRequest(`/customers/${customerId}/warranties`) || [];
        renderCustomerWarranties();
    } catch (err) {
        notify(`Warranties: ${err.message}`, 'error');
    }
}

async function loadInventory() {
    try {
        const { items = [] } = await apiRequest('/inventory/items', { query: state.inventoryQuery }) || {};
        state.inventory = items;
        renderInventoryTable();
        renderStats();
    } catch (err) {
        notify(`Inventory: ${err.message}`, 'error');
    }
}

async function loadWorkOrders() {
    try {
        const { items = [] } = await apiRequest('/work-orders', { query: state.workOrderQuery }) || {};
        state.workOrders = items;
        renderWorkOrders();
        renderStats();
    } catch (err) {
        notify(`Work orders: ${err.message}`, 'error');
    }
}

async function loadTimeClockStatus() {
    try {
        const response = await apiRequest('/time-clock/status');
        const { people = [] } = response || {};
        state.timeClockStatus = Array.isArray(people) ? people : [];
        renderTimeClockStatus();
        renderStats();
    } catch (err) {
        notify(`Time clock: ${err.message}`, 'error');
    }
}

async function loadWorkOrderDetail(id) {
    try {
        state.workOrderDetail = await apiRequest(`/work-orders/${id}`);
        renderWorkOrderDetail();
    } catch (err) {
        notify(err.message, 'error');
    }
}

function renderCustomerTable() {
    const body = document.getElementById('customer-table-body');
    if (!state.customers.length) {
        body.innerHTML = '<tr><td colspan="4">No records.</td></tr>';
        return;
    }
    body.innerHTML = state.customers.map((c = {}) => {
        const {
            id = '',
            first_name: firstName = '',
            last_name: lastName = '',
            email = '',
            phone = '',
            city = '',
            region = '',
        } = c;
        return `
        <tr data-id="${id}">
            <td>${firstName} ${lastName}</td>
            <td>${email}</td>
            <td>${phone}</td>
            <td>${city}, ${region}</td>
        </tr>
    `;
    }).join('');
}

function renderCustomerDetail() {
    const container = document.getElementById('customer-detail');
    const customer = state.customers.find(c => c.id === state.selectedCustomerId);
    if (!customer) {
        container.textContent = 'Select a customer.';
        return;
    }
    const {
        first_name: firstName = '',
        last_name: lastName = '',
        email = '—',
        phone = '—',
        city = '—',
    } = customer;
    container.innerHTML = `
        <div class="detail-grid">
            <div><strong>Name</strong><div>${firstName} ${lastName}</div></div>
            <div><strong>Email</strong><div>${email}</div></div>
            <div><strong>Phone</strong><div>${phone}</div></div>
            <div><strong>City</strong><div>${city}</div></div>
        </div>
    `;
}

function renderCustomerWarranties() {
    const body = document.getElementById('customer-warranties');
    if (!state.customerWarranties.length) {
        body.textContent = 'No warranties found.';
        return;
    }
    body.innerHTML = state.customerWarranties.map((w = {}) => {
        const { id = '', template_name: templateName, name, status = '' } = w;
        const label = templateName || name || 'Template';
        return `
        <div class="pill">
            #${id} · ${label} · ${status}
        </div>
    `;
    }).join('');
}

function renderInventoryTable() {
    const body = document.getElementById('inventory-table-body');
    if (!state.inventory.length) {
        body.innerHTML = '<tr><td colspan="5">No records.</td></tr>';
        return;
    }
    body.innerHTML = state.inventory.map((item = {}) => {
        const {
            sku = '',
            name = '',
            brand = '',
            category = '',
            price = 0,
        } = item;
        return `
        <tr>
            <td>${sku}</td>
            <td>${name}</td>
            <td>${brand}</td>
            <td>${category}</td>
            <td>$${Number(price || 0).toFixed(2)}</td>
        </tr>
    `;
    }).join('');
}

function renderWorkOrders() {
    const body = document.getElementById('wo-table-body');
    if (!state.workOrders.length) {
        body.innerHTML = '<tr><td colspan="6">No work orders.</td></tr>';
        return;
    }
    body.innerHTML = state.workOrders.map((wo = {}) => {
        const {
            id = '',
            status = 'open',
            opened_at: openedAt = '',
            customer = '',
            bike = '',
            assigned_to: assignedTo = '—',
        } = wo;
        const safeStatus = status?.replace(' ', '_') ?? 'open';
        return `
        <tr data-id="${id}">
            <td>${id}</td>
            <td><span class="status-chip status-${safeStatus}">${status}</span></td>
            <td>${openedAt ? new Date(openedAt).toLocaleString() : '—'}</td>
            <td>${customer}</td>
            <td>${bike}</td>
            <td>${assignedTo || '—'}</td>
        </tr>
    `;
    }).join('');
}

// ---------- Calendar ----------
let calMonth = new Date();
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function renderCalendar(){
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('cal-title');
    if (!grid || !title) return;
    const monthStart = startOfMonth(calMonth);
    title.textContent = monthStart.toLocaleString(undefined, { month:'long', year:'numeric'});

    // build 42 cells (6 weeks)
    const firstDay = new Date(monthStart);
    const weekday = (firstDay.getDay()+6)%7; // Monday=0
    const start = new Date(firstDay); start.setDate(firstDay.getDate() - weekday);
    const cells = [];
    for (let i=0;i<42;i++){
        const d = new Date(start); d.setDate(start.getDate()+i);
        cells.push(d);
    }
    // map work orders by date (prioritize promised_at; fallback to opened_at)
    const map = new Map();
    (state.workOrders||[]).forEach(w=>{
        const raw = w['promised_at'] || w['opened_at'] || null;
        if (!raw) return;
        const day = new Date(raw);
        const key = day.toISOString().slice(0,10);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(w);
    });
    grid.innerHTML = cells.map(d=>{
        const key = d.toISOString().slice(0,10);
        const list = map.get(key)||[];
        const items = list.map(w=>{
            const status = (w.status||'open').replace(' ','_');
            const label = `#${w.id} ${w['customer']||''}`.trim();
            return `<div class=\"cal-wo status-${status}\" data-id=\"${w.id}\">${label}</div>`;
        }).join('');
        return `<div class="cal-cell"><div class="day">${d.getDate()}</div>${items}</div>`;
    }).join('');
    grid.querySelectorAll('.cal-wo').forEach(el=>{
        el.addEventListener('click', async ()=>{
            const id = Number(el.dataset.id);
            await openWorkOrderEdit(id);
        });
    });
}
document.addEventListener('click', (e)=>{
    if (e.target?.id === 'cal-prev'){ calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1); renderCalendar(); }
    if (e.target?.id === 'cal-next'){ calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1); renderCalendar(); }
});

async function openWorkOrderEdit(id) {
    // ensure the Work Orders view is active and an edit panel visible
    setActiveView('workorders');
    const view = document.getElementById('view-workorders');
    if (view) {
        const panels = Array.from(view.querySelectorAll('.section-panel'));
        const cards = Array.from(view.querySelectorAll('.nav-card'));
        panels.forEach(p => p.classList.toggle('active', p.id === 'workorder-edit'));
        cards.forEach(c => c.classList.toggle('active', c.dataset.section === 'workorder-edit'));
    }
    // load detail
    await loadWorkOrderDetail(id);
    // prefill form
    const d = state.workOrderDetail || {};
    const wo = d['work_order'] || {};
    // status rail
    const uiStatusMap = {
        open: 'open',
        in_progress: 'in_progress',
        awaiting_parts: 'awaiting_parts',
        completed: 'finished',
        cancelled: 'cancelled',
        draft: 'estimate',
        delivered: 'finished',
    };
    const uiStatus = uiStatusMap[wo.status] || 'open';
    const statusSelect = document.getElementById('woe-status-select');
    if (statusSelect) { statusSelect.value = uiStatus; }
    const rail = document.getElementById('woe-rail');
    const railLabel = document.getElementById('woe-rail-label');
    if (rail && railLabel) {
        const cls = { waiting:'rail-waiting', open:'rail-open', finished:'rail-finished', cancelled:'rail-cancelled', estimate:'rail-estimate', in_progress:'rail-progress', awaiting_parts:'rail-awaiting' };
        rail.className = 'wo-status-column';
        rail.classList.add(cls[uiStatus] || 'rail-open');
        railLabel.textContent = uiStatus.replace('_',' ').toUpperCase();
    }
    // basics
    const idInput = document.getElementById('woe-workorder-id'); if (idInput) idInput.value = wo.id || '';
    const custHidden = document.getElementById('woe-customer-id'); if (custHidden) custHidden.value = wo.customer_id || '';
    const custName = document.getElementById('woe-selected-customer-name'); if (custName) custName.textContent = wo.customer_id ? `Customer #${wo.customer_id}` : '—';
    if (wo.customer_id) {
        try {
            const c = await apiRequest(`/customers/${wo.customer_id}`);
            if (c && custName) custName.textContent = `${c['first_name']||''} ${c['last_name']||''}`.trim() || custName.textContent;
        } catch { /* ignore */ }
    }
    // promised_at
    const promised = document.getElementById('woe-promised-at');
    if (promised) {
        // assume wo.promised_at is ISO; convert to local datetime-local input value (yyyy-MM-ddThh:mm)
        if (wo.promised_at) {
            const dt = new Date(wo.promised_at);
            promised.value = dt.toISOString().slice(0,16);
        } else promised.value = '';
    }
    // employee list
    const employeeSelect = document.getElementById('woe-employee-select');
    if (employeeSelect) {
        try {
            const res = await apiRequest('/users');
            const items = res.items || [];
            const opts = items.map(u => `<option value="${u.id}">${u['full_name']} (${u.role})</option>`).join('');
            employeeSelect.innerHTML = '<option value="">Select employee…</option>' + opts;
            employeeSelect.value = wo.assigned_to ? String(wo.assigned_to) : '';
        } catch { /* ignore */ }
    }
    // bikes
    await loadCustomerBikesForSelectEdit(wo.customer_id || null, wo.bike_id || null);
    // bike details
    const bike = wo.bike || {};
    const by = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    by('woe-bike_brand', bike.brand);
    by('woe-bike_model', bike.model);
    by('woe-bike_year', bike.model_year ? String(bike.model_year) : '');
    by('woe-bike_notes', bike.notes);
    by('woe-bike_color', bike.color);
    by('woe-bike_size', bike.wheel_size);
    by('woe-bike_serial', bike.serial_number);
    // lines
    renderEditLines();
    updateEditTotals();
}

function renderWorkOrderDetail() {
    const container = document.getElementById('wo-detail');
    const detail = state.workOrderDetail;
    if (!detail) {
        container.textContent = 'Select a work order.';
        return;
    }
    const {
        services = [],
        parts = [],
        totals: woTotals = {},
        work_order: workOrder = {},
    } = detail;
    const svcRows = services.map((service = {}) => {
        const {
            code = '',
            name = '',
            quantity = '',
            minutes = '',
            price = 0,
            id: lineId = ''
        } = service;
        return `
        <tr>
            <td>${code}</td>
            <td>${name}</td>
            <td>${quantity}</td>
            <td>${minutes}</td>
            <td>$${Number(price || 0).toFixed(2)}</td>
            <td><button class="btn-ghost wo-line-del" data-type="service" data-id="${lineId}">✕</button></td>
        </tr>
    `;
    }).join('');
    const partRows = parts.map((part = {}) => {
        const {
            sku = '',
            name = '',
            quantity = '',
            unit_price: unitPrice = 0,
            id: lineId = ''
        } = part;
        return `
        <tr>
            <td>${sku}</td>
            <td>${name}</td>
            <td>${quantity}</td>
            <td>$${Number(unitPrice || 0).toFixed(2)}</td>
            <td><button class="btn-ghost wo-line-del" data-type="part" data-id="${lineId}">✕</button></td>
        </tr>
    `;
    }).join('');
    const {
        labor_subtotal: laborSubtotal = 0,
        parts_subtotal: partsSubtotal = 0,
        total = 0,
    } = woTotals;
    const {
        status = '',
        customer_id: customerId = '',
        bike_id: bikeId = '—',
    } = workOrder;
    container.innerHTML = `
        <p>Status: <strong>${status}</strong></p>
        <p>Customer ID: ${customerId}</p>
        <p>Bike ID: ${bikeId || '—'}</p>
        <h4>Services</h4>
        <div class="table-container"><table><tbody>${svcRows || '<tr><td>No services</td></tr>'}</tbody></table></div>
        <h4>Parts</h4>
        <div class="table-container"><table><tbody>${partRows || '<tr><td>No parts</td></tr>'}</tbody></table></div>
        <h4>Totals</h4>
        <p>Labor: $${Number(laborSubtotal).toFixed(2)} · Parts: $${Number(partsSubtotal).toFixed(2)} · Total: $${Number(total).toFixed(2)}</p>
    `;
}

function getCurrentWorkOrderId() {
    const detail = state.workOrderDetail;
    if (!detail) return null;
    const workOrder = detail['work_order'] ?? null;
    return workOrder?.id ?? null;
}

function renderEditLines() {
    const tbody = document.getElementById('woe-lines');
    if (!tbody) return;
    const d = state.workOrderDetail || {};
    const services = d.services || [];
    const parts = d.parts || [];
    if (!services.length && !parts.length) { tbody.innerHTML = '<tr><td colspan="6">No lines</td></tr>'; return; }
    const rows = [];
    for (const s of services) {
        const qty = Number(s.quantity||1);
        const price = Number(s.price||0);
        const sub = qty*price;
        rows.push(`<tr><td>Svc</td><td>${s.name||s.code||'Service'}</td><td>${qty}</td><td>$${price.toFixed(2)}</td><td>$${sub.toFixed(2)}</td><td><button class="btn-ghost wo-line-del" data-type="service" data-id="${s.id}">✕</button></td></tr>`);
    }
    for (const p of parts) {
        const qty = Number(p.quantity||1);
        const price = Number(p['unit_price']||0);
        const sub = qty*price;
        rows.push(`<tr><td>Item</td><td>${p.name||p['sku']||'Item'}</td><td>${qty}</td><td>$${price.toFixed(2)}</td><td>$${sub.toFixed(2)}</td><td><button class=\"btn-ghost wo-line-del\" data-type=\"part\" data-id=\"${p.id}\">✕</button></td></tr>`);
    }
    tbody.innerHTML = rows.join('');
}

function updateEditTotals() {
    const d = state.workOrderDetail || {};
    const tot = d.totals || {};
    const labor = Number(tot['labor_subtotal'] || 0);
    const parts = Number(tot['parts_subtotal'] || 0);
    const total = Number(tot.total || labor + parts);
    const byId = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    byId('woe-labor', `$${labor.toFixed(2)}`);
    byId('woe-parts', `$${parts.toFixed(2)}`);
    byId('woe-total', `$${total.toFixed(2)}`);
}

function renderStats() {
    const card = document.getElementById('stats-card');
    if (!card) return;
    const onShift = state.timeClockStatus.filter(({ is_clocked_in: isClockedIn }) => Boolean(isClockedIn)).length;
    const stats = [
        { label: 'Customers', value: state.customers.length },
        { label: 'Inventory', value: state.inventory.length },
        { label: 'Work orders', value: state.workOrders.length },
        { label: 'On shift', value: onShift },
    ];
    card.innerHTML = `
        <div class="grid stats-grid">
            ${stats.map(s => `
                <div>
                    <div class="muted">${s.label}</div>
                    <strong style="font-size:1.5rem;">${s.value}</strong>
                </div>
            `).join('')}
        </div>
    `;
}

function renderTimeClockStatus() {
    const body = document.getElementById('clock-status-body');
    if (!body) return;
    if (!state.timeClockStatus.length) {
        body.innerHTML = '<tr><td colspan="5">No active employees yet.</td></tr>';
        return;
    }
    body.innerHTML = state.timeClockStatus.map((person = {}) => {
        const {
            full_name: fullName = '',
            role = '',
            is_clocked_in: isClockedIn = false,
            clock_in: clockIn = null,
            minutes_active: minutesActive = null,
        } = person;
        const statusLabel = isClockedIn ? 'Clocked in' : 'Off shift';
        const statusClass = isClockedIn ? 'badge status-ok' : 'badge status-bad';
        const since = clockIn ? new Date(clockIn).toLocaleTimeString() : '—';
        const duration = isClockedIn ? formatMinutes(minutesActive ?? 0) : '—';
        return `
            <tr>
                <td>${fullName}</td>
                <td>${role}</td>
                <td><span class="${statusClass}">${statusLabel}</span></td>
                <td>${since}</td>
                <td>${duration}</td>
            </tr>
        `;
    }).join('');
}

async function handleClockForm(evt) {
    evt.preventDefault();
    const form = evt.currentTarget;
    const submitter = evt.submitter;
    const action = submitter?.dataset.action === 'out' ? 'out' : 'in';
    const code = form.elements.code.value.trim();
    const note = form.elements.note.value.trim();
    if (!/^\d{4}$/.test(code)) {
        notify('Enter the 4-digit employee code', 'error');
        return;
    }
    const endpoint = action === 'out' ? '/time-clock/clock-out' : '/time-clock/clock-in';
    const body = { code };
    if (action === 'in' && note) body.note = note;
    try {
        await apiRequest(endpoint, { method: 'POST', body });
        notify(`Clock ${action === 'in' ? 'in' : 'out'} recorded`, 'success');
        form.reset();
        await loadTimeClockStatus();
        updateTopClockStatus();
    } catch (err) {
        notify(err.message, 'error');
    }
}

// Quick clock toggle via badge prompt
async function promptClockToggle() {
    const code = prompt('Enter your 4-digit employee code');
    if (!code) return;
    if (!/^\d{4}$/.test(code.trim())) { notify('Enter a valid 4-digit code', 'error'); return; }
    const pin = code.trim();
    try {
        // Try to clock out first; if not clocked in, attempt to clock in
        try {
            await apiRequest('/time-clock/clock-out', { method: 'POST', body: { code: pin } });
            notify('Clocked out', 'success');
        } catch (e) {
            // If 409 not clocked in, try to clock in
            await apiRequest('/time-clock/clock-in', { method: 'POST', body: { code: pin } });
            notify('Clocked in', 'success');
        }
        await loadTimeClockStatus();
        updateTopClockStatus();
    } catch (err) {
        notify(err.message || 'Clock action failed', 'error');
    }
}

function updateTopClockStatus() {
    const chip = document.getElementById('side-clock-chip');
    const dd = document.getElementById('side-clock-dropdown');
    const inList = document.getElementById('side-roster-in');
    const outList = document.getElementById('side-roster-out');
    if (!chip) return;
    const me = state.user || {};
    const self = (state.timeClockStatus || []).find(p => Number(p.id) === Number(me.id));
    const isIn = self ? Boolean(self.is_clocked_in) : false;
    chip.textContent = isIn ? 'IN' : 'OUT';
    chip.classList.toggle('status-ok', isIn);
    chip.classList.toggle('status-bad', !isIn);
    // Roster dropdown
    if (inList && outList) {
        const on = (state.timeClockStatus || []).filter(p => p.is_clocked_in);
        const off = (state.timeClockStatus || []).filter(p => !p.is_clocked_in);
        inList.innerHTML = on.length ? on.map(p => {
            const dur = typeof p.minutes_active === 'number' ? formatMinutes(p.minutes_active) : '—';
            const role = p.role || '';
            return `<li class="roster-item"><span class="roster-dot in"></span><span>${p.full_name}</span><span class="roster-role">${role}</span><span class="roster-duration">${dur}</span></li>`;
        }).join('') : '<li class="muted">—</li>';
        outList.innerHTML = off.length ? off.map(p => {
            const role = p.role || '';
            return `<li class="roster-item"><span class="roster-dot out"></span><span>${p.full_name}</span><span class="roster-role">${role}</span></li>`;
        }).join('') : '<li class="muted">—</li>';
    }
}

async function handleCustomerSearch(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    state.customerQuery.q = fd.get('q');
    state.customerQuery.page = fd.get('page') || 1;
    await loadCustomers();
}

async function handleCustomerCreate(evt) {
    evt.preventDefault();
    const raw = Object.fromEntries(new FormData(evt.target).entries());
    const fd = {};
    Object.entries(raw).forEach(([key, value]) => {
        fd[key] = value === '' ? null : value;
    });
    try {
        const res = await apiRequest('/customers', { method: 'POST', body: fd });
        notify(`Customer #${res.id} created`, 'success');
        evt.target.reset();
        await loadCustomers();
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleInventorySearch(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    state.inventoryQuery.q = fd.get('q');
    state.inventoryQuery.brand = fd.get('brand');
    await loadInventory();
}

async function handleInventoryCreate(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const body = {};
    fd.forEach((value, key) => {
        if (value === '') return;
        if (['brand_id','category_id','reorder_level'].includes(key)) body[key] = Number(value);
        else if (['cost','price'].includes(key)) body[key] = Number(value);
        else if (key === 'is_serialized') body[key] = value === '1';
        else body[key] = value;
    });
    try {
        const res = await apiRequest('/inventory/items', { method: 'POST', body });
        notify(`Inventory item #${res.id} created`, 'success');
        evt.target.reset();
        await loadInventory();
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleWorkOrderFilter(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    state.workOrderQuery.status = fd.get('status');
    state.workOrderQuery.page = fd.get('page') || 1;
        await loadWorkOrders();
}

async function handleWorkOrderCreate(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    // require customer selection
    const selectedCustomerId = Number(document.getElementById('wo-customer-id')?.value || 0);
    if (!selectedCustomerId || selectedCustomerId <= 0) {
        notify('Select or create a customer before creating the ticket', 'error');
        const findBtn = document.getElementById('wo-find-customer');
        if (findBtn) findBtn.click();
        return;
    }
    // require at least one line (parts or services)
    const hasLines = (state.woStaged?.parts?.length || 0) + (state.woStaged?.services?.length || 0) > 0;
    if (!hasLines) {
        notify('Add at least one item or service before creating the ticket', 'error');
        return;
    }
    // Gather staged services
    const services = (state.woStaged?.services || []).map(s => ({ service_code: s.code, quantity: Number(s.quantity||1) }));
    // Map UI status to API status
    const uiStatus = fd.get('status') || 'open';
    const statusMap = {
        waiting: 'open',
        open: 'open',
        finished: 'completed',
        cancelled: 'cancelled',
        estimate: 'draft',
        in_progress: 'in_progress',
        awaiting_parts: 'awaiting_parts',
    };
    const apiStatus = statusMap[uiStatus] || 'open';
    const body = {
        customer_id: selectedCustomerId,
        status: apiStatus,
        assigned_to: fd.get('assigned_to') ? Number(fd.get('assigned_to')) : null,
        promised_at: fd.get('promised_at') || null,
        notes: fd.get('internal_notes') || null,
        services,
    };
    const selectedBikeId = fd.get('bike_id');
    if (selectedBikeId) {
        body.bike_id = Number(selectedBikeId);
    }
    const bikeBrand = fd.get('bike_brand');
    if (!selectedBikeId && (bikeBrand || fd.get('bike_model') || fd.get('bike_year') || fd.get('bike_serial') || fd.get('bike_color') || fd.get('bike_size') || fd.get('bike_notes'))) {
        body.bike = {
            brand: bikeBrand || null,
            model: fd.get('bike_model') || null,
            model_year: fd.get('bike_year') ? Number(fd.get('bike_year')) : null,
            serial_number: fd.get('bike_serial') || null,
            color: fd.get('bike_color') || null,
            wheel_size: fd.get('bike_size') || null,
            notes: fd.get('bike_notes') || null,
        };
    }
    try {
        const res = await apiRequest('/work-orders', { method: 'POST', body });
        notify(`Work order #${res.id} created`, 'success');
        evt.target.reset();
        // add staged parts if any
        const parts = (state.woStaged?.parts || []);
        const servicesLines = (state.woStaged?.services || []);
        if (parts.length) {
            await apiRequest(`/work-orders/${res.id}/parts`, { method: 'POST', body: { items: parts.map(p => ({ item_id: p.id, quantity: Number(p.quantity||1), notes: p.notes||null })) } });
        }
        if (servicesLines.length) {
            await apiRequest(`/work-orders/${res.id}/services`, { method: 'POST', body: { items: servicesLines.map(s => ({ service_id: s.id, quantity: Number(s.quantity||1), assigned_to: s.assigned_to || null, notes: s.notes || null })) } });
        }
        state.woStaged = { parts: [], services: [] };
        await loadWorkOrders();
        await loadWorkOrderDetail(res.id);
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleWorkOrderUpdate(evt) {
    evt.preventDefault();
    const form = evt.target;
    const fd = new FormData(form);
    const woId = Number(fd.get('id'));
    if (!woId) { notify('Missing work order id','error'); return; }
    const selectedCustomerId = Number(document.getElementById('woe-customer-id')?.value || 0);
    const uiStatus = fd.get('status') || 'open';
    const statusMap = {
        waiting: 'open',
        open: 'open',
        finished: 'completed',
        cancelled: 'cancelled',
        estimate: 'draft',
        in_progress: 'in_progress',
        awaiting_parts: 'awaiting_parts',
    };
    const apiStatus = statusMap[uiStatus] || 'open';
    const body = {
        customer_id: selectedCustomerId || null,
        assigned_to: fd.get('assigned_to') ? Number(fd.get('assigned_to')) : null,
        promised_at: fd.get('promised_at') || null,
        notes: fd.get('internal_notes') || null,
        status: apiStatus,
    };
    const selectedBikeId = fd.get('bike_id');
    const bikeBrand = fd.get('bike_brand');
    const hasBikeFields = bikeBrand || fd.get('bike_model') || fd.get('bike_year') || fd.get('bike_serial') || fd.get('bike_color') || fd.get('bike_size') || fd.get('bike_notes');
    if (selectedBikeId) {
        body.bike_id = Number(selectedBikeId);
        if (hasBikeFields) {
            body.bike = {
                id: Number(selectedBikeId),
                brand: bikeBrand || null,
                model: fd.get('bike_model') || null,
                model_year: fd.get('bike_year') ? Number(fd.get('bike_year')) : null,
                serial_number: fd.get('bike_serial') || null,
                color: fd.get('bike_color') || null,
                wheel_size: fd.get('bike_size') || null,
                notes: fd.get('bike_notes') || null,
            };
        }
    } else if (hasBikeFields) {
    const existingBike = (state.workOrderDetail?.['work_order']?.bike || {});
        body.bike = {
            id: existingBike.id || undefined,
            brand: bikeBrand || null,
            model: fd.get('bike_model') || null,
            model_year: fd.get('bike_year') ? Number(fd.get('bike_year')) : null,
            serial_number: fd.get('bike_serial') || null,
            color: fd.get('bike_color') || null,
            wheel_size: fd.get('bike_size') || null,
            notes: fd.get('bike_notes') || null,
        };
    }
    try {
        await apiRequest(`/work-orders/${woId}`, { method: 'PATCH', body });
        notify(`Work order #${woId} updated`, 'success');
        await loadWorkOrderDetail(woId);
        renderEditLines();
        updateEditTotals();
        await loadWorkOrders();
        renderCalendar();
    } catch (e) { notify(e.message || 'Update failed','error'); }
}

async function handleStatusUpdate(evt) {
    evt.preventDefault();
    const currentWorkOrderId = getCurrentWorkOrderId();
    if (!currentWorkOrderId) {
        notify('Select a work order first', 'error');
        return;
    }
    const status = new FormData(evt.target).get('status');
    if (!status) return;
    try {
        await apiRequest(`/work-orders/${currentWorkOrderId}/status`, { method: 'PATCH', body: { status } });
        notify('Status updated', 'success');
        await loadWorkOrderDetail(currentWorkOrderId);
        await loadWorkOrders();
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleAddPart(evt) {
    evt.preventDefault();
    const currentWorkOrderId = getCurrentWorkOrderId();
    if (!currentWorkOrderId) {
        notify('Select a work order first', 'error');
        return;
    }
    const fd = new FormData(evt.target);
    const item_id = Number(fd.get('item_id'));
    const quantity = Number(fd.get('quantity') || 1);
    const notes = fd.get('notes') || null;
    try {
        await apiRequest(`/work-orders/${currentWorkOrderId}/parts`, {
            method: 'POST',
            body: { items: [{ item_id, quantity, notes }] }
        });
        notify('Part added', 'success');
        evt.target.reset();
        await loadWorkOrderDetail(currentWorkOrderId);
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleNextSlot(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const query = {
        mechanic_id: fd.get('mechanic_id'),
        location_id: fd.get('location_id'),
        duration_minutes: fd.get('duration_minutes'),
        from: fd.get('from'),
    };
    try {
        const slot = await apiRequest('/schedule/next-slot', { query });
        if (!slot) {
            notify('No slot available', 'error');
            return;
        }
        state.nextSlot = slot;
        const card = document.getElementById('next-slot-card');
        if (card) {
            const startLabel = slot.start_at ? new Date(String(slot.start_at)).toLocaleString() : '—';
            const endLabel = slot.end_at ? new Date(String(slot.end_at)).toLocaleString() : '—';
            card.innerHTML = `
                <h2>Next Available Slot</h2>
                <p><strong>${startLabel}</strong> → ${endLabel}</p>
                <p class="muted">Adjust filters in the scheduling tab.</p>
            `;
        }
        notify('Slot located', 'success');
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleAppointmentCreate(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const woId = Number(fd.get('work_order_id'));
    const body = {
        start_at: fd.get('start_at'),
        end_at: fd.get('end_at'),
        assigned_to: fd.get('assigned_to') ? Number(fd.get('assigned_to')) : null,
        location_id: fd.get('location_id') ? Number(fd.get('location_id')) : null,
        status: fd.get('status') || 'scheduled',
        notes: fd.get('notes') || null,
    };
    try {
        const res = await apiRequest(`/work-orders/${woId}/appointments`, { method: 'POST', body });
        notify(`Appointment #${res.id} created`, 'success');
        evt.target.reset();
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleMechanicDay(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const query = {
        mechanic_id: fd.get('mechanic_id'),
        day: fd.get('day'),
    };
    try {
        const res = await apiRequest('/schedule/mechanic', { query });
        const {
            appointments = [],
            day = null,
        } = res || {};
        state.mechanicDay = appointments;
        state.mechanicDayMeta = day;
        const container = document.getElementById('mechanic-day-results');
        if (!state.mechanicDay.length) {
            container.textContent = 'No appointments for that day.';
        } else {
            container.innerHTML = state.mechanicDay.map((appt = {}) => {
                const {
                    start_at: startAt,
                    work_order_id: workOrderId = '',
                    status = '',
                } = appt;
                const startLabel = startAt ? new Date(String(startAt)).toLocaleTimeString() : '—';
                return `
                <div class="pill">
                    ${startLabel} · WO ${workOrderId} · ${status}
                </div>
            `;
            }).join('');
        }
        notify('Schedule loaded', 'success');
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleWarrantyLookup(evt) {
    evt.preventDefault();
    const id = Number(new FormData(evt.target).get('customer_id'));
    if (!id) return;
    try {
        const data = await apiRequest(`/customers/${id}/warranties`);
        const body = document.getElementById('warranty-table-body');
        if (!data.length) {
            body.innerHTML = '<tr><td colspan="5">No warranties yet.</td></tr>';
            return;
        }
        body.innerHTML = data.map((w = {}) => {
            const {
                id: warrantyId = '',
                template_name: templateName,
                name,
                status = '',
                serial_number: serialNumber = '—',
                purchase_date: purchaseDate = '',
                start_date: startDate = '',
            } = w;
            const displayName = templateName || name || 'Template';
            return `
            <tr>
                <td>${warrantyId}</td>
                <td>${displayName}</td>
                <td>${status}</td>
                <td>${serialNumber}</td>
                <td>${purchaseDate} → ${startDate}</td>
            </tr>
        `;
        }).join('');
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleWarrantyRegister(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const customerId = Number(fd.get('customer_id'));
    const body = {};
    fd.forEach((value, key) => {
        if (['customer_id'].includes(key) || value === '') return;
        if (['warranty_id','bike_id','inventory_item_id','duration_months'].includes(key)) body[key] = Number(value);
        else body[key] = value;
    });
    try {
        const res = await apiRequest(`/customers/${customerId}/warranties`, { method: 'POST', body });
        notify(`Warranty #${res.id} registered`, 'success');
        evt.target.reset();
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function handleTemplateCreate(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const body = {};
    fd.forEach((value, key) => {
        if (value === '') return;
        if (['brand_id','item_id','duration_months'].includes(key)) body[key] = Number(value);
        else body[key] = value;
    });
    try {
        const res = await apiRequest('/warranties', { method: 'POST', body });
        notify(`Template #${res.id} created`, 'success');
        evt.target.reset();
    } catch (err) {
        notify(err.message, 'error');
    }
}

function registerSectionNav() {
    if (!root) return;
    root.querySelectorAll('.view').forEach(view => {
        const nav = view.querySelector('.section-nav');
        const panels = Array.from(view.querySelectorAll('.section-panel'));
        if (!nav || panels.length === 0) return;
        const cards = Array.from(nav.querySelectorAll('.nav-card'));
        const initial = cards[0]?.dataset.section || panels[0].id;
        const activate = (id, scroll = true) => {
            if (!id) return;
            panels.forEach(panel => panel.classList.toggle('active', panel.id === id));
            cards.forEach(card => card.classList.toggle('active', card.dataset.section === id));
            const panel = view.querySelector(`#${id}`);
            if (panel && scroll) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        activate(initial, false);
        cards.forEach(card => {
            card.addEventListener('click', () => activate(card.dataset.section, true));
        });
    });
}

function registerModuleTiles() {
    root.querySelectorAll('.module-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            const target = tile.dataset.jump;
            if (!target) return;
            const el = root.querySelector(target);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// ---------- Workorder add-lines (search + stage) ----------
state.woStaged = state.woStaged || { parts: [], services: [] };

function renderStagedLines() {
    const body = document.getElementById('staged-lines');
    if (!body) return;
    const parts = state.woStaged.parts || [];
    const services = state.woStaged.services || [];
    if (!parts.length && !services.length) { body.innerHTML = '<tr><td colspan="6">No lines added yet.</td></tr>'; updateWorkOrderEstimate(); updateCreateBtnState(); return; }
    const rows = [];
    const employees = state.employees || [];
    const employeeOptions = (sel) => ['<option value="">—</option>'].concat(employees.map(e=>`<option value="${e.id}" ${String(sel||'')===String(e.id)?'selected':''}>${e['full_name']}</option>`)).join('');
    for (const p of parts) {
        const qty = Number(p.quantity||1);
        const price = Number(p.price||0);
        const sub = qty * price;
        rows.push(`<tr data-type="part" data-id="${p.id}"><td>Item</td><td>${p.name}</td><td><select class="wo-emp">${employeeOptions(p.assigned_to)}</select></td><td><label><input type="checkbox" class="wo-flag" ${p.special?'checked':''}> Special</label></td><td>$${price.toFixed(2)}</td><td><input class="wo-qty" type="number" min="1" value="${qty}"></td><td>0</td><td>$${sub.toFixed(2)}</td><td><button class="btn-ghost wo-remove">✕</button></td></tr>`);
    }
    for (const s of services) {
        const qty = Number(s.quantity||1);
        const price = Number(s.price||0);
        const sub = qty * price;
        rows.push(`<tr data-type="service" data-id="${s.id}" data-code="${s.code}"><td>Labor</td><td>${s.name}</td><td><select class="wo-emp">${employeeOptions(s.assigned_to)}</select></td><td>—</td><td>$${price.toFixed(2)}</td><td><input class="wo-qty" type="number" min="1" value="${qty}"></td><td>—</td><td>$${sub.toFixed(2)}</td><td><button class="btn-ghost wo-remove">✕</button></td></tr>`);
    }
    body.innerHTML = rows.join('');
    body.querySelectorAll('.wo-qty').forEach(inp => {
        inp.addEventListener('change', stagedQtyChanged);
        inp.addEventListener('input', stagedQtyChanged);
        inp.addEventListener('blur', stagedQtyChanged);
    });
    body.querySelectorAll('.wo-emp').forEach(sel => sel.addEventListener('change', stagedEmpChanged));
    body.querySelectorAll('.wo-flag').forEach(ch => ch.addEventListener('change', stagedFlagChanged));
    body.querySelectorAll('.wo-remove').forEach(btn => btn.addEventListener('click', (e)=>{ e.preventDefault(); stagedRemove(e); }));
    updateWorkOrderEstimate();
    updateCreateBtnState();
}

function stagedQtyChanged(evt) {
    const tr = evt.target.closest('tr'); if (!tr) return;
    let qty = Number(evt.target.value);
    if (!isFinite(qty)) qty = 0;
    const type = tr.dataset.type;
    const id = tr.dataset.id;
    const list = type === 'part' ? state.woStaged.parts : state.woStaged.services;
    const item = list.find(x => String(x.id) === String(id));
    if (!item) return;
    if (qty <= 0) {
        // treat 0/blank as delete from staging
        if (type === 'part') state.woStaged.parts = list.filter(x => String(x.id)!==String(id));
        else state.woStaged.services = list.filter(x => String(x.id)!==String(id));
    } else {
        item.quantity = qty;
    }
    renderStagedLines();
}

function stagedRemove(evt) {
    const tr = evt.target.closest('tr'); if (!tr) return;
    const type = tr.dataset.type;
    const id = tr.dataset.id;
    if (type === 'part') state.woStaged.parts = state.woStaged.parts.filter(x => String(x.id)!==String(id));
    else state.woStaged.services = state.woStaged.services.filter(x => String(x.id)!==String(id));
    renderStagedLines();
}

function stagedEmpChanged(evt){
    const tr = evt.target.closest('tr'); if (!tr) return;
    const type = tr.dataset.type; const id = tr.dataset.id; const v = evt.target.value || '';
    const list = type==='part'? state.woStaged.parts : state.woStaged.services;
    const item = list.find(x => String(x.id)===String(id)); if (item) item.assigned_to = v || null;
}
function stagedFlagChanged(evt){
    const tr = evt.target.closest('tr'); if (!tr) return;
    const list = state.woStaged.parts; const id = tr.dataset.id;
    const item = list.find(x => String(x.id)===String(id)); if (item) item.special = !!evt.target.checked;
}

function updateWorkOrderEstimate() {
    const parts = state.woStaged.parts || [];
    const services = state.woStaged.services || [];
    const labor = services.reduce((sum,s)=> sum + Number(s.price||0)*Number(s.quantity||1), 0);
    const partsTotal = parts.reduce((sum,p)=> sum + Number(p.price||0)*Number(p.quantity||1), 0);
    const total = labor + partsTotal;
    const card = document.querySelector('#workorder-create .wo-summary-card');
    if (!card) return;
    const lines = card.querySelectorAll('dl div dd');
    if (lines[0]) lines[0].textContent = `$${labor.toFixed(2)}`;
    if (lines[1]) lines[1].textContent = `$${partsTotal.toFixed(2)}`;
    if (lines[2]) lines[2].textContent = `$0.00`;
    const totalEl = card.querySelector('.wo-total strong');
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
}

async function searchParts() {
    const q = (document.getElementById('add-part-q')?.value || '').trim();
    const box = document.getElementById('addline-results'); if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    try {
        const res = await apiRequest('/inventory/items', { query: { q, size: 10 } });
        const items = res.items || [];
        box.innerHTML = items.map((i={}) => {
            const { id='', name='', sku='', price=0 } = i;
            return `<div class="result-pill" data-type="part" data-id="${id}" data-name="${name}" data-price="${price}"><div>${name} <small>${sku}</small></div><button type="button" class="btn-secondary addline-add">Add</button></div>`;
        }).join('');
        box.querySelectorAll('.addline-add').forEach(btn=>btn.addEventListener('click',addSearchResult));
    } catch (e) { box.innerHTML = '<div class="muted">Error searching inventory</div>'; }
}

async function searchServices() {
    const q = (document.getElementById('add-service-q')?.value || '').trim();
    const box = document.getElementById('addline-results'); if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    try {
        const res = await apiRequest('/services', { query: { q } });
        const items = res.items || [];
        box.innerHTML = items.map((s={}) => {
            const { id='', code='', name='', default_price=0, default_minutes=0 } = s;
            return `<div class="result-pill" data-type="service" data-id="${id}" data-code="${code}" data-name="${name}" data-price="${default_price}" data-minutes="${default_minutes}"><div>${name} <small>${code}</small></div><button type="button" class="btn-secondary addline-add">Add</button></div>`;
        }).join('');
        box.querySelectorAll('.addline-add').forEach(btn=>btn.addEventListener('click',addSearchResult));
    } catch (e) { box.innerHTML = '<div class="muted">Error searching services</div>'; }
}

function addSearchResult(evt) {
    const pill = evt.target.closest('.result-pill'); if (!pill) return;
    const type = pill.dataset.type;
    if (type === 'part') {
        const id = Number(pill.dataset.id);
        const existing = (state.woStaged.parts || []).find(x => Number(x.id) === id);
        if (existing) { existing.quantity = Number(existing.quantity || 1) + 1; }
        else {
            state.woStaged.parts.push({ id, name: pill.dataset.name, price: Number(pill.dataset.price||0), quantity: 1 });
        }
    } else {
        const code = pill.dataset.code || '';
        const existing = (state.woStaged.services || []).find(x => (x.code || '') === code);
        if (existing) { existing.quantity = Number(existing.quantity || 1) + 1; }
        else {
            state.woStaged.services.push({ id: Number(pill.dataset.id), code, name: pill.dataset.name, price: Number(pill.dataset.price||0), minutes: Number(pill.dataset.minutes||0), quantity: 1 });
        }
    }
    renderStagedLines();
}

async function searchPartsEdit() {
    const q = (document.getElementById('add-part-q-edit')?.value || '').trim();
    const box = document.getElementById('edit-addline-results'); if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    try {
        const res = await apiRequest('/inventory/items', { query: { q, size: 10 } });
        const items = res.items || [];
        box.innerHTML = items.map((i={}) => {
            const { id='', name='', sku='', price=0 } = i;
            return `<div class="result-pill" data-type="part" data-id="${id}" data-name="${name}" data-price="${price}"><div>${name} <small>${sku}</small></div><button type="button" class="btn-secondary addline-add-edit">Add</button></div>`;
        }).join('');
        box.querySelectorAll('.addline-add-edit').forEach(btn=>btn.addEventListener('click',addSearchResultToExisting));
    } catch (e) { box.innerHTML = '<div class="muted">Error searching inventory</div>'; }
}

async function searchServicesEdit() {
    const q = (document.getElementById('add-service-q-edit')?.value || '').trim();
    const box = document.getElementById('edit-addline-results'); if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    try {
        const res = await apiRequest('/services', { query: { q } });
        const items = res.items || [];
        box.innerHTML = items.map((s={}) => {
            const { id='', code='', name='', default_price=0, default_minutes=0 } = s;
            return `<div class="result-pill" data-type="service" data-id="${id}" data-code="${code}" data-name="${name}" data-price="${default_price}" data-minutes="${default_minutes}"><div>${name} <small>${code}</small></div><button type="button" class="btn-secondary addline-add-edit">Add</button></div>`;
        }).join('');
        box.querySelectorAll('.addline-add-edit').forEach(btn=>btn.addEventListener('click',addSearchResultToExisting));
    } catch (e) { box.innerHTML = '<div class="muted">Error searching services</div>'; }
}

async function addSearchResultToExisting(evt) {
    const pill = evt.target.closest('.result-pill'); if (!pill) return;
    const currentWorkOrderId = getCurrentWorkOrderId();
    if (!currentWorkOrderId) { notify('No work order selected','error'); return; }
    const type = pill.dataset.type;
    try {
        if (type === 'part') {
            const itemId = Number(pill.dataset.id);
            await apiRequest(`/work-orders/${currentWorkOrderId}/parts`, {
                method: 'POST',
                body: { items: [{ item_id: itemId, quantity: 1 }] },
            });
        } else {
            const serviceId = Number(pill.dataset.id);
            await apiRequest(`/work-orders/${currentWorkOrderId}/services`, {
                method: 'POST',
                body: { items: [{ service_id: serviceId, quantity: 1 }] },
            });
        }
        notify('Line added','success');
        await loadWorkOrderDetail(currentWorkOrderId);
        renderEditLines();
        updateEditTotals();
    } catch (e) { notify(e.message || 'Add failed','error'); }
}

document.addEventListener('click', (evt) => {
    if (evt.target?.id === 'add-part-search') { void searchParts(); }
    if (evt.target?.id === 'add-service-search') { void searchServices(); }
    if (evt.target?.id === 'add-part-search-edit') { void searchPartsEdit(); }
    if (evt.target?.id === 'add-service-search-edit') { void searchServicesEdit(); }
    const del = evt.target.closest?.('.wo-line-del');
    if (del) { void deleteWoLine(del); }
});

// Prevent Enter from submitting the main form while searching/adjusting
['add-part-q','add-service-q','add-part-q-edit','add-service-q-edit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') { e.preventDefault(); if (id==='add-part-q') void searchParts(); else if (id==='add-service-q') void searchServices(); else if (id==='add-part-q-edit') void searchPartsEdit(); else void searchServicesEdit(); } });
});

// Workorder implementations have been moved to workorders.js

function updateCreateBtnState() {
    const btn = document.querySelector('#workorder-create .wo-summary-card button[type="submit"]');
    if (!btn) return;
    const hasCustomer = Number(document.getElementById('wo-customer-id')?.value || 0) > 0;
    const hasLines = (state.woStaged?.parts?.length || 0) + (state.woStaged?.services?.length || 0) > 0;
    btn.disabled = !(hasCustomer && hasLines);
}

async function loadCustomerBikesForSelect(customerId) {
    const sel = document.getElementById('wo-customer-bike');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading…</option>';
    if (!customerId) { sel.innerHTML = '<option value="">None or New Item</option>'; return; }
    try {
        const res = await apiRequest(`/customers/${customerId}/bikes`);
        const items = Array.isArray(res) ? res : (res.items || []);
        const opts = items.map((b = {}) => {
            const id = b.id || '';
            const year = b.model_year ? ` ${b.model_year}` : '';
            const name = `${b.brand||''} ${b.model||''}${year}`.trim();
            const serial = b.serial_number ? ` • SN ${b.serial_number}` : '';
            return `<option value="${id}">${name}${serial}</option>`;
        }).join('');
        sel.innerHTML = '<option value="">None or New Item</option>' + opts;
    } catch (e) {
        sel.innerHTML = '<option value="">None or New Item</option>';
    }
}

// Disable bike detail inputs when an existing bike is chosen
document.addEventListener('change', (evt) => {
    if (evt.target && evt.target.id === 'wo-customer-bike') {
        const hasSelection = String(evt.target.value || '') !== '';
        const form = document.getElementById('workorder-create-form');
        if (!form) return;
        const fields = form.querySelectorAll('input[name^="bike_"], textarea[name="bike_notes"]');
        fields.forEach((el) => { el.disabled = hasSelection; el.classList.toggle('muted', hasSelection); });
    }
});

async function loadCustomerBikesForSelectEdit(customerId, preselectId = null) {
    const sel = document.getElementById('woe-customer-bike');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading…</option>';
    if (!customerId) { sel.innerHTML = '<option value="">None or New Item</option>'; return; }
    try {
        const res = await apiRequest(`/customers/${customerId}/bikes`);
        const items = Array.isArray(res) ? res : (res.items || []);
        const opts = items.map((b = {}) => {
            const id = b.id || '';
            const year = b.model_year ? ` ${b.model_year}` : '';
            const name = `${b.brand||''} ${b.model||''}${year}`.trim();
            const serial = b.serial_number ? ` • SN ${b.serial_number}` : '';
            const selAttr = preselectId && String(preselectId) === String(id) ? ' selected' : '';
            return `<option value="${id}"${selAttr}>${name}${serial}</option>`;
        }).join('');
        sel.innerHTML = '<option value="">None or New Item</option>' + opts;
    } catch (e) {
        sel.innerHTML = '<option value="">None or New Item</option>';
    }
}

// Disable bike detail inputs in edit when an existing bike is chosen
document.addEventListener('change', (evt) => {
    if (evt.target && evt.target.id === 'woe-customer-bike') {
        const hasSelection = String(evt.target.value || '') !== '';
        const form = document.getElementById('workorder-edit-form');
        if (!form) return;
        const fields = form.querySelectorAll('input[name^="bike_"], textarea[name="bike_notes"]');
        fields.forEach((el) => { el.disabled = hasSelection; el.classList.toggle('muted', hasSelection); });
    }
});

async function deleteWoLine(btn){
    const currentWorkOrderId = getCurrentWorkOrderId();
    if (!currentWorkOrderId) { notify('Select a work order first','error'); return; }
    const type = btn.dataset.type;
    const lineId = btn.dataset.id;
    try {
        const ep = type === 'service' ? `/work-orders/${currentWorkOrderId}/services/${lineId}` : `/work-orders/${currentWorkOrderId}/parts/${lineId}`;
        await apiRequest(ep, { method: 'DELETE' });
        notify('Line removed','success');
        await loadWorkOrderDetail(currentWorkOrderId);
    } catch (e) { notify(e.message || 'Delete failed','error'); }
}

async function toggleInitialRoute() {
    if (state.token) {
        ensureShell();
        await bootstrap();
    } else {
        renderLogin();
    }
}

void toggleInitialRoute();
