# LNCT Attendance Helper

[![Version](https://img.shields.io/badge/version-3.2.0-blue)](https://github.com/VishwajeetCSE/Attendance-LNCT)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

A Chrome extension for LNCT University and LNCT College students. It shows the latest attendance, subject-wise pie charts, profile information, and semester-history records from the authenticated AccSoft portal.

## Features

| Feature | What it does |
|---|---|
| Live toolbar badge | Shows the selected portal's latest overall attendance: green at 75%+, amber at 60–74%, red below 60%. |
| Live-page refresh | Reads the currently open Attendance Status page first, so the popup matches the portal's latest Summary without opening or changing a tab. |
| Subject-wise pie charts | Shows each recognised subject as an attended/remaining donut chart. |
| Semester records | Saves each semester selected with the portal's **Class** dropdown, then lists the saved records in order. |
| Update history | Preserves every changed attendance percentage, so students can see when attendance moves up or down. |
| Dual portal isolation | University and College attendance, profile, history, and session status are stored separately. |
| Auto-login | Fills the currently verified AccSoft login fields only when enabled. |
| Keep-alive | Checks the signed-in session every four minutes and reports expired sessions in the popup. |

## Supported portals

| Institution | Login page |
|---|---|
| LNCT University | `https://accsoft.lnctu.ac.in/AccSoft2/StudentLogin.aspx` |
| LNCT College | `https://portal.lnct.ac.in/Accsoft2/studentLogin.aspx` |

## Install locally

1. Download or clone the project.
2. Open `chrome://extensions/` in Chrome or Brave.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose this project folder.
5. Pin **LNCT Attendance Helper**.

## First-time setup

1. Open the extension and choose the correct portal.
2. Select **Manage Credentials** and save your Student ID and password.
3. Enable Auto-login only if this is your personal device.
4. Sign in once through **View Attendance**.
5. Keep the portal's **Attendance Status** page open and press the circular **Refresh** button in the extension. It reads the live page without opening another tab.

## How data is read

The parser reads the current AccSoft layout: each subject percentage is calculated from **Present Count ÷ Total Class Held**, while the dashboard percentage comes directly from the portal's **Present %** Summary. It deliberately does not average random percentages found elsewhere on the page.

To save past semesters, choose a semester in AccSoft's **Class** dropdown, click **Show**, and leave the result visible for a moment. The extension detects the redrawn table and stores that semester's actual Summary percentage. Repeat for the remaining semesters; the Profile tab keeps them in semester order.

## Privacy

- Credentials are kept in this browser's extension storage, not Chrome Sync.
- The extension sends credentials only to the LNCT portal when Auto-login is enabled.
- Attendance, profile photos, and semester data remain in the extension's local storage.
- This is not a password manager. Use it only in a personal browser profile and clear credentials before sharing the device.
- Do not commit screenshots of portal pages: they can contain student IDs and attendance data.

## Development checks

Run these commands from the project folder:

```bash
npm run check
npm test
```

The tests cover parser value validation and semester ordering. Test the live login, attendance table, profile page, and history page after every AccSoft portal redesign.

## Project structure

```text
attendance_parser.js    Shared DOM parser for attendance/profile pages
attendance_scraper.js   Saves data when an attendance page is opened
profile_scraper.js      Captures data when an authenticated profile page is opened
background.js           Refresh, session status, storage, redirect and toolbar badge
popup.html / popup.js   Dashboard, pie charts, profile and semester history
options.html / options.js
tests/                  Parser unit tests
```

## Team

- Vishwajeet Kumar — Lead developer, LNCT University CSE
- Utpal Upadhyay — Collaborator, LNCT University

Licensed under the [MIT License](LICENSE).
