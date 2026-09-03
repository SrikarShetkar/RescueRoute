const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const VALID_ROLES = ['reporter', 'ambulance', 'hospital', 'dispatch', 'driver'];

function generateToken(user) {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            username: user.username,
            name: user.name,
            role: user.role,
            avatar: user.avatar
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function sanitizeUser(user) {
    return {
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        bloodGroup: user.bloodGroup,
        allergies: user.allergies,
        vehicleNumber: user.vehicleNumber,
        identityProof: user.identityProof,
        roleSelectionComplete: user.roleSelectionComplete
    };
}

/**
 * POST /api/auth/google
 * Body: { idToken, role? }
 * Verifies Google ID token, finds or creates user, optionally assigns role.
 */
exports.googleAuth = async (req, res) => {
    try {
        const { idToken, role } = req.body;
        if (!idToken) {
            return res.status(400).json({ success: false, message: 'Google ID token is required' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        const { sub: googleId, email, name, picture: avatar } = payload;

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            user = new User({
                googleId,
                email,
                name,
                avatar,
                roleSelectionComplete: false
            });
            await user.save();
        } else {
            if (!user.googleId) user.googleId = googleId;
            if (!user.avatar && avatar) user.avatar = avatar;
            if (!user.email) user.email = email;
            await user.save();
        }

        if (role && VALID_ROLES.includes(role) && !user.roleSelectionComplete) {
            user.role = role;
            user.roleSelectionComplete = true;
            await user.save();
        }

        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: sanitizeUser(user),
            needsRole: !user.roleSelectionComplete
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(401).json({ success: false, message: 'Invalid Google token' });
    }
};

/**
 * POST /api/auth/assign-role
 * Body: { role }
 * Requires Bearer token. Assigns a role to a Google-auth'd user.
 */
exports.assignRole = async (req, res) => {
    try {
        const { role } = req.body;
        if (!role || !VALID_ROLES.includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role. Must be one of: ' + VALID_ROLES.join(', ') });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.role = role;
        user.roleSelectionComplete = true;
        await user.save();

        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('Assign role error:', error);
        res.status(500).json({ success: false, message: 'Server error assigning role' });
    }
};

/**
 * POST /api/auth/register
 * Body: { username, password, name, phone, bloodGroup, vehicleNumber, ... }
 */
exports.register = async (req, res) => {
    try {
        const { username, password, name, phone, bloodGroup, vehicleNumber, identityProof, allergies } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            username,
            password: hashedPassword,
            name: name || username,
            phone,
            bloodGroup,
            vehicleNumber,
            identityProof,
            allergies,
            roleSelectionComplete: true
        });

        await user.save();

        const token = generateToken(user);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.password) {
            const bcrypt = require('bcryptjs');
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } else {
            return res.status(401).json({ success: false, message: 'This account uses Google Sign-In. Please log in with Google.' });
        }

        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: sanitizeUser(user)
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
};
