# Team Cats

A short online game to get to know a team. One task: five scales. Players place themselves between two answers, the host shows everyone's cats on the main screen. Static site, no build step. Data lives in Firebase Realtime Database.

- Host: `/?host` creates a room, shares the screen and moves the game forward with the main button.
- Player: `/?room=XXXX` picks a cat, enters a name and plays on the phone. Many players can pick the same cat.

**Run locally:** run `python3 -m http.server 8080` in this folder and open `http://localhost:8080/?host`. It does not work from `file://` because of ES module imports.

**Offline demo:** `?host&demo` and `?room=TEST&demo`. The arrow keys move between steps. `&phase=scales&step=2` opens a step directly. `&players=30` shows a big group.

**Deploy:** push to `main`. GitHub Pages serves the repository root. Firebase settings are in `config.js` (template: `config.example.js`). Database rules are in `firebase.rules.json`.

Made with Claude by Hanna.
