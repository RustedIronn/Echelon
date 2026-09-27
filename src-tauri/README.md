# Echelon for Windows

The desktop target packages the existing Vite frontend in one Tauri 2 window. All user data continues to use the existing UID-scoped stores and Firebase project. There is no desktop data copy or separate server.

Install the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) and run `npm install`, then `npm run desktop:dev` for development or `npm run desktop:build` for an NSIS installer. The checked-in icon assets are generated from `app-icon.svg` with `npm run desktop:icons`.

The tray keeps the process alive after the main window closes; Quit exits. The window-state plugin persists position and size but not hidden visibility. Ctrl+Alt+E registers when the desktop frontend starts, and Settings reports if another application owns it. Pausing desktop notifications lasts only for the current process.

The existing Schedule reminder ledger remains the only reminder scheduler. A native one-minute wake signal helps it reconcile while the WebView is hidden; it does not generate or store reminders. There are no Planner reminder rules to deliver yet. Focus completion and Workout runner phase changes can produce native notifications while unfocused. Native delivery requires an installed Windows build; Windows notification settings and Focus Assist can suppress it. The Tauri 2 notification plugin does not provide reliable Windows notification-click routing, so no action buttons or click navigation are promised.

Google Firebase popup sign-in in the packaged WebView has not been verified on Windows. Verify it against the configured Firebase authorized domains before distributing the installer; do not treat a successful web login as desktop auth verification.
