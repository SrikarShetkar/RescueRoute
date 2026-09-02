const mongoose = require('mongoose');

const MedicalProfileSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    bloodGroup: {
        type: String,
        required: true
    },
    age: Number,
    allergies: String,
    medicalConditions: [String],
    emergencyContacts: [{
        name: String,
        phone: String,
        relation: String
    }],
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('MedicalProfile', MedicalProfileSchema);
