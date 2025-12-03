// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: warranties.js
// Description: Warranty management view

import { apiRequest } from '../api.js';
import { state } from '../state.js';
import { notify } from '../utils.js';

export function initWarranties() {
    const container = document.getElementById('view-warranties');
    container.innerHTML = `
        <div class="view-container">
            <div class="section-panel active" id="warranties-list-panel">
                <div class="wo-toolbar">
                    <input id="warranty-search-input" placeholder="Search warranties..." value="${state.warrantyQuery?.q || ''}">
                    <select id="warranty-status-filter">
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="void">Void</option>
                        <option value="transferred">Transferred</option>
                    </select>
                    <button class="btn-primary" id="warranty-create-btn">New Warranty</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Warranty / Item</th>
                                <th>Customer</th>
                                <th>Dates</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="warranty-table-body">
                            <tr><td colspan="5">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    setupWarrantyModals();

    // Event Listeners
    const searchInput = document.getElementById('warranty-search-input');
    const statusFilter = document.getElementById('warranty-status-filter');

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.warrantyQuery.q = e.target.value;
            loadWarranties();
        }, 300);
    });

    statusFilter.addEventListener('change', (e) => {
        state.warrantyQuery.status = e.target.value;
        loadWarranties();
    });

    document.getElementById('warranty-create-btn').addEventListener('click', () => {
        openWarrantyModal('create');
    });

    // Initial Load
    if (!state.warrantyQuery) state.warrantyQuery = { q: '', status: '', page: 1, size: 50 };
    loadWarranties();
}

function setupWarrantyModals() {
    const existingCreate = document.getElementById('warranty-create-modal');
    if (existingCreate) existingCreate.remove();
    const existingEdit = document.getElementById('warranty-edit-modal');
    if (existingEdit) existingEdit.remove();

    const createHTML = `
        <div class="modal" id="warranty-create-modal" hidden>
            <div class="modal-card">
                <div class="modal-header">
                    <strong>New Warranty</strong>
                    <button type="button" class="btn-ghost close-modal">✕</button>
                </div>
                <div class="modal-body">
                    <form id="warranty-create-form" class="two-col">
                        <label class="full">Customer
                            <div class="search-container">
                                <input id="warranty-customer-search" placeholder="Search by name..." autocomplete="off">
                                <input name="customer_id" type="hidden" required>
                                <div id="warranty-customer-results" class="search-results" hidden></div>
                            </div>
                        </label>
                        <label>Warranty Template
                            <select name="warranty_id" id="warranty-template-select" required>
                                <option value="">Select Template...</option>
                            </select>
                        </label>
                        <label>Status
                            <select name="status">
                                <option value="active">Active</option>
                                <option value="expired">Expired</option>
                                <option value="void">Void</option>
                            </select>
                        </label>
                        <label>Purchase Date<input name="purchase_date" type="date" required></label>
                        <label>Start Date<input name="start_date" type="date" required></label>
                        <label>Serial Number<input name="serial_number"></label>
                        <label>Duration (Months)<input name="duration_months" type="number"></label>
                        <label class="full">Notes<textarea name="notes" rows="3"></textarea></label>
                        <div class="form-actions full">
                            <button class="btn-primary" type="submit">Register Warranty</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const editHTML = `
        <div class="modal" id="warranty-edit-modal" hidden>
            <div class="modal-card">
                <div class="modal-header">
                    <strong>Edit Warranty</strong>
                    <button type="button" class="btn-ghost close-modal">✕</button>
                </div>
                <div class="modal-body">
                    <form id="warranty-edit-form" class="two-col">
                        <input type="hidden" name="id">
                        <label>Status
                            <select name="status">
                                <option value="active">Active</option>
                                <option value="expired">Expired</option>
                                <option value="void">Void</option>
                                <option value="transferred">Transferred</option>
                            </select>
                        </label>
                        <label class="full">Notes<textarea name="notes" rows="3"></textarea></label>
                        <div class="form-actions full">
                            <button class="btn-primary" type="submit">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', createHTML + editHTML);

    // Modal Listeners
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').hidden = true;
        });
    });

    // Customer Search Logic
    const custSearch = document.getElementById('warranty-customer-search');
    const custResults = document.getElementById('warranty-customer-results');
    const custId = document.querySelector('#warranty-create-form [name="customer_id"]');

    let searchDebounce;
    custSearch.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        const q = e.target.value.trim();
        if (!q) {
            custResults.hidden = true;
            return;
        }
        searchDebounce = setTimeout(async () => {
            try {
                const res = await apiRequest('/customers', { query: { q, size: 5 } });
                const items = res.items || [];
                if (!items.length) {
                    custResults.innerHTML = '<div class="search-item muted">No customers found</div>';
                } else {
                    custResults.innerHTML = items.map(c => `
                        <div class="search-item" data-id="${c.id}" data-name="${c.first_name} ${c.last_name}">
                            <strong>${c.first_name} ${c.last_name}</strong>
                            <small>${c.email || ''}</small>
                        </div>
                    `).join('');
                }
                custResults.hidden = false;
            } catch (err) { console.error(err); }
        }, 300);
    });

    custResults.addEventListener('click', (e) => {
        const item = e.target.closest('.search-item');
        if (!item || item.classList.contains('muted')) return;
        custSearch.value = item.dataset.name;
        custId.value = item.dataset.id;
        custResults.hidden = true;
    });

    // Close results on outside click
    document.addEventListener('click', (e) => {
        if (!custSearch.contains(e.target) && !custResults.contains(e.target)) {
            custResults.hidden = true;
        }
    });

    document.getElementById('warranty-create-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const customerId = fd.get('customer_id');
        if (!customerId) {
            notify('Please select a customer', 'error');
            return;
        }
        try {
            await apiRequest(`/customers/${customerId}/warranties`, {
                method: 'POST',
                body: Object.fromEntries(fd.entries())
            });
            notify('Warranty registered', 'success');
            e.target.reset();
            document.getElementById('warranty-create-modal').hidden = true;
            await loadWarranties();
        } catch (err) {
            notify(err.message, 'error');
        }
    });

    document.getElementById('warranty-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const id = fd.get('id');
        try {
            await apiRequest(`/warranties/${id}`, {
                method: 'PATCH',
                body: Object.fromEntries(fd.entries())
            });
            notify('Warranty updated', 'success');
            document.getElementById('warranty-edit-modal').hidden = true;
            await loadWarranties();
        } catch (err) {
            notify(err.message, 'error');
        }
    });
}

async function openWarrantyModal(type, data = null) {
    if (type === 'create') {
        // Load templates
        try {
            const { items = [] } = await apiRequest('/warranties/templates');
            const select = document.getElementById('warranty-template-select');
            select.innerHTML = '<option value="">Select Template...</option>' +
                items.map(t => `<option value="${t.id}">${t.name} (${t.duration_months}mo)</option>`).join('');
        } catch (e) { console.error(e); }
        document.getElementById('warranty-create-modal').hidden = false;
    } else if (type === 'edit') {
        const form = document.getElementById('warranty-edit-form');
        form.querySelector('[name="id"]').value = data.id;
        form.querySelector('[name="status"]').value = data.status;
        form.querySelector('[name="notes"]').value = data.notes || '';
        document.getElementById('warranty-edit-modal').hidden = false;
    }
}

async function loadWarranties() {
    try {
        const { items = [] } = await apiRequest('/warranties', { query: state.warrantyQuery }) || {};
        state.warranties = items;
        renderWarrantyTable();
    } catch (err) {
        notify(`Warranties: ${err.message}`, 'error');
    }
}

function renderWarrantyTable() {
    const body = document.getElementById('warranty-table-body');
    if (!body) return;

    if (!state.warranties.length) {
        body.innerHTML = '<tr><td colspan="5">No warranties found.</td></tr>';
        return;
    }

    body.innerHTML = state.warranties.map(w => {
        const {
            id,
            status,
            start_date,
            end_date,
            serial_number,
            warranty_name,
            customer_name,
            item_name
        } = w;

        const statusClass = {
            active: 'status-ok',
            expired: 'status-bad',
            void: 'status-bad',
            transferred: 'role'
        }[status] || 'role';

        return `
        <tr class="inventory-rich-row" data-id="${id}">
            <td>
                <div class="inv-item-cell">
                    <span class="inv-item-name">${warranty_name}</span>
                    <span class="inv-item-sku">${item_name || '—'}</span>
                    <span class="inv-meta-cell">S/N: ${serial_number || '—'}</span>
                </div>
            </td>
            <td>${customer_name}</td>
            <td>
                <div class="inv-item-cell">
                    <span class="inv-meta-cell">Start: ${start_date}</span>
                    <span class="inv-meta-cell">End: ${end_date || '—'}</span>
                </div>
            </td>
            <td><span class="badge ${statusClass}">${status}</span></td>
            <td style="text-align:right;">
                <button class="btn-ghost edit-btn">Edit</button>
            </td>
        </tr>
        `;
    }).join('');

    body.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const row = e.target.closest('tr');
            const id = Number(row.dataset.id);
            const warranty = state.warranties.find(w => w.id === id);
            if (warranty) openWarrantyModal('edit', warranty);
        });
    });
}
