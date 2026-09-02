const User = require('../models/User');

/**
 * Register a new user
 */
exports.register = async (req, res) => {
    try {
        const { username, password, name, phone, bloodGroup, vehicleNumber, identityProof, allergies } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }

        // Create new user (password hashing would be here in production)
        const user = new User({
            username,
            password, // Storing as plain text for demo simplicity, use bcrypt in production
            name,
            phone,
            bloodGroup,
            vehicleNumber,
            identityProof,
            allergies
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                role: user.role,
                bloodGroup: user.bloodGroup,
                allergies: user.allergies
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                role: user.role,
                bloodGroup: user.bloodGroup,
                allergies: user.allergies,
                phone: user.phone,
                vehicleNumber: user.vehicleNumber,
                identityProof: user.identityProof
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
};
