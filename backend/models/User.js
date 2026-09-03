const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        sparse: true
    },
    name: {
        type: String,
        required: true
    },
    avatar: String,
    phone: String,
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        default: 'O+'
    },
    vehicleNumber: String,
    identityProof: String,
    allergies: String,
    role: {
        type: String,
        enum: ['reporter', 'ambulance', 'hospital', 'dispatch', 'driver', 'USER', 'ADMIN', 'HOSPITAL_ROLE', 'AMBULANCE_ROLE'],
        default: null
    },
    roleSelectionComplete: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);
