# Integrated Dashboard (`index.html`) Implementation Plan

This plan outlines the steps to build a unified index page for the application suite, acting as a master dashboard from which the user can navigate to any of the sub-applications.

## Goal Description
The user wants to convert the current `index.html` (which simply redirects) into a full-fledged dashboard. It will feature a left sidebar with navigation menus pointing to all the different HTML views available in the `public` folder. Clicking a menu item will load the corresponding page into a main content area (likely using an `<iframe>` for isolation and fast switching). The default view will be a comprehensive summary of all implemented features.

## Proposed Changes

### 1. `public/index.html`

- **[MODIFY] [index.html](file:///c:/bpdt/project/express-sample/public/index.html)**
    - Completely rewrite the HTML structure.
    - Implement a Dark Theme UI matching the rest of the applications.
    - Add a **Sidebar** on the left containing categories and links to all public HTML files:
        - **통신 / 메신저:** `messenger.html`, `webrtc.html`
        - **DB 클라이언트:** `pg-client.html`, `sqlite-client.html`
        - **업무 관리:** `todo.html`, `order-management.html`, `schedule-manager.html`
---
	- **파일 및 미디어:** `file-share.html`, `file-transfer.html`, `video-player.html`
        - **음악 / 노래방:** `funny_music.html`, `music_select.html`, `lyrics.html`
        - **기타 앱:** `dashboard.html`, `launcher.html`, `theme-selector.html`, `color-table.html`
    - Add a **Main Content Area** using an `<iframe>` (e.g., `<iframe id="content-frame"></iframe>`).
    - Create a **Default Summary View** (either embedded in index.html and hidden when iframe loads, or created as a separate `summary.html` which is loaded by default. Embedding might be simpler to avoid creating new files). The summary will describe:
        - 💬 Real-time Messenger (WebSocket, Push, Location sharing)
        - 🗄️ Database Management (PostgreSQL & SQLite Web Clients)
        - ✅ Task & Order Management (Todo WBS, Restaurant POS)
        - 🎵 Multimedia (Video Scheduler, Karaoke system)

## Verification Plan

### Manual Verification
1. Navigate to `/` (or `/index.html`) in the browser.
2. Verify the new dashboard layout is displayed instead of redirecting.
3. Check the "Summary" page shows correctly on initial load.
4. Click on various sidebar links and verify the `iframe` loads the correct sub-pages.
