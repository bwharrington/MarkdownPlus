# MarkdownPlus - Feature Roadmap

## Top Priority Features


### 1. Image/Chart Diagram insert AI tool.

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
3. **Spell Check** - Uses built-in Electron APIs, good user value

### General Considerations
- All features should respect the existing theme system (light/dark mode)
- Add keyboard shortcuts for new features
- Update documentation as features are implemented
- Consider adding feature toggles in settings for users who want minimal UI
- Maintain cross-platform compatibility (Windows, macOS, Linux)

---

## Future Enhancements (Lower Priority)

- Search across multiple files
---


