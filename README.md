# Scrolli Studio

A tester for Scrolli scrolls. Artists load their scroll image and roll it through the Scrolli window.
Everything runs in the visitor's browser: files are never uploaded or stored (the page even blocks all
network connections with a Content-Security-Policy).

Files: `index.html` (tester), `guidelines.html` (format + templates), `app.js`, `style.css`, `templates/`.

## Publish on GitHub Pages
1. github.com → New repository → name `scrolli-studio` → Public → Create.
2. Add file → Upload files → drag in ALL files and the `templates` folder from this zip → Commit changes.
3. Settings → Pages → Source: Deploy from a branch → Branch: main, folder: / (root) → Save.
4. After about a minute the site is live at https://YOUR-USERNAME.github.io/scrolli-studio/
