# Electron Template React TypeScript Application

This repository is meant to be cloned into a folder with a different name, then delete the git folder and push to a new repo for development.

## Project Structure

```
├── dist/                   # Compiled output
├── src/
│   ├── main/               # Electron main process
│   │   └── main.ts
│   ├── renderer/           # React renderer process
│   │   ├── App.tsx
│   │   ├── index.html
│   │   └── index.tsx
│   └── styles/             # CSS styles
│       └── index.css
├── package.json
├── tsconfig.json
└── webpack.config.js
```
## To get all the dependancies installed, run

### `npm install --save-dev`

## Available Scripts

In the project directory, you can run:

### `npm start`

Builds the app and starts it.

### `npm run dev`

Runs the app in the development mode with hot reloading.

### `npm run build`

Builds the app for production to the `dist` folder.

### `npm run dist`

Creates a Generate Distribution Executable.

### `npm run package`

Packages the app for Windows distribution.

### `npm run package-mac`

Packages the app for macOS distribution.

### `npm run package-linux`

Packages the app for Linux distribution.

## Technologies Used

- Electron
- React
- TypeScript
- Webpack
