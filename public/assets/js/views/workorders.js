// Author: Joshua Schaff 
// Email: joshuarschaff@gmail.com
// File: workorders.js
// Description: Work order management view

import { apiRequest } from '../api.js';
import { state } from '../state.js';
import { notify, formatMinutes } from '../utils.js';

export function initWorkOrders() {
    const container = document.getElementById('view-workorders');
    container.innerHTML = `
        <div class="section-nav">
            <button class="nav-card" data-section="workorders-list">
                <span class="tile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                </span>
                Active tickets
                <span>Monitor the queue</span>
            </button>
            <button class="nav-card" data-section="workorder-create">
                <span class="tile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                </span>
                New work order
                <span>Book service and intake bikes</span>
            </button>

            <button class="nav-card" data-section="workorder-edit">
                <span class="tile-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                </span>
                Edit ticket
                <span>Modify an existing order</span>
            </button>
        </div>
        <div class="section-panels">
            <article class="card section-panel active" id="workorders-list">
                <h2>Work orders</h2>
                <div class="wo-toolbar">
                    <input id="wo-search" placeholder="Search work orders..." value="">
                    <select id="wo-status-filter">
                        <option value="">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="awaiting_parts">Awaiting Parts</option>
                        <option value="finished">Finished</option>
                    </select>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Customer / Bike</th>
                                <th>Status</th>
                                <th>Assigned</th>
                                <th>Opened</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="wo-table-body">
                            <tr><td colspan="6">No data yet.</td></tr>
                        </tbody>
                    </table>
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
                                <div id="edit-addline-results" class="addline-results" style="margin-top:0.5rem;"></div>
                                <div class="table-container" style="margin-top:0.5rem;">
                                    <table>
                                        <thead><tr><th>Type</th><th>Description</th><th>Employee</th><th>Status</th><th>Price/Time</th><th>Qty</th><th>Reserved</th><th>Subtotal</th><th></th></tr></thead>
                                        <tbody id="woe-lines"><tr><td colspan="9">No lines</td></tr></tbody>
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
    `;

    // Portal Modal to Body
    const existingModal = document.getElementById('customer-picker');
    if (existingModal) existingModal.remove();

    const modalHTML = `
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
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Initialize state
    state.woStaged = state.woStaged || { parts: [], services: [] };

    // Navigation
    container.querySelectorAll('.nav-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.section;
            container.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // Event Listeners
    // document.getElementById('workorders-filter-form').addEventListener('submit', handleWorkOrderFilter); // Removed
    const searchInput = document.getElementById('wo-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => loadWorkOrders());
    }
    const statusFilter = document.getElementById('wo-status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => loadWorkOrders());
    }
    document.getElementById('workorder-create-form').addEventListener('submit', handleWorkOrderCreate);
    document.getElementById('workorder-edit-form').addEventListener('submit', handleWorkOrderUpdate);

    // Customer Picker
    document.getElementById('wo-find-customer').addEventListener('click', () => openCustomerPicker('create'));
    document.getElementById('wo-new-customer').addEventListener('click', () => openCustomerPicker('create', true));
    document.getElementById('woe-find-customer').addEventListener('click', () => openCustomerPicker('edit'));
    document.getElementById('woe-new-customer').addEventListener('click', () => openCustomerPicker('edit', true));
    document.getElementById('customer-picker-close').addEventListener('click', closeCustomerPicker);
    document.getElementById('customer-picker-cancel').addEventListener('click', closeCustomerPicker);
    document.getElementById('customer-picker-search').addEventListener('input', handleCustomerPickerSearch);
    document.getElementById('customer-picker-switch-new').addEventListener('click', () => toggleCustomerPickerMode('new'));
    document.getElementById('customer-picker-switch-search').addEventListener('click', () => toggleCustomerPickerMode('search'));
    document.getElementById('customer-create-inline-form').addEventListener('submit', handleCustomerPickerCreate);

    // Staging
    document.getElementById('add-part-search').addEventListener('click', searchParts);
    document.getElementById('add-service-search').addEventListener('click', searchServices);
    document.getElementById('add-part-search-edit').addEventListener('click', searchPartsEdit);
    document.getElementById('add-service-search-edit').addEventListener('click', searchServicesEdit);

    // Bike Selection
    document.getElementById('wo-customer-bike').addEventListener('change', (e) => handleBikeSelect(e.target.value, 'wo'));
    document.getElementById('woe-customer-bike').addEventListener('change', (e) => handleBikeSelect(e.target.value, 'woe'));



    // Status Visuals
    document.getElementById('wo-status-select').addEventListener('change', (e) => updateStatusVisuals(e.target.value, 'wo'));
    document.getElementById('woe-status-select').addEventListener('change', (e) => updateStatusVisuals(e.target.value, 'woe'));

    // Initial Load
    loadWorkOrders();
    loadEmployees();
    // --- Quick Actions ---
    const quickActionsHTML = `
        <div class="quick-actions">
            <button type="button" class="btn-quick" data-search="Tune Up">Tune Up</button>
            <button type="button" class="btn-quick" data-search="Flat Fix">Flat Fix</button>
            <button type="button" class="btn-quick" data-search="Brake Adjust">Brake Adjust</button>
            <button type="button" class="btn-quick" data-search="Safety Check">Safety Check</button>
        </div>
    `;
    const toolbar = document.querySelector('#workorder-create .addline-toolbar');
    if (toolbar) {
        toolbar.insertAdjacentHTML('beforebegin', quickActionsHTML);
        document.querySelectorAll('.btn-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                const term = btn.dataset.search;
                const input = document.getElementById('add-service-q');
                if (input) {
                    input.value = term;
                    searchServices(); // Trigger search
                }
            });
        });
    }

    // --- Collapsible Panels ---
    document.querySelectorAll('.wo-panel-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('collapsed');
        });
    });

    renderStagedLines(); // Ensure empty table is rendered
}

async function loadEmployees() {
    try {
        const { items = [] } = await apiRequest('/users') || {};
        state.employees = items; // Store for lookup
        const opts = '<option value="">Select employee…</option>' +
            items.map(u => `<option value="${u.id}">${u.full_name}</option>`).join('');

        const s1 = document.getElementById('wo-employee-select');
        const s2 = document.getElementById('woe-employee-select');
        if (s1) s1.innerHTML = opts;
        if (s2) s2.innerHTML = opts;
    } catch (e) { console.error('Failed to load employees', e); }
}

function updateStatusVisuals(status, prefix) {
    const rail = document.querySelector(`#${prefix === 'wo' ? 'workorder-create' : 'workorder-edit'} .wo-status-column`);
    const label = document.querySelector(`#${prefix === 'wo' ? 'workorder-create' : 'workorder-edit'} .wo-status-label`);
    if (!rail || !label) return;

    const safeStatus = (status || 'open').toString();
    label.textContent = safeStatus.toUpperCase().replace('_', ' ');
    rail.className = 'wo-status-column';
    rail.dataset.status = safeStatus;
}

// --- Logic ---

export async function loadWorkOrders() {
    try {
        // Simple search/filter logic
        const q = (document.getElementById('wo-search')?.value || '').trim();
        const status = document.getElementById('wo-status-filter')?.value || '';

        const query = {};
        if (q) query.q = q;
        if (status) query.status = status;

        const { items = [] } = await apiRequest('/work-orders', { query }) || {};
        state.workOrders = items;
        renderWorkOrders();

    } catch (err) {
        notify(`Work orders: ${err.message}`, 'error');
    }
}



function renderWorkOrders() {
    const body = document.getElementById('wo-table-body');
    if (!state.workOrders.length) {
        body.innerHTML = '<tr><td colspan="6">No work orders.</td></tr>';
        return;
    }

    // Sort by opened_at desc
    const sorted = [...state.workOrders].sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));

    // Group by date
    const groups = {};
    sorted.forEach(wo => {
        const d = new Date(wo.opened_at);
        const key = d.toDateString();
        if (!groups[key]) groups[key] = [];
        groups[key].push(wo);
    });

    let html = '';
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    Object.keys(groups).forEach(dateKey => {
        let label = dateKey;
        if (dateKey === today) label = 'Today';
        else if (dateKey === yesterday) label = 'Yesterday';

        html += `<tr class="wo-date-header"><td colspan="6">${label}</td></tr>`;

        html += groups[dateKey].map((wo = {}) => {
            const {
                id = '',
                status = 'open',
                opened_at: openedAt = '',
                customer = '',
                bike = '',
                assigned_to: assignedTo = null,
            } = wo;

            let empName = '—';
            let initials = '—';
            if (assignedTo) {
                // API returns the full name directly
                empName = assignedTo;
                initials = empName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            }

            const safeStatus = status?.replace(' ', '_') ?? 'open';

            // Relative time for the cell
            let timeAgo = '—';
            if (openedAt) {
                const diff = Date.now() - new Date(openedAt).getTime();
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                timeAgo = days === 0 ? 'Today' : (days === 1 ? 'Yesterday' : `${days} days ago`);
            }

            return `
            <tr data-id="${id}" class="wo-rich-row">
                <td class="wo-id-cell">#${id}</td>
                <td>
                    <div class="wo-customer-cell">
                        <span class="wo-customer-name">${customer || 'Unknown Customer'}</span>
                        <span class="wo-bike-detail">${bike || 'No Bike'}</span>
                    </div>
                </td>
                <td><span class="status-chip status-${safeStatus}">${status}</span></td>
                <td>
                    ${initials !== '—'
                    ? `<div class="user-avatar" title="${empName}">${initials}</div>`
                    : '<span class="muted">—</span>'}
                </td>
                <td class="muted">${timeAgo}</td>
                <td class="wo-action-cell">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </td>
            </tr>`;
        }).join('');
    });

    body.innerHTML = html;

    // Add click listeners to rows
    body.querySelectorAll('.wo-rich-row').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.dataset.id;
            loadWorkOrderDetail(id);
            document.querySelector('[data-section="workorder-edit"]').click();
        });
    });
}

async function handleWorkOrderFilter(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    state.workOrderQuery.status = fd.get('status');
    state.workOrderQuery.page = fd.get('page') || 1;
    await loadWorkOrders();
}

// --- Create Work Order ---

async function handleWorkOrderCreate(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);

    const selectedCustomerId = Number(document.getElementById('wo-customer-id')?.value || 0);
    if (!selectedCustomerId || selectedCustomerId <= 0) {
        notify('Select or create a customer before creating the ticket', 'error');
        return;
    }

    const services = (state.woStaged?.services || []).map(s => ({
        service_id: s.id,
        service_code: s.code,
        quantity: Number(s.quantity || 1)
    }));
    const uiStatus = fd.get('status') || 'open';
    const statusMap = {
        waiting: 'open', open: 'open', finished: 'completed', cancelled: 'cancelled',
        estimate: 'draft', in_progress: 'in_progress', awaiting_parts: 'awaiting_parts',
    };

    const body = {
        customer_id: selectedCustomerId,
        status: statusMap[uiStatus] || 'open',
        assigned_to: fd.get('assigned_to') ? Number(fd.get('assigned_to')) : null,
        location_id: fd.get('location_id') ? Number(fd.get('location_id')) : null,
        promised_at: fd.get('promised_at') || null,
        notes: fd.get('internal_notes') || null,
        services,
    };

    const selectedBikeId = fd.get('bike_id');
    if (selectedBikeId) {
        body.bike_id = Number(selectedBikeId);
    }

    const bikeBrand = fd.get('bike_brand');
    if (!selectedBikeId && (bikeBrand || fd.get('bike_model'))) {
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

        // Add staged parts
        const parts = (state.woStaged?.parts || []);
        if (parts.length) {
            await apiRequest(`/ work - orders / ${res.id}/parts`, {
                method: 'POST',
                body: { items: parts.map(p => ({ item_id: p.id, quantity: Number(p.quantity || 1), notes: p.notes || null })) }
            });
        }

        state.woStaged = { parts: [], services: [] };
        renderStagedLines();
        await loadWorkOrders();
        document.querySelector('[data-section="workorders-list"]').click();
    } catch (err) {
        notify(err.message, 'error');
    }
}

// --- Staging Logic ---

function renderStagedLines() {
    const body = document.getElementById('staged-lines');
    if (!body) return;
    const parts = state.woStaged.parts || [];
    const services = state.woStaged.services || [];

    if (!parts.length && !services.length) {
        body.innerHTML = '<tr><td colspan="6">No lines added yet.</td></tr>';
        updateWorkOrderEstimate();
        return;
    }

    const rows = [];
    for (const p of parts) {
        const qty = Number(p.quantity || 1);
        const price = Number(p.price || 0);
        const sub = qty * price;
        rows.push(`<tr data-type="part" data-id="${p.id}"><td>Item</td><td>${p.name}</td><td>—</td><td>—</td><td>$${price.toFixed(2)}</td><td><input class="wo-qty" type="number" min="1" value="${qty}"></td><td>0</td><td>$${sub.toFixed(2)}</td><td><button class="btn-ghost wo-remove">✕</button></td></tr>`);
    }
    for (const s of services) {
        const qty = Number(s.quantity || 1);
        const price = Number(s.price || 0);
        const sub = qty * price;
        rows.push(`<tr data-type="service" data-id="${s.id}" data-code="${s.code}"><td>Labor</td><td>${s.name}</td><td>—</td><td>—</td><td>$${price.toFixed(2)}</td><td><input class="wo-qty" type="number" min="1" value="${qty}"></td><td>—</td><td>$${sub.toFixed(2)}</td><td><button class="btn-ghost wo-remove">✕</button></td></tr>`);
    }
    body.innerHTML = rows.join('');

    body.querySelectorAll('.wo-qty').forEach(inp => inp.addEventListener('change', stagedQtyChanged));
    body.querySelectorAll('.wo-remove').forEach(btn => btn.addEventListener('click', stagedRemove));
    updateWorkOrderEstimate();
}

function stagedQtyChanged(evt) {
    const tr = evt.target.closest('tr'); if (!tr) return;
    let qty = Number(evt.target.value);
    if (!isFinite(qty) || qty < 1) qty = 1;
    const type = tr.dataset.type;
    const id = tr.dataset.id;
    const list = type === 'part' ? state.woStaged.parts : state.woStaged.services;
    const item = list.find(x => String(x.id) === String(id));
    if (item) {
        item.quantity = qty;
        renderStagedLines();
    }
}

function stagedRemove(evt) {
    const tr = evt.target.closest('tr'); if (!tr) return;
    const type = tr.dataset.type;
    const id = tr.dataset.id;
    if (type === 'part') state.woStaged.parts = state.woStaged.parts.filter(x => String(x.id) !== String(id));
    else state.woStaged.services = state.woStaged.services.filter(x => String(x.id) !== String(id));
    renderStagedLines();
}

function updateWorkOrderEstimate() {
    const parts = state.woStaged.parts || [];
    const services = state.woStaged.services || [];
    const labor = services.reduce((sum, s) => sum + Number(s.price || 0) * Number(s.quantity || 1), 0);
    const partsTotal = parts.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.quantity || 1), 0);

    // Tax
    const tax = (labor + partsTotal) * 0.08;
    const total = labor + partsTotal + tax;

    const card = document.querySelector('#workorder-create .wo-summary-card');
    if (!card) return;
    const lines = card.querySelectorAll('dl div dd');
    if (lines[0]) lines[0].textContent = `$${labor.toFixed(2)}`;
    if (lines[1]) lines[1].textContent = `$${partsTotal.toFixed(2)}`;
    if (lines[2]) lines[2].textContent = `$${tax.toFixed(2)}`;
    const totalEl = card.querySelector('.wo-total strong');
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    // --- Print Button ---
    if (!document.getElementById('wo-print-btn')) {
        const printBtn = document.createElement('button');
        printBtn.type = 'button';
        printBtn.id = 'wo-print-btn';
        printBtn.className = 'btn-secondary';
        printBtn.style.width = '100%';
        printBtn.style.marginTop = '0.5rem';
        printBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 4px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h10.5M6.75 9.75h10.5m-13.5 3h16.5m-16.5 3h16.5m-16.5 3h16.5M3.75 6.75h16.5M3.75 21h16.5" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75V4.5a2.25 2.25 0 012.25-2.25h3a2.25 2.25 0 012.25 2.25v2.25m-7.5 0h7.5m-7.5 0v11.25c0 .621.504 1.125 1.125 1.125h5.25c.621 0 1.125-.504 1.125-1.125V6.75" />
            </svg> Print Estimate`;
        printBtn.addEventListener('click', () => window.print());
        card.appendChild(printBtn);
    }
}

async function searchParts() {
    const q = (document.getElementById('add-part-q')?.value || '').trim();
    const box = document.getElementById('addline-results');
    if (!q) { box.innerHTML = ''; return; }
    try {
        const res = await apiRequest('/inventory/items', { query: { q, size: 10 } });
        const items = res.items || [];
        box.innerHTML = items.map((i = {}) => {
            const { id = '', name = '', sku = '', price = 0, stock_quantity = 0, bin_location = '—' } = i;
            const stockClass = stock_quantity > 0 ? 'stock-badge' : 'stock-badge low';
            return `
                <div class="result-pill" data-type="part" data-id="${id}" data-name="${name}" data-price="${price}">
                    <div class="result-info">
                        <div class="result-name">${name}</div>
                        <div class="result-meta">
                            <span>${sku}</span>
                            <span class="${stockClass}">Stock: ${stock_quantity}</span>
                            <span>Bin: ${bin_location}</span>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary addline-add">Add</button>
                </div>`;
        }).join('');
        box.querySelectorAll('.addline-add').forEach(btn => btn.addEventListener('click', addSearchResult));
    } catch (e) { box.innerHTML = '<div class="muted">Error searching inventory</div>'; }
}

async function searchServices() {
    const q = (document.getElementById('add-service-q')?.value || '').trim();
    const box = document.getElementById('addline-results');
    if (!q) { box.innerHTML = ''; return; }
    try {
        const res = await apiRequest('/services', { query: { q } });
        const items = res.items || [];
        box.innerHTML = items.map((s = {}) => {
            return `
                <div class="result-pill" data-type="service" data-id="${s.id}" data-code="${s.code}" data-name="${s.name}" data-price="${s.default_price}">
                    <div class="result-info">
                        <div class="result-name">${s.name}</div>
                        <div class="result-meta">
                            <span>${s.code}</span>
                            <span>$${Number(s.default_price).toFixed(2)}</span>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary addline-add">Add</button>
                </div>`;
        }).join('');
        box.querySelectorAll('.addline-add').forEach(btn => btn.addEventListener('click', addSearchResult));
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
            state.woStaged.parts.push({ id, name: pill.dataset.name, price: Number(pill.dataset.price || 0), quantity: 1 });
        }
    } else {
        const code = pill.dataset.code || '';
        const existing = (state.woStaged.services || []).find(x => (x.code || '') === code);
        if (existing) { existing.quantity = Number(existing.quantity || 1) + 1; }
        else {
            state.woStaged.services.push({ id: Number(pill.dataset.id), code, name: pill.dataset.name, price: Number(pill.dataset.price || 0), quantity: 1 });
        }
    }
    renderStagedLines();
    document.getElementById('addline-results').innerHTML = '';
}

// --- Customer Picker ---

let pickerMode = 'create'; // or 'edit'
let pickerTargetId = null;

function openCustomerPicker(mode, isNew = false) {
    pickerMode = mode;
    const modal = document.getElementById('customer-picker');
    modal.hidden = false;
    toggleCustomerPickerMode(isNew ? 'new' : 'search');
}

function closeCustomerPicker() {
    document.getElementById('customer-picker').hidden = true;
}

function toggleCustomerPickerMode(view) {
    const searchPane = document.getElementById('customer-picker-search-pane');
    const createPane = document.getElementById('customer-picker-create-pane');
    const title = document.getElementById('customer-picker-title');

    if (view === 'new') {
        searchPane.hidden = true;
        createPane.hidden = false;
        title.textContent = 'New Customer';
    } else {
        searchPane.hidden = false;
        createPane.hidden = true;
        title.textContent = 'Find Customer';
    }
}

async function handleCustomerPickerSearch(evt) {
    const q = evt.target.value;
    if (q.length < 2) return;
    try {
        const { items = [] } = await apiRequest('/customers', { query: { q, size: 10 } });
        const tbody = document.getElementById('customer-picker-results');
        tbody.innerHTML = items.map(c => `
            <tr class="picker-row" data-id="${c.id}" data-name="${c.first_name} ${c.last_name}">
                <td>${c.first_name} ${c.last_name}</td>
                <td>${c.email}</td>
                <td>${c.city}</td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.picker-row').forEach(row => {
            row.addEventListener('click', () => selectCustomer(row.dataset.id, row.dataset.name));
        });
    } catch (e) { console.error(e); }
}

async function handleCustomerPickerCreate(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    try {
        const res = await apiRequest('/customers', { method: 'POST', body: Object.fromEntries(fd.entries()) });
        selectCustomer(res.id, `${fd.get('first_name')} ${fd.get('last_name')}`);
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function selectCustomer(id, name) {
    const prefix = pickerMode === 'create' ? 'wo' : 'woe';
    document.getElementById(`${prefix}-customer-id`).value = id;
    document.getElementById(`${prefix}-selected-customer-name`).textContent = name;
    closeCustomerPicker();
    notify('Customer selected', 'success');

    // Load bikes for this customer
    await loadCustomerBikes(id, prefix);
}

async function loadCustomerBikes(customerId, prefix) {
    try {
        const res = await apiRequest(`/customers/${customerId}/bikes`);
        const bikes = Array.isArray(res) ? res : (res.items || []);
        state.customerBikes = bikes; // Store for auto-fill
        const select = document.getElementById(`${prefix}-customer-bike`);
        if (!select) return;

        select.innerHTML = '<option value="">None or New Item</option>' +
            bikes.map(b => `<option value="${b.id}">${b.brand} ${b.model} (${b.color})</option>`).join('');
    } catch (err) {
        console.error('Failed to load bikes', err);
    }
}

function handleBikeSelect(bikeId, prefix) {
    if (!bikeId) return; // Handle clear/new case if needed
    const bike = state.customerBikes?.find(b => String(b.id) === String(bikeId));
    if (!bike) return;

    const f = document.getElementById(prefix === 'wo' ? 'workorder-create-form' : 'workorder-edit-form');
    if (!f) return;

    // Mapping
    const map = {
        'bike_brand': 'brand',
        'bike_model': 'model',
        'bike_year': 'model_year',
        'bike_notes': 'notes',
        'bike_color': 'color',
        'bike_size': 'wheel_size',
        'bike_serial': 'serial_number'
    };

    for (const [field, prop] of Object.entries(map)) {
        const input = f.elements[field];
        if (input) input.value = bike[prop] || '';
    }
}

// --- Edit Work Order ---

async function loadWorkOrderDetail(id) {
    try {
        const wo = await apiRequest(`/work-orders/${id}`);
        state.workOrderDetail = wo;

        // Populate form
        const f = document.getElementById('workorder-edit-form');
        f.elements.id.value = wo.id;
        f.elements.status.value = wo.status;
        f.elements.customer_id.value = wo.customer_id;
        f.elements.assigned_to.value = wo.assigned_to || '';
        if (wo.promised_at) {
            const d = new Date(wo.promised_at);
            const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            f.elements.promised_at.value = localIso;
        } else {
            f.elements.promised_at.value = '';
        }
        f.elements.internal_notes.value = wo.notes || '';

        const custName = wo.customer ? `${wo.customer.first_name} ${wo.customer.last_name}` : 'Unknown';
        document.getElementById('woe-selected-customer-name').textContent = custName;
        updateStatusVisuals(wo.status, 'woe');

        // Load bikes for the customer and select the current one
        if (wo.customer_id) {
            await loadCustomerBikes(wo.customer_id, 'woe');
            if (wo.bike_id) {
                f.elements.bike_id.value = wo.bike_id;
            }
        }

        // Bike details
        if (wo.bike) {
            f.elements.bike_brand.value = wo.bike.brand || '';
            f.elements.bike_model.value = wo.bike.model || '';
            f.elements.bike_year.value = wo.bike.model_year || '';
            f.elements.bike_notes.value = wo.bike.notes || '';
            f.elements.bike_color.value = wo.bike.color || '';
            f.elements.bike_size.value = wo.bike.wheel_size || '';
            f.elements.bike_serial.value = wo.bike.serial_number || '';
        }

        renderEditLines();
        updateEditTotals();
    } catch (err) {
        notify(`Failed to load work order: ${err.message}`, 'error');
    }
}

function renderEditLines() {
    const tbody = document.getElementById('woe-lines');
    const wo = state.workOrderDetail;
    if (!wo) return;

    const lines = [];
    (wo.services || []).forEach(s => {
        const price = Number(s.price || s.price_at_time || 0);
        const qty = Number(s.quantity || 1);
        const emp = state.employees?.find(u => u.id === s.assigned_to);
        const empName = emp ? emp.full_name : '—';

        lines.push(`<tr>
            <td>Labor</td>
            <td>${s.service?.name || s.name || 'Service'}</td>
            <td>${empName}</td>
            <td>—</td>
            <td>$${price.toFixed(2)}</td>
            <td><input type="number" class="qty-input" value="${qty}" min="1" data-type="service" data-id="${s.id}" style="width: 60px; padding: 0.25rem;"></td>
            <td>—</td>
            <td>$${(qty * price).toFixed(2)}</td>
            <td><button type="button" class="btn-ghost wo-remove-line" data-type="service" data-id="${s.id}">✕</button></td>
        </tr>`);
    });
    (wo.items || []).forEach(i => {
        const price = Number(i.unit_price || i.price_at_time || 0);
        const qty = Number(i.quantity || 1);

        lines.push(`<tr>
            <td>Part</td>
            <td>${i.item?.name || i.name || 'Item'}</td>
            <td>—</td>
            <td>—</td>
            <td>$${price.toFixed(2)}</td>
            <td><input type="number" class="qty-input" value="${qty}" min="1" data-type="part" data-id="${i.id}" style="width: 60px; padding: 0.25rem;"></td>
            <td>—</td>
            <td>$${(qty * price).toFixed(2)}</td>
            <td><button type="button" class="btn-ghost wo-remove-line" data-type="part" data-id="${i.id}">✕</button></td>
        </tr>`);
    });

    tbody.innerHTML = lines.length ? lines.join('') : '<tr><td colspan="9">No lines</td></tr>';
    tbody.querySelectorAll('.wo-remove-line').forEach(btn => btn.addEventListener('click', removeEditLine));
    tbody.querySelectorAll('.qty-input').forEach(inp => inp.addEventListener('change', updateLineQuantity));
}

async function updateLineQuantity(evt) {
    const inp = evt.target;
    const type = inp.dataset.type;
    const id = inp.dataset.id;
    const qty = Number(inp.value);
    const woId = state.workOrderDetail.id;

    if (qty <= 0) {
        notify('Quantity must be > 0', 'error');
        return;
    }

    try {
        const endpoint = type === 'part' ? `/work-orders/${woId}/parts/${id}` : `/work-orders/${woId}/services/${id}`;
        await apiRequest(endpoint, { method: 'PATCH', body: { quantity: qty } });
        notify('Quantity updated', 'success');
        await loadWorkOrderDetail(woId);
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function removeEditLine(evt) {
    if (!confirm('Remove this line?')) return;
    const btn = evt.target;
    const type = btn.dataset.type;
    const id = btn.dataset.id;
    const woId = state.workOrderDetail.id;

    try {
        const endpoint = type === 'part' ? `/work-orders/${woId}/parts/${id}` : `/work-orders/${woId}/services/${id}`;
        await apiRequest(endpoint, { method: 'DELETE' });
        notify('Line removed', 'success');
        await loadWorkOrderDetail(woId);
    } catch (err) {
        notify(err.message, 'error');
    }
}

function updateEditTotals() {
    const wo = state.workOrderDetail;
    if (!wo) return;

    const labor = (wo.services || []).reduce((sum, s) => sum + (Number(s.quantity || 1) * Number(s.price || s.price_at_time || 0)), 0);
    const parts = (wo.items || []).reduce((sum, i) => sum + (Number(i.quantity || 1) * Number(i.unit_price || i.price_at_time || 0)), 0);
    const total = labor + parts;

    document.getElementById('woe-labor').textContent = `$${labor.toFixed(2)}`;
    document.getElementById('woe-parts').textContent = `$${parts.toFixed(2)}`;
    document.getElementById('woe-total').textContent = `$${total.toFixed(2)}`;
}

async function handleWorkOrderUpdate(evt) {
    evt.preventDefault();
    const fd = new FormData(evt.target);
    const id = fd.get('id');

    const body = {
        status: fd.get('status'),
        assigned_to: fd.get('assigned_to') ? Number(fd.get('assigned_to')) : null,
        promised_at: fd.get('promised_at') || null,
        notes: fd.get('internal_notes') || null,
        bike: {
            brand: fd.get('bike_brand'),
            model: fd.get('bike_model'),
            model_year: fd.get('bike_year') ? Number(fd.get('bike_year')) : null,
            notes: fd.get('bike_notes'),
            color: fd.get('bike_color'),
            wheel_size: fd.get('bike_size'),
            serial_number: fd.get('bike_serial'),
        }
    };

    // Also send bike_id if selected
    const bikeId = fd.get('bike_id');
    if (bikeId) body.bike_id = Number(bikeId);

    try {
        await apiRequest(`/work-orders/${id}`, { method: 'PATCH', body });
        notify('Work order updated', 'success');
        await loadWorkOrderDetail(id);
        await loadWorkOrders();
    } catch (err) {
        notify(err.message, 'error');
    }
}

async function searchPartsEdit() {
    const q = (document.getElementById('add-part-q-edit')?.value || '').trim();
    const box = document.getElementById('edit-addline-results');
    if (!q) { box.innerHTML = ''; return; }
    try {
        const res = await apiRequest('/inventory/items', { query: { q, size: 10 } });
        const items = res.items || [];
        box.innerHTML = items.map((i = {}) => {
            const { id = '', name = '', sku = '', price = 0, stock_quantity = 0, bin_location = '—' } = i;
            const stockClass = stock_quantity > 0 ? 'stock-badge' : 'stock-badge low';
            return `
                <div class="result-pill" data-type="part" data-id="${id}">
                    <div class="result-info">
                        <div class="result-name">${name}</div>
                        <div class="result-meta">
                            <span>${sku}</span>
                            <span class="${stockClass}">Stock: ${stock_quantity}</span>
                            <span>Bin: ${bin_location}</span>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary add-edit">Add</button>
                </div>`;
        }).join('');
        box.querySelectorAll('.add-edit').forEach(btn => btn.addEventListener('click', addLineToEdit));
    } catch (e) { box.innerHTML = '<div class="muted">Error</div>'; }
}

async function searchServicesEdit() {
    const q = (document.getElementById('add-service-q-edit')?.value || '').trim();
    const box = document.getElementById('edit-addline-results');
    if (!q) { box.innerHTML = ''; return; }
    try {
        const res = await apiRequest('/services', { query: { q } });
        const items = res.items || [];
        box.innerHTML = items.map((s = {}) => {
            const { id = '', name = '', code = '', default_price = 0 } = s;
            return `
                <div class="result-pill" data-type="service" data-id="${id}">
                    <div class="result-info">
                        <div class="result-name">${name}</div>
                        <div class="result-meta">
                            <span>${code}</span>
                            <span>$${Number(default_price).toFixed(2)}</span>
                        </div>
                    </div>
                    <button type="button" class="btn-secondary add-edit">Add</button>
                </div>`;
        }).join('');
        box.querySelectorAll('.add-edit').forEach(btn => btn.addEventListener('click', addLineToEdit));
    } catch (e) { box.innerHTML = '<div class="muted">Error</div>'; }
}

async function addLineToEdit(evt) {
    const pill = evt.target.closest('.result-pill');
    const type = pill.dataset.type;
    const id = Number(pill.dataset.id);
    const woId = document.getElementById('woe-workorder-id')?.value;

    if (!woId) {
        notify('Work Order ID missing', 'error');
        return;
    }

    try {
        const endpoint = type === 'part' ? `/work-orders/${woId}/parts` : `/work-orders/${woId}/services`;
        const body = { items: [{ [type === 'part' ? 'item_id' : 'service_id']: id, quantity: 1 }] };
        await apiRequest(endpoint, { method: 'POST', body });
        notify('Line added', 'success');
        await loadWorkOrderDetail(woId);
        document.getElementById('edit-addline-results').innerHTML = '';
    } catch (err) {
        notify(err.message, 'error');
    }
}

// --- Calendar ---

let calendarOffset = 0;

