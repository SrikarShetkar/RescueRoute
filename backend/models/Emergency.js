const mongoose = require('mongoose');

const EmergencySchema = new mongoose.Schema({
    emergencyId: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['SELF_USE', 'VICTIM_PHONE', 'ACCIDENT_REPORT', 'CRASH_DETECTION'],
        required: true
    },
    userId: {
        type: String,
        default: 'ANONYMOUS'
    },
    location: {
        lat: Number,
        lng: Number
    },
    medicalProfile: {
        name: String,
        bloodGroup: String,
        allergies: String,
        age: Number,
        condition: String
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'RESOLVED', 'CANCELLED'],
        default: 'ACTIVE'
    },
    ambulanceId: String,
    ambulance: mongoose.Schema.Types.Mixed,
    hospitalId: String,
    hospital: mongoose.Schema.Types.Mixed,
    trafficCorridor: mongoose.Schema.Types.Mixed,
    familyContacts: mongoose.Schema.Types.Mixed,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Emergency', EmergencySchema);
