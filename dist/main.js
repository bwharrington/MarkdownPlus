/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/main/main.ts":
/*!**************************!*\
  !*** ./src/main/main.ts ***!
  \**************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

eval("\nvar __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {\n    if (k2 === undefined) k2 = k;\n    var desc = Object.getOwnPropertyDescriptor(m, k);\n    if (!desc || (\"get\" in desc ? !m.__esModule : desc.writable || desc.configurable)) {\n      desc = { enumerable: true, get: function() { return m[k]; } };\n    }\n    Object.defineProperty(o, k2, desc);\n}) : (function(o, m, k, k2) {\n    if (k2 === undefined) k2 = k;\n    o[k2] = m[k];\n}));\nvar __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {\n    Object.defineProperty(o, \"default\", { enumerable: true, value: v });\n}) : function(o, v) {\n    o[\"default\"] = v;\n});\nvar __importStar = (this && this.__importStar) || (function () {\n    var ownKeys = function(o) {\n        ownKeys = Object.getOwnPropertyNames || function (o) {\n            var ar = [];\n            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;\n            return ar;\n        };\n        return ownKeys(o);\n    };\n    return function (mod) {\n        if (mod && mod.__esModule) return mod;\n        var result = {};\n        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== \"default\") __createBinding(result, mod, k[i]);\n        __setModuleDefault(result, mod);\n        return result;\n    };\n})();\nvar __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {\n    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }\n    return new (P || (P = Promise))(function (resolve, reject) {\n        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }\n        function rejected(value) { try { step(generator[\"throw\"](value)); } catch (e) { reject(e); } }\n        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }\n        step((generator = generator.apply(thisArg, _arguments || [])).next());\n    });\n};\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nconst electron_1 = __webpack_require__(/*! electron */ \"electron\");\nconst path = __importStar(__webpack_require__(/*! path */ \"path\"));\nconst fs = __importStar(__webpack_require__(/*! fs/promises */ \"fs/promises\"));\nlet mainWindow;\n// Config file path - next to the app executable\nconst getConfigPath = () => {\n    // In development, use the project root; in production, use the app's directory\n    const appPath = electron_1.app.isPackaged\n        ? path.dirname(electron_1.app.getPath('exe'))\n        : electron_1.app.getAppPath();\n    return path.join(appPath, 'config.json');\n};\n// Default config\nconst defaultConfig = {\n    recentFiles: [],\n    openFiles: [],\n    defaultLineEnding: 'CRLF',\n};\n// Detect line ending in content\nfunction detectLineEnding(content) {\n    if (content.includes('\\r\\n')) {\n        return 'CRLF';\n    }\n    return 'LF';\n}\n// Normalize line endings for saving\nfunction normalizeLineEndings(content, lineEnding) {\n    // First normalize to LF\n    const normalized = content.replace(/\\r\\n/g, '\\n');\n    // Then convert to target\n    if (lineEnding === 'CRLF') {\n        return normalized.replace(/\\n/g, '\\r\\n');\n    }\n    return normalized;\n}\n// Load config from file\nfunction loadConfig() {\n    return __awaiter(this, void 0, void 0, function* () {\n        try {\n            const configPath = getConfigPath();\n            const data = yield fs.readFile(configPath, 'utf-8');\n            return Object.assign(Object.assign({}, defaultConfig), JSON.parse(data));\n        }\n        catch (_a) {\n            return defaultConfig;\n        }\n    });\n}\n// Save config to file\nfunction saveConfig(config) {\n    return __awaiter(this, void 0, void 0, function* () {\n        try {\n            const configPath = getConfigPath();\n            yield fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');\n        }\n        catch (error) {\n            console.error('Failed to save config:', error);\n        }\n    });\n}\n// Open config file for editing - creates if doesn't exist\nfunction openConfigFile() {\n    return __awaiter(this, void 0, void 0, function* () {\n        const configPath = getConfigPath();\n        try {\n            // Check if file exists, if not create it with defaults\n            try {\n                yield fs.access(configPath);\n            }\n            catch (_a) {\n                // File doesn't exist, create it\n                yield fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');\n            }\n            const content = yield fs.readFile(configPath, 'utf-8');\n            const lineEnding = detectLineEnding(content);\n            return { filePath: configPath, content, lineEnding };\n        }\n        catch (error) {\n            console.error('Failed to open config file:', error);\n            return null;\n        }\n    });\n}\n// Register IPC handlers\nfunction registerIpcHandlers() {\n    // File: Open dialog\n    electron_1.ipcMain.handle('file:open', () => __awaiter(this, void 0, void 0, function* () {\n        const result = yield electron_1.dialog.showOpenDialog(mainWindow, {\n            filters: [\n                { name: 'Markdown', extensions: ['md', 'markdown'] },\n                { name: 'Text Files', extensions: ['txt'] },\n                { name: 'All Files', extensions: ['*'] },\n            ],\n            properties: ['openFile', 'multiSelections'],\n        });\n        if (result.canceled || result.filePaths.length === 0) {\n            return null;\n        }\n        // Read all selected files\n        const files = [];\n        for (const filePath of result.filePaths) {\n            try {\n                const content = yield fs.readFile(filePath, 'utf-8');\n                const lineEnding = detectLineEnding(content);\n                files.push({ filePath, content, lineEnding });\n            }\n            catch (error) {\n                console.error(`Failed to read file ${filePath}:`, error);\n            }\n        }\n        return files.length > 0 ? files : null;\n    }));\n    // File: Read specific file\n    electron_1.ipcMain.handle('file:read', (_event, filePath) => __awaiter(this, void 0, void 0, function* () {\n        try {\n            const content = yield fs.readFile(filePath, 'utf-8');\n            const lineEnding = detectLineEnding(content);\n            return { filePath, content, lineEnding };\n        }\n        catch (error) {\n            console.error('Failed to read file:', error);\n            return null;\n        }\n    }));\n    // File: Save to existing path\n    electron_1.ipcMain.handle('file:save', (_event, filePath, content) => __awaiter(this, void 0, void 0, function* () {\n        try {\n            // Detect original line ending and preserve it\n            let lineEnding = 'LF';\n            try {\n                const originalContent = yield fs.readFile(filePath, 'utf-8');\n                lineEnding = detectLineEnding(originalContent);\n            }\n            catch (_a) {\n                // File might not exist yet, use default\n                lineEnding = process.platform === 'win32' ? 'CRLF' : 'LF';\n            }\n            const normalizedContent = normalizeLineEndings(content, lineEnding);\n            yield fs.writeFile(filePath, normalizedContent, 'utf-8');\n            return { success: true, filePath };\n        }\n        catch (error) {\n            console.error('Failed to save file:', error);\n            return { success: false, filePath, error: String(error) };\n        }\n    }));\n    // File: Save As dialog\n    electron_1.ipcMain.handle('file:save-as', (_event, content, defaultName) => __awaiter(this, void 0, void 0, function* () {\n        const result = yield electron_1.dialog.showSaveDialog(mainWindow, {\n            defaultPath: defaultName || 'Untitled.md',\n            filters: [\n                { name: 'Markdown', extensions: ['md'] },\n                { name: 'Text Files', extensions: ['txt'] },\n                { name: 'All Files', extensions: ['*'] },\n            ],\n        });\n        if (result.canceled || !result.filePath) {\n            return null;\n        }\n        try {\n            const lineEnding = process.platform === 'win32' ? 'CRLF' : 'LF';\n            const normalizedContent = normalizeLineEndings(content, lineEnding);\n            yield fs.writeFile(result.filePath, normalizedContent, 'utf-8');\n            return { success: true, filePath: result.filePath };\n        }\n        catch (error) {\n            console.error('Failed to save file:', error);\n            return { success: false, filePath: result.filePath, error: String(error) };\n        }\n    }));\n    // Config: Load\n    electron_1.ipcMain.handle('config:load', () => __awaiter(this, void 0, void 0, function* () {\n        return yield loadConfig();\n    }));\n    // Config: Save\n    electron_1.ipcMain.handle('config:save', (_event, config) => __awaiter(this, void 0, void 0, function* () {\n        yield saveConfig(config);\n    }));\n    // Config: Open for editing\n    electron_1.ipcMain.handle('config:open', () => __awaiter(this, void 0, void 0, function* () {\n        return yield openConfigFile();\n    }));\n    // Config: Sync recent files with open files\n    electron_1.ipcMain.handle('config:sync-recent-files', (_event, openFiles) => __awaiter(this, void 0, void 0, function* () {\n        const config = yield loadConfig();\n        const newConfig = Object.assign(Object.assign({}, config), { recentFiles: openFiles });\n        yield saveConfig(newConfig);\n    }));\n    // Dialog: Confirm close\n    electron_1.ipcMain.handle('dialog:confirm-close', (_event, fileName) => __awaiter(this, void 0, void 0, function* () {\n        const result = yield electron_1.dialog.showMessageBox(mainWindow, {\n            type: 'question',\n            buttons: ['Save', \"Don't Save\", 'Cancel'],\n            defaultId: 0,\n            cancelId: 2,\n            title: 'Unsaved Changes',\n            message: `Do you want to save changes to \"${fileName}\"?`,\n            detail: 'Your changes will be lost if you don\\'t save them.',\n        });\n        const actions = ['save', 'discard', 'cancel'];\n        return { action: actions[result.response] };\n    }));\n    // Dialog: External change\n    electron_1.ipcMain.handle('dialog:external-change', (_event, fileName) => __awaiter(this, void 0, void 0, function* () {\n        const result = yield electron_1.dialog.showMessageBox(mainWindow, {\n            type: 'question',\n            buttons: ['Reload', 'Keep Current'],\n            defaultId: 0,\n            title: 'File Changed',\n            message: `\"${fileName}\" has been modified externally.`,\n            detail: 'Do you want to reload the file or keep your current version?',\n        });\n        return result.response === 0 ? 'reload' : 'keep';\n    }));\n    // Window: Set title\n    electron_1.ipcMain.handle('window:set-title', (_event, title) => __awaiter(this, void 0, void 0, function* () {\n        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.setTitle(title);\n    }));\n    // Window: Get bounds\n    electron_1.ipcMain.handle('window:get-bounds', () => __awaiter(this, void 0, void 0, function* () {\n        return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.getBounds();\n    }));\n    // Shell: Show in folder\n    electron_1.ipcMain.handle('shell:show-in-folder', (_event, filePath) => __awaiter(this, void 0, void 0, function* () {\n        electron_1.shell.showItemInFolder(filePath);\n    }));\n}\nfunction createWindow() {\n    // Create the browser window with secure settings\n    mainWindow = new electron_1.BrowserWindow({\n        width: 1200,\n        height: 800,\n        minWidth: 600,\n        minHeight: 400,\n        icon: path.join(__dirname, 'assets', 'MarkdownPlus.png'),\n        webPreferences: {\n            nodeIntegration: false,\n            contextIsolation: true,\n            preload: path.join(__dirname, 'preload.js'),\n        },\n    });\n    // Load the index.html file\n    mainWindow.loadFile(path.join(__dirname, 'index.html'));\n    // Open the DevTools in development mode\n    if (true) {\n        mainWindow.webContents.openDevTools();\n    }\n    // Emitted when the window is closed\n    mainWindow.on('closed', () => {\n        // Dereference the window object\n        mainWindow = null;\n    });\n}\n// This method will be called when Electron has finished initialization\nelectron_1.app.whenReady().then(() => __awaiter(void 0, void 0, void 0, function* () {\n    registerIpcHandlers();\n    // Remove the native menu bar\n    electron_1.Menu.setApplicationMenu(null);\n    createWindow();\n}));\n// Quit when all windows are closed, except on macOS\nelectron_1.app.on('window-all-closed', () => {\n    if (process.platform !== 'darwin') {\n        electron_1.app.quit();\n    }\n});\nelectron_1.app.on('activate', () => {\n    // On macOS it's common to re-create a window when the dock icon is clicked\n    if (mainWindow === null) {\n        createWindow();\n    }\n});\n\n\n//# sourceURL=webpack://markdownplus/./src/main/main.ts?");

/***/ }),

/***/ "electron":
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("electron");

/***/ }),

/***/ "fs/promises":
/*!******************************!*\
  !*** external "fs/promises" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("fs/promises");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main/main.ts");
/******/ 	
/******/ })()
;