const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

/**
 * Register a new user
 */
export async function registerUser(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        return await response.json();
    } catch (error) {
        console.error("Registration API error:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Login user
 */
export async function loginUser(credentials) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(credentials),
        });

        return await response.json();
    } catch (error) {
        console.error("Login API error:", error);
        return { success: false, message: error.message };
    }
}

const authApi = {
    registerUser,
    loginUser
};

export default authApi;
