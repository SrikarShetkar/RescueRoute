const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

/**
 * Middleware that verifies a JWT from the Authorization header.
 * Attaches the decoded payload to req.user on success.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}

/**
 * Optional auth — attaches req.user if a valid token is present, but does not
 * block the request when no token is provided.
 */
function optionalAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        try {
            req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
        } catch { /* ignore invalid tokens */ }
    }
    next();
}

module.exports = { requireAuth, optionalAuth };
