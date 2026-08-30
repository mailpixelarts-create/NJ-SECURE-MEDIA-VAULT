# 🔒 NJ-SECURE-MEDIA-VAULT

Welcome to **Secure Media Vault** — a high-security, military-grade desktop application for downloading, organizing, and protecting your media. 

This vault features AES-256-GCM encryption, Argon2id key derivation, true RAM-wiping (via `sodium-native`), in-memory media streaming, stealth anti-bot scraping, and local AI image tagging.

---

## 📋 Prerequisites

Before you install, ensure you have the following installed on your computer:
1. **[Node.js](https://nodejs.org/)** (Version 18 or 20 LTS is highly recommended)
2. **Git** (To clone this repository)
3. **C++/Python Build Tools**: Because this app uses heavy native security modules (`sodium-native`, `better-sqlite3`), your computer needs the tools to compile them.
   * **Windows:** Open an Administrator PowerShell and run: `npm install --global windows-build-tools`
   * **Mac:** Open terminal and run: `xcode-select --install`
   * **Linux:** `sudo apt-get install python3 make g++`

---

## 🛠️ Installation Step-by-Step

1. **Open your terminal or command prompt** and navigate to where you want to download the app.
2. **Clone the repository:**
   ```bash
   git clone https://github.com/jkeylight/NJ-SECURE-MEDIA-VAULT.git
   ```
3. **Go into the folder:**
   ```bash
   cd NJ-SECURE-MEDIA-VAULT
   ```
4. **Install all dependencies:**
   ```bash
   npm install
   ```
   *(Note: If you get network/SSL errors during installation, you can run `npm install --ignore-scripts` instead).*

---

## 🚀 How to Run the App (Development Mode)

Whenever you want to run the app normally on your computer for testing or usage:

1. **Build the code:**
   ```bash
   npm run build
   ```
2. **Start the Electron application:**
   ```bash
   npm start
   ```

---

## 📦 How to Create a Standalone Desktop Installer (.exe / .dmg)

If you want to package the app into a standalone installer (so you don't need to run code from the terminal anymore), you can compile it for your operating system:

1. Ensure the code is built:
   ```bash
   npm run build
   ```
2. Run the packager:
   ```bash
   npm run dist
   ```
3. Check the **`release/`** folder!
   * On Windows, it will generate a `Secure Media Vault-1.0.0-setup.exe` file.
   * On Mac, it will generate a `.dmg` file.
   * On Linux, an `.AppImage` or `.deb` file.

---

## 🔐 Using the App (First Time)

1. **Master Password:** On your first launch, you will create a Master Password. **Do not forget this.** The app uses Argon2id key derivation, meaning if you lose this password, your files are mathematically impossible to recover.
2. **Recovery Phrase:** The app generates a 24-word BIP39 recovery phrase. Write this down on physical paper and store it in a safe. This is your ONLY backup if you forget your master password.
3. **Downloading:** Paste URLs into the download manager. The app uses `yt-dlp` for videos and a custom stealth scraper for images. 
4. **Media Scrubbing:** By default, EXIF data and GPS coordinates can be scrubbed from downloaded images before they enter your vault.
5. **Secure Deletion:** When you delete a file from the vault, it undergoes a 35-pass DoD-grade secure wipe, physically overwriting the sectors on your hard drive so forensic recovery is impossible.

---

## ⚠️ Troubleshooting

* **Issue: Installation fails on `better-sqlite3` or `sodium-native`**
  * *Fix:* Ensure you have C++ build tools installed. On Windows, run `npm install -g node-gyp` and `npm install -g windows-build-tools`.
* **Issue: Downloads are failing**
  * *Fix:* The target site might have updated its layout. Run `npm update yt-dlp-wrap` to ensure the core downloader engine is up to date, or toggle the "Proxy" settings in the app.
