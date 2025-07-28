# 🚀 Nexus Login System

**Advanced & Safe Facebook Login System for Nexus-FCA**

Automatic appstate generation and management with maximum account safety features.

---

## 🌟 Features

### ✅ **Smart Auto-Login**
- Automatically checks for existing valid appstate
- Generates new appstate if needed
- Seamless integration with Nexus-FCA

### ✅ **Maximum Safety**
- Human-like device simulation
- Rate limiting and safety delays
- 2FA support (TOTP auto-generation)
- Account protection features

### ✅ **Advanced Management**
- Automatic backup system
- Appstate validation
- Credential management
- Error recovery

### ✅ **Easy Integration**
- One-line setup
- Multiple usage patterns
- Comprehensive examples
- Full documentation

---

## 🚀 Quick Start

### **Method 1: Ultra-Simple (One Line)**
```javascript
const { nexusLogin } = require('./nexloginsystem');

const result = await nexusLogin({
    username: 'your_email@gmail.com',
    password: 'your_password',
    twofactor: 'YOUR_2FA_SECRET_KEY'
});

if (result.success) {
    console.log('Bot ready!', result.api.getCurrentUserID());
    // Your bot code here
}
```

### **Method 2: Advanced Usage**
```javascript
const { createNexusLogin } = require('./nexloginsystem');

const login = createNexusLogin({
    appstatePath: './my-appstate.json',
    autoStartBot: true,
    safeMode: true
});

const result = await login.login();
```

### **Method 3: Quick Test**
```javascript
// Edit nexloginsystem/test.js with your credentials
node nexloginsystem/test.js
```

---

## 📚 API Reference

### **nexusLogin(credentials, options)**
Simple one-function login.

**Parameters:**
- `credentials` (Object): Login credentials
  - `username` (String): Facebook email or phone
  - `password` (String): Facebook password  
  - `twofactor` (String): 2FA secret key (recommended)
  - `_2fa` (String): Manual 2FA code (alternative)
  - `i_user` (String): Optional i_user cookie value

- `options` (Object): Configuration options
  - `autoStartBot` (Boolean): Auto-start Nexus-FCA (default: true)
  - `safeMode` (Boolean): Enable safety features (default: true)
  - `appstatePath` (String): Path to save appstate
  - `autoLogin` (Boolean): Check existing appstate first (default: true)

**Returns:** Promise<Object>
```javascript
{
    success: true,
    api: nexusFcaApi,        // Ready-to-use Nexus-FCA API
    appstate: [...],         // Raw appstate cookies
    loginMethod: 'string',   // How login was achieved
    message: 'string'
}
```

### **createNexusLogin(options)**
Create a login instance with custom configuration.

**Parameters:**
- `options` (Object): All nexusLogin options plus:
  - `credentialsPath` (String): Path to credentials file
  - `backupPath` (String): Path for backup files
  - `maxRetries` (Number): Maximum retry attempts
  - `retryDelay` (Number): Delay between retries

**Returns:** NexusLogin instance

### **NexusLogin Methods:**

#### `login(credentials)`
Main login method.

#### `quickSetup(username, password, twofactor)`
Quick setup with parameters.

#### `loadAppstate(path)`
Load appstate from specific file.

#### `getStatus()`
Get current login status.

#### `cleanup()`
Clean up old backup files.

---

## 🔧 Configuration Options

### **Paths**
```javascript
{
    appstatePath: './appstate.json',           // Main appstate file
    credentialsPath: './credentials.json',    // Stored credentials
    backupPath: './backups'                   // Backup directory
}
```

### **Behavior**
```javascript
{
    autoLogin: true,        // Check existing appstate first
    autoSave: true,         // Auto-save appstate and credentials
    autoStartBot: true,     // Auto-start Nexus-FCA
    safeMode: true          // Enable all safety features
}
```

### **Safety**
```javascript
{
    maxRetries: 3,          // Maximum login attempts
    retryDelay: 5000,       // Delay between attempts (ms)
    rateLimit: true,        // Enforce rate limiting
    humanDelays: true       // Random human-like delays
}
```

---

## 📱 2FA Setup Guide

### **Get 2FA Secret Key:**

1. **Facebook Settings**
   - Go to Settings & Privacy → Settings
   - Click Security and Login
   - Find Two-Factor Authentication section

2. **Setup Authentication App**
   - Click "Edit" next to Two-Factor Authentication
   - Choose "Authentication app" method
   - Click "Set up" or "Add new app"

3. **Get Secret Key**
   - Instead of scanning QR code, click "Can't scan code?"
   - Copy the secret key (16-32 characters)
   - Use this key in your credentials

4. **Complete Setup**
   - Add the key to Google Authenticator or similar app
   - Use the same key in your login credentials

### **Example Secret Key:**
```
ABCD1234EFGH5678IJKL9012MNOP3456
```

---

## 🛡️ Safety Features

### **Account Protection**
- ✅ Human-like device simulation with real Android fingerprints
- ✅ Intelligent request timing and delays
- ✅ Rate limiting to prevent triggering Facebook defenses
- ✅ Session validation and management
- ✅ Automatic error recovery

### **Data Security**
- ✅ Secure credential handling
- ✅ Automatic backup system
- ✅ Appstate validation and cleanup
- ✅ No password storage in files
- ✅ Encrypted communication

### **Best Practices**
- ✅ Always use 2FA-enabled accounts
- ✅ Regular appstate refresh
- ✅ Monitor account status
- ✅ Use ultra-safe mode for production
- ✅ Keep credentials secure

---

## 📝 Usage Examples

### **Example 1: Complete Bot Setup**
```javascript
const { nexusLogin } = require('./nexloginsystem');

async function startBot() {
    const result = await nexusLogin({
        username: 'your_email@gmail.com',
        password: 'your_password',
        twofactor: 'YOUR_2FA_SECRET_KEY'
    });

    if (result.success) {
        const api = result.api;
        
        // Setup message listener
        api.listenMqtt((err, event) => {
            if (err) return console.log('Error:', err);
            
            if (event.type === 'message') {
                console.log('Message:', event.body);
                
                // Auto-reply example
                if (event.body === 'hello') {
                    api.sendMessage('Hello there! 👋', event.threadID);
                }
            }
        });
        
        console.log('Bot is ready!');
    }
}

startBot();
```

### **Example 2: Appstate Only (No Bot)**
```javascript
const { createNexusLogin } = require('./nexloginsystem');

async function generateAppstate() {
    const login = createNexusLogin({
        autoStartBot: false  // Don't start bot
    });

    const result = await login.login({
        username: 'your_email@gmail.com',
        password: 'your_password',
        twofactor: 'YOUR_2FA_SECRET_KEY'
    });

    if (result.success) {
        console.log('Appstate generated!');
        console.log('Cookies:', result.appstate.length);
        
        // Use appstate with any FCA library
        const appstate = result.appstate;
    }
}
```

### **Example 3: Auto-Detection**
```javascript
const { nexusLogin } = require('./nexloginsystem');

// Will automatically:
// 1. Check for existing appstate
// 2. Use it if valid
// 3. Generate new one if needed
const result = await nexusLogin(); // No credentials needed if appstate exists
```

### **Example 4: Custom Paths**
```javascript
const { createNexusLogin } = require('./nexloginsystem');

const login = createNexusLogin({
    appstatePath: './data/my-appstate.json',
    credentialsPath: './config/credentials.json',
    backupPath: './backups',
    safeMode: true
});

const result = await login.quickSetup(
    'email@gmail.com',
    'password',
    'YOUR_2FA_SECRET'
);
```

---

## 🔄 Workflow

### **Automatic Flow:**
1. **Check Existing Appstate**
   - Validates existing appstate file
   - Checks cookie freshness
   - Returns if valid

2. **Generate New Appstate** (if needed)
   - Uses provided credentials
   - Simulates Android device
   - Handles 2FA automatically
   - Saves with backup

3. **Start Nexus-FCA** (optional)
   - Loads ultra-safe configuration
   - Starts bot with appstate
   - Returns ready-to-use API

### **File Management:**
```
nexloginsystem/
├── appstate.json           # Main appstate
├── credentials.json        # Stored credentials (no password)
├── appstate-full.json      # Full login result with metadata
└── backups/
    ├── appstate-backup-2025-01-01.json
    └── appstate-backup-2025-01-02.json
```

---

## ⚠️ Important Notes

### **Security**
- Never share your credentials or appstate files
- Use 2FA-enabled accounts only
- Keep your secret keys secure
- Monitor your account regularly

### **Legal**
- This is for educational and testing purposes
- Use only on accounts you own
- Respect Facebook's Terms of Service
- Consider official APIs for production use

### **Reliability**
- Facebook may change their API anytime
- Always have backup appstate files
- Monitor for rate limiting
- Use ultra-safe mode for production

---

## 🛠️ Troubleshooting

### **Common Issues:**

#### ❌ "Two-factor authentication required"
- Enable 2FA on your Facebook account
- Get the secret key from 2FA setup
- Add it to your credentials

#### ❌ "Wrong username or password"
- Double-check your credentials
- Try logging in manually on Facebook
- Check if account is locked

#### ❌ "Login processing failed"
- Check your internet connection
- Wait a few minutes and retry
- Make sure you're not hitting rate limits

#### ❌ "Appstate validation failed"
- Delete old appstate file
- Generate fresh appstate
- Check file permissions

### **Debug Mode:**
Enable detailed logging:
```javascript
const result = await nexusLogin(credentials, {
    logLevel: 'debug',
    safeMode: true
});
```

---

## 🏗️ Technical Details

### **Architecture:**
- **NexusLoginSystem**: Core login logic
- **NexusLogin**: High-level interface
- **Device Simulation**: Android device fingerprinting
- **Safety Manager**: Rate limiting and delays
- **File Manager**: Appstate and backup handling

### **Security Features:**
- Consistent device fingerprinting
- Request signature generation
- Human-like timing patterns
- Session validation
- Error recovery mechanisms

### **Integration:**
- Seamless Nexus-FCA integration
- Compatible with all FCA libraries
- Configurable options
- Event-driven architecture

---

## 📊 Status Monitoring

### **Get System Status:**
```javascript
const login = createNexusLogin();
const status = login.getStatus();

console.log(status);
// {
//     hasValidAppstate: true,
//     hasCredentials: true,
//     isLoggedIn: true,
//     hasAPI: true,
//     userID: '100087550592244',
//     lastLogin: Date,
//     loginAttempts: 1
// }
```

### **Health Check:**
```javascript
const health = {
    appstate: login.hasValidAppstate(),
    credentials: fs.existsSync('./credentials.json'),
    api: !!login.api,
    userId: login.api?.getCurrentUserID()
};
```

---

## 🔮 Advanced Usage

### **Custom Error Handling:**
```javascript
const result = await nexusLogin(credentials).catch(error => {
    if (error.message.includes('checkpoint')) {
        console.log('Account needs manual verification');
    } else if (error.message.includes('rate')) {
        console.log('Rate limited, waiting...');
    }
});
```

### **Batch Operations:**
```javascript
const accounts = [
    { username: 'acc1@gmail.com', password: 'pass1', twofactor: 'secret1' },
    { username: 'acc2@gmail.com', password: 'pass2', twofactor: 'secret2' }
];

for (const account of accounts) {
    const result = await nexusLogin(account, {
        appstatePath: `./appstates/${account.username}.json`
    });
    
    if (result.success) {
        console.log(`${account.username}: Login successful`);
    }
}
```

---

## 📞 Support

### **Need Help?**
1. Check the examples in `/examples.js`
2. Run the test file: `node test.js`
3. Enable debug mode for detailed logs
4. Review troubleshooting section

### **Contributing:**
- Report issues with detailed logs
- Submit feature requests
- Share usage examples
- Improve documentation

---

**Happy Botting! 🤖✨**
