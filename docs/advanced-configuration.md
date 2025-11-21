# Advanced Configuration Options for Nexus-FCA

This document outlines additional configuration options available to optimize your Nexus-FCA experience.

## Environment Variables

Nexus-FCA supports various environment variables to fine-tune its behavior:

### Session Management

```
# Device persistence
NEXUS_PERSISTENT_DEVICE=true    # Enable consistent device fingerprinting (default)
NEXUS_DEVICE_FILE=./device.json # Custom path to device profile file

# Single-session guard (built-in)
# Toggle and configure SingleSessionGuard (default OFF)
NEXUS_SESSION_LOCK_ENABLED=false # Enable with true/1 to turn lock ON
NEXUS_SESSION_LOCK_PATH=./lock  # Path to session lock file used by SingleSessionGuard
NEXUS_FORCE_LOCK=false          # Force acquire lock even if lock exists

# Region control
NEXUS_REGION=NA                 # Set fixed region (NA, EU, AS)
```

### Cookie Management

```
# Cookie refresher settings
NEXUS_COOKIE_REFRESH_INTERVAL=1800000  # Refresh interval in ms (default: 30 minutes)
NEXUS_COOKIE_EXPIRY_DAYS=90           # Days to extend cookie expiry
NEXUS_COOKIE_BACKUP_PATH=./backups    # Path to store cookie backups
NEXUS_COOKIE_MAX_BACKUPS=5            # Maximum number of cookie backups to keep
```

### Connection Settings

```
# Connection resilience
NEXUS_MAX_RETRIES=5              # Maximum connection retry attempts
NEXUS_RETRY_DELAY=5000           # Base delay between retries (ms)
NEXUS_KEEPALIVE_INTERVAL=300000  # Keepalive interval (ms)

# MQTT Connection Stability (New for Long-Running Bots)
NEXUS_MQTT_RECONNECT_TIMEOUT=300000    # Socket idle timeout before reconnect (ms, default: 5 minutes)
NEXUS_MQTT_PING_INTERVAL=30000         # WebSocket ping interval (ms, default: 30 seconds)
NEXUS_MQTT_BACKOFF_BASE=1000           # Initial backoff delay (ms, default: 1 second)
NEXUS_MQTT_BACKOFF_MAX=300000          # Maximum backoff delay (ms, default: 5 minutes)
NEXUS_MQTT_BACKOFF_FACTOR=2            # Backoff multiplier (default: 2 = exponential doubling)
```

### Safety Features

```
# Safety controls
NEXUS_FCA_SAFE_MODE=1            # Enable basic safety measures
NEXUS_FCA_ULTRA_SAFE_MODE=1      # Enable maximum safety for stability
NEXUS_DELIVERY_TIMEOUT=60000     # Message delivery timeout (ms)
NEXUS_AUTO_MARK_READ=false       # Automatically mark messages as read
```

## API Configuration Options

When initializing the API, you can pass additional options:

```javascript
const api = await login({
  appState: require('./appstate.json'),
  
  // Session stability options
  persistentDevice: true,           // Use consistent device fingerprinting
  deviceFilePath: './device.json',  // Custom device profile path
  // Single-session guard (optional toggle)
  sessionLockEnabled: true,        // default is OFF; set true or env NEXUS_SESSION_LOCK_ENABLED=true
  
  // Connection options
  region: 'NA',                     // Set fixed region
  userAgent: 'custom-user-agent',   // Override user agent
  
  // Cookie management
  cookieRefreshInterval: 1800000,   // Cookie refresh interval (ms)
  cookieExpiryDays: 90,             // Days to extend cookie expiry
  cookieBackupEnabled: true,        // Enable cookie backups
  cookieMaxBackups: 5,              // Maximum cookie backups
  
  // Safety options
  forceLogout: true,                // Force logout any other sessions
  safetyLevel: 2                    // Safety level (0-2)
});
```

## Best Practices

For the most stable experience:

1. **Always enable persistent device**: Use the same device fingerprint across restarts
2. **Enable session locking**: Prevent multiple instances from using the same account (optional, off by default)
3. **Set a fixed region**: Use the `NEXUS_REGION` environment variable
4. **Use a modern user agent**: Let the system select an appropriate one
5. **Keep cookie refreshing enabled**: Maintains fresh cookies (enabled by default, refreshes every 30 minutes)
6. **Back up working appstate files**: Keep copies of working sessions

### For Long-Running Bots (24/7 Operation)

If your bot runs for days/weeks without restart and you experience MQTT disconnections:

1. **Increase MQTT reconnect timeout**:
   ```bash
   NEXUS_MQTT_RECONNECT_TIMEOUT=600000  # 10 minutes instead of 5
   ```

2. **Reduce ping interval for faster detection**:
   ```bash
   NEXUS_MQTT_PING_INTERVAL=20000  # Ping every 20 seconds
   ```

3. **Adjust backoff strategy**:
   ```bash
   NEXUS_MQTT_BACKOFF_BASE=2000     # Start with 2 second delay
   NEXUS_MQTT_BACKOFF_MAX=600000    # Max 10 minute backoff
   NEXUS_MQTT_BACKOFF_FACTOR=1.5    # Slower exponential growth
   ```

4. **Cookie refresh frequency**: The default 30 minutes is optimal, but for ultra-stability:
   ```bash
   NEXUS_COOKIE_REFRESH_INTERVAL=1200000  # Refresh every 20 minutes
   ```

5. **Monitor health metrics**: Enable verbose MQTT logging to diagnose issues:
   ```javascript
   const api = await login({
     appState: require('./appstate.json'),
     verboseMqtt: true  // Logs every connection attempt
   });
   ```

### Troubleshooting "Session invalid" After Long Runtime

If you see `ERR! listenMqtt Session invalid after retry: Not logged in` after many hours:

- **Root cause**: Cookies expired or session token became stale
- **Auto-fix**: After 10 consecutive failures, the system now automatically triggers a cookie refresh
- **Manual intervention**: Restart your bot to reload fresh cookies from appstate
- **Prevention**: Ensure `NEXUS_COOKIE_REFRESH_ENABLED=true` (default) and cookies are being saved properly

## Security Considerations

- Store sensitive information like appstate files securely
- Use environment variables for credentials instead of hardcoding
- Use `.env` files in development (gitignored)
- Consider using a dedicated account for automation
- Respect Facebook's terms of service and rate limits
