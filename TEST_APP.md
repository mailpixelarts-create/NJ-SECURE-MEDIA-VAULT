# 🔍 NJ-SECURE MEDIA VAULT - Testing Checklist

## Current Status: Build ✅ SUCCESS

Please test the following and tell me what specifically doesn't work:

---

## 1. ✅ Application Launch
- [ ] Does the Electron window open?
- [ ] Do you see any error dialogs?
- [ ] Is the window blank/white screen?
- [ ] Do you see the login screen with a lock icon 🔒?

---

## 2. ✅ Login Screen
- [ ] Can you see the "Master Password" input field?
- [ ] Can you type in the password field?
- [ ] Does the "Unlock Vault" button appear?
- [ ] When you click "Unlock Vault", does it show "Unlocking..."?
- [ ] Do you get any error messages?

**Expected behavior:**
- First time: ANY password creates a new master password
- Subsequent: Must use the same password you created

---

## 3. ✅ Dashboard (After Login)
- [ ] Do you see the dashboard with tabs (Overview, Download, Browser)?
- [ ] Can you see folder cards (Images, Videos, Folders)?
- [ ] Can you see statistics (Total Files, Downloads Today, etc.)?
- [ ] Can you click the tabs to switch between views?

---

## 4. ✅ Download Tab
- [ ] Can you click the "Download" tab?
- [ ] Do you see a URL input area?
- [ ] Can you paste URLs?
- [ ] Does the "Start Download" button appear?

**Note:** Downloads require `yt-dlp.exe` binary to be present.

---

## 5. ✅ Browser Tab
- [ ] Can you click the "Browser" tab?
- [ ] Do you see your media files (if any)?
- [ ] Can you navigate folders?

---

## Common Issues & Solutions

### Issue: Blank White Screen
**Solution:**
1. Open DevTools (should open automatically)
2. Check Console tab for errors
3. Look for missing file errors

### Issue: "Master key not set" errors
**Solution:**
1. Logout and login again
2. Use the same password you created initially

### Issue: Downloads don't start
**Reason:** Missing `yt-dlp.exe` binary
**Solution:**
1. Download yt-dlp from: https://github.com/yt-dlp/yt-dlp/releases
2. Place `yt-dlp.exe` in project root or resources folder

### Issue: Database errors
**Solution:**
1. Delete `%APPDATA%/Electron/vault.db`
2. Restart the app

### Issue: Cache errors (in console)
**Not a problem:** These are Chromium warnings and don't affect functionality

---

## How to Check Console Errors

1. App opens with DevTools automatically
2. Click "Console" tab
3. Look for RED error messages
4. Copy and share any error messages you see

---

## What to Report

Please tell me:
1. **Which step fails?** (1-5 above)
2. **What do you see?** (screenshot or description)
3. **Any error messages?** (from Console in DevTools)
4. **What were you trying to do?** (download, browse files, etc.)

---

## Quick Test Commands

### Check if app data exists:
```bash
ls "%APPDATA%/Electron/"
```

### Check database:
```bash
ls "%APPDATA%/Electron/vault.db"
```

### Delete and reset (if needed):
```bash
rm -rf "%APPDATA%/Electron/"
```

---

## Expected First-Time Experience

1. App opens → Login screen appears
2. Enter ANY password (e.g., "test123") → Click "Unlock Vault"
3. Dashboard appears with 0 files
4. Default folders created: Images, Videos, Downloads, Archive
5. Can navigate tabs but no media to show yet

---

## Testing Download Feature (Optional)

**Prerequisites:**
- Internet connection
- yt-dlp binary installed

**Test:**
1. Go to Download tab
2. Paste a YouTube URL (or similar)
3. Click "Start Download"
4. Should see progress bar
5. After completion, file appears in Browser tab

**Known limitation:** yt-dlp must be installed separately

---

## Current Build Info

- Build Date: 2026-08-27
- Build Status: ✅ SUCCESS
- Main Bundle: 1.13 MB
- Renderer Bundle: 2.6 MB
- Components: 16 React components
- Dependencies: All installed ✅

---

## Please Answer These Questions:

1. **Does the app window open at all?** YES / NO
2. **Can you see the login screen?** YES / NO
3. **Can you login successfully?** YES / NO
4. **After login, do you see the dashboard?** YES / NO
5. **Which specific feature doesn't work?**
   - [ ] Login
   - [ ] Dashboard display
   - [ ] Downloads
   - [ ] File browsing
   - [ ] File preview
   - [ ] Settings
   - [ ] Other: _________________

6. **What error messages do you see (if any)?**

---

**Next Steps:**
Once you tell me specifically what's broken, I can:
- Fix the exact issue
- Add missing components
- Debug specific errors
- Improve the functionality

