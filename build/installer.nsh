!macro customInstall
  DetailPrint "Register docuedit URI Handler"
  DeleteRegKey HKCR "docuedit"
  WriteRegStr HKCR "docuedit" "" "URL:docuedit"
  WriteRegStr HKCR "docuedit" "URL Protocol" ""
  WriteRegStr HKCR "docuedit\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCR "docuedit\shell" "" ""
  WriteRegStr HKCR "docuedit\shell\Open" "" ""
  WriteRegStr HKCR "docuedit\shell\Open\command" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME} %1"
!macroend

!macro customUnInstall
  DetailPrint "Remove docuedit URI Handler"
  DeleteRegKey HKCR "docuedit"
!macroend