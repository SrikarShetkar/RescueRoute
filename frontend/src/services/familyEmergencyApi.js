const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

/**
 * Trigger self-use emergency (Case 1)
 */
export async function triggerSelfUseEmergency(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/family-emergency/self-use`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        return await response.json();
    } catch (error) {
        console.error("Self-use emergency API error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Trigger victim phone emergency (Case 2A)
 */
export async function triggerVictimPhoneEmergency(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/family-emergency/victim-phone`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        return await response.json();
    } catch (error) {
        console.error("Victim phone emergency API error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Report accident using own phone (Case 2B)
 */
export async function reportAccident(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/family-emergency/report-accident`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        return await response.json();
    } catch (error) {
        console.error("Report accident API error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle crash detection (Case 3)
 */
export async function handleCrashDetection(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/family-emergency/crash-detection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        return await response.json();
    } catch (error) {
        console.error("Crash detection API error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get emergency details by ID
 */
export async function getEmergencyDetails(emergencyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/family-emergency/${emergencyId}`);
        return await response.json();
    } catch (error) {
        console.error("Get emergency details API error:", error);
        return { error: error.message };
    }
}

/**
 * Get all active emergencies
 */
export async function getActiveEmergencies() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/family-emergency/active`);
        return await response.json();
    } catch (error) {
        console.error("Get active emergencies API error:", error);
        return { count: 0, emergencies: [] };
    }
}

/**
 * Save medical profile
 */
export async function saveMedicalProfile(userId, profile) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/family-emergency/medical-profile`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId, profile }),
        });

        return await response.json();
    } catch (error) {
        console.error("Save medical profile API error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get medical profile
 */
export async function getMedicalProfile(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/family-emergency/medical-profile/${userId}`);
        return await response.json();
    } catch (error) {
        console.error("Get medical profile API error:", error);
        return { error: error.message };
    }
}

const familyEmergencyApi = {
    triggerSelfUseEmergency,
    triggerVictimPhoneEmergency,
    reportAccident,
    handleCrashDetection,
    getEmergencyDetails,
    getActiveEmergencies,
    saveMedicalProfile,
    getMedicalProfile,
};

export default familyEmergencyApi;
