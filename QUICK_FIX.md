# 🚀 Quick Fix Guide

## If you're seeing errors, try these:

### Reset Everything
```bash
cd "C:\Users\norma\OneDrive\Desktop\APP\NJ-SECURE MEDIA VAULT\NJ-SECURE-MEDIA-VAULT"

# Clean and rebuild
rm -rf node_modules dist
npm install
npm run build
npm start
```

### Reset App Data
```bash
# Windows
rm -rf "%APPDATA%/Electron/"

# Then restart the app
npm start
```

### Check for Missing Files
```bash
# Make sure these exist:
ls dist/main/index.js
ls dist/main/preload.js
ls dist/renderer/index.html
ls dist/renderer/index.js
```

### Check Console Output
When you run `npm start`, check for:
- ✅ "Master key set successfully" - Login worked
- ❌ "auth:login error" - Wrong password
- ❌ "File not found" - Missing files

### Common Fixes

**Problem:** Window opens but shows blank
**Fix:** Check dist/renderer/index.html exists

**Problem:** "Invalid password" errors
**Fix:** First login creates password, use same password next time

**Problem:** Downloads don't work
**Fix:** Install yt-dlp separately (app only has UI for it)

**Problem:** Can't see any files
**Fix:** Normal - app starts empty, add files via Download tab

