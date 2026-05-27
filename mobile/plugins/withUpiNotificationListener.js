/**
 * Expo config plugin: UPI Notification Listener
 *
 * Wires the Kotlin sources under ./native/upi-listener/ into a prebuild
 * Android project. Idempotent — running `expo prebuild` repeatedly will
 * not duplicate manifest entries or MainApplication imports.
 *
 * Effects on the generated Android project:
 *   1. AndroidManifest.xml:
 *        - <uses-permission BIND_NOTIFICATION_LISTENER_SERVICE>
 *        - <service> declaration with the
 *          NotificationListenerService intent-filter, plus the matching
 *          system permission so only the OS can bind to it.
 *   2. android/app/src/main/java/com/moneymind/app/upilistener/*.kt
 *        Copied verbatim from this plugin's `native/` directory.
 *   3. MainApplication.{kt|java}:
 *        - import com.moneymind.app.upilistener.UpiNotificationPackage
 *        - registration of the package in getPackages().
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const KOTLIN_PACKAGE = 'com.moneymind.app.upilistener';
const SERVICE_FQCN = `${KOTLIN_PACKAGE}.UpiNotificationListenerService`;
const RN_PACKAGE_FQCN = `${KOTLIN_PACKAGE}.UpiNotificationPackage`;
const RN_PACKAGE_SIMPLE = 'UpiNotificationPackage';
const NOTIF_LISTENER_PERMISSION =
  'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE';
const NOTIF_LISTENER_INTENT =
  'android.service.notification.NotificationListenerService';

const SOURCE_JAVA_ROOT = path.join(
  __dirname,
  'native',
  'upi-listener',
  'android',
  'src',
  'main',
  'java',
);

// ---------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------

const withUpiNotificationListener = (config) => {
  config = withUpiManifest(config);
  config = withUpiKotlinSources(config);
  config = withUpiMainApplication(config);
  return config;
};

// ---------------------------------------------------------------
// 1. AndroidManifest.xml
// ---------------------------------------------------------------

function withUpiManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // <uses-permission> at the manifest root.
    if (!Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = [];
    }
    const alreadyPermitted = manifest['uses-permission'].some(
      (p) => p?.$ && p.$['android:name'] === NOTIF_LISTENER_PERMISSION,
    );
    if (!alreadyPermitted) {
      manifest['uses-permission'].push({
        $: { 'android:name': NOTIF_LISTENER_PERMISSION },
      });
    }

    // <service> nested inside <application>.
    const application = manifest.application?.[0];
    if (!application) {
      // Should never happen for a valid Expo manifest, but bail safely
      // rather than throw — `expo prebuild` should not crash on us.
      return cfg;
    }
    if (!Array.isArray(application.service)) {
      application.service = [];
    }
    const alreadyDeclared = application.service.some(
      (s) => s?.$ && s.$['android:name'] === SERVICE_FQCN,
    );
    if (!alreadyDeclared) {
      application.service.push({
        $: {
          'android:name': SERVICE_FQCN,
          'android:label': 'MoneyMind UPI Capture',
          'android:permission': NOTIF_LISTENER_PERMISSION,
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': NOTIF_LISTENER_INTENT } }],
          },
        ],
      });
    }

    return cfg;
  });
}

// ---------------------------------------------------------------
// 2. Copy Kotlin sources into the generated android/ project
// ---------------------------------------------------------------

function withUpiKotlinSources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const platformRoot = cfg.modRequest.platformProjectRoot;
      const destJavaRoot = path.join(platformRoot, 'app', 'src', 'main', 'java');

      if (!fs.existsSync(SOURCE_JAVA_ROOT)) {
        throw new Error(
          `[withUpiNotificationListener] Kotlin source root not found at ${SOURCE_JAVA_ROOT}`,
        );
      }

      copyDirSync(SOURCE_JAVA_ROOT, destJavaRoot);
      return cfg;
    },
  ]);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name);
    const dp = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(sp, dp);
    } else {
      fs.copyFileSync(sp, dp);
    }
  }
}

// ---------------------------------------------------------------
// 3. MainApplication.kt | MainApplication.java
// ---------------------------------------------------------------

function withUpiMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    const language = cfg.modResults.language; // 'kt' | 'java'
    cfg.modResults.contents =
      language === 'kt'
        ? patchMainApplicationKt(cfg.modResults.contents)
        : patchMainApplicationJava(cfg.modResults.contents);
    return cfg;
  });
}

function patchMainApplicationKt(contents) {
  // a) Inject `import com.moneymind.app.upilistener.UpiNotificationPackage`
  //    after the `package …` line, right where the other imports live.
  const importLine = `import ${RN_PACKAGE_FQCN}`;
  if (!contents.includes(importLine)) {
    contents = contents.replace(
      /^(package\s+[^\n]+\n)/m,
      `$1\n${importLine}\n`,
    );
  }

  // b) Insert `add(UpiNotificationPackage())` inside the apply { ... }
  //    block of getPackages(). Modern Expo prebuilds emit:
  //
  //      override fun getPackages(): List<ReactPackage> =
  //        PackageList(this).packages.apply {
  //          // Packages that cannot be autolinked yet can be added manually here, for example:
  //          // add(MyReactNativePackage())
  //        }
  //
  //    We append after the comment marker so order is stable across runs.
  const addLine = `add(${RN_PACKAGE_SIMPLE}())`;
  if (!contents.includes(addLine)) {
    const marker = /(\/\/\s*add\(MyReactNativePackage\(\)\))/;
    if (marker.test(contents)) {
      contents = contents.replace(marker, `$1\n          ${addLine}`);
    } else {
      // Fallback: inject before the closing brace of `apply { ... }`.
      contents = contents.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{[\s\S]*?)(\n\s*\})/,
        `$1\n          ${addLine}$2`,
      );
    }
  }

  return contents;
}

function patchMainApplicationJava(contents) {
  // a) Add the import line.
  const importLine = `import ${RN_PACKAGE_FQCN};`;
  if (!contents.includes(importLine)) {
    contents = contents.replace(
      /^(package\s+[^\n]+;\n)/m,
      `$1\n${importLine}\n`,
    );
  }

  // b) Add `packages.add(new UpiNotificationPackage());` right after the
  //    `List<ReactPackage> packages = new PackageList(this).getPackages();`
  //    line, before `return packages;`.
  const addLine = `packages.add(new ${RN_PACKAGE_SIMPLE}());`;
  if (!contents.includes(addLine)) {
    contents = contents.replace(
      /(List<ReactPackage>\s+packages\s*=\s*new\s+PackageList\(this\)\.getPackages\(\);\s*\n)/,
      `$1      ${addLine}\n`,
    );
  }

  return contents;
}

module.exports = withUpiNotificationListener;
