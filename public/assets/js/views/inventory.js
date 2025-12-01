import { apiRequest } from '../api.js';
import { state } from '../state.js';
import { notify } from '../utils.js';

export function initInventory() {
    const container = document.getElementById('view-inventory');
    container.innerHTML = `
        <div class="view-container">
            <div class="section-panel active" id="inventory-list-panel">
                <div class="wo-toolbar">
                    <input id="inv-search-input" placeholder="Search SKU, Name..." value="${state.inventoryQuery?.q || ''}">
                    <select id="inv-brand-filter">
                        <option value="">All Brands</option>
                        <!-- Brands loaded dynamically -->
                    </select>
                    <button class="btn-primary" id="inv-create-btn">New Item</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Category / Brand</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="inventory-table-body">
                            <tr><td colspan="5">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Modals
    setupInventoryModals();

    // Event Listeners
    const searchInput = document.getElementById('inv-search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.inventoryQuery.q = e.target.value;
            loadInventory();
        }, 300);
    });

    document.getElementById('inv-brand-filter').addEventListener('change', (e) => {
        state.inventoryQuery.brand = e.target.value;
        loadInventory();
    });

    document.getElementById('inv-create-btn').addEventListener('click', () => {
        openInventoryModal('create');
    });

    // Initial Load
    if (!state.inventoryQuery) state.inventoryQuery = { q: '', brand: '', page: 1, size: 50 };
    loadInventory();
    loadBrands(); // Helper to populate brand filter
}

function setupInventoryModals() {
    const existingCreate = document.getElementById('inv-create-modal');
    if (existingCreate) existingCreate.remove();
    const existingDetail = document.getElementById('inv-detail-modal');
    if (existingDetail) existingDetail.remove();

    // Create Modal
    const createHTML = `
        <div class="modal" id="inv-create-modal" hidden>
            <div class="modal-card">
                <div class="modal-header">
                    <strong>New Inventory Item</strong>
                    <button type="button" class="btn-ghost close-modal">✕</button>
                </div>
                <div class="modal-body">
                    <form id="inv-create-form" class="two-col">
                        <label>SKU<input name="sku" required></label>
                        <label>Name<input name="name" required></label>
                        <label>Brand<input name="brand_id" type="number" placeholder="ID (temp)"></label>
                        <label>Category<input name="category_id" type="number" placeholder="ID (temp)"></label>
                        <label>Price<input name="price" type="number" step="0.01"></label>
                        <label>Cost<input name="cost" type="number" step="0.01"></label>
                        <label>Stock<input name="stock_quantity" type="number"></label>
                        <label>Reorder Level<input name="reorder_level" type="number"></label>
                        <div class="form-actions full">
                            <button class="btn-primary" type="submit">Create Item</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Detail Modal
    const detailHTML = `
        <div class="modal" id="inv-detail-modal" hidden>
            <div class="modal-card">
                <div class="modal-header">
                    <strong>Item Details</strong>
                    <button type="button" class="btn-ghost close-modal">✕</button>
                </div>
                <div class="modal-body" id="inv-detail-content">
                    Loading...
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', createHTML + detailHTML);

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').hidden = true;
        });
    });

    document.getElementById('inv-create-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
            await apiRequest('/inventory/items', { method: 'POST', body: Object.fromEntries(fd.entries()) });
            notify('Item created', 'success');
            e.target.reset();
            document.getElementById('inv-create-modal').hidden = true;
            await loadInventory();
        } catch (err) {
            notify(err.message, 'error');
        }
    });
}

function openInventoryModal(type, data = null) {
    if (type === 'create') {
        document.getElementById('inv-create-modal').hidden = false;
    } else if (type === 'detail') {
        const modal = document.getElementById('inv-detail-modal');
        const content = document.getElementById('inv-detail-content');
        modal.hidden = false;
        renderInventoryDetail(content, data);
    }
}

async function loadInventory() {
    try {
        const { items = [] } = await apiRequest('/inventory/items', { query: state.inventoryQuery }) || {};
        state.inventory = items;
        renderInventoryTable();
    } catch (err) {
        notify(`Inventory: ${err.message}`, 'error');
    }
}

async function loadBrands() {
    try {
        const { items = [] } = await apiRequest('/inventory/brands') || {};
        const select = document.getElementById('inv-brand-filter');
        if (select) {
            const current = select.value;
            select.innerHTML = '<option value="">All Brands</option>' +
                items.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
            select.value = current;
        }
    } catch (e) {
        console.error('Failed to load brands', e);
    }
}

function renderInventoryTable() {
    const body = document.getElementById('inventory-table-body');
    if (!body) return;

    if (!state.inventory.length) {
        body.innerHTML = '<tr><td colspan="5">No items found.</td></tr>';
        return;
    }

    body.innerHTML = state.inventory.map(item => {
        const {
            id,
            sku = '—',
            name = '—',
            brand = '—',
            category = '—',
            price = 0,
            stock_quantity: stock = 0,
            reorder_level: reorder = 0
        } = item;

        let stockBadge = 'badge-stock-ok';
        let stockLabel = 'In Stock';
        if (stock <= 0) {
            stockBadge = 'badge-stock-out';
            stockLabel = 'Out of Stock';
        } else if (stock <= reorder) {
            stockBadge = 'badge-stock-low';
            stockLabel = 'Low Stock';
        }

        return `
        <tr class="inventory-rich-row" data-id="${id}">
            <td>
                <div class="inv-item-cell">
                    <span class="inv-item-name">${name}</span>
                    <span class="inv-item-sku">${sku}</span>
                </div>
            </td>
            <td class="inv-meta-cell">
                <div>${brand || '—'}</div>
                <div class="tiny-label">${category || '—'}</div>
            </td>
            <td class="inv-meta-cell">$${Number(price).toFixed(2)}</td>
            <td>
                <span class="badge-stock ${stockBadge}">${stockLabel} (${stock})</span>
            </td>
            <td style="text-align:right;">
                <button class="btn-ghost view-inv-btn">View</button>
            </td>
        </tr>
        `;
    }).join('');

    body.querySelectorAll('.inventory-rich-row').forEach(row => {
        row.addEventListener('click', () => {
            const id = Number(row.dataset.id);
            const item = state.inventory.find(i => i.id === id);
            if (item) openInventoryModal('detail', item);
        });
    });
}

function renderInventoryDetail(container, item) {
    const {
        id, sku, name, brand, category, price, cost, stock_quantity, reorder_level
    } = item;

    container.innerHTML = `
        <div class="detail-header-actions" style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
            <button class="btn-secondary" id="inv-edit-btn">Edit Item</button>
        </div>
        <div id="inv-view-mode">
            <div class="detail-grid">
                <div class="detail-section">
                    <h3>Item Info</h3>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>SKU:</strong> ${sku}</p>
                    <p><strong>Brand:</strong> ${brand || '—'}</p>
                    <p><strong>Category:</strong> ${category || '—'}</p>
                </div>
                <div class="detail-section">
                    <h3>Pricing & Stock</h3>
                    <p><strong>Price:</strong> $${Number(price).toFixed(2)}</p>
                    <p><strong>Cost:</strong> $${Number(cost || 0).toFixed(2)}</p>
                    <p><strong>Stock:</strong> ${stock_quantity}</p>
                    <p><strong>Reorder Level:</strong> ${reorder_level}</p>
                </div>
            </div>
        </div>
        <form id="inv-edit-form" class="two-col" hidden>
            <input type="hidden" name="id" value="${id}">
            <label>SKU<input name="sku" value="${sku}" required></label>
            <label>Name<input name="name" value="${name}" required></label>
            <label>Brand
                <select name="brand_id" id="inv-edit-brand">
                    <option value="">Select Brand...</option>
                </select>
            </label>
            <label>Category
                <select name="category_id" id="inv-edit-category">
                    <option value="">Select Category...</option>
                </select>
            </label>
            <label>Price<input name="price" type="number" step="0.01" value="${price ?? ''}"></label>
            <label>Cost<input name="cost" type="number" step="0.01" value="${cost ?? ''}"></label>
            <label>Stock<input name="stock_quantity" type="number" value="${stock_quantity ?? ''}"></label>
            <label>Reorder Level<input name="reorder_level" type="number" value="${reorder_level ?? ''}"></label>
            <div class="form-actions full">
                <button class="btn-primary" type="submit">Save Changes</button>
                <button class="btn-ghost" type="button" id="inv-edit-cancel">Cancel</button>
            </div>
        </form>
    `;

    // Edit Listeners
    document.getElementById('inv-edit-btn').addEventListener('click', async () => {
        // Load options
        try {
            const [bRes, cRes] = await Promise.all([
                apiRequest('/inventory/brands'),
                apiRequest('/inventory/categories')
            ]);

            const brandSel = document.getElementById('inv-edit-brand');
            const catSel = document.getElementById('inv-edit-category');

            brandSel.innerHTML = '<option value="">Select Brand...</option>' +
                (bRes.items || []).map(b => `<option value="${b.id}" ${b.id == item.brand_id ? 'selected' : ''}>${b.name}</option>`).join('');

            catSel.innerHTML = '<option value="">Select Category...</option>' +
                (cRes.items || []).map(c => `<option value="${c.id}" ${c.id == item.category_id ? 'selected' : ''}>${c.name}</option>`).join('');

        } catch (e) { console.error('Failed to load options', e); }

        document.getElementById('inv-view-mode').hidden = true;
        document.getElementById('inv-edit-btn').hidden = true;
        document.getElementById('inv-edit-form').hidden = false;
    });

    document.getElementById('inv-edit-cancel').addEventListener('click', () => {
        document.getElementById('inv-view-mode').hidden = false;
        document.getElementById('inv-edit-btn').hidden = false;
        document.getElementById('inv-edit-form').hidden = true;
    });

    document.getElementById('inv-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        try {
            await apiRequest(`/inventory/items/${id}`, { method: 'PATCH', body: data });
            notify('Item updated', 'success');

            // Refresh local data
            const updated = { ...item, ...data };
            const idx = state.inventory.findIndex(i => i.id === id);
            if (idx !== -1) state.inventory[idx] = updated;

            // Re-render
            loadInventory(); // Reload to refresh list and potentially brand/category names if IDs changed
            renderInventoryDetail(container, updated);
        } catch (err) {
            notify(err.message, 'error');
        }
    });
}
