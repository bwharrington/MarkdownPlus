; Custom NSIS installer script for MarkdownPlus
; This adds MarkdownPlus to the Windows "Open with" context menu list

!macro customInstall
  ; Register MarkdownPlus in the Applications registry
  WriteRegStr SHCTX "SOFTWARE\Classes\Applications\${PRODUCT_FILENAME}" "FriendlyAppName" "${PRODUCT_NAME}"
  WriteRegStr SHCTX "SOFTWARE\Classes\Applications\${PRODUCT_FILENAME}\shell\open\command" "" '"$INSTDIR\${PRODUCT_FILENAME}" "%1"'
  WriteRegStr SHCTX "SOFTWARE\Classes\Applications\${PRODUCT_FILENAME}\DefaultIcon" "" "$INSTDIR\${PRODUCT_FILENAME},0"
  WriteRegStr SHCTX "SOFTWARE\Classes\Applications\${PRODUCT_FILENAME}\SupportedTypes" ".md" ""
  
  ; Add MarkdownPlus to the OpenWithList for .md files
  WriteRegStr SHCTX "SOFTWARE\Classes\.md\OpenWithList\${PRODUCT_FILENAME}" "" ""
  
  ; Add to OpenWithProgids
  WriteRegStr SHCTX "SOFTWARE\Classes\.md\OpenWithProgids" "${PRODUCT_NAME}.md" ""
  
  ; Register the ProgId
  WriteRegStr SHCTX "SOFTWARE\Classes\${PRODUCT_NAME}.md" "" "Markdown Document"
  WriteRegStr SHCTX "SOFTWARE\Classes\${PRODUCT_NAME}.md\DefaultIcon" "" "$INSTDIR\${PRODUCT_FILENAME},0"
  WriteRegStr SHCTX "SOFTWARE\Classes\${PRODUCT_NAME}.md\shell\open\command" "" '"$INSTDIR\${PRODUCT_FILENAME}" "%1"'
  
  ; Add application capabilities for Windows 7+
  WriteRegStr SHCTX "SOFTWARE\${PRODUCT_NAME}\Capabilities" "ApplicationDescription" "A multi-tab Markdown editor with live preview"
  WriteRegStr SHCTX "SOFTWARE\${PRODUCT_NAME}\Capabilities" "ApplicationName" "${PRODUCT_NAME}"
  WriteRegStr SHCTX "SOFTWARE\${PRODUCT_NAME}\Capabilities\FileAssociations" ".md" "${PRODUCT_NAME}.md"
  WriteRegStr SHCTX "SOFTWARE\RegisteredApplications" "${PRODUCT_NAME}" "SOFTWARE\${PRODUCT_NAME}\Capabilities"
!macroend

!macro customUnInstall
  ; Remove registry entries on uninstall
  DeleteRegKey SHCTX "SOFTWARE\Classes\Applications\${PRODUCT_FILENAME}"
  DeleteRegValue SHCTX "SOFTWARE\Classes\.md\OpenWithList" "${PRODUCT_FILENAME}"
  DeleteRegValue SHCTX "SOFTWARE\Classes\.md\OpenWithProgids" "${PRODUCT_NAME}.md"
  DeleteRegKey SHCTX "SOFTWARE\Classes\${PRODUCT_NAME}.md"
  DeleteRegKey SHCTX "SOFTWARE\${PRODUCT_NAME}"
  DeleteRegValue SHCTX "SOFTWARE\RegisteredApplications" "${PRODUCT_NAME}"
!macroend
