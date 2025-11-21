"use strict";

/**
 * EmailPasswordLogin.js - Facebook Email/Password Login Support
 * Implements Facebook API method for credential-based authentication
 * Alternative to cookie-based (appState) login
 */

const axios = require('axios');
const qs = require('querystring');
const logger = require('../logger');

class EmailPasswordLogin {
    constructor() {
        this.apiEndpoint = "https://api.facebook.com/method/auth.login";
        this.accessToken = "350685531728|62f8ce9f74b12f84c123cc23437a4a32";
        this.signature = "c1c640010993db92e5afd11634ced864";
    }

    /**
     * Authenticate user with email and password
     * @param {string} email - Facebook email or phone number
     * @param {string} password - Facebook password
     * @param {Object} jar - Cookie jar to store session cookies
     * @returns {Promise<Object>} Session data with cookies
     */
    async login(email, password, jar) {
        logger("Attempting email/password login...", "info");

        if (!email || !password) {
            throw new Error("Email and password are required for credential-based login");
        }

        const params = {
            access_token: this.accessToken,
            format: "json",
            sdk_version: 2,
            email: email,
            locale: "en_US",
            password: password,
            sdk: "ios",
            generate_session_cookies: 1,
            sig: this.signature,
        };

        const query = qs.stringify(params);
        const url = `${this.apiEndpoint}?${query}`;

        try {
            logger("Sending authentication request to Facebook API...", "info");
            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                }
            });

            if (response.status !== 200) {
                throw new Error(`Login failed with status code: ${response.status}`);
            }

            const data = response.data;

            // Check for errors
            if (data.error_msg) {
                logger(`Login error: ${data.error_msg}`, "error");
                throw new Error(`Facebook API error: ${data.error_msg}`);
            }

            if (!data.session_cookies || data.session_cookies.length === 0) {
                throw new Error("No session cookies returned from Facebook. Invalid credentials or account issue.");
            }

            // Process session cookies
            const sessionCookies = data.session_cookies;
            const cookieStrings = sessionCookies.map(c => `${c.name}=${c.value}`);

            // Store cookies in jar with proper domain and expiry
            cookieStrings.forEach(cookieStr => {
                const domain = ".facebook.com";
                const expires = new Date().getTime() + 1000 * 60 * 60 * 24 * 365; // 1 year
                const cookieString = `${cookieStr}; expires=${expires}; domain=${domain}; path=/;`;
                jar.setCookie(cookieString, `https://${domain}`);
            });

            logger("Email/password login successful! Session cookies stored.", "info");

            return {
                success: true,
                cookies: sessionCookies,
                uid: data.uid || null,
                access_token: data.access_token || null,
                session_key: data.session_key || null
            };

        } catch (error) {
            if (error.response) {
                logger(`Login failed with HTTP ${error.response.status}`, "error");
                if (error.response.status === 401 || error.response.status === 400) {
                    throw new Error("Invalid email or password. Please check your credentials.");
                }
            }
            
            if (error.code === 'ECONNABORTED') {
                throw new Error("Login request timed out. Please check your internet connection.");
            }

            logger(`Email/password login error: ${error.message}`, "error");
            throw new Error(`Login failed: ${error.message}`);
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone number format (basic)
     * @param {string} phone - Phone to validate
     * @returns {boolean} True if looks like a phone
     */
    isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-()]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }

    /**
     * Check if credentials look valid before attempting login
     * @param {string} email - Email or phone
     * @param {string} password - Password
     * @returns {Object} Validation result
     */
    validateCredentials(email, password) {
        const errors = [];

        if (!email || email.trim().length === 0) {
            errors.push("Email/phone is required");
        } else if (!this.isValidEmail(email) && !this.isValidPhone(email)) {
            errors.push("Email or phone number format appears invalid");
        }

        if (!password || password.length < 6) {
            errors.push("Password must be at least 6 characters");
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = EmailPasswordLogin;
