import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

let logFilePath: string;
let logBuffer: string[] = [];
let isWriting = false;

// Initialize logger
export function initLogger() {
    const appPath = app.isPackaged 
        ? path.dirname(app.getPath('exe'))
        : app.getAppPath();
    
    logFilePath = path.join(appPath, 'markdownplus-debug.log');
    
    // Clear old log file on startup
    try {
        fs.writeFile(logFilePath, `=== MarkdownPlus Debug Log ===\n`, 'utf-8').catch(() => {});
    } catch {
        // Ignore errors
    }
    
    log('Logger initialized', { appPath, logFilePath, isPackaged: app.isPackaged });
}

// Write buffered logs to file
async function flushLogs() {
    if (isWriting || logBuffer.length === 0) return;
    
    isWriting = true;
    const toWrite = [...logBuffer];
    logBuffer = [];
    
    try {
        await fs.appendFile(logFilePath, toWrite.join(''), 'utf-8');
    } catch (error) {
        console.error('Failed to write logs:', error);
    } finally {
        isWriting = false;
    }
}

// Log a message with optional data
export function log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logLine = data 
        ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}\n\n`
        : `[${timestamp}] ${message}\n\n`;
    
    // Console output
    console.log(`[LOG] ${message}`, data || '');
    
    // Buffer for file write
    logBuffer.push(logLine);
    
    // Flush after a short delay
    setTimeout(flushLogs, 100);
}

// Log an error
export function logError(message: string, error: any) {
    const timestamp = new Date().toISOString();
    const errorInfo = {
        message: error?.message || String(error),
        stack: error?.stack,
        ...error
    };
    const logLine = `[${timestamp}] ERROR: ${message}\n${JSON.stringify(errorInfo, null, 2)}\n\n`;
    
    console.error(`[ERROR] ${message}`, error);
    
    logBuffer.push(logLine);
    setTimeout(flushLogs, 100);
}

// Force flush logs (call before app quit)
export async function flushLogsSync() {
    await flushLogs();
}
