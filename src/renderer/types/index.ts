// Re-export all types
export * from './global.d';

// File interface for editor state
export interface IFile {
  id: string;
  path: string | null; // null for untitled files
  name: string; // "Untitled-1", "README.md"
  content: string;
  originalContent: string; // Track original content for dirty detection
  isDirty: boolean;
  viewMode: 'markdown' | 'plaintext';
  lineEnding: 'CRLF' | 'LF';
}

// Editor state interface
export interface EditorState {
  openFiles: IFile[];
  activeFileId: string | null;
  untitledCounter: number;
  config: IConfig;
  notifications: Notification[];
}

// Notification interface
export interface Notification {
  id: string;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
}

// Import IConfig from global
import type { IConfig } from './global.d';
export type { IConfig };
