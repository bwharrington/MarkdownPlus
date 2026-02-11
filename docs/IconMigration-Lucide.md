# Icon Migration: MUI to Lucide

This project now routes renderer icons through `src/renderer/components/AppIcons.tsx`.

## Sizing strategy

- `fontSize="small"` maps to `20px`.
- `fontSize="medium"` (default) maps to `24px`.
- `fontSize="large"` maps to `35px`.
- Explicit dense UI sizes remain explicit (`size={16}` for tabs, `size={18}` for menu items).

## Mapping inventory

- `FormatBold` -> `Bold`
- `FormatItalic` -> `Italic`
- `FormatStrikethrough` -> `Strikethrough`
- `Code` -> `Code2`
- `Title` -> `Heading1`
- `FormatQuote` -> `TextQuote`
- `FormatListBulleted` -> `List`
- `FormatListNumbered` -> `ListOrdered`
- `CheckBox` -> `SquareCheckBig`
- `Link` -> `Link2`
- `Image` -> `Image`
- `TableChart` -> `Table2`
- `HorizontalRule` -> `Minus`
- `Undo` -> `Undo2`
- `Redo` -> `Redo2`
- `Search` -> `Search`
- `Info` -> `Info`
- `Warning` -> `TriangleAlert`
- `NoteAdd` -> `FilePlus2`
- `FolderOpen` -> `FolderOpen`
- `Save` -> `Save`
- `SaveAs` -> `SaveAll`
- `Close` -> `X`
- `TabUnselected` -> `Files`
- `Settings` -> `Settings`
- `Brightness4` -> `Moon`
- `Brightness7` -> `Sun`
- `Minimize` -> `Minus`
- `CropSquare` -> `Square`
- `BugReport` -> `Bug`
- `Description` -> `FileText`
- `SmartToy` -> `Bot`
- `KeyboardArrowUp` -> `ChevronUp`
- `KeyboardArrowDown` -> `ChevronDown`
- `Check` -> `Check`
- `DoneAll` -> `CheckCheck`
- `DragIndicator` -> `Grip`
- `ExpandLess` -> `ChevronUp`
- `ExpandMore` -> `ChevronDown`
- `Send` -> `SendHorizontal`
- `DeleteOutline` -> `Trash2`
- `Delete` -> `Trash2`
- `AttachFile` -> `Paperclip`
- `Edit` -> `Pencil`
- `WarningAmber` -> `TriangleAlert`
- `Visibility` -> `Eye`
- `VisibilityOff` -> `EyeOff`
- `CheckCircle` -> `CircleCheckBig`
- `Add` (zoom in) -> `Plus`
- `Remove` (zoom out) -> `Minus`
- `CenterFocusStrong` (reset) -> `LocateFixed`
- `OpenWith` (pan) -> `Move`
- `History` -> `History`
