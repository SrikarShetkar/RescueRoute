const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

/**
 * Auth API client. Communicates with /api/auth/* endpoints.
 * All methods return the parsed JSON response body.
 */

function authHeaders(token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

export async function googleAuth(idToken, role) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, role })
        });
        return await res.json();
    } catch (error) {
        console.error('Google auth API error:', error);
        return { success: false, message: error.message };
    }
}

export async function assignRole(token, role) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/assign-role`, {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({ role })
        });
        return await res.json();
    } catch (error) {
        console.error('Assign role API error:', error);
        return { success: false, message: error.message };
    }
}

export async function registerUser(data) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch (error) {
        console.error('Registration API error:', error);
        return { success: false, message: error.message };
    }
}

export async function loginUser(credentials) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        return await res.json();
    } catch (error) {
        console.error('Login API error:', error);
        return { success: false, message: error.message };
    }
}

const authApi = {
    googleAuth,
    assignRole,
    registerUser,
    loginUser
};

export default authApi;
