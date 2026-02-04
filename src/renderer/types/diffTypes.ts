/**
 * Types for AI-powered diff editing feature
 */

export interface DiffHunk {
    id: string;                    // Unique ID for this diff region
    startLine: number;             // 0-indexed line in original file
    endLine: number;               // End line in original
    originalLines: string[];       // Lines being replaced/removed
    newLines: string[];            // Lines being added (empty if pure deletion)
    type: 'add' | 'remove' | 'modify'; // Type of change
    status: 'pending' | 'accepted' | 'rejected'; // User decision
}

export interface DiffSession {
    fileId: string;                // ID of file being edited
    originalContent: string;       // Snapshot of original content
    modifiedContent: string;       // Full modified content from AI
    hunks: DiffHunk[];             // All diff regions
    currentHunkIndex: number;      // Currently focused hunk (-1 if none)
    isActive: boolean;             // Whether diff mode is active
    summary?: string;              // AI-provided summary of changes
}

export interface DiffEditRequest {
    prompt: string;                // User's edit request
    fileContent: string;           // Current file content
    fileName: string;              // For context
}

export interface DiffEditResponse {
    success: boolean;
    modifiedContent?: string;      // Full modified file content
    summary?: string;              // AI-provided summary of changes
    error?: string;
}

export interface AIEditJsonResponse {
    modifiedContent: string;       // The complete modified file content
    summary: string;               // Brief description of changes made
}
