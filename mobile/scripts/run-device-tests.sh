#!/usr/bin/env bash
# ==============================================================================
# Guardian Mobile - Physical Android Device & ADB Test Automation Runner
# ==============================================================================
set -e

PACKAGE_NAME="com.anonymous.guardianmobile"
MAESTRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.maestro" && pwd)"
APK_DEBUG_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../android/app/build/outputs/apk/debug" && pwd)/app-debug.apk"

echo "========================================================"
echo "🛡️  Guardian Mobile ADB & Maestro Device Test Suite"
echo "========================================================"

# 1. Check if ADB is installed and device is attached
if ! command -v adb &> /dev/null; then
    echo "❌ Error: ADB is not found in PATH. Please install Android Platform Tools."
    exit 1
fi

DEVICES=$(adb devices | grep -v "List" | grep "device$" | awk '{print $1}')

if [ -z "$DEVICES" ]; then
    echo "❌ Error: No physical Android devices or emulators attached via ADB."
    echo "💡 Run 'adb devices' to check USB/Wi-Fi debugging connections."
    exit 1
fi

echo "✅ Target Android device detected: $DEVICES"

# 2. Check if Maestro CLI is installed
if ! command -v maestro &> /dev/null; then
    echo "⚠️  Maestro CLI not found. Installing Maestro..."
    curl -FsSL "https://get.maestro.mobile.dev" | bash
    export PATH="$PATH:$HOME/.maestro/bin"
fi

# 3. Optional: Install fresh debug build if APK exists
if [ -f "$APK_DEBUG_PATH" ]; then
    echo "📦 Installing fresh Debug APK on target device..."
    adb -s "$DEVICES" install -r "$APK_DEBUG_PATH"
else
    echo "ℹ️  Existing package check for $PACKAGE_NAME..."
    if ! adb -s "$DEVICES" shell pm list packages | grep "$PACKAGE_NAME" > /dev/null; then
        echo "⚠️ Package $PACKAGE_NAME not installed. Building and assembling Debug APK..."
        cd "$(dirname "${BASH_SOURCE[0]}")/.."
        npm run build:android:debug
        adb -s "$DEVICES" install -r "$APK_DEBUG_PATH"
    fi
fi

# 4. Grant required permissions upfront via ADB for seamless CI/CD runs
echo "🔐 Pre-granting runtime Android permissions via ADB..."
adb -s "$DEVICES" shell pm grant "$PACKAGE_NAME" android.permission.RECORD_AUDIO || true
adb -s "$DEVICES" shell pm grant "$PACKAGE_NAME" android.permission.ACCESS_FINE_LOCATION || true
adb -s "$DEVICES" shell pm grant "$PACKAGE_NAME" android.permission.ACCESS_COARSE_LOCATION || true
adb -s "$DEVICES" shell pm grant "$PACKAGE_NAME" android.permission.POST_NOTIFICATIONS || true

# 5. Execute Maestro E2E Flows
echo "🚀 Executing Maestro Automated E2E Flows..."
maestro test "$MAESTRO_DIR/01_login_and_permissions.yaml"
maestro test "$MAESTRO_DIR/02_trigger_sos_pipeline.yaml"

echo "========================================================"
echo "✅ All Physical Device E2E Flows Passed Successfully!"
echo "========================================================"
