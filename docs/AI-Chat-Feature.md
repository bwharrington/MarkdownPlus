# AI Chat Feature Documentation 3.0

This document describes the AI Chat feature in MarkdownPlus, covering configuration, the chat dialog, edit mode, diff visualization, and the underlying architecture.

---

## Table of Contents 2.0

1. [Overview](#overview)
2. [Configuration](#configuration)
   - [API Key Setup](#api-key-setup)
   - [Model Selection](#model-selection)
   - [Secure Storage](#secure-storage)
3. [Chat Dialog](#chat-dialog)
   - [Opening and Closing](#opening-and-closing)
   - [Floating vs Docked Mode](#floating-vs-docked-mode)
   - [Provider and Model Selection](#provider-and-model-selection)
   - [Sending Messages](#sending-messages)
   - [Message Display](#message-display)
   - [File Attachments](#file-attachments)
   - [Loading Indicators](#loading-indicators)
4. [Edit Mode and Diff System](#edit-mode-and-diff-system)
   - [Activating Edit Mode](#activating-edit-mode)
   - [How Edits Are Requested](#how-edits-are-requested)
   - [Diff Computation](#diff-computation)
   - [Diff Tab and Visualization](#diff-tab-and-visualization)
   - [Accepting and Rejecting Changes](#accepting-and-rejecting-changes)
   - [Keyboard Shortcuts](#keyboard-shortcuts)
   - [Source File Protection](#source-file-protection)
5. [Supported AI Providers](#supported-ai-providers)
   - [Claude (Anthropic)](#claude-anthropic)
   - [OpenAI](#openai)
   - [xAI (Grok)](#xai-grok)
6. [Architecture](#architecture)
   - [File Structure](#file-structure)
   - [IPC Communication](#ipc-communication)
   - [State Management](#state-management)

---

## Overview

The AI Chat feature allows users to interact with AI language models directly within the MarkdownPlus editor. It supports two modes:

- **Chat Mode**: A conversational interface for asking questions, brainstorming, or getting help with writing. The AI sees the current document as context and responds in a chat bubble format.
- **Edit Mode**: The AI modifies the current markdown document based on user instructions. Changes are presented in a **dedicated diff tab** with a unified inline diff view, where the user can accept or reject changes on a per-hunk basis.

Three AI providers are supported: **Claude (Anthropic)**, **OpenAI**, and **xAI (Grok)** (xAI is currently disabled in the UI).

---

## Configuration

### API Key Setup

API keys are configured in **Settings** (gear icon in the toolbar). The AI API Keys section provides input fields for each provider:

- **Claude** - Requires an Anthropic API key
- **OpenAI** - Requires an OpenAI API key
- **xAI** - Requires an xAI API key (currently disabled)

For each provider:
1. Enter the API key in the password field
2. Click **Set** to validate and store the key
3. The key is validated with a test API call before being stored
4. A success indicator appears when a key is stored
5. Click **Clear** to remove a stored key

**Development Override**: During development, API keys can be set via environment variables in a `.env` file:
- `ANTHROPIC_API_KEY` for Claude
- `OPENAI_API_KEY` for OpenAI
- `XAI_API_KEY` for xAI

Environment variable values take precedence over keys stored in secure storage.

### Model Selection

Once an API key is configured for a provider, an **AI Models** section appears in Settings. Each provider has an expandable accordion containing checkboxes to enable or disable individual models.

**Default available models:**

| Provider | Models |
|----------|--------|
| Claude | Claude Sonnet 4.5, Claude Sonnet 4, Claude Haiku 3.5 |
| OpenAI | GPT-4 Omni Latest, GPT-4 Omni Mini Latest, GPT-4 Turbo Latest |
| xAI | Grok 3 Fast, Grok 3, Grok 3 Mini |

The application also queries each provider's API for dynamically available models. Models are filtered based on the enabled/disabled configuration stored in `config.json` under the `aiModels` key.

### Secure Storage

API keys are encrypted using Electron's `safeStorage` API, which uses the OS-native credential store:

| Platform | Encryption Method |
|----------|------------------|
| Windows | DPAPI (Data Protection API) |
| macOS | Keychain |
| Linux | libsecret |

Encrypted keys are stored in `{userData}/encrypted-keys.json` as base64-encoded encrypted buffers. Keys are decrypted only when needed for API calls and are never stored in plain text on disk.

---

## Chat Dialog

### Opening and Closing

**Opening:**
- **Keyboard shortcut**: `Ctrl+Shift+A`
- **Toolbar button**: Click the AI icon (SmartToyIcon) in the toolbar

**Closing:**
- Click the **X** button in the dialog header
- Press **Escape** while the dialog is focused

### Floating vs Docked Mode

The chat dialog supports two display modes:

**Floating Mode (default):**
- The dialog appears as a draggable, resizable overlay on top of the editor
- It can be repositioned by dragging the header bar
- It can be resized using the bottom-left resize handle
- When unfocused, the dialog becomes semi-transparent (60% opacity) and returns to full opacity when focused
- Minimum size: 350px wide

**Docked Mode:**
- Click the dock icon in the dialog header to dock the panel to the right side of the editor
- The docked panel has a resizable divider between the editor and the chat panel
- Minimum dock width: 320px, default: 420px
- Dock width is saved to `config.json` (`aiChatDockWidth`) and persists between sessions
- The dock state itself (`aiChatDocked`) also persists in configuration

### Provider and Model Selection

At the top of the chat dialog, two dropdowns allow selecting the AI provider and model:

**Provider Dropdown:**
- Lists available providers that have API keys configured
- Each provider shows a colored status dot:
  - Green: Connected and working
  - Red: Error (invalid key or API issue)
  - Orange: Currently checking connection
  - Grey: Unchecked
- Provider defaults to Claude if available, otherwise OpenAI

**Model Dropdown:**
- Lists enabled models for the selected provider
- Updates dynamically when the provider changes
- Auto-selects the first available model

### Sending Messages

- Type a message in the text input at the bottom of the dialog
- Press **Enter** to send (or click the Send button)
- Press **Shift+Enter** for a line break without sending
- The input supports up to 4 visible rows (multiline)
- The send button is disabled when the input is empty, a request is loading, or a diff tab is currently open
- Active requests can be canceled using the Cancel button next to the input

### Message Display

Messages appear as styled bubbles in the messages container:

**User messages:**
- Aligned to the right
- Primary color background (blue) with white text
- Maximum width: 85% of the container

**Assistant messages:**
- Aligned to the left
- Grey background (adapts to light/dark theme)
- Maximum width: 85% of the container
- Content rendered as Markdown using `ReactMarkdown`, supporting formatted text, code blocks, lists, and other Markdown elements

The message area automatically scrolls to the latest message using smooth scrolling.

**Clearing Chat:**
- Click the delete icon in the dialog header
- A confirmation dialog appears before clearing all messages
- Clears all messages and any error state

### File Attachments

The chat supports file attachments for providing additional context:

**Current Document (auto-attached):**
- When the chat dialog opens, the active document is automatically attached as a context file
- A chip labeled with the file name and a visibility icon appears in the attachments area
- The context document can be toggled on/off via its visibility icon
- When the document is saved while attached, the attachment chip shows a blue glow animation to indicate the context has been updated

**Manual Attachments:**
- Click the attachment icon (paperclip) next to the text input
- Select files via the system file dialog
- Attached files appear as removable chips
- **Text files**: Sent inline as `[File: filename]\ncontent` in the message
- **Images**: Base64-encoded and sent with their MIME type using provider-specific image formats

### Loading Indicators

**Chat Mode:**
- A centered `CircularProgress` spinner appears while waiting for a response

**Edit Mode:**
- A green `CircularProgress` spinner appears with a typewriter-animated loading message
- Messages rotate every 5 seconds from a pool of 15 playful messages (e.g., "Boldly formatting my thoughts...", "Markdown magic in progress...", "Syntax sorcery loading...")
- Each character appears with a 30ms delay for a typewriter effect
- Messages use a shuffle-bag pattern so no message repeats until all have been shown

---

## Edit Mode and Diff System

### Activating Edit Mode

- Toggle the **Edit Mode** switch in the chat dialog (between the model dropdown and the input area)
- When active, the send button turns green and shows an edit icon instead of a send icon
- The placeholder text changes to "Describe the changes..."
- Edit mode is only supported for **Claude** and **OpenAI** providers. When xAI is selected, edit mode is disabled and a warning chip is displayed
- Edit mode is disabled while a diff tab is already open

### How Edits Are Requested

When the user sends a message in edit mode:

1. The current document content and file name are wrapped in a structured prompt:
   ```
   Edit the following markdown document.

   File: {fileName}

   Requested changes:
   {user's prompt}

   Current document:
   ```markdown
   {document content}
   ```

   Return a JSON object with the complete modified document.
   ```

2. The AI receives a system prompt instructing it to return only a JSON object:
   ```json
   {
     "modifiedContent": "# Title\n\nUpdated content...",
     "summary": "Brief description of what was changed"
   }
   ```

3. The response is parsed using a three-strategy approach to handle imperfect JSON:
   - **Strategy 1**: Parse the response as-is (pure JSON)
   - **Strategy 2**: Strip markdown code fences (` ```json ... ``` `) and parse
   - **Strategy 3**: Extract JSON by finding the first `{` and last `}` in the response

4. Claude uses `max_tokens: 16384` for edit requests (vs 4096 for chat) to accommodate full document rewrites. OpenAI uses `response_format: { type: 'json_object' }` to enforce JSON output.

### Diff Computation

Once the AI returns modified content, diffs are computed using the `diff` npm library's `diffLines` function:

**Line ending normalization:**
- Both the original and modified content are normalized to LF (`\n`) before diffing. This prevents false diffs when the AI returns LF line endings but the original file uses CRLF (`\r\n`).
- When accepted changes are applied back to the source file, the original line ending style (CRLF or LF) is restored.

**Pass 1 - Build raw hunks:**
- The normalized original and modified content are compared line by line
- Consecutive removed+added pairs are detected by checking if the previous change was a removal (`changes[i-1]?.removed`) and merged into `modify` type hunks
- Each hunk captures: original lines, new lines, type (`add`/`remove`/`modify`), start and end line numbers

**Pass 2 - Merge nearby hunks:**
- Hunks separated by 2 or fewer unchanged lines are merged into a single grouped hunk
- The bridging unchanged lines are included in both the original and new line arrays of the merged hunk
- This prevents the UI from showing many tiny scattered changes

Each hunk has a `status` field: `pending`, `accepted`, or `rejected`.

### Diff Tab and Visualization

When the AI returns modified content, a **new diff tab** opens in the tab bar — modeled after the diff experience in VS Code and Cursor. This approach keeps the diff separate from the source file and provides a dedicated review experience.

**How the diff tab works:**
1. A new virtual file entry is created with `viewMode: 'diff'` and the name `"{originalName} (AI Diff)"`
2. The diff tab stores a `sourceFileId` linking it back to the original file, and a `diffSession` containing the computed hunks, original/modified content, and AI summary
3. The diff tab becomes the active tab automatically
4. The source file's tab remains in the tab bar but becomes read-only while the diff tab is open

**Tab bar appearance:**
- Diff tabs display a blue **FileDiff** icon instead of the usual save/dirty indicator
- Diff tabs do not show the edit/preview toggle button (they are always in diff view mode)
- The tab tooltip shows "AI Changes"
- Closing a diff tab discards any unresolved pending changes

**Diff view rendering:**
The `DiffView` component renders a unified inline diff using React elements (not HTML strings):

| Element | Appearance |
|---------|------------|
| Unchanged lines | Normal rendering, no special styling |
| Removed lines (original) | Red background tint, red left border (3px), strikethrough text, 70% opacity |
| Added lines (new) | Green background tint, green left border (3px) |
| Current hunk (focused) | Blue outline (2px) around the entire hunk |

The background colors adapt to light/dark theme (15% opacity in light mode, 25% in dark mode).

**Summary banner:**
- At the top of the diff view, a banner displays the AI's summary of what was changed
- A chip shows the count of pending hunks remaining to be resolved

**Hunk resolution display:**
- **Pending hunks**: Show both removed (original) and added (new) lines with inline accept/reject buttons
- **Accepted hunks**: Show only the new lines as normal text
- **Rejected hunks**: Show only the original lines as normal text

### Accepting and Rejecting Changes

Changes can be managed through two UI components:

**Inline hunk controls** (on the first line of each pending hunk):
- **Accept** button (green checkmark): Accept this hunk's changes
- **Reject** button (red undo): Reject this hunk's changes
- These buttons appear directly within the diff view on the first line of each pending hunk

**DiffNavigationToolbar** (floating toolbar, bottom-right of diff view):
- **Previous/Next** buttons: Navigate between hunks (shows current position as "X / Y")
- **Keep** button (green): Accept the currently focused hunk
- **Undo** button (red): Reject the currently focused hunk
- **Keep All** button (green, shows pending count): Accept all remaining pending hunks
- **Cancel** button (X icon): Close the diff tab and discard all changes

**How changes are applied:**
- When a hunk is accepted, the `applyAcceptedHunks()` function rebuilds the source file's content line by line, selecting new or original lines based on each hunk's status
- If the source file uses CRLF line endings, the result is converted back from LF to CRLF before updating the source file
- The source file's previous content is pushed to its undo stack before changes are applied, so changes can be undone
- When all hunks are resolved (none remain pending), the diff tab **auto-closes** and the editor switches back to the source file tab
- If the diff tab is closed manually (or via Escape), no changes are applied to the source file

### Keyboard Shortcuts

While a diff tab is active, the following keyboard shortcuts are available:

| Key | Action |
|-----|--------|
| `J` or `ArrowDown` | Navigate to next change |
| `K` or `ArrowUp` | Navigate to previous change |
| `Enter` or `Y` | Accept (keep) current change |
| `Backspace` or `N` | Reject (undo) current change |
| `Ctrl+Shift+A` | Accept all pending changes |
| `Escape` | Close diff tab and discard all changes |

Navigation auto-scrolls to bring the focused hunk into view.

### Source File Protection

While a diff tab is open for a file, the source file's tab is placed in a **read-only state**:
- The editor content is dimmed (70% opacity)
- All editing interactions are disabled (typing, paste, drag-and-drop, keyboard shortcuts)
- The cursor changes to `default` to indicate non-editable state
- Toolbar insert, undo, and redo actions are disabled

This prevents conflicts between manual edits and the pending diff changes. Once the diff tab is closed (either by resolving all hunks or by canceling), normal editing resumes.

---

## Supported AI Providers

### Claude (Anthropic)

- **API Endpoint**: `https://api.anthropic.com/v1/messages`
- **Authentication**: `X-Api-Key` header
- **API Version**: `2023-06-01`
- **Default Model**: `claude-sonnet-4-5-20250514`
- **Chat Token Limit**: 4,096 max output tokens
- **Edit Token Limit**: 16,384 max output tokens
- **Edit Mode**: Supported (uses system prompt for structured JSON output)
- **Image Attachments**: Native format with `media_type` and base64 `data`
- **Validation**: Test call to `/v1/models` endpoint

### OpenAI

- **API Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Authentication**: `Bearer` token in `Authorization` header
- **Default Model**: `gpt-4o-mini-latest`
- **Edit Mode**: Supported (uses `response_format: { type: 'json_object' }`)
- **Image Attachments**: Data URL format with `image_url`
- **Model Filtering**: Only models with `-latest` suffix are listed
- **Validation**: Test call to list models endpoint

### xAI (Grok)

- **API Endpoint**: `https://api.x.ai/v1/chat/completions`
- **Authentication**: `Bearer` token in `Authorization` header
- **Default Model**: N/A (currently disabled)
- **Edit Mode**: Not supported
- **Status**: Temporarily disabled in the UI

---

## Architecture

### File Structure

**Renderer (React UI):**

| File | Purpose |
|------|---------|
| `src/renderer/components/AIChatDialog.tsx` | Main chat dialog component with all UI elements |
| `src/renderer/components/DiffView.tsx` | Dedicated diff tab view with unified inline diff rendering |
| `src/renderer/components/DiffNavigationToolbar.tsx` | Floating toolbar for navigating and resolving diff hunks |
| `src/renderer/hooks/useAIChat.ts` | Chat state management, message sending, provider/model loading |
| `src/renderer/hooks/useAIDiffEdit.ts` | Edit mode logic, diff computation, opens diff tab |
| `src/renderer/hooks/useEditLoadingMessage.ts` | Typewriter-animated loading messages |
| `src/renderer/types/diffTypes.ts` | TypeScript interfaces for DiffHunk and DiffSession |
| `src/renderer/contexts/EditorContext.tsx` | State reducer for diff tab actions (open, update, close) |
| `src/renderer/styles/editor.styles.ts` | CSS styles for diff highlighting |

**Main Process (Electron Backend):**

| File | Purpose |
|------|---------|
| `src/main/aiIpcHandlers.ts` | IPC handlers for all AI requests, JSON parsing, model filtering |
| `src/main/services/claudeApi.ts` | Claude API integration (chat, edit, model listing, validation) |
| `src/main/services/openaiApi.ts` | OpenAI API integration (chat, JSON mode, model listing, validation) |
| `src/main/services/xaiApi.ts` | xAI API integration (chat, model listing, validation) |
| `src/main/services/secureStorage.ts` | Encrypted API key storage using Electron safeStorage |
| `src/main/secureStorageIpcHandlers.ts` | IPC handlers for API key operations |

### IPC Communication

All AI operations communicate between the renderer and main process via Electron IPC channels:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `ai:claude-chat-request` | Renderer → Main | Send chat message to Claude |
| `ai:openai-chat-request` | Renderer → Main | Send chat message to OpenAI |
| `ai:chat-request` | Renderer → Main | Send chat message to xAI |
| `ai:edit-request` | Renderer → Main | Send edit request (Claude/OpenAI only) |
| `ai:cancel-request` | Renderer → Main | Cancel an active chat request |
| `ai:cancel-edit-request` | Renderer → Main | Cancel an active edit request |
| `ai:list-claude-models` | Renderer → Main | List available Claude models |
| `ai:list-openai-models` | Renderer → Main | List available OpenAI models |
| `ai:list-models` | Renderer → Main | List available xAI models |
| `ai:get-provider-status` | Renderer → Main | Check all provider connection statuses |
| `secure-storage:set-api-key` | Renderer → Main | Validate and store an API key |
| `secure-storage:has-api-key` | Renderer → Main | Check if a provider has a stored key |
| `secure-storage:delete-api-key` | Renderer → Main | Remove a stored API key |
| `secure-storage:get-key-status` | Renderer → Main | Get storage status of all providers |

Request cancellation uses `AbortController` instances tracked by unique request IDs. Each active request is stored in a `Map` and can be aborted by calling the corresponding cancel channel.

### State Management

**Chat State** (managed by `useAIChat` hook):
- `messages: AIMessage[]` - Full conversation history
- `inputValue: string` - Current text input
- `isLoading: boolean` - Whether a chat request is in progress
- `error: string | null` - Current error message
- `selectedProvider` - Active AI provider
- `selectedModel` - Active AI model
- `availableModels` - Models loaded for the current provider
- `providerStatuses` - Connection status of each provider

**Diff State** (stored on diff tab's `IFile` entry):

Diff state is no longer global — it lives on each diff tab's `IFile` object:
- `file.viewMode` - Set to `'diff'` for diff tabs
- `file.sourceFileId` - ID of the original file being diffed against
- `file.diffSession.originalContent` - Snapshot of content before AI edits
- `file.diffSession.modifiedContent` - Full AI-modified content
- `file.diffSession.hunks: DiffHunk[]` - Array of individual changes with statuses
- `file.diffSession.currentHunkIndex` - Currently focused hunk for navigation
- `file.diffSession.summary` - AI-provided summary of changes

**Reducer Actions:**
- `OPEN_DIFF_TAB` - Creates a new diff tab with computed hunks, sets it as active, links to source file via `sourceFileId`
- `UPDATE_DIFF_SESSION` - Accepts or rejects a hunk, rebuilds source file content for accepted changes, auto-closes the diff tab when all hunks are resolved
- `CLOSE_DIFF_TAB` - Closes the diff tab without applying remaining pending changes, switches back to the source file

**Helper hooks:**
- `useHasDiffTab(sourceFileId?)` - Returns `true` if any open file is a diff tab referencing the given source file (used to enforce read-only state on the source file)

**Configuration State** (persisted in `config.json`):
- `aiModels` - Per-provider model enable/disable flags
- `aiChatDocked` - Whether the chat panel is docked
- `aiChatDockWidth` - Width of the docked chat panel
