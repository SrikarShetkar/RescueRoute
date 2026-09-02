/**
 * Notification Service
 * Handles sending alerts via SMS, Email, etc.
 */

/**
 * Notify family contacts about an emergency
 * @param {Object} emergency The emergency data
 */
async function notifyEmergencyContacts(emergency) {
    const contacts = emergency.familyContacts?.contacts || [];
    const type = emergency.type;
    const location = emergency.location;

    console.log(`\n---  NOTIFICATION SYSTEM ---`);
    console.log(`Type: ${type}`);
    console.log(`Location: Lat ${location.lat}, Lng ${location.lng}`);

    if (contacts.length === 0) {
        console.log('No specific contacts found. Sending broadcast to default contacts.');
        // Simulated default contacts
        simulateSMS('+91-XXXXX-XXXXX', `EMERGENCY ALERT: A relative is in distress. Location: http://maps.google.com/?q=${location.lat},${location.lng}`);
    } else {
        contacts.forEach(contact => {
            const message = ` RESCUEROUTE ALERT: ${contact.name}, your ${contact.relation} is in a medical emergency (${type}). Help is on the way (ETA: ${emergency.eta || 'Calculating...'}). Track here: http://rescueroute.com/track/${emergency.emergencyId}`;
            simulateSMS(contact.phone || 'N/A', message);
        });
    }
    console.log(`---  END NOTIFICATIONS ---\n`);

    return true;
}

/**
 * Simulate sending an SMS
 */
function simulateSMS(phone, message) {
    console.log(`[SIMULATED SMS to ${phone}]: ${message}`);
}

module.exports = {
    notifyEmergencyContacts
};
