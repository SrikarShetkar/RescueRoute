const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
    vehicleNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    qrToken: {
        type: String,
        required: true,
        unique: true
    },
    ownerUserId: {
        type: String,
        required: true
    },
    associatedUserIds: [{
        type: String
    }],
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Vehicle', VehicleSchema);
