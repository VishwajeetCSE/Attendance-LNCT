# LNCT Attendance Helper — Chrome Extension

[![Version](https://img.shields.io/badge/version-3.0.0-blue)](https://github.com/VishwajeetCSE/Attendance-LNCT)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

> One-click smart attendance tracker with auto-login, live % badge, subject graph & profile display — for **LNCT University** and **LNCT College** students.

---

## 🌟 Features

| Feature | Description |
|---|---|
| **📊 Attendance % Badge** | Live percentage on extension icon (🟢 ≥75% / 🟡 ≥60% / 🔴 <60%) |
| **⚡ Smart Auto-Login** | Detects session expiry, auto-fills credentials, redirects to attendance |
| **📈 Subject Bar Graph** | Vertical bar chart for each subject with color-coded status |
| **👤 Student Profile** | Shows profile photo, name, and attendance stats |
| **🔄 Session Keep-Alive** | Pings portal every 4 min to prevent auto-logout |
| **ℹ️ About Section** | Developer info with LinkedIn & GitHub links |
| **🏫 Dual Portal** | Supports both LNCT University and LNCT College portals |
| **🔐 Secure Storage** | Credentials stored locally in Chrome encrypted storage |

---

## 🏫 Supported Portals

| Institution | Portal URL | Login URL |
|---|---|---|
| **LNCT University** | accsoft.lnctu.ac.in | `/AccSoft2/StudentLogin.aspx` |
| **LNCT College** | portal.lnct.ac.in | `/Accsoft2/studentLogin.aspx` |

---

## 📁 Project Structure

```
Attendance-LNCT/
├── manifest.json           # Chrome Extension Manifest V3
├── background.js           # Service worker: session check, ping, badge, redirect
├── content_script.js       # Auto-fills login form (both portals)
├── attendance_scraper.js   # Extracts %, subjects, profile from attendance page
├── popup.html              # 3-tab popup: Home | Profile | About
├── popup.js                # Popup logic: ring, bar graph, profile, links
├── options.html            # Credential settings page
├── options.js              # Save/clear credentials
└── icons/
    ├── icon16.png          # Extension toolbar icon
    ├── icon48.png
    ├── icon128.png
    ├── lnct_logo.png       # Official LNCT logo
    └── lnct_popup_logo.png # Logo used in popup header
```

---

## 🚀 Installation (Developer Mode)

1. Clone / download this repository
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer Mode** (top-right toggle)
4. Click **"Load unpacked"** → select the project folder
5. Pin the extension to your toolbar

---

## ⚙️ First-Time Setup

1. Click the extension icon → **⚙️ Manage Credentials**
2. Enter your **Student Login ID** and **Password** → Save
3. Select your portal (University or College) from the popup dropdown
4. Enable **Auto-Login** and **Keep Session Alive**

---

## 🖥️ Usage

Click the extension icon — you'll see **3 tabs**:

### 🏠 Home
- Animated attendance percentage ring
- Color-coded status (Safe / At Risk / Low)
- **📊 View Attendance** — smart button: auto-logs in if needed, then navigates to attendance page
- Subject-wise vertical bar chart

### 👤 Profile
- Student photo (extracted from portal)
- Name, overall %, safe/low subject counts
- Last update time

### ℹ️ About
- Developer info with LinkedIn & GitHub links
- Team collaboration section
- Extension info

---

## 👥 Team

| Member | Role | GitHub |
|---|---|---|
| **Vishwajeet Kumar** | Lead Developer — LNCT University, CSE | [@VishwajeetCSE](https://github.com/VishwajeetCSE) |
| **Utpal Upadhyay** | Collaborator — LNCT University | [@utpalupadhyay](https://github.com/utpalupadhyay) |

---

## 🔗 Developer

**Vishwajeet Kumar**
- 💼 LinkedIn: [vishwajeet-kumar-752606237](https://www.linkedin.com/in/vishwajeet-kumar-752606237/)
- 🐙 GitHub: [@VishwajeetCSE](https://github.com/VishwajeetCSE)

---

## 🔒 Security & Privacy

> Credentials are stored **only on your local device** using `chrome.storage.sync`.
> They are **never transmitted** to any external server.
> Always use on your **personal device** only.

---

## 🛠️ Troubleshooting

**Auto-login not filling?**
- Press F12 on the login page → Console tab
- Look for `[LNCT]` messages — they log all found input fields
- Share the output to update selectors

**Attendance % not showing in badge?**
- The scraper needs to run on the attendance page at least once
- Click "View Attendance" and wait for the page to load fully

**Wrong portal?**
- Select the correct portal from the popup dropdown before clicking "View Attendance"

---

*Built with HTML, CSS, JavaScript — Chrome Extension Manifest V3 · © 2026 Vishwajeet Kumar*
