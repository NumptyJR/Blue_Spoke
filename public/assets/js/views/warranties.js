import { apiRequest } from '../api.js';
import { state } from '../state.js';
import { notify } from '../utils.js';

export function initWarranties() {
    const container = document.getElementById('view-warranties');
    container.innerHTML = `
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
    `;

    // Navigation
    container.querySelectorAll('.nav-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.section;
            container.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // Event Listeners
    document.getElementById('warranty-customer-form').addEventListener('submit', handleWarrantyLookup);
    document.getElementById('warranty-register-form').addEventListener('submit', handleWarrantyRegister);
    document.getElementById('warranty-template-form').addEventListener('submit', handleTemplateCreate);
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
        if (['warranty_id', 'bike_id', 'inventory_item_id', 'duration_months'].includes(key)) body[key] = Number(value);
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
        if (['brand_id', 'item_id', 'duration_months'].includes(key)) body[key] = Number(value);
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
