# MarkdownPlus Development Guide

## Overview

MarkdownPlus is a multi-tab Markdown editor built with Electron, React, and TypeScript. It features live preview, undo/redo functionality, and a comprehensive markdown toolbar.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 16 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/)

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd MarkdownPlus
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Development Workflow

### Running in Development Mode

**Hot reloading development server:**
```bash
npm run dev
```
This will start webpack in watch mode and launch the Electron app with hot reloading enabled.

**One-time build and run:**
```bash
npm start
```
This builds the project and starts the Electron app.

### Manual Build Process

**Build only (no run):**
```bash
npm run build
```

**Watch mode (rebuilds on file changes):**
```bash
npm run watch
```

## Creating Installers

MarkdownPlus uses electron-builder to create distributable packages.

### Windows Installers

**Create Windows NSIS installer and portable version:**
```bash
npm run package
# or
npm run dist
```

This creates:
- `release/MarkdownPlus-Setup.exe` - Windows installer
- `release/MarkdownPlus-Portable.exe` - Portable version

### Cross-Platform Installers

**macOS:**
```bash
npm run package-mac
```
Creates: `release/MarkdownPlus.dmg`

**Linux:**
```bash
npm run package-linux
```
Creates: `release/MarkdownPlus.AppImage` and `release/MarkdownPlus.deb`

## File Associations

MarkdownPlus supports file associations on Windows, allowing you to right-click .md files in Windows Explorer and select "Edit with MarkdownPlus".

### Windows File Associations

The Windows installers automatically register file associations for .md files:

1. **During installation**, the NSIS installer registers MarkdownPlus as the default handler for .md files
2. **Right-click any .md file** in Windows Explorer to see "Edit with MarkdownPlus" option
3. **Double-clicking .md files** will open them directly in MarkdownPlus
4. **Single instance behavior** - opening multiple .md files opens them as tabs in the same window

### Manual File Association Setup

If you need to manually set up file associations:

1. Right-click a .md file in Windows Explorer
2. Select "Open with" > "Choose another app"
3. Click "More apps" > "Look for another app on this PC"
4. Navigate to the MarkdownPlus installation folder
5. Select `MarkdownPlus.exe`

### Testing File Associations

To test file associations after installation:

1. Install MarkdownPlus using the setup executable
2. Create or find a .md file on your desktop
3. Right-click the file and verify "Edit with MarkdownPlus" appears in the context menu
4. Test opening multiple .md files to ensure they open as tabs in a single window

## Project Structure

```
├── src/
│   ├── main/               # Electron main process
│   │   ├── main.ts         # Main entry point, window management
│   │   └── preload.ts      # Preload script for IPC communication
│   └── renderer/           # React renderer process
│       ├── components/     # React components
│       │   ├── App.tsx
│       │   ├── EditorPane.tsx
│       │   ├── TabBar.tsx
│       │   ├── Toolbar.tsx
│       │   └── MarkdownToolbar.tsx
│       ├── contexts/       # React context providers
│       │   ├── EditorContext.tsx
│       │   └── ThemeContext.tsx
│       ├── hooks/          # Custom React hooks
│       │   └── useFileOperations.ts
│       └── types/          # TypeScript type definitions
├── assets/                 # Icons and images
├── dist/                   # Compiled output (generated)
├── release/                # Built installers (generated)
├── webpack.config.js       # Webpack configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Project dependencies and scripts
```

## Key Features

- **Multi-tab editing** with drag-and-drop reordering
- **Live markdown preview** with toggle between edit/preview modes
- **Undo/Redo functionality** with keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- **Comprehensive markdown toolbar** with formatting buttons
- **File operations** (new, open, save, save as, close)
- **Dark/Light theme toggle**
- **File associations** - Right-click .md files in Windows Explorer to "Edit with MarkdownPlus"
- **Keyboard shortcuts:**
  - `Ctrl+N` - New file
  - `Ctrl+O` - Open file
  - `Ctrl+S` - Save file
  - `Ctrl+Shift+S` - Save all files
  - `Ctrl+W` - Close file
  - `Ctrl+E` - Toggle edit/preview mode
  - `Ctrl+Z` - Undo
  - `Ctrl+Y` - Redo
  - `Ctrl+B` - Bold text
  - `Ctrl+I` - Italic text

## Technologies Used

- **Electron** - Cross-platform desktop app framework
- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Material-UI** - React component library
- **Webpack** - Module bundler
- **electron-builder** - Installer creation
- **react-markdown** - Markdown rendering
- **remark-gfm** - GitHub Flavored Markdown support

## Build Configuration

The build process is configured in:
- `webpack.config.js` - Webpack bundling configuration
- `package.json` - electron-builder configuration in the `build` section
- `tsconfig.json` - TypeScript compilation settings

## Troubleshooting

### Common Issues

1. **Build fails with TypeScript errors:**
   - Ensure all dependencies are installed: `npm install`
   - Check TypeScript version compatibility

2. **Electron app won't start:**
   - Make sure the build completed successfully
   - Check that all required files are in the `dist/` folder

3. **Installer creation fails:**
   - Ensure electron-builder is installed: `npm install`
   - Check that the `assets/` folder contains the required icons

### Development Tips

- Use `npm run dev` for development with hot reloading
- Check the console for runtime errors when the app is running
- Use browser dev tools (F12) to debug the renderer process
- Check Electron dev tools for main process debugging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.