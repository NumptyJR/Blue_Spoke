// Author: Joshua Schaff 
// Email: joshuarschaff@gmail.com
// File: login.js
// Description: Login view

import { apiRequest } from '../api.js';
import { state } from '../state.js';
import { normalizeToken, notify } from '../utils.js';
import { bootstrap } from '../main.js';

export function renderLogin() {
    const root = document.getElementById('app');
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
