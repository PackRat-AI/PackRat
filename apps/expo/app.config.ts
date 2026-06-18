import * as fs from 'node:fs';
import * as path from 'node:path';
import { withSentry } from '@sentry/react-native/expo';
import type { ExpoConfig } from 'expo/config';
import { type ConfigPlugin, withDangerousMod, withXcodeProject } from 'expo/config-plugins';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getAppName = () => {
  if (IS_DEV) return 'PackRat (Dev)';
  if (IS_PREVIEW) return 'PackRat (Preview)';
  return 'PackRat';
};

const getBundleIdentifier = () => {
  if (IS_DEV) return 'com.andrewbierman.packrat.dev';
  if (IS_PREVIEW) return 'com.andrewbierman.packrat.preview';
  return 'com.andrewbierman.packrat';
};

const getAndroidPackage = () => {
  if (IS_DEV) return 'com.packratai.mobile.dev';
  if (IS_PREVIEW) return 'com.packratai.mobile.preview';
  return 'com.packratai.mobile';
};

const getIcon = () => {
  if (IS_DEV) return './assets/packrat-app-icon-gradient-dev.png';
  return './assets/packrat-app-icon-gradient.png';
};

const getAdaptiveIcon = () => {
  if (IS_DEV) return './assets/adaptive-icon-dev.png';
  return './assets/adaptive-icon.png';
};

// Since Xcode 16, SwiftUI is split into a public SwiftUI.framework and a private
// SwiftUICore.framework. SPIndicator + SPAlert (Burnt's deps) compile `import SwiftUI`,
// which causes the Swift compiler to embed a SwiftUICore auto-link directive in the
// resulting object files. The linker then fails because SwiftUICore is restricted to
// Apple-internal clients. Two-pronged fix:
//   1. withXcodeProject — add -framework SwiftUI to the main target's OTHER_LDFLAGS so
//      the public umbrella satisfies any transitive symbol look-ups.
//   2. withDangerousMod — inject a Podfile post_install hook that replaces the
//      SwiftUIExtension.swift files in SPIndicator/SPAlert with empty stubs before
//      compilation, eliminating the auto-link directive at its source.
const SWIFTUI_FIX_MARKER = '# withSwiftUICoreFix';

const withSwiftUICoreFix: ConfigPlugin<void> = (config) => {
  // ── Step 1: xcodeproj ──────────────────────────────────────────────────────
  let patched = withXcodeProject(config, (c) => {
    const proj = c.modResults;
    const appTarget = proj.getTarget('com.apple.product-type.application');
    if (!appTarget) return c;

    const configList = proj.pbxXCConfigurationList()[appTarget.target.buildConfigurationList];
    if (!configList || typeof configList === 'string') return c;

    const buildConfigs = proj.pbxXCBuildConfigurationSection();
    for (const ref of configList.buildConfigurations) {
      const bc = buildConfigs[ref.value];
      if (!bc || typeof bc === 'string') continue;

      // Shims/SwiftUICore.framework/SwiftUICore.tbd is a minimal stub without
      // allowable-clients. It lives at apps/expo/Shims/ (outside ios/, so it
      // survives CNG rebuilds). Adding it before the SDK lets the linker accept
      // the SwiftUICore auto-link directive; the actual symbols resolve through
      // SwiftUI.framework which re-exports all of SwiftUICore.
      const fps = bc.buildSettings.FRAMEWORK_SEARCH_PATHS;
      const searchPaths = Array.isArray(fps) ? fps : fps ? [fps as string] : ['"$(inherited)"'];
      if (!searchPaths.some((p) => String(p).includes('Shims'))) {
        bc.buildSettings.FRAMEWORK_SEARCH_PATHS = [...searchPaths, '"$(PROJECT_DIR)/../Shims"'];
      }

      const existing = bc.buildSettings.OTHER_LDFLAGS;
      const flags = Array.isArray(existing) ? existing : ['"$(inherited)"'];
      if (!flags.some((f) => String(f).includes('SwiftUI'))) {
        bc.buildSettings.OTHER_LDFLAGS = [...flags, '"-framework SwiftUI"'];
      }
    }
    return c;
  });

  // ── Step 2: Podfile post_install stub ──────────────────────────────────────
  patched = withDangerousMod(patched, [
    'ios',
    (c) => {
      const podfilePath = path.join(c.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf-8');

      if (!podfile.includes(SWIFTUI_FIX_MARKER)) {
        // Ruby code injected inside the existing post_install block.
        // Dir.glob with **/ finds SwiftUIExtension.swift wherever CocoaPods places it.
        // File.write replaces content with an empty stub — no `import SwiftUI` means
        // the Swift compiler emits no SwiftUICore auto-link directive.
        const snippet = [
          `    ${SWIFTUI_FIX_MARKER}: stub SwiftUI extension files to prevent SwiftUICore auto-linking.`,
          `    # Xcode 16+/26+: SwiftUICore.framework is private (Apple-internal only). Any pod`,
          `    # that compiles \`import SwiftUI\` embeds a SwiftUICore auto-link directive in its`,
          `    # object files; the linker fails when it tries to resolve it. Replacing the`,
          `    # extension files with empty stubs removes the directive before compilation.`,
          `    ['SPIndicator', 'SPAlert'].each do |pod_name|`,
          `      Dir.glob("#{installer.sandbox.pod_dir(pod_name)}/**/SwiftUI*.swift").each do |f|`,
          `        File.write(f, "// SwiftUI extension disabled — SwiftUICore restricted on Xcode 16+\\n")`,
          `      end`,
          `    end`,
          `    # react-native-ios-utilities 5.x references RCTRootContentView which is not exported`,
          `    # from the prebuilt React.framework in RN 0.85+. Replace the property return type`,
          `    # with RCTView (the common ancestor) so the linker finds the symbol.`,
          `    # For :path pods, source lives in node_modules — walk back from ios/ to find it.`,
          `    helpers_file = File.expand_path(`,
          `      '../../../../node_modules/react-native-ios-utilities/ios/Sources/Extensions+Helpers/RCTView+Helpers.swift',`,
          `      installer.sandbox.root`,
          `    )`,
          `    if File.exist?(helpers_file)`,
          `      content = File.read(helpers_file)`,
          `      patched = content`,
          `        .gsub('var closestParentReactContentView: RCTRootContentView?', 'var closestParentReactContentView: RCTView?')`,
          `        .gsub('let targetType = RCTRootContentView.self;', 'let targetType = RCTView.self;')`,
          `      File.write(helpers_file, patched) if patched != content`,
          `    end`,
        ].join('\n');

        // Anchor: the blank line + post_install closing `end` + platform block closing `end`.
        // This pattern is stable in Expo's generated Podfile across regenerations.
        const anchor = '\n\n  end\nend\n';
        if (podfile.includes(anchor)) {
          podfile = podfile.replace(anchor, `\n\n${snippet}\n\n  end\nend\n`);
          fs.writeFileSync(podfilePath, podfile, 'utf-8');
        }
      }

      return c;
    },
  ]);

  return patched;
};

export default (): ExpoConfig =>
  withSwiftUICoreFix(
    withSentry(
      {
        name: getAppName(),
        slug: 'packrat',
        version: '2.0.28',
        scheme: 'packrat',
        web: {
          bundler: 'metro',
          output: 'single',
          favicon: './assets/favicon.png',
        },
        plugins: [
          'expo-router',
          'expo-sqlite',
          'expo-font',
          'expo-image',
          [
            '@react-native-google-signin/google-signin',
            {
              iosUrlScheme:
                'com.googleusercontent.apps.993694750638-97t0vhfml04u2avrlbve22jbs9qcinbc',
            },
          ],
          'expo-secure-store',
          'expo-web-browser',
          [
            'expo-dev-client',
            {
              android: { toolsButton: false },
              ios: { toolsButton: false },
            },
          ],
          'expo-apple-authentication',
          'expo-localization',
          [
            'llama.rn',
            {
              enableEntitlements: true,
              forceCxx20: true,
              enableOpenCLAndHexagon: false,
            },
          ],
          [
            'react-native-maps',
            { iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY },
          ],
          '@react-native-community/datetimepicker',
          '@sentry/react-native',
          'expo-status-bar',
          ['expo-splash-screen', { image: './assets/splash.png' }],
        ],
        experiments: {
          typedRoutes: true,
          tsconfigPaths: true,
        },
        orientation: 'portrait',
        icon: getIcon(),
        userInterfaceStyle: 'automatic',
        assetBundlePatterns: ['**/*'],
        ios: {
          supportsTablet: true,
          bundleIdentifier: getBundleIdentifier(),
          usesAppleSignIn: true,
          config: {
            googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
          },
          infoPlist: {
            ITSAppUsesNonExemptEncryption: false,
            CFBundleURLTypes: [
              {
                CFBundleURLSchemes: [getBundleIdentifier()],
              },
            ],
            NSLocationWhenInUseUsageDescription:
              'This app needs access to your location while you are using it.',
            NSCameraUsageDescription:
              'This app requires access to your camera to let you take photos or scan items.',
            NSPhotoLibraryUsageDescription:
              'This app needs access to your photo library to let you upload or choose photos.',
          },
          privacyManifests: {
            NSPrivacyCollectedDataTypes: [
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
                NSPrivacyCollectedDataTypeLinked: false,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: [
                  'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                ],
              },
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
                NSPrivacyCollectedDataTypeLinked: false,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: [
                  'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                ],
              },
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherDiagnosticData',
                NSPrivacyCollectedDataTypeLinked: false,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: [
                  'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                ],
              },
            ],
            NSPrivacyAccessedAPITypes: [
              {
                NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
                NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
              },
              {
                NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
                NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
              },
              {
                NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
                NSPrivacyAccessedAPITypeReasons: ['C617.1'],
              },
            ],
          },
          entitlements: {
            'com.apple.developer.kernel.extended-virtual-addressing': true,
            'com.apple.developer.kernel.increased-memory-limit': true,
          },
        },
        android: {
          adaptiveIcon: {
            foregroundImage: getAdaptiveIcon(),
            backgroundColor: '#026A9F',
          },
          package: getAndroidPackage(),
          config: {
            googleMaps: {
              apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
            },
          },
        },
        extra: {
          eas: {
            projectId: '267945b1-d9ac-4621-8541-826a2c70576d',
          },
          appVariant: IS_DEV ? 'development' : IS_PREVIEW ? 'preview' : 'production',
        },
        updates: {
          url: 'https://u.expo.dev/267945b1-d9ac-4621-8541-826a2c70576d',
        },
        runtimeVersion: {
          policy: 'appVersion',
        },
        owner: 'packrat',
      },
      {
        url: 'https://sentry.io/',
        organization: 'packrat-oq',
        project: 'packrat-expo',
      },
    ),
  );
