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

/***/ "./src/main/preload.ts":
/*!*****************************!*\
  !*** ./src/main/preload.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nconst electron_1 = __webpack_require__(/*! electron */ \"electron\");\n// Define the API that will be exposed to the renderer process\nconst electronAPI = {\n    // File operations\n    newFile: () => electron_1.ipcRenderer.invoke('file:new'),\n    openFile: () => electron_1.ipcRenderer.invoke('file:open'),\n    readFile: (filePath) => electron_1.ipcRenderer.invoke('file:read', filePath),\n    saveFile: (filePath, content) => electron_1.ipcRenderer.invoke('file:save', filePath, content),\n    saveFileAs: (content, defaultName) => electron_1.ipcRenderer.invoke('file:save-as', content, defaultName),\n    renameFile: (oldPath, newPath) => electron_1.ipcRenderer.invoke('file:rename', oldPath, newPath),\n    // Config operations\n    loadConfig: () => electron_1.ipcRenderer.invoke('config:load'),\n    saveConfig: (config) => electron_1.ipcRenderer.invoke('config:save', config),\n    openConfig: () => electron_1.ipcRenderer.invoke('config:open'),\n    syncRecentFiles: (openFiles) => electron_1.ipcRenderer.invoke('config:sync-recent-files', openFiles),\n    // Dialog operations\n    confirmClose: (fileName) => electron_1.ipcRenderer.invoke('dialog:confirm-close', fileName),\n    showExternalChangeDialog: (fileName) => electron_1.ipcRenderer.invoke('dialog:external-change', fileName),\n    // Window operations\n    setWindowTitle: (title) => electron_1.ipcRenderer.invoke('window:set-title', title),\n    getWindowBounds: () => electron_1.ipcRenderer.invoke('window:get-bounds'),\n    minimizeWindow: () => electron_1.ipcRenderer.invoke('window:minimize'),\n    maximizeWindow: () => electron_1.ipcRenderer.invoke('window:maximize'),\n    closeWindow: () => electron_1.ipcRenderer.invoke('window:close'),\n    // Shell operations\n    showInFolder: (filePath) => electron_1.ipcRenderer.invoke('shell:show-in-folder', filePath),\n    // Menu event listeners\n    onMenuNew: (callback) => {\n        electron_1.ipcRenderer.on('menu:new', callback);\n        return () => electron_1.ipcRenderer.removeListener('menu:new', callback);\n    },\n    onMenuOpen: (callback) => {\n        electron_1.ipcRenderer.on('menu:open', callback);\n        return () => electron_1.ipcRenderer.removeListener('menu:open', callback);\n    },\n    onMenuSave: (callback) => {\n        electron_1.ipcRenderer.on('menu:save', callback);\n        return () => electron_1.ipcRenderer.removeListener('menu:save', callback);\n    },\n    onMenuSaveAs: (callback) => {\n        electron_1.ipcRenderer.on('menu:save-as', callback);\n        return () => electron_1.ipcRenderer.removeListener('menu:save-as', callback);\n    },\n    onMenuSaveAll: (callback) => {\n        electron_1.ipcRenderer.on('menu:save-all', callback);\n        return () => electron_1.ipcRenderer.removeListener('menu:save-all', callback);\n    },\n    onMenuClose: (callback) => {\n        electron_1.ipcRenderer.on('menu:close', callback);\n        return () => electron_1.ipcRenderer.removeListener('menu:close', callback);\n    },\n    onMenuCloseAll: (callback) => {\n        electron_1.ipcRenderer.on('menu:close-all', callback);\n        return () => electron_1.ipcRenderer.removeListener('menu:close-all', callback);\n    },\n    onMenuShowInFolder: (callback) => {\n        electron_1.ipcRenderer.on('menu:show-in-folder', callback);\n        return () => electron_1.ipcRenderer.removeListener('menu:show-in-folder', callback);\n    },\n    onMenuOpenRecent: (callback) => {\n        electron_1.ipcRenderer.on('menu:open-recent', (_event, filePath) => callback(filePath));\n        return () => electron_1.ipcRenderer.removeAllListeners('menu:open-recent');\n    },\n    onExternalFileChange: (callback) => {\n        electron_1.ipcRenderer.on('file:external-change', (_event, filePath) => callback(filePath));\n        return () => electron_1.ipcRenderer.removeAllListeners('file:external-change');\n    },\n};\n// Expose the API to the renderer process\nelectron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);\n\n\n//# sourceURL=webpack://markdownplus/./src/main/preload.ts?");

/***/ }),

/***/ "electron":
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("electron");

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
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main/preload.ts");
/******/ 	
/******/ })()
;