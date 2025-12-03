// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: customers.js
// Description: Customer management view

import { apiRequest } from '../api.js';
import { state } from '../state.js';
import { notify } from '../utils.js';

export function initCustomers() {
    const container = document.getElementById('view-customers');
    container.innerHTML = `
        <div class="view-container">
            <div class="section-panel active" id="customers-list-panel">
                <div class="wo-toolbar">
                    <input id="customer-search-input" placeholder="Search customers..." value="${state.customerQuery?.q || ''}">
                    <button class="btn-primary" id="customer-create-btn">New Customer</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Contact</th>
                                <th>Location</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="customer-table-body">
                            <tr><td colspan="4">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Modals
    setupCustomerModals();

    // Event Listeners
    const searchInput = document.getElementById('customer-search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.customerQuery.q = e.target.value;
            loadCustomers();
        }, 300);
    });

    document.getElementById('customer-create-btn').addEventListener('click', () => {
        openCustomerModal('create');
    });

    // Initial Load
    if (!state.customerQuery) state.customerQuery = { q: '', page: 1, size: 50 };
    loadCustomers();
}

function setupCustomerModals() {
    // Remove existing if any (to prevent duplicates on re-init)
    const existingCreate = document.getElementById('customer-create-modal');
    if (existingCreate) existingCreate.remove();
    const existingDetail = document.getElementById('customer-detail-modal');
    if (existingDetail) existingDetail.remove();

    // Create Modal
    const createHTML = `
        <div class="modal" id="customer-create-modal" hidden>
            <div class="modal-card">
                <div class="modal-header">
                    <strong>New Customer</strong>
                    <button type="button" class="btn-ghost close-modal">✕</button>
                </div>
                <div class="modal-body">
                    <form id="customer-create-form" class="two-col">
                        <label>First Name<input name="first_name" required></label>
                        <label>Last Name<input name="last_name" required></label>
                        <label>Email<input name="email" type="email"></label>
                        <label>Phone<input name="phone" type="tel"></label>
                        <label>City<input name="city"></label>
                        <label>Region<input name="region"></label>
                        <div class="form-actions full">
                            <button class="btn-primary" type="submit">Create Customer</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Detail Modal
    const detailHTML = `
        <div class="modal" id="customer-detail-modal" hidden>
            <div class="modal-card">
                <div class="modal-header">
                    <strong>Customer Details</strong>
                    <button type="button" class="btn-ghost close-modal">✕</button>
                </div>
                <div class="modal-body" id="customer-detail-content">
                    Loading...
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', createHTML + detailHTML);

    // Modal Listeners
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').hidden = true;
        });
    });

    document.getElementById('customer-create-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            await apiRequest('/customers', { method: 'POST', body: Object.fromEntries(fd.entries()) });
            notify('Customer created', 'success');
            e.target.reset();
            document.getElementById('customer-create-modal').hidden = true;
            await loadCustomers();
        } catch (err) {
            notify(err.message, 'error');
        }
    });
}

function openCustomerModal(type, data = null) {
    if (type === 'create') {
        document.getElementById('customer-create-modal').hidden = false;
    } else if (type === 'detail') {
        const modal = document.getElementById('customer-detail-modal');
        const content = document.getElementById('customer-detail-content');
        modal.hidden = false;
        renderCustomerDetail(content, data);
    }
}

async function loadCustomers() {
    try {
        const { items = [] } = await apiRequest('/customers', { query: state.customerQuery }) || {};
        state.customers = items;
        renderCustomerTable();
    } catch (err) {
        notify(`Customers: ${err.message}`, 'error');
    }
}

function renderCustomerTable() {
    const body = document.getElementById('customer-table-body');
    if (!body) return;

    if (!state.customers.length) {
        body.innerHTML = '<tr><td colspan="4">No customers found.</td></tr>';
        return;
    }

    body.innerHTML = state.customers.map(c => {
        const {
            id,
            first_name: firstName = '',
            last_name: lastName = '',
            email = '',
            phone = '',
            city = '',
            region = '',
        } = c;

        const initials = (firstName[0] || '') + (lastName[0] || '');
        const location = [city, region].filter(Boolean).join(', ') || '—';

        return `
        <tr class="customer-rich-row" data-id="${id}">
            <td>
                <div class="customer-info-cell">
                    <div class="customer-avatar">${initials}</div>
                    <div class="customer-details-col">
                        <span class="customer-name">${firstName} ${lastName}</span>
                        <span class="customer-email">${email || 'No email'}</span>
                    </div>
                </div>
            </td>
            <td class="customer-meta">${phone || '—'}</td>
            <td class="customer-meta">${location}</td>
            <td style="text-align:right;">
                <button class="btn-ghost view-customer-btn">View</button>
            </td>
        </tr>
        `;
    }).join('');

    body.querySelectorAll('.customer-rich-row').forEach(row => {
        row.addEventListener('click', () => {
            const id = Number(row.dataset.id);
            const customer = state.customers.find(c => c.id === id);
            if (customer) openCustomerModal('detail', customer);
        });
    });
}

async function renderCustomerDetail(container, customer) {
    const {
        id,
        first_name: firstName = '',
        last_name: lastName = '',
        email = '',
        phone = '',
        city = '',
        region = '',
        street = '',
        postal_code: zip = '',
        notes = ''
    } = customer;

    container.innerHTML = `
        <div class="detail-header-actions" style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
            <button class="btn-secondary" id="customer-edit-btn">Edit Details</button>
        </div>
        <div id="customer-view-mode">
            <div class="detail-grid">
                <div class="detail-section">
                    <h3>Contact Info</h3>
                    <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                    <p><strong>Email:</strong> ${email || '—'}</p>
                    <p><strong>Phone:</strong> ${phone || '—'}</p>
                </div>
                <div class="detail-section">
                    <h3>Address</h3>
                    <p>${street || '—'}</p>
                    <p>${[city, region, zip].filter(Boolean).join(', ') || '—'}</p>
                </div>
                ${notes ? `<div class="detail-section full"><h3>Notes</h3><p>${notes}</p></div>` : ''}
            </div>
        </div>
        <form id="customer-edit-form" class="two-col" hidden>
            <input type="hidden" name="id" value="${id}">
            <label>First Name<input name="first_name" value="${firstName}" required></label>
            <label>Last Name<input name="last_name" value="${lastName}" required></label>
            <label>Email<input name="email" type="email" value="${email || ''}"></label>
            <label>Phone<input name="phone" type="tel" value="${phone || ''}"></label>
            <label>Street<input name="street" value="${street || ''}"></label>
            <label>City<input name="city" value="${city || ''}"></label>
            <label>Region<input name="region" value="${region || ''}"></label>
            <label>Zip<input name="postal_code" value="${zip || ''}"></label>
            <label class="full">Notes<textarea name="notes" rows="3">${notes || ''}</textarea></label>
            <div class="form-actions full">
                <button class="btn-primary" type="submit">Save Changes</button>
                <button class="btn-ghost" type="button" id="customer-edit-cancel">Cancel</button>
            </div>
        </form>
        <div style="margin-top:1rem; border-top:1px solid var(--border); padding-top:1rem;">
            <h3>Bikes</h3>
            <div id="customer-detail-bikes">Loading bikes...</div>
        </div>
    `;

    // Edit Listeners
    document.getElementById('customer-edit-btn').addEventListener('click', () => {
        document.getElementById('customer-view-mode').hidden = true;
        document.getElementById('customer-edit-btn').hidden = true;
        document.getElementById('customer-edit-form').hidden = false;
    });

    document.getElementById('customer-edit-cancel').addEventListener('click', () => {
        document.getElementById('customer-view-mode').hidden = false;
        document.getElementById('customer-edit-btn').hidden = false;
        document.getElementById('customer-edit-form').hidden = true;
    });

    document.getElementById('customer-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        try {
            await apiRequest(`/customers/${id}`, { method: 'PATCH', body: data });
            notify('Customer updated', 'success');

            // Refresh local data
            const updated = { ...customer, ...data };
            const idx = state.customers.findIndex(c => c.id === id);
            if (idx !== -1) state.customers[idx] = updated;

            // Re-render list and close modal
            renderCustomerTable();
            document.getElementById('customer-detail-modal').hidden = true;
        } catch (err) {
            notify(err.message, 'error');
        }
    });

    // Load bikes
    try {
        const bikes = await apiRequest(`/customers/${id}/bikes`);
        const bikeContainer = document.getElementById('customer-detail-bikes');
        if (!bikes || !bikes.items || !bikes.items.length) {
            bikeContainer.innerHTML = '<p class="muted">No bikes on file.</p>';
        } else {
            bikeContainer.innerHTML = `<ul class="pill-list">${bikes.items.map(b =>
                `<li class="pill">${b.brand} ${b.model} <small>(${b.color})</small></li>`
            ).join('')}</ul>`;
        }
    } catch (e) {
        document.getElementById('customer-detail-bikes').innerHTML = '<p class="muted">Could not load bikes.</p>';
    }
}
