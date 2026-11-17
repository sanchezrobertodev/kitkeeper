; Skillshelf was renamed Kitkeeper in 0.6.0. The installer names its folder, Apps entry, shortcuts and registry keys
; after the product, so installing Kitkeeper would leave Skillshelf installed next to it, still offering the same
; update. This removes the old copy. The app data, which both names share through the unchanged identifier, is never
; touched: the old uninstaller deletes it only when its "Delete app data" box is ticked, and /S never shows that box.
; The binary keeps its name (skillshelf.exe), unlike Mimikit's rename.

; The old uninstaller runs silently, so it would close a running Skillshelf without asking. Ask here, before any file is
; written, the way the installer asks about Kitkeeper itself (passive and silent installs close it without asking).
!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $R5 SHCTX "Software\${MANUFACTURER}\Skillshelf" ""
  ${If} $R5 != ""
    !insertmacro CheckIfAppIsRunning "$R5\${MAINBINARYNAME}.exe" "Skillshelf"
    ; The in-app update skips the folder page and, with no Kitkeeper install to follow yet, would use the default
    ; folder, moving a Skillshelf the user had put elsewhere. Install next to it instead: D:\Apps\Skillshelf becomes
    ; D:\Apps\Kitkeeper. A default install's parent is the default one, so nothing changes for it.
    ReadRegStr $R8 SHCTX "${MANUPRODUCTKEY}" ""
    ${GetParent} $R5 $R9
    ${If} $UpdateMode = 1
    ${AndIf} $R8 == ""
    ${AndIf} $R9 != ""
    ${AndIf} "$R9\${PRODUCTNAME}" != $INSTDIR
      StrCpy $R7 $INSTDIR
      StrCpy $INSTDIR "$R9\${PRODUCTNAME}"
      SetOutPath $INSTDIR
      ; The template's SetOutPath created the default folder; it is still empty.
      RMDir $R7
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ReadRegStr $R1 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\Skillshelf" "UninstallString"
  ReadRegStr $R2 SHCTX "Software\${MANUFACTURER}\Skillshelf" ""
  ${GetRoot} $R2 $R6
  ; Skip while the old folder's drive is unplugged, so a later install tries again.
  ${If} $R2 != ""
  ${AndIf} ${FileExists} "$R6\*.*"
    ; The in-app updater runs this with /UPDATE, which creates no shortcuts, and the uninstall deletes Skillshelf's.
    ; Give back the ones the user had, under the new name.
    StrCpy $R3 0
    StrCpy $R4 0
    ${If} $UpdateMode = 1
      ${IfThen} ${FileExists} "$SMPROGRAMS\Skillshelf.lnk" ${|} StrCpy $R3 1 ${|}
      ${IfThen} ${FileExists} "$DESKTOP\Skillshelf.lnk" ${|} StrCpy $R4 1 ${|}
    ${EndIf}
    ; The same folder however it is spelled (a trailing backslash, a short name, a subst drive): a file made in
    ; $INSTDIR shows up under $R2. Comparing the strings would miss those and run Kitkeeper's own uninstaller below.
    ; The string compare stays for when the file can't be made (a path near the 260-character limit).
    StrCpy $R5 0
    FileOpen $0 "$INSTDIR\kitkeeper-same-folder.tmp" w
    FileClose $0
    ${IfThen} ${FileExists} "$R2\kitkeeper-same-folder.tmp" ${|} StrCpy $R5 1 ${|}
    Delete "$INSTDIR\kitkeeper-same-folder.tmp"
    ${If} $R5 = 1
    ${OrIf} $R2 == $INSTDIR
      ; Installed into the old folder: Kitkeeper already replaced skillshelf.exe and uninstall.exe there, so the
      ; Skillshelf entry in Apps would uninstall Kitkeeper. Only the old name goes; no file is deleted.
      DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\Skillshelf"
      DeleteRegKey SHCTX "Software\${MANUFACTURER}\Skillshelf"
    ${Else}
      ; The uninstall deletes the login item, which Kitkeeper keeps under the old name (the autostart plugin in
      ; lib.rs). Put it back pointing at Kitkeeper, the way auto-launch writes it, so it works before Kitkeeper is
      ; first opened. A Task Manager "Disabled" lives in StartupApproved, which the uninstall leaves, so it holds.
      ReadRegStr $R7 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Skillshelf"
      ${If} $R1 != ""
      ${AndIf} ${FileExists} "$R2\uninstall.exe"
        ; _?= runs it in place so ExecWait waits for it.
        ExecWait '$R1 /S _?=$R2'
      ${EndIf}
      ${If} $R7 != ""
        WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Skillshelf" "$INSTDIR\${MAINBINARYNAME}.exe --hidden"
      ${EndIf}
      ; Turned on with an admin token, the login item is in HKLM, which the uninstall leaves pointing at the old exe.
      ; Without admin rights that write fails, so it goes in HKCU instead, where it starts Kitkeeper all the same,
      ; unless Task Manager has it "Disabled" in HKLM (StartupApproved, odd first byte), which HKCU would not inherit.
      ReadRegStr $R8 HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Skillshelf"
      ${If} $R8 != ""
        ClearErrors
        WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Skillshelf" "$INSTDIR\${MAINBINARYNAME}.exe --hidden"
        ${If} ${Errors}
          ; ReadRegStr can't read REG_BINARY. 0x10008 = RRF_RT_REG_BINARY | RRF_SUBKEY_WOW6464KEY.
          StrCpy $6 0
          System::Alloc 16
          Pop $9
          System::Call 'advapi32::RegGetValueW(p 0x80000002, w "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run", w "Skillshelf", i 0x10008, p 0, p r9, *i 16) i .r8'
          ${If} $8 = 0
            System::Call '*$9(&i1 .r6)'
          ${EndIf}
          System::Free $9
          IntOp $6 $6 & 1
          ${If} $6 = 0
            WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Skillshelf" "$INSTDIR\${MAINBINARYNAME}.exe --hidden"
          ${EndIf}
        ${EndIf}
        ClearErrors
      ${EndIf}
      ; The Skillshelf entry in Apps goes even if files are left: its uninstaller's "Delete app data" box would delete
      ; Kitkeeper's data too.
      DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\Skillshelf"
      ; Whatever the uninstaller left (it can't delete itself in place), or all of it when there was none to run. A
      ; skillshelf.exe that couldn't be closed keeps the folder key, so the next install deletes the rest.
      Delete "$R2\${MAINBINARYNAME}.exe"
      ${IfNot} ${FileExists} "$R2\${MAINBINARYNAME}.exe"
        Delete "$R2\uninstall.exe"
        RMDir "$R2"
        DeleteRegKey SHCTX "Software\${MANUFACTURER}\Skillshelf"
      ${EndIf}
    ${EndIf}
    ; Explorer can have a shortcut open for a moment, while it loads the desktop icons, and Delete fails then. The
    ; old uninstaller doesn't retry either. Try again for up to 5 seconds.
    ${For} $0 1 20
      Delete "$SMPROGRAMS\Skillshelf.lnk"
      Delete "$DESKTOP\Skillshelf.lnk"
      ${IfNot} ${FileExists} "$SMPROGRAMS\Skillshelf.lnk"
      ${AndIfNot} ${FileExists} "$DESKTOP\Skillshelf.lnk"
        ${ExitFor}
      ${EndIf}
      Sleep 250
    ${Next}
    ${If} $R3 = 1
      CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
      !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    ${EndIf}
    ${If} $R4 = 1
      CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
      !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
    ${EndIf}
  ${EndIf}
!macroend

; The template deletes the login item named after the product (Kitkeeper), but Kitkeeper's keeps the old name.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Skillshelf"
    ; Only with an admin token; otherwise it fails and changes nothing.
    DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Skillshelf"
    ClearErrors
  ${EndIf}
!macroend
