const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Only email and password are strictly required
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user already exists
        const [existing] = await db.query('SELECT * FROM teachers WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        await db.query(
            'INSERT INTO teachers (name, email, password) VALUES (?, ?, ?)',
            [name || '', email, hashedPassword]
        );

        res.status(201).json({ success: true, message: 'Registration successful' });
    } catch (err) {
        console.error('❌ REGISTRATION ERROR:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Only email and password are required for login validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user by email
        const [users] = await db.query('SELECT * FROM teachers WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = users[0];

        // Verify password match
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Return success
        res.json({ success: true, teacherName: user.name || 'Teacher' });
    } catch (err) {
        console.error('❌ LOGIN ERROR:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const [users] = await db.query('SELECT * FROM teachers WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ error: 'Email not registered' });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60000); // 10 minutes

        await db.query('UPDATE teachers SET reset_otp = ?, reset_otp_expiry = ? WHERE email = ?', [otp, expiry, email]);

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'SkyMeet - Password Reset OTP',
            text: `Your One-Time Password (OTP) for resetting your password is: ${otp}\n\nThis OTP is valid for 10 minutes. If you did not request this, please ignore this email.`
        });

        res.json({ success: true, message: 'OTP sent to email' });
    } catch (err) {
        console.error('❌ FORGOT PASSWORD ERROR:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

        const [users] = await db.query('SELECT * FROM teachers WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = users[0];
        if (user.reset_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
        if (new Date() > new Date(user.reset_otp_expiry)) return res.status(400).json({ error: 'OTP has expired' });

        res.json({ success: true, message: 'OTP verified' });
    } catch (err) {
        console.error('❌ VERIFY OTP ERROR:', err);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) return res.status(400).json({ error: 'Missing fields' });

        const [users] = await db.query('SELECT * FROM teachers WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = users[0];
        if (user.reset_otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
        if (new Date() > new Date(user.reset_otp_expiry)) return res.status(400).json({ error: 'OTP has expired' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE teachers SET password = ?, reset_otp = NULL, reset_otp_expiry = NULL WHERE email = ?', [hashedPassword, email]);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error('❌ RESET PASSWORD ERROR:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
