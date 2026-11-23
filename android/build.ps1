# Builds FieldSight from PowerShell:  powershell -ExecutionPolicy Bypass -File android\build.ps1
#   (no switch)  run the unit tests and build the release APK
#   -Debug       build the debug APK instead (uses fieldsight.apiUrl from local.properties)
#   -Install     also install it on a phone connected by USB (USB debugging on)
param([switch]$Debug, [switch]$Install)
$ErrorActionPreference = "Stop"

# The SDK and JDK live outside AppData on purpose (see android/README.md).
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = (Get-ChildItem "C:\Program Files\Microsoft\jdk-21*" | Select-Object -First 1).FullName }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:USERPROFILE\tools\android-sdk" }

Set-Location $PSScriptRoot
$task = if ($Debug) { "assembleDebug" } else { "assembleRelease" }
& .\gradlew.bat --console=plain testDebugUnitTest $task
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$variant = if ($Debug) { "debug" } else { "release" }
$apk = Get-ChildItem "app\build\outputs\apk\$variant\*.apk" | Select-Object -First 1
"{0}  {1:N1} MB" -f $apk.FullName, ($apk.Length / 1MB)

if ($Install) {
    & "$env:ANDROID_HOME\platform-tools\adb.exe" install -r $apk.FullName
}
