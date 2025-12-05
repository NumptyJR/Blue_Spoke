// Author: Joshua Schaff
// Email: joshuarschaff@gmail.com
// File: api.js
// Description: API request handler

import { state, AUTH_DEV_COMPAT } from './state.js';
import { normalizeToken, notify } from './utils.js';

export async function apiRequest(path, { method = 'GET', body, query, auth = true } = {}) {
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
                        Object.entries(query).forEach(([k, v]) => { if (k !== 'token' && v !== undefined && v !== null && v !== '') p.append(String(k), String(v)); });
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
            // Do not auto-logout
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
