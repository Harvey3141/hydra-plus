# hydra+

![GitHub package.json version](https://img.shields.io/github/package-json/v/dahegyi/hydra-plus)

hydra+ is a double-screen visual editing environment based on the [hydra synth](https://github.com/hydra-synth/hydra-synth), designed for ease of use and to project live visuals without revealing any code.

_The application is tested only on Chromium-based browsers, so it may not work properly on other browsers._

If you have any questions, suggestions, or just want to report a bug, please use the **Issues** or **Discussions** tab on [Github](https://github.com/dahegyi/hydra-plus).

## Known issues:

- initScreen doesn't work properly in visualizer
- initScreen doesn't initialize properly after refreshing the page

## Local development

1. Clone the repository: `git clone git@github.com:dahegyi/hydra-plus.git`
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

### Usage

- `npm run dev` - Runs Vite + WebSocket relay server (supports both local and cross-machine use)
- `npm run build` - Builds the production version
- `npm run preview` - Serves the production version locally
- `npm run prepare` - Installs the Git hooks (runs automatically on `npm install`)
- `npm run lint` - Runs ESLint and Stylelint
- `npm run lint:fix` - Runs ESLint and Stylelint and fixes the errors

### Cross-machine LAN setup

The GUI and Visualizer can run on separate machines on the same network. The Visualizer page is designed to be shown on a second screen or projector without exposing the editor UI.

**Architecture:**

```
Machine A: Vite :5173 + WebSocket relay :3001
  GuiPage → ws://localhost:3001

Machine B: opens http://<Machine-A-IP>:5173/visualizer
  VisualizerPage → ws://<Machine-A-IP>:3001
```

**Steps:**

1. On Machine A, run `npm run dev`
2. Note the Network URL printed by Vite, e.g. `http://192.168.1.X:5173/`
3. On Machine B, open `http://192.168.1.X:5173/visualizer`
4. Use the GUI on Machine A — clicking **Send** will push the current sketch to the Visualizer on Machine B

Both pages reconnect automatically if the relay is restarted.

