!macro customInstall
  DetailPrint "Register docuedti URI Handler"
  DeleteRegKey HKCR "docuedti"
  WriteRegStr HKCR "docuedti" "" "URL:docuedti"
  WriteRegStr HKCR "docuedti" "URL Protocol" ""
  WriteRegStr HKCR "docuedti\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCR "docuedti\shell" "" ""
  WriteRegStr HKCR "docuedti\shell\Open" "" ""
  WriteRegStr HKCR "docuedti\shell\Open\command" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME} %1"
!macroend