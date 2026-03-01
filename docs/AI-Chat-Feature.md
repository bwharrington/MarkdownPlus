# Nexus Feature Documentation 1.2

This document describes the Nexus feature in Markdown Nexus, covering configuration, the chat dialog, edit mode, diff visualization, and the underlying architecture.

---

## Table of Contents 1.2

1. [Overview](#overview)
2. [Configuration](#configuration)
   - [API Key Setup](#api-key-setup)
   - [Model Selection](#model-selection)
   - [Model Filtering](#model-filtering)
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
5. [Research Mode](#research-mode)
   - [Activating Research Mode](#activating-research-mode)
   - [How Research Works](#how-research-works)
   - [Research Output](#research-output)
6. [Go Deeper Mode](#go-deeper-mode)
   - [Activating Go Deeper](#activating-go-deeper)
   - [How Go Deeper Works](#how-go-deeper-works)
   - [Topic Selection](#topic-selection)
   - [Go Deeper Output](#go-deeper-output)
   - [Loading States — Nexus Progress Stepper](#loading-states--nexus-progress-stepper-1)
   - [Cancellation](#cancellation-1)
   - [Debugging & Logging](#debugging--logging-1)
7. [Supported AI Providers](#supported-ai-providers)
   - [Claude (Anthropic)](#claude-anthropic)
   - [OpenAI](#openai)
   - [Google Gemini](#google-gemini)
   - [xAI (Grok)](#xai-grok)
8. [Architecture](#architecture)
   - [File Structure](#file-structure)
   - [IPC Communication](#ipc-communication)
   - [State Management](#state-management)

---

## Overview

The Nexus feature allows users to interact with AI language models directly within the Markdown Nexus editor. It supports four modes:

- **Chat Mode**: A conversational interface for asking questions, brainstorming, or getting help with writing. The AI sees the current document as context and responds in a chat bubble format.
- **Edit Mode**: The AI modifies the current markdown document based on user instructions. Changes are presented in a **dedicated diff tab** with a unified inline diff view, where the user can accept or reject changes on a per-hunk basis.
- **Research Mode**: Deep research on any topic. The AI performs a multi-phase process — first inferring the target audience and relevant fields, then generating a comprehensive, structured research report with automatic deepening passes. The output opens as a new markdown file tab in preview mode.
- **Go Deeper Mode**: Expands and enriches an existing research report. The AI analyzes the document, suggests expansion topics, lets the user select which to pursue, then generates exhaustive addendums and merges them back into a versioned document.

Four AI providers are supported: **Claude (Anthropic)**, **OpenAI**, **Google Gemini**, and **xAI (Grok)**. Edit mode is supported by Claude, OpenAI, and Gemini. Research mode is supported by all four providers. Go Deeper mode is supported by all four providers. xAI is restricted from Edit mode only (structured output not yet available). Each provider's models are filtered at the API level to surface only the models relevant for chat use.

---

## Configuration

### API Key Setup

API keys are configured in **Settings** (gear icon in the toolbar). The AI API Keys section provides input fields for each provider:

- **Claude** - Requires an Anthropic API key
- **OpenAI** - Requires an OpenAI API key
- **Google Gemini** - Requires a Google Gemini API key
- **xAI** - Requires an xAI API key

For each provider:

1. Enter the API key in the password field
2. Click **Set** to validate and store the key
3. The key is validated with a test API call before being stored
4. A status chip indicates the connection state:
   - **"Connected"** (green) — Key is stored and the provider API is reachable
   - **"Set"** (red) — Key is stored but the provider returned an error
5. Click **Clear** to remove a stored key
6. Click the **refresh** icon (spinning arrows) next to Clear to re-test the connection and see a toast with the result

Provider statuses are automatically refreshed whenever you set or clear an API key.

**Development Override**: During development, API keys can be set via environment variables in a `.env` file:

- `ANTHROPIC_API_KEY` for Claude
- `OPENAI_API_KEY` for OpenAI
- `GEMINI_API_KEY` for Google Gemini
- `XAI_API_KEY` for xAI

Environment variable values take precedence over keys stored in secure storage.

### Model Selection

Once an API key is configured for a provider, an **AI Models** section appears in Settings. Each provider has an expandable accordion containing checkboxes to enable or disable individual models.

**Default fallback models** (used when the provider API cannot be reached):

| Provider | Models                                                                  |
| -------- | ----------------------------------------------------------------------- |
| Claude   | Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5                   |
| OpenAI   | GPT-5.2, GPT-5.1, GPT-5, GPT-5 Mini, GPT-4o Latest, o3, o4 Mini       |
| Gemini   | Gemini 3 Pro Preview, Gemini 3 Flash Preview                            |
| xAI      | Grok 4, Grok 4.1, Grok 4.1 Reasoning                                   |

The application queries each provider's API for dynamically available models. Models returned from the API are first filtered at the provider level to remove irrelevant variants (see [Model Filtering](#model-filtering) below), then further filtered based on the user's enabled/disabled configuration stored in `config.json` under the `aiModels` key.

### Model Filtering

Each provider applies automatic filtering to its API model list to surface only models useful for chat interactions. This prevents embedding models, image-generation variants, dated snapshots, and other non-chat models from cluttering the model dropdown.

**Claude:**

- Only models starting with `claude-` are included
- Old Claude 3 base generation (pre-3.5) models are excluded — models starting with `claude-3-` are filtered out, keeping `claude-3-5+`, `claude-3-7+`, `claude-4+`, etc.

**OpenAI:**

- GPT-5 family models are included via an explicit allowlist (`gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5.1`, `gpt-5.2`); ChatGPT-specific `-chat-latest` aliases are excluded
- GPT chat models outside the GPT-5 family are included only when they use the `-latest` rolling alias (e.g., `gpt-4o-latest`); dated snapshots and audio/search variants are excluded
- O-series reasoning models are included only as base IDs (e.g., `o3`, `o4-mini`, `o4-pro`)

**Google Gemini:**

- Only models that support `generateContent` and start with `gemini-` are included (drops PaLM, Gemma, LearnLM, Imagen, AQA, etc.)
- Embedding models, image-generation variants (`-image`), and image-only models are excluded
- Pinned dated snapshots (e.g., `exp-03-25`, `exp-0827`), numbered versions (`-001`, `-002`), and `-latest` aliases are excluded (the bare model name already serves as the rolling alias)

**xAI:**

- Only models starting with `grok-4` are included
- Image, video, and image-generation variants (`image`, `video`, `imagine`) are excluded

### Secure Storage

API keys are encrypted using Electron's `safeStorage` API, which uses the OS-native credential store:

| Platform | Encryption Method           |
| -------- | --------------------------- |
| Windows  | DPAPI (Data Protection API) |
| macOS    | Keychain                    |
| Linux    | libsecret                   |

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
- Provider auto-selection priority: saved provider → Claude → OpenAI → Gemini → xAI

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
- **Code blocks with syntax highlighting**: Fenced code blocks (e.g., ` ```javascript `) are rendered with language-aware syntax highlighting using `react-syntax-highlighter` with Prism. Colors adapt to light/dark theme (oneLight / oneDark)

The message area automatically scrolls to the latest message using smooth scrolling.

**Clearing Chat:**

- Click the delete icon in the dialog header
- A confirmation dialog appears before clearing all messages
- Clears all messages and any error state

### File Attachments

The chat supports file attachments for providing additional context. Files can be attached automatically, from the attachment popover, or from the tab bar context menu.

**Context Document (auto-attached active file):**

- When the chat dialog opens, the currently active file is automatically attached as the **context document**
- A chip labeled with the file name and a visibility (eye) icon appears in the attachments area
- The context document can be toggled visible/hidden via its eye icon — hidden context documents are not sent to the AI
- When the active file changes (by switching tabs), the newly active file becomes the context document and inherits the eye icon. The previously active file remains in the attachment list as a regular attachment that can be removed
- When the context document is saved while attached, the attachment chip shows a blue glow animation to indicate the content has been updated

**Attach File Popover:**

Clicking the attachment icon (paperclip) next to the text input opens a popover with two sections:

1. **"Files and Folders"** — Opens the native file dialog to browse and select files from the computer (multi-select supported)
2. **Open Files List** — Shows all currently open editor tabs (excluding diff tabs) with per-file actions:
   - **Context document**: Displays an eye icon (filled when visible, outline when hidden). Clicking toggles visibility on/off
   - **Already manually attached**: The file is hidden from the list since it already appears as a removable chip below the input
   - **Available to attach**: Displays a green plus (+) icon. Clicking attaches the file
   - **Unsaved files** (no path on disk): Shown as disabled/greyed out and cannot be attached

The popover has a maximum height of 360px and scrolls when the file list is long. A close button (X) appears in the top-right corner.

**Tab Bar Context Menu:**

Right-clicking a file tab shows AI attachment options:

- **For the context document**: A "Hide/Show *filename* from AI" option with the corresponding eye icon. This toggles the context document's visibility without removing it
- **For other files**: An "Attach/Remove *filename*" option. Files not yet attached show a green plus icon; already-attached files show a red minus icon
- Diff tabs and unsaved files (no path) are excluded from these options

**Supported File Types:**

- **Text files**: `.txt`, `.md`, `.markdown`, `.json`, `.js`, `.ts`, `.tsx`, `.jsx`, `.css`, `.html`, `.xml`, `.yaml`, `.yml`, `.log` — sent inline as `[File: filename]\ncontent` in the message
- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp` — Base64-encoded and sent with their MIME type using provider-specific image formats

### Loading Indicators

#### Nexus Aura

While any AI request is active, the Nexus panel displays the **Nexus Aura** — a continuously rotating conic gradient that sweeps around the outer border of the panel in a loop of deep blue → cyan → white → gold → amber → white → cyan → deep blue. It is implemented as a 3px masked pseudo-element (`conic-gradient` driven by a CSS custom property `--border-angle` that animates from 0° to 360°) layered on top of the panel border. The Nexus Aura is visible in every mode (Chat, Edit, Research, Go Deeper, Insight Forge) and stops as soon as the request completes or is cancelled.

**Chat Mode:**

- A centered `CircularProgress` spinner appears in the messages area while waiting for a response

**Edit Mode:**

- A green `CircularProgress` spinner appears in the messages area with a typewriter-animated loading message
- The send button itself also shows a spinner while the edit request is in progress
- Messages rotate every 5 seconds from a pool of 15 playful messages (e.g., "Boldly formatting my thoughts...", "Markdown magic in progress...", "Syntax sorcery loading...")
- Each character appears with a 30ms delay for a typewriter effect
- Messages use a shuffle-bag pattern so no message repeats until all have been shown

**Research Mode:**

- The send button shows a spinner while research is in progress
- The **Nexus Progress Stepper** is displayed in the messages area (see [Loading States — Nexus Progress Stepper](#loading-states--nexus-progress-stepper) in the Research Mode section)

**Provider/Model Loading:**

- When provider statuses are being fetched on startup, a centered spinner appears in place of the chat UI
- When models are being loaded for a selected provider, a loading indicator is shown in the model dropdown

---

## Edit Mode and Diff System

### Activating Edit Mode

- Toggle the **Edit Mode** switch in the chat dialog (between the model dropdown and the input area)
- When active, the send button turns green and shows an edit icon instead of a send icon
- The placeholder text changes to "Describe the changes..."
- Edit mode is supported for **Claude**, **OpenAI**, and **Google Gemini** providers. When xAI is selected, edit mode is disabled and a warning chip is displayed
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
4. Claude uses `max_tokens: 16384` for edit requests (vs 4096 for chat) to accommodate full document rewrites. OpenAI uses `response_format: { type: 'json_object' }` to enforce JSON output. Gemini uses `response_mime_type: 'application/json'` for guaranteed JSON responses, with the system prompt prepended as the first user message (Gemini's `generateContent` API does not have a dedicated system role).

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

| Element                  | Appearance                                                                  |
| ------------------------ | --------------------------------------------------------------------------- |
| Unchanged lines          | Normal rendering, no special styling                                        |
| Removed lines (original) | Red background tint, red left border (3px), strikethrough text, 70% opacity |
| Added lines (new)        | Green background tint, green left border (3px)                              |
| Current hunk (focused)   | Blue outline (2px) around the entire hunk                                   |

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
- A global notification toast appears: *"AI changes applied. Remember to save your file (Ctrl+S)."* — this uses the app-level `SHOW_NOTIFICATION` dispatch so it survives the diff tab unmounting
- If the diff tab is closed manually (or via Escape), no changes are applied to the source file

### Keyboard Shortcuts

While a diff tab is active, the following keyboard shortcuts are available:

| Key                    | Action                                 |
| ---------------------- | -------------------------------------- |
| `J` or `ArrowDown` | Navigate to next change                |
| `K` or `ArrowUp`   | Navigate to previous change            |
| `Enter` or `Y`     | Accept (keep) current change           |
| `Backspace` or `N` | Reject (undo) current change           |
| `Ctrl+Shift+A`       | Accept all pending changes             |
| `Escape`             | Close diff tab and discard all changes |

Navigation auto-scrolls to bring the focused hunk into view.

### Source File Protection

While a diff tab is open for a file, the source file's tab is placed in a **read-only state**:

- The editor content is dimmed (70% opacity)
- All editing interactions are disabled (typing, paste, drag-and-drop, keyboard shortcuts)
- The cursor changes to `default` to indicate non-editable state
- Toolbar insert, undo, and redo actions are disabled

This prevents conflicts between manual edits and the pending diff changes. Once the diff tab is closed (either by resolving all hunks or by canceling), normal editing resumes.

---

## Research Mode

### Activating Research Mode

- Select **Research** from the Mode dropdown in the Nexus panel
- Research mode is supported for all four providers: **Claude**, **OpenAI**, **Google Gemini**, and **xAI**
- The input placeholder changes to "Enter a research topic..." and the send button shows a telescope icon with an info-blue color

### How Research Works

Research mode uses a **multi-phase AI flow** with dynamic deepening to produce comprehensive, structured research reports:

**Phase 1 — Pre-Prompt Inference (Automatic):**

When the user submits a research topic, a quick preliminary LLM call analyzes the topic to infer:
- **Target audience** (e.g., "mid-level software engineers building AI apps")
- **Relevant fields** (e.g., technology, databases, software engineering)
- **Focus areas** (key angles to explore)
- **Deep dive topics** (4-6 specific technical concepts to explore in depth)

The user's full message serves as both the topic and the user intent — no separate input is needed. This inference step uses the same provider and model the user has selected. If inference fails (e.g., invalid JSON response), sensible defaults are used automatically.

**Phase 2 — Main Research Call:**

The inferred metadata (audience, fields, focus areas, deep dive topics) is injected into a comprehensive research prompt template that instructs the AI to produce a detailed, structured research report. The template enforces:
- Depth-first analysis with historical context, current state, and future projections
- Technical mastery with code examples, architectures, and implementation guides
- Dedicated deep dive sections for each inferred topic
- Truth-seeking with source citations and confidence ratings
- Strategic value tailored to the inferred audience

**Phase 3 — Dynamic Deepening (Multi-Turn Chaining):**

After the main research call, automatic follow-up calls expand the technical sections based on the inferred deep dive topics:

- Deep dive topics are **batched into groups of 2** per follow-up call
- Up to **3 deepening calls** maximum (covering up to 6 topics)
- The number of calls is dynamic: `Math.min(Math.ceil(topics.length / 2), 3)`
- Each deepening call asks the AI for exhaustive coverage of its batch: internals, code examples, pitfalls, best practices, and latest updates
- If no deep dive topics were inferred, deepening is skipped entirely

**Graceful degradation:** If any deepening call fails, the base report plus any successful deepening results are still used. The research never fails due to a deepening error.

**Final merge:** The base report and all successful deepening responses are concatenated with a horizontal rule separator (`---`) to form the final document.

**Phase 4 — Filename Inference:**

After the research content is assembled, a final lightweight LLM call generates a descriptive filename for the tab:
- The AI is prompted to return a short, descriptive Title Case filename (max 50 chars, no extension)
- The response is sanitized (invalid characters removed, length truncated to 60 chars)
- **Graceful fallback:** If the naming call fails, the tab uses the legacy format `Research - <topic snippet>.md`

### Research Output

The merged AI response is opened as a **new markdown file tab** in preview mode:
- Tab name: AI-inferred descriptive name with `.md` extension (e.g., `React Hooks Deep Dive.md`)
- Falls back to `Research - <topic snippet>.md` if naming fails
- File is virtual (not saved to disk) with `path: null`
- Opens in preview mode for immediate reading
- Can be saved to disk using Ctrl+S / Save As

### Output Structure

The research report follows a standardized markdown format:
- **Executive Summary**: 4-6 bullet takeaways
- **Historical Evolution**: Timeline of milestones
- **Current State**: Landscape, leaders, metrics
- **Key Debates & Risks**: Pros/cons, controversies
- **Engineering & Implementation Guide**: Code examples, architectures, tools, plus dedicated deep dive subsections for inferred topics
- **Future Horizons**: 2026-2030 projections
- **Actionable Playbook**: Recommendations, experiments
- **Sources & Rigor**: References, confidence matrix
- **Extended Technical Deep Dive** (appended from deepening calls): Exhaustive coverage of each deep dive topic with production-ready code, pitfalls, and comparative analysis

### Loading States — Nexus Progress Stepper

During research, the chat panel shows the **Nexus Progress Stepper** (`ResearchProgress` component) — a vertical timeline that visualizes all four phases as a sequence of steps:

```
● Analyzing Topic                    ✓ 2.1s
  "Identifying key research angles..."
  ┌──────────────────────────────────┐
  │ Audience: mid-level engineers    │
  │ Fields: React, TypeScript        │
  │ Topics: useEffect, useMemo ...   │
  └──────────────────────────────────┘

◉ Compiling Research Report          ⟳ active
  "Synthesizing findings..."

○ Expanding Depth (0/3)              pending

○ Generating Filename                pending
```

**Step indicators:**
- **Pending** (grey dot): Phase not yet started, label dimmed
- **Active** (pulsing blue dot): Currently running, shows typewriter-animated message with blinking cursor
- **Complete** (green checkmark): Phase finished, shows elapsed time badge (e.g., "2.1s")

**Phase-specific typewriter messages** rotate every 5 seconds:
- **Inference**: "Analyzing your topic...", "Identifying key research angles...", "Mapping the knowledge landscape..."
- **Researching**: "Compiling research report...", "Synthesizing findings...", "Building executive summary..."
- **Deepening**: "Expanding technical deep dive...", "Adding code examples and patterns..." with a progress counter showing "(1/3)", "(2/3)", etc.
- **Naming**: "Generating filename...", "Picking the perfect title...", "Naming your report..."

**Metadata cards:** After inference completes, a bordered card appears showing the AI-inferred audience, fields (as chips), and deep dive topics (as info-colored chips).

Each message appears with a typewriter effect (30ms per character) and a blinking cursor.

### Cancellation

Research requests can be canceled at any time using the Cancel button. All in-flight API calls (inference, research, deepening, and naming calls) are aborted.

### Debugging & Logging

All research phases are logged to the browser console with `[Research]` prefix, including:
- Phase transitions with elapsed time
- Inference results (audience, fields, deep dive topics)
- Response lengths for each API call
- Deepening batch details (which topics, batch number)
- Errors with the phase where failure occurred

Open DevTools (Ctrl+Shift+I) to view these logs for troubleshooting.

---

## Go Deeper Mode

Go Deeper is a multi-phase AI workflow that **expands and enriches an existing research report**. Where Research Mode creates a new document from scratch, Go Deeper takes an open file and generates exhaustive addendums on selected topics, merges them structurally, and versions the file in place.

### Activating Go Deeper

Go Deeper is triggered by a **"Go Deeper" button** that appears in the chat panel after a Research Mode run completes. It operates on whichever file is currently active in the editor.

### How Go Deeper Works

Go Deeper runs four sequential AI phases:

**Phase D1 — Report Analysis (Automatic):**

When the user clicks "Go Deeper", the AI receives the full document content and topic to identify the best expansion opportunities. The AI returns structured JSON with:
- **New focus areas** — 2-4 key angles to expand (comma-separated)
- **Deep dive topics** — 5-8 high-value technical/strategic topics deserving exhaustive new coverage
- **Suggested depth level** — `practitioner` or `expert`
- **Changelog ideas** — 4-6 short bullets previewing what will be added

After analysis completes, the workflow **pauses** at topic selection. The Nexus Aura and loading state remain active during this pause.

**Phase D2 — Topic Selection (User Interaction):**

The progress panel replaces the active step's typewriter message with an interactive `GoDeepTopicSelector` component. It presents two sections:

- **AI-Suggested Topics** — topics from the Phase D1 analysis, all pre-checked by default
- **Document Topics** — extracted from the document's `##` and `###` headings (up to 8), filtered to exclude structural headings (changelog, references, appendix, etc.) and deduplicated against AI suggestions. All unchecked by default.

The user selects any combination and clicks **"Continue with N topic(s)"** to proceed. At least one topic must be selected.

**Phase D3 — Deep Dive Expansion:**

Selected topics are **batched into groups of 3** (up to 4 batches maximum, covering up to 12 topics). For each batch the AI generates a rich standalone addendum targeting:
- Latest 2025–2026 developments and changes
- Advanced internals, mechanics, and under-the-hood details
- Production battle stories, failure modes, and edge cases with solutions
- More sophisticated, production-ready code examples
- Quantitative insights, benchmarks, or comparisons
- Alternative implementations and trade-offs

Each addendum starts with a `## Deep Dive Addendum — <date>` heading. Failed batches are skipped gracefully; successful results are still used.

**Phase D4 — Integration:**

Two sub-steps run in sequence:
1. A lightweight AI call generates a concise changelog bullet list (4–8 bullets) summarizing what was added. Falls back to the `changelogIdeas` from Phase D1 if this call fails.
2. The final document is assembled: `original report` + `---` + `addendums` + `---` + `## Changelog (Deepened vN)` section.

**Phase D5 — Finalization (Filename & Versioning):**

A final AI call generates a new descriptive filename (Title Case, max 60 chars, no extension) reflecting that the document has been deepened. The result is sanitized and a version suffix (`v2`, `v3`, etc.) is appended if not already present. The file is updated in-place via `EditorContext`:
- Content replaced with the merged final document
- Filename updated to the versioned name
- Tab selected and brought into focus
- Success notification shown

### Topic Selection

The `GoDeepTopicSelector` component uses the `extractDocumentTopics` utility ([src/renderer/utils/extractDocumentTopics.ts](src/renderer/utils/extractDocumentTopics.ts)) to parse `##` and `###` headings from the active document. It excludes structural sections matching 24 patterns (e.g., changelog, sources, references, appendix, executive summary, etc.) and deduplicates against AI-suggested topics using fuzzy substring matching. Results are capped at 8 document topics.

### Go Deeper Output

- The active file is **modified in-place** (not a new tab)
- Filename is versioned: `Report Title v2.md`, `Report Title v3.md`, etc.
- The file is marked dirty — save manually with Ctrl+S / Save As
- Document structure: original content + deep dive addendums + changelog section, separated by `---` dividers

### Loading States — Nexus Progress Stepper

During Go Deeper, the chat panel shows the **Nexus Progress Stepper** (`GoDeepProgress` component) with six steps:

```
● Analyzing Report                   ✓ 3.2s
  ┌──────────────────────────────────┐
  │ Focus: latest developments, ...  │
  │ Topics: [Chip] [Chip] [Chip]     │
  │ Depth:  expert                   │
  │ Changes: - Added section on ...  │
  └──────────────────────────────────┘

◉ Select Topics                      ⟳ active (user pause)
  AI-Suggested Topics
      ☑ React Server Components
      ☑ Suspense Boundaries
      ...
  Document Topics
      ☐ useCallback Deep Dive
      ...
  [ Continue with 4 topic(s) ]

○ Expanding Depth (0/3)             pending

○ Integrating Content               pending

○ Finalizing Document               pending

○ Go Deeper Complete                pending
```

**Step indicators:**
- **Pending** (grey dot): Phase not yet started, label dimmed
- **Active** (pulsing blue dot + glow): Currently running; shows rotating typewriter message with blinking cursor
- **Complete** (green checkmark dot): Phase finished; shows elapsed time badge (e.g., `3.2s`)
- **Select Topics**: No typewriter — replaced by the interactive `GoDeepTopicSelector`

**After Analysis completes**, a metadata card appears under "Analyzing Report" showing focus areas, suggested topics as info-colored chips, suggested depth level, and a preview of changelog ideas.

**Expanding Depth** shows a batch counter in the label: `Expanding Depth (1/4)`, `(2/4)`, etc.

**Go Deeper Complete** shows the total elapsed time across all phases when finished.

**Phase-specific typewriter messages** rotate every 5 seconds:
- **Analyzing**: "Analyzing current report...", "Scanning for gaps and opportunities...", "Mapping expansion potential...", "Evaluating depth coverage...", "Identifying high-value topics..."
- **Expanding**: "Expanding technical deep dive...", "Adding latest developments...", "Building advanced examples...", "Enriching with production insights...", "Deepening coverage..."
- **Integrating**: "Merging new insights...", "Weaving content together...", "Building cohesive narrative...", "Integrating addendums...", "Polishing transitions..."
- **Finalizing**: "Generating updated filename...", "Versioning the document...", "Preparing final output..."

### Cancellation

Go Deeper requests can be canceled at any time using the Cancel button. The cancel handler aborts all in-flight API calls: analysis, each expansion batch (up to 4), the integration/changelog call, and the naming call. The error state shows "Go Deeper request canceled".

### Debugging & Logging

All Go Deeper phases are logged to the browser console with `[GoDeeper]` prefix, including:
- Phase transitions with elapsed time from start
- Analysis results (focus areas, topics, depth level)
- Expansion batch details (topics per batch, response lengths)
- Integration and changelog generation results
- Filename generation (raw AI response, sanitized result, final filename, version number)
- Total elapsed time on completion

Open DevTools (Ctrl+Shift+I) to view these logs for troubleshooting.

---

## Supported AI Providers

### Claude (Anthropic)

- **API Endpoint**: `https://api.anthropic.com/v1/messages`
- **Authentication**: `X-Api-Key` header
- **API Version**: `2023-06-01`
- **Default Fallback Models**: Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5
- **Chat Token Limit**: 4,096 max output tokens
- **Edit Token Limit**: 16,384 max output tokens
- **Edit Mode**: Supported (uses system prompt for structured JSON output)
- **Research Mode**: Supported
- **Image Attachments**: Native format with `media_type` and base64 `data`
- **Model Filtering**: Only `claude-` models are included; old Claude 3 base generation (pre-3.5) models are excluded
- **Validation**: Test call to `/v1/models` endpoint
- **Error Logging**: Full error response body is captured and logged for debugging API issues

### OpenAI

- **API Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Authentication**: `Bearer` token in `Authorization` header
- **Default Fallback Models**: GPT-5.2, GPT-5.1, GPT-5, GPT-5 Mini, GPT-4o Latest, o3, o4 Mini
- **Edit Mode**: Supported (uses `response_format: { type: 'json_object' }`)
- **Research Mode**: Supported
- **Image Attachments**: Data URL format with `image_url`
- **Model Filtering**: GPT models included only with `-latest` suffix; o-series reasoning models included as base IDs only (e.g., `o1`, `o3`, `o4-mini`)
- **Validation**: Test call to list models endpoint

### Google Gemini

- **API Endpoint**: `https://generativelanguage.googleapis.com/v1beta`
- **Authentication**: `x-goog-api-key` header
- **Default Fallback Models**: Gemini 3 Pro Preview, Gemini 3 Flash Preview
- **Edit Mode**: Supported (uses `response_mime_type: 'application/json'` for JSON mode; system prompt prepended as first user message since Gemini lacks a dedicated system role)
- **Research Mode**: Supported
- **Image Attachments**: Inline data format with `mimeType` and base64 `data` in Gemini's `inlineData` part
- **Text Attachments**: Appended as text parts in the Gemini `parts` array
- **Model Filtering**: Only `gemini-` branded chat models that support `generateContent`; excludes embedding, image-generation, dated snapshot, numbered version, and `-latest` alias variants
- **Validation**: Test call to list models endpoint
- **Role Mapping**: Gemini uses `model` instead of `assistant` for the assistant role

### xAI (Grok)

- **API Endpoint**: `https://api.x.ai/v1/chat/completions`
- **Authentication**: `Bearer` token in `Authorization` header
- **Default Fallback Models**: Grok 4, Grok 4.1, Grok 4.1 Reasoning
- **Edit Mode**: Not supported (no structured output; restricted via `aiProviderModeRestrictions.ts`)
- **Research Mode**: Supported
- **Go Deeper Mode**: Supported
- **Image Attachments**: Data URL format with `image_url` (same as OpenAI format)
- **Text Attachments**: Inline text content format
- **Model Filtering**: Only `grok-4` models; excludes image, video, and image-generation variants
- **Validation**: Test call to list models endpoint

---

## Architecture

### File Structure

**Renderer (React UI):**

| File                                                      | Purpose                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/renderer/components/AIChatDialog.tsx`              | Main chat dialog component, orchestrates sub-components                      |
| `src/renderer/components/ChatMessages.tsx`              | Chat message bubbles with Markdown rendering and sci-fi diff review messages |
| `src/renderer/components/ProviderSelector.tsx`          | Provider and model dropdown selectors with status indicators                 |
| `src/renderer/components/FileAttachmentsList.tsx`       | File attachment chips and context document management                        |
| `src/renderer/components/AttachFilePopover.tsx`         | Popover for attaching open files or browsing from disk                       |
| `src/renderer/components/MessageInput.tsx`              | Message text input, send/edit button, cancel, and attachment popover trigger |
| `src/renderer/components/TabBar.tsx`                    | File tabs with AI attachment context menu (attach/remove, show/hide)         |
| `src/renderer/components/CodeBlock.tsx`                  | Syntax-highlighted code blocks using PrismLight (react-syntax-highlighter)   |
| `src/renderer/components/ResearchProgress.tsx`          | Nexus Progress Stepper for research phase visualization with metadata cards     |
| `src/renderer/components/GoDeepProgress.tsx`            | Nexus Progress Stepper for Go Deeper phase visualization with metadata cards and topic selector |
| `src/renderer/components/GoDeepTopicSelector.tsx`       | Interactive checkbox component for selecting expansion topics during Go Deeper |
| `src/renderer/components/DiffView.tsx`                  | Dedicated diff tab view with unified inline diff rendering                   |
| `src/renderer/components/DiffNavigationToolbar.tsx`     | Floating toolbar for navigating and resolving diff hunks                     |
| `src/renderer/components/DiffHunkControl.tsx`           | Per-hunk inline accept/reject buttons                                        |
| `src/renderer/hooks/useAIChat.ts`                       | Chat state management, message sending, provider/model loading               |
| `src/renderer/hooks/useAIProviderCache.ts`              | App-level provider status and model cache (shared across components)         |
| `src/renderer/hooks/useAIDiffEdit.ts`                   | Edit mode logic, diff computation, opens diff tab                            |
| `src/renderer/hooks/useAIResearch.ts`                   | Research mode logic, two-step inference + research, opens file tab           |
| `src/renderer/hooks/useAIGoDeeper.ts`                   | Go Deeper orchestration: analysis, expansion batches, integration, versioning |
| `src/renderer/hooks/useEditLoadingMessage.ts`           | Typewriter-animated loading messages                                         |
| `src/renderer/utils/extractDocumentTopics.ts`           | Extracts `##`/`###` headings from markdown for Go Deeper topic selection     |
| `src/renderer/aiProviderModeRestrictions.ts`            | Defines which providers are restricted from which chat modes                 |
| `src/renderer/contexts/AIProviderCacheContext.tsx`      | React context for sharing provider cache across the component tree           |
| `src/renderer/utils/diffUtils.ts`                       | Diff computation utilities (line ending normalization, hunk building)        |
| `src/renderer/types/diffTypes.ts`                       | TypeScript interfaces for DiffHunk and DiffSession                           |
| `src/renderer/contexts/EditorContext.tsx`               | State reducer for diff tab actions (open, update, close)                     |

**Main Process (Electron Backend):**

| File                                     | Purpose                                                              |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `src/main/aiIpcHandlers.ts`            | IPC handlers for all AI requests, JSON parsing, model filtering      |
| `src/main/services/claudeApi.ts`       | Claude API integration (chat, edit, model listing, validation)       |
| `src/main/services/openaiApi.ts`       | OpenAI API integration (chat, JSON mode, model listing, validation)  |
| `src/main/services/geminiApi.ts`       | Gemini API integration (chat, JSON mode, model listing, validation)  |
| `src/main/services/xaiApi.ts`          | xAI API integration (chat, model listing, validation)                |
| `src/main/services/secureStorage.ts`   | Encrypted API key storage using Electron safeStorage                 |
| `src/main/secureStorageIpcHandlers.ts` | IPC handlers for API key operations                                  |

### IPC Communication

All AI operations communicate between the renderer and main process via Electron IPC channels:

| Channel                           | Direction        | Purpose                                          |
| --------------------------------- | ---------------- | ------------------------------------------------ |
| `ai:claude-chat-request`        | Renderer → Main | Send chat message to Claude                      |
| `ai:openai-chat-request`        | Renderer → Main | Send chat message to OpenAI                      |
| `ai:gemini-chat-request`        | Renderer → Main | Send chat message to Google Gemini               |
| `ai:chat-request`               | Renderer → Main | Send chat message to xAI                         |
| `ai:edit-request`               | Renderer → Main | Send edit request (Claude, OpenAI, or Gemini)    |
| `ai:cancel-request`             | Renderer → Main | Cancel an active chat request                    |
| `ai:cancel-edit-request`        | Renderer → Main | Cancel an active edit request                    |
| `ai:list-claude-models`         | Renderer → Main | List available Claude models                     |
| `ai:list-openai-models`         | Renderer → Main | List available OpenAI models                     |
| `ai:list-gemini-models`         | Renderer → Main | List available Gemini models                     |
| `ai:list-models`                | Renderer → Main | List available xAI models                        |
| `ai:get-provider-status`        | Renderer → Main | Check all provider connection statuses (4 total) |
| `secure-storage:set-api-key`    | Renderer → Main | Validate and store an API key                    |
| `secure-storage:has-api-key`    | Renderer → Main | Check if a provider has a stored key             |
| `secure-storage:delete-api-key` | Renderer → Main | Remove a stored API key                          |
| `secure-storage:get-key-status` | Renderer → Main | Get storage status of all providers              |

Request cancellation uses `AbortController` instances tracked by unique request IDs. Each active request is stored in a `Map` and can be aborted by calling the corresponding cancel channel.

### State Management

**Provider Cache** (managed by `useAIProviderCache` hook, shared via `AIProviderCacheContext`):

- `providerStatuses: AIProviderStatuses` - Connection status for all four providers (xai, claude, openai, gemini)
- `isStatusesLoaded: boolean` - Whether the initial status fetch has completed
- Model cache per provider (stored in a ref, not in React state) with deduplication of in-flight fetches
- `isLoadingModelsFor(provider)` - Whether models are currently being fetched for a given provider
- `invalidateModelsForProvider(provider)` - Clears cached models when a provider's enabled state changes

**Chat State** (managed by `useAIChat` hook):

- `messages: AIMessage[]` - Full conversation history
- `inputValue: string` - Current text input
- `isLoading: boolean` - Whether a chat request is in progress
- `error: string | null` - Current error message
- `selectedProvider` - Active AI provider (one of `xai`, `claude`, `openai`, `gemini`)
- `selectedModel` - Active AI model
- `availableModels` - Models loaded for the current provider (cache-aware)
- Provider auto-selection priority: saved provider → Claude → OpenAI → Gemini → xAI

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

- `aiModels` - Per-provider model enable/disable flags (providers: `xai`, `claude`, `openai`, `gemini`)
- `aiChatDocked` - Whether the chat panel is docked
- `aiChatDockWidth` - Width of the docked chat panel
- `aiChatMode` - Current AI chat mode (`'chat'`, `'edit'`, or `'research'`). Migrated from legacy `aiChatEditMode` boolean
- `aiChatProvider` - Last selected AI provider
- `aiChatModel` - Last selected AI model

**Provider Mode Restrictions** (defined in `aiProviderModeRestrictions.ts`):

- A static map defines which providers are restricted from which modes
- Currently: xAI is restricted from `edit` mode only (structured output not yet available)
- The UI disables restricted mode options and auto-resets to `chat` when switching to a restricted provider
- The send handler also enforces restrictions at runtime as a safety net
