# LNCT Attendance Helper — Chrome Extension

[![GitHub](https://img.shields.io/badge/GitHub-VishwajeetCSE-blue?logo=github)](https://github.com/VishwajeetCSE/Attendance-LNCT)

A Chrome extension that **auto-logs you into** the LNCT University student portal, **keeps your session alive**, and shows your **attendance % directly on the extension badge** — all with one click.

---

## Features

| Feature | Description |
|---|---|
| **One-Click Attendance** | Single button — logs in automatically if needed, then opens attendance |
| **Attendance % Badge** | Live percentage shown on the extension icon (green/yellow/red) |
| **Auto-Login** | Automatically fills credentials on the login page |
| **Session Keep-Alive** | Pings portal every 4 minutes to prevent auto-logout |
| **Secure Storage** | Credentials stored locally in Chrome encrypted storage only |
| **Logout Recovery** | Detects manual logout, auto-re-logs when you click View Attendance |

---

## Project Structure

```
Attendance-LNCT/
├── manifest.json           # Extension manifest (Manifest V3)
├── background.js           # Service worker: smart login, session ping, badge
├── content_script.js       # Auto-fills login form on login page
├── attendance_scraper.js   # Extracts attendance % from attendance page
├── popup.html              # Extension popup with % ring UI
├── popup.js                # Popup logic
├── options.html            # Settings page to save credentials
├── options.js              # Settings logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## How to Install

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode** (top-right toggle)
3. Click **"Load unpacked"** → select this folder
4. Click the extension icon → **"⚙️ Manage Credentials"**
5. Enter your **Student Login ID** and **Password** → Save
6. Enable **Auto-Login** and **Keep Session Alive** toggles

---

## Usage

Just click the extension icon and press **📊 View Attendance**.

- If you're logged in → goes directly to attendance page
- If session expired or you logged out → auto-logs in → redirects to attendance
- Your attendance % appears in the popup ring AND as a badge on the icon

---

## Portal URLs

- **Login**: `https://accsoft.lnctu.ac.in/AccSoft2/StudentLogin.aspx`
- **Attendance**: `https://accsoft.lnctu.ac.in/AccSoft2/Parents/StuAttendanceStatus.aspx`

---

## Security

> Credentials are stored **only on your device** using `chrome.storage.sync`.
> They are **never transmitted** to any external server.
> Only use this on your **personal device**.

---

*Built with HTML, CSS, JavaScript — Chrome Extension Manifest V3*
*By Vishwajeet Kumar | LNCT University*
