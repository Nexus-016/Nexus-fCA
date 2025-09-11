# Cookie Expiry and Session Management Guide

This document explains how Nexus-FCA handles cookie management to prevent rapid session expiry and improve overall stability.

## Understanding the Issue

Facebook cookies may expire rapidly (within hours) due to several reasons:

1. **Missing Expiry Dates**: Some cookies don't have proper expiry timestamps
2. **Short-lived Sessions**: Facebook may issue cookies with short expiry times
3. **Device Inconsistency**: Using different device profiles between sessions
4. **Multiple Sessions**: Running multiple bots with the same account
5. **Security Triggers**: Suspicious activities triggering Facebook safety mechanisms

## Nexus-FCA Solution

Nexus-FCA implements a robust multi-layered approach to maintain session stability:

### 1. Cookie Expiry Extension

The system automatically extends cookie expiry dates:

- Critical cookies (`c_user`, `xs`, `fr`, `datr`, `sb`) are extended to 90 days
- All cookies are validated at startup and fixed if needed
- Proper expiry format is enforced using the standard RFC format

### 2. Persistent Device Profile

To maintain consistency across restarts:

- Device fingerprints (device ID, user agent, family device ID) are preserved
- The same device profile is used for all requests
- Configuration option: `persistentDevice: true` (enabled by default)

### 3. Cookie Refresher

An active background service keeps your session fresh:

- Periodically refreshes cookies (every 30 minutes)
- Makes lightweight requests to maintain session activity
- Extends cookie expiry dates automatically
- Creates backups of working sessions

### 4. Single Session Guard

Prevents multiple instances from using the same account:

- File-based locking mechanism prevents duplicate sessions
- Ensures Facebook sees consistent device information
- Configuration via `NEXUS_SESSION_LOCK_PATH` and `NEXUS_FORCE_LOCK`

## Best Practices

For maximum session stability:

1. **Use Persistent Device**: Always enable persistentDevice (default)
2. **Keep Proxy Consistent**: Use the same proxy for extended periods
3. **Set Region**: Use `NEXUS_REGION` to maintain a consistent region
4. **Avoid Multiple Instances**: Never run multiple bots with the same account
5. **Regular Backups**: Keep backups of working appstate files

## Configuration

Key environment variables for session stability:

```
# Session stability
NEXUS_PERSISTENT_DEVICE=true    # Keep device fingerprint consistent (default)
NEXUS_DEVICE_FILE=./device.json # Custom device profile path
NEXUS_SESSION_LOCK_PATH=./lock  # Single session lock file location
NEXUS_REGION=NA                 # Fixed region (NA, EU, AS, etc.)

# Safety settings
NEXUS_FCA_ULTRA_SAFE_MODE=1     # Maximum safety for stability
```

## Troubleshooting

If you still experience session expiry:

1. **Check Logs**: Look for warnings about cookie expiry or checkpoint
2. **Monitor Activity**: High message volume can trigger Facebook limits
3. **Fresh Login**: Generate a completely new appstate if needed
4. **API Limits**: Respect Facebook rate limits with delay between actions
5. **Secure Network**: Use residential IPs rather than datacenter IPs

The new cookie management system should significantly improve stability and prevent the rapid expiry issues previously encountered.
