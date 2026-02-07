# MarkdownPlus - Feature Roadmap

## Top Priority Features

### 1. Export to PDF/HTML
**Priority:** High  
**Status:** Not Started

Export capabilities for sharing and publishing documents.

**Requirements:**
- Export to PDF with customizable styling
- Export to HTML (standalone or with CSS)
- Export to DOCX for Word compatibility
- Print preview functionality
- Direct printing support
- Preserve formatting, images, and diagrams (including Mermaid)
- Custom CSS support for exports

**Technical Considerations:**
- Use Electron's printing API for PDF generation
- Consider libraries like `puppeteer` or `electron-pdf` for advanced PDF features
- HTML export should include embedded CSS and base64-encoded images for standalone files
- DOCX export may require `pandoc` or similar conversion tool

---

### 2. Outline/Document Map
**Priority:** High  
**Status:** Not Started

Sidebar showing document structure for easy navigation in large documents.

**Requirements:**
- Display heading hierarchy (H1-H6) in a collapsible tree view
- Click to jump to sections
- Highlight current section while scrolling
- Drag-and-drop to reorder sections (optional advanced feature)
- Toggle sidebar visibility
- Keyboard shortcut to open/close outline

**Technical Considerations:**
- Parse document headings in real-time
- Sync scroll position with outline selection
- Consider using a ResizableBox for adjustable sidebar width
- Store sidebar state (open/closed, width) in config

---

### 3. Image Paste from Clipboard
**Priority:** High  
**Status:** Not Started

Paste images directly from clipboard with automatic saving.

**Requirements:**
- Paste images from clipboard with `Ctrl+V`
- Auto-save images to a configurable folder (e.g., `./images/` or `./assets/`)
- Generate unique filenames (timestamp or hash-based)
- Automatically insert Markdown image syntax at cursor position
- Support for screenshots, copied images, and image files
- Optional image optimization/compression
- Drag-and-drop image insertion from file explorer

**Technical Considerations:**
- Use Electron's clipboard API to read image data
- Create images folder if it doesn't exist
- Handle relative vs. absolute paths
- Consider image format (PNG, JPEG, WebP)
- Add configuration options for image folder location and naming scheme

---

### 4. Word Count and Statistics
**Priority:** Medium-High  
**Status:** Not Started

Real-time statistics for writers and content creators.

**Requirements:**
- Display word count, character count (with/without spaces)
- Show paragraph and sentence count
- Estimate reading time
- Selection-based counts (show stats for selected text)
- Persistent status bar or toggleable panel
- Update in real-time as user types

**Technical Considerations:**
- Implement efficient counting algorithm (debounced for performance)
- Consider excluding code blocks and front matter from counts
- Add configuration for reading speed (words per minute)
- Display in status bar or dedicated panel
- Option to show/hide statistics

---

### 5. Spell Check
**Priority:** Medium-High  
**Status:** Not Started

Built-in spell checking for professional writing.

**Requirements:**
- Real-time spell checking with red underlines
- Right-click context menu with suggestions
- Custom dictionary support (add words)
- Multiple language support
- Toggle spell check on/off
- Ignore code blocks, URLs, and technical terms
- Grammar suggestions (optional advanced feature)

**Technical Considerations:**
- Use Electron's built-in spell checker API
- Consider integrating external libraries like `nspell` for more control
- Store custom dictionary in user data directory
- Add language selection in settings dialog
- Exclude code blocks, inline code, and URLs from spell checking
- Consider LanguageTool integration for grammar checking

---

## Implementation Notes

### Recommended Order
1. **Word Count and Statistics** - Relatively simple, high user value
2. **Image Paste from Clipboard** - High productivity boost, moderate complexity
3. **Spell Check** - Uses built-in Electron APIs, good user value
4. **Outline/Document Map** - More complex UI work, but essential for large documents
5. **Export to PDF/HTML** - Most complex, but critical for publishing workflows

### General Considerations
- All features should respect the existing theme system (light/dark mode)
- Add keyboard shortcuts for new features
- Update documentation as features are implemented
- Consider adding feature toggles in settings for users who want minimal UI
- Maintain cross-platform compatibility (Windows, macOS, Linux)

---

## Future Enhancements (Lower Priority)

- File tree/sidebar for project management
- Search across multiple files
- Git integration
- Plugin/extension system
- Cloud sync capabilities
- Collaborative editing
- Custom themes and CSS
- Math equation support (LaTeX/KaTeX)
- Footnote support
- Focus/distraction-free mode

---

*Last Updated: February 6, 2026*
