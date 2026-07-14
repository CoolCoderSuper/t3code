# Build an Installable Android APK on Windows

This guide builds the `preview` variant of T3 Code Mobile as a self-contained APK. The preview app is
named `T3 Code Preview`, uses the package ID `com.t3tools.t3code.preview`, and can be installed beside
the development and production variants.

The short build path and hoisted dependency layout in this guide are intentional. React Native native
modules generate deeply nested CMake and Ninja paths. A normal pnpm workspace path can exceed Windows'
effective object-file path limit and fail with an error like:

```text
ninja: error: manifest 'build.ninja' still dirty after 100 tries
```

Enabling Windows long paths or mapping the repository with `subst` is not sufficient in this case:
Java and pnpm can resolve the mapped drive back to its longer physical path.

## Prerequisites

Install the following before starting:

- Git
- Node.js `24.13.1` (the version required by the repository)
- pnpm, available through Corepack
- Android Studio with:
  - Android SDK Platform 36
  - Android SDK Build-Tools 36.0.0
  - Android NDK 27.1.12297006
- JDK 19

The commands below assume these default Windows locations:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-19"
```

Adjust them if the SDK or JDK is installed elsewhere.

## 1. Create a short build worktree

Run these commands from the repository root in PowerShell. Commit the version you want to build first,
because the detached worktree builds `HEAD` and does not include uncommitted changes.

```powershell
$Repo = (Resolve-Path .).Path
$BuildRoot = "C:\t3apkbuild"

if (Test-Path -LiteralPath $BuildRoot) {
  throw "$BuildRoot already exists. Remove or choose a different temporary build path."
}

git worktree add --detach $BuildRoot HEAD
```

Keep `$BuildRoot` close to the drive root. A longer temporary directory can reintroduce the CMake path
problem.

## 2. Install dependencies with a hoisted layout

The `node-linker=hoisted` setting makes native dependencies resolve to short paths such as
`C:\t3apkbuild\node_modules\react-native-reanimated` instead of pnpm's longer encoded virtual-store
paths.

```powershell
Push-Location $BuildRoot
corepack pnpm install --frozen-lockfile --config.node-linker=hoisted
Pop-Location
```

The first install can take several minutes. pnpm may download optional binaries for platforms other
than Windows because this is a multi-platform workspace.

Confirm that Reanimated is a real hoisted directory rather than a link into a long virtual-store path:

```powershell
Get-Item "$BuildRoot\node_modules\react-native-reanimated" |
  Select-Object FullName, LinkType, Target
```

`FullName` should be under `$BuildRoot\node_modules`, and `LinkType` should be empty.

## 3. Generate the Android preview project

The native `android` directory is generated and ignored by Git.

```powershell
$env:APP_VARIANT = "preview"
$env:EXPO_NO_GIT_STATUS = "1"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

Push-Location "$BuildRoot\apps\mobile"
& "$BuildRoot\node_modules\.bin\expo.cmd" prebuild --clean --platform android --no-install
Pop-Location
```

Always rerun the clean prebuild after changing the dependency layout. Expo autolinking records native
module paths in the generated Android project.

## 4. Build the arm64 release APK

Most current Android phones use `arm64-v8a`. Limiting the app to that architecture reduces the APK
size and avoids unnecessary native compilation.

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-19"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:APP_VARIANT = "preview"
$env:NODE_ENV = "production"
$env:NODE_OPTIONS = "--max-old-space-size=4096"

Push-Location "$BuildRoot\apps\mobile\android"
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --stacktrace
Pop-Location
```

The first build can take 15 minutes or more. Deprecation warnings from React Native and Expo
dependencies are expected. Success ends with `BUILD SUCCESSFUL` and produces:

```text
C:\t3apkbuild\apps\mobile\android\app\build\outputs\apk\release\app-release.apk
```

This local preview release is signed with the Android debug certificate. It is installable directly on
a phone, but it is not a production Play Store artifact.

## 5. Copy and verify the APK

Copy the result back to the original repository before deleting the temporary worktree:

```powershell
$ArtifactDirectory = Join-Path $Repo "artifacts"
$Apk = Join-Path $ArtifactDirectory "t3-code-preview-arm64.apk"
$BuildApk = Join-Path $BuildRoot "apps\mobile\android\app\build\outputs\apk\release\app-release.apk"

New-Item -ItemType Directory -Path $ArtifactDirectory -Force | Out-Null
Copy-Item -LiteralPath $BuildApk -Destination $Apk -Force
Get-FileHash -Algorithm SHA256 -LiteralPath $Apk
```

Use the Android SDK tools to verify the signature and inspect the package:

```powershell
$BuildTools = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Directory |
  Sort-Object { [version]$_.Name } -Descending |
  Select-Object -First 1

& (Join-Path $BuildTools.FullName "apksigner.bat") verify --verbose --print-certs $Apk
& (Join-Path $BuildTools.FullName "aapt.exe") dump badging $Apk |
  Select-String "^package:|^native-code:|^sdkVersion:|^targetSdkVersion:|^application-label:"
```

Expected properties include:

- package: `com.t3tools.t3code.preview`
- application label: `T3 Code Preview`
- minimum SDK: `24` (Android 7.0)
- target SDK: `36`
- native code: `arm64-v8a`
- APK Signature Scheme v2: verified

Transfer the APK to the phone, open it, and allow installation from the file manager or browser when
Android prompts for permission.

## 6. Run repository checks

Run the required checks from the original repository:

```powershell
Push-Location $Repo
& .\node_modules\.bin\vp.CMD check
& .\node_modules\.bin\vp.CMD run typecheck
& .\node_modules\.bin\vp.CMD run lint:mobile
Pop-Location
```

The mobile lint command can report that SwiftLint, ktlint, or detekt are unavailable on Windows. The
repository's static mobile checks still run, and missing optional native linters are reported as
warnings.

## 7. Remove the temporary worktree

Stop Gradle before cleanup so its daemon does not retain files from the temporary worktree:

```powershell
Push-Location "$BuildRoot\apps\mobile\android"
.\gradlew.bat --stop
Pop-Location

Push-Location $Repo
git worktree remove --force $BuildRoot
git worktree prune
Pop-Location
```

Removing `node_modules` can take several minutes on Windows.

## Troubleshooting

### Ninja reports that `build.ninja` is still dirty

The native dependency path is still too long. Check the following:

1. `$BuildRoot` is a short path such as `C:\t3apkbuild`.
2. Dependencies were installed with `--config.node-linker=hoisted`.
3. `react-native-reanimated` is a real directory directly under `$BuildRoot\node_modules`.
4. Expo prebuild was rerun with `--clean` after reinstalling dependencies.

Do not rely on `subst` alone; Java can canonicalize the mapped drive back to the original path.

### Gradle cannot find Java or the Android SDK

Confirm the configured paths before building:

```powershell
& "$env:JAVA_HOME\bin\java.exe" -version
Test-Path "$env:ANDROID_HOME\platforms\android-36"
Test-Path "$env:ANDROID_HOME\build-tools\36.0.0"
Test-Path "$env:ANDROID_HOME\ndk\27.1.12297006"
```

### The APK will not install

- Confirm the phone supports `arm64-v8a`.
- Enable installation from the app used to open the APK.
- Uninstall an older preview build if it was signed by a different certificate.
- Re-run `apksigner verify` to ensure the copied APK was not corrupted.
