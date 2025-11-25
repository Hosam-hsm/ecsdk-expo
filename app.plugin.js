// ============================================================================
// IMPORTS
// ============================================================================

// iOS Plugins
const {
  withReportInfoPlist,
  withReportBackgroundModes,
} = require("./plugins/ios/infoPlist");
const { withSPMGitHubAuth, withSPMFrameworks } = require("./plugins/ios/spm");
const { withAppDelegateInitialization } = require("./plugins/ios/appDelegate");

// Android Plugins
const { withECSDKManifest } = require("./plugins/android/manifest");
const { withECSDKStrings } = require("./plugins/android/strings");
const {
  withECSDKGradleProperties,
  withGitHubPackagesRepository,
  withGoogleServicesGradle,
  withGoogleServicesAppGradle,
  withECSDKDependency,
  withCoreLibraryDesugaring,
  withGoogleServicesFile,
  withIOSModularHeaders,
} = require("./plugins/android/gradle");
const {
  withECSDKMainApplication,
} = require("./plugins/android/mainApplication");

// ============================================================================
// MAIN PLUGIN FUNCTION
// ============================================================================

/**
 * ECSDK Config Plugin for iOS and Android
 *
 * Automatically configures both iOS and Android native files with ECSDK settings.
 * No manual native code editing required!
 *
 * iOS Configuration:
 * - Info.plist privacy permissions (camera, location, photo library, microphone)
 * - Background modes (fetch, remote-notification)
 * - GitHub authentication for SPM packages (.netrc configuration)
 * - SPM frameworks (ELERTSKitCore, ELERTSKitUI) with transitive dependencies
 * - AppDelegate initialization (ELERTSKit.initializeDataUI)
 * - Background fetch handler
 *
 * Android Configuration:
 * - AndroidManifest.xml configuration (ECSDK API key, Google Maps API key, FCM service)
 * - String resources setup (PRODUCT, app_name, short_display_name, LIST_MESSAGE_SERVICE)
 * - MainApplication.kt ECSDK initialization (ECUISDK)
 * - GitHub credentials (automatic via environment variables or gradle.properties)
 * - GitHub Packages repository configuration (automatic)
 * - ECSDK library dependency injection (automatic)
 * - Firebase/FCM setup (Google Services plugin and google-services.json)
 * - Core library desugaring
 *
 * Usage in app.json/app.config.js:
 * {
 *   "plugins": [
 *     [
 *       "ecsdk-expo",
 *       {
 *         "ecsdkApiKey": process.env.ECSDK_API_KEY,
 *         "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY,  // Required for Android map functionality
 *         "googleServicesFile": "./google-services.json",       // Optional, for Android FCM push notifications
 *         "productName": "PROVIDED BY ELERTS",                  // Optional, default: "PROVIDED BY ELERTS"
 *         "appName": "Your App Name",                           // Optional
 *         "shortDisplayName": "Short Name",                     // Optional
 *         "productKey": "YourProductKey",                       // Optional, for iOS
 *         // GitHub credentials: Use environment variables GPR_USER and GPR_API_KEY
 *         // Required for both iOS (SPM) and Android (Maven) to access private packages
 *         // Or pass them here (not recommended):
 *         // "githubUsername": "your-github-username",
 *         // "githubToken": "your-github-token"
 *       }
 *     ]
 *   ]
 * }
 *
 * Environment Variables:
 * Values must be passed explicitly via plugin props. The app.config.js should read from
 * environment variables and pass them to the plugin. This allows you to use EAS Secrets
 * or local .env files by configuring them in app.config.js.
 *
 * The following environment variables should be set and passed to the plugin:
 * - ECSDK_API_KEY - ECSDK API Key from ELERTS (required)
 * - GOOGLE_MAPS_API_KEY - Google Maps API Key (required for Android)
 * - GOOGLE_SERVICES_FILE - Path to google-services.json (required for Firebase/FCM)
 * - GPR_USER - GitHub username for accessing private ECSDK packages (required)
 * - GPR_API_KEY - GitHub personal access token (required)
 * - ECSDK_PRODUCT_KEY - Product key for iOS (optional)
 *
 * Validation:
 * Validation only occurs during the prebuild phase, not during config evaluation.
 * This ensures that environment variables from EAS dashboard are available when validation runs.
 * During config evaluation (e.g., 'npx expo config'), validation is skipped to allow the
 * config to load even if environment variables aren't available yet.
 *
 * EAS Build Configuration:
 * For EAS builds, configure environment variables in the EAS dashboard or eas.json:
 *
 * Option 1: EAS Secrets (recommended):
 * 1. Set secrets: eas secret:create --scope project --name ECSDK_API_KEY --value your-key
 * 2. Set secrets: eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value your-key
 * 3. Set secrets: eas secret:create --scope project --name GOOGLE_SERVICES_FILE --value ./google-services.json
 * 4. Set secrets: eas secret:create --scope project --name GPR_USER --value your-username
 * 5. Set secrets: eas secret:create --scope project --name GPR_API_KEY --value your-token
 * 6. Secrets are automatically available during prebuild phase
 *
 * Option 2: eas.json env section:
 * {
 *   "build": {
 *     "production": {
 *       "env": {
 *         "ECSDK_API_KEY": "your-key",
 *         "GOOGLE_MAPS_API_KEY": "your-key",
 *         "GOOGLE_SERVICES_FILE": "./google-services.json",
 *         "GPR_USER": "your-github-username",
 *         "GPR_API_KEY": "your-github-token"
 *       },
 *       "ios": {
 *         "prebuildCommand": "bash -c 'mkdir -p $HOME/.netrc && echo \"machine github.com\\n  login $GPR_USER\\n  password $GPR_API_KEY\\n\" >> $HOME/.netrc && chmod 600 $HOME/.netrc'"
 *       }
 *     }
 *   }
 * }
 *
 * For Android: The gradle.properties approach works automatically in EAS builds
 * since the credentials are written to the project file during prebuild.
 *
 * @param {import('@expo/config-plugins').ExportedConfig} config
 * @param {Object} props - Plugin configuration
 * @param {string} [props.ecsdkApiKey] - ECSDK API Key from ELERTS (required, can also use ECSDK_API_KEY env var)
 * @param {string} [props.googleMapsApiKey] - Google Maps API Key (required for Android, can also use GOOGLE_MAPS_API_KEY env var)
 * @param {string} [props.googleServicesFile] - Path to google-services.json (required, can also use GOOGLE_SERVICES_FILE env var)
 * @param {string} [props.productName] - Product name (default: "PROVIDED BY ELERTS")
 * @param {string} [props.appName] - App name (optional)
 * @param {string} [props.shortDisplayName] - Short display name (optional)
 * @param {string} [props.productKey] - Product key for iOS (optional, can also use ECSDK_PRODUCT_KEY env var)
 * @param {string} [props.githubUsername] - GitHub username for ECSDK package access (optional, can also use GPR_USER env var)
 * @param {string} [props.githubToken] - GitHub personal access token (optional, can also use GPR_API_KEY env var)
 */
module.exports = function withECSDK(config, props = {}) {
  const {
    ecsdkApiKey,
    googleMapsApiKey,
    googleServicesFile,
    productName = "PROVIDED BY ELERTS",
    appName,
    shortDisplayName,
    productKey,
    githubUsername,
    githubToken,
  } = props;

  // ============================================================================
  // VALIDATION - Defer validation until prebuild phase when env vars are available
  // ============================================================================

  // Detect if we're in prebuild phase (when env vars are actually available)
  // During prebuild, EXPO_PREBUILD is set or 'prebuild' is in argv
  // EAS_BUILD_WORKINGDIR is set by EAS during the build process when prebuild runs
  const isPrebuildPhase =
    process.env.EXPO_PREBUILD === "1" ||
    process.argv.includes("prebuild") ||
    process.env.EAS_BUILD_WORKINGDIR; // EAS sets this during prebuild

  // Only validate during prebuild phase when environment variables are guaranteed to be available
  // Skip validation during config evaluation (npx expo config) - env vars from EAS dashboard
  // are only available during the actual prebuild phase, not during config evaluation
  const shouldValidate = isPrebuildPhase;

  // Validate required ECSDK API Key
  if (shouldValidate && !ecsdkApiKey) {
    throw new Error(
      `ECSDK Config Plugin Error: 'ecsdkApiKey' is required but not provided.

Please configure the plugin in your app.config.js:
{
  "plugins": [
    [
      "ecsdk-expo",
      {
        "ecsdkApiKey": process.env.ECSDK_API_KEY,
        "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY,
        ...
      }
    ]
  ]
}

Or set the environment variable: ECSDK_API_KEY
Get your API key from ELERTS.`
    );
  }

  // Validate required Google Maps API Key for Android
  if (shouldValidate && !googleMapsApiKey) {
    throw new Error(
      `ECSDK Config Plugin Error: 'googleMapsApiKey' is required for Android but not provided.

The ECSDK requires Google Maps API key for map functionality.

Please configure in your app.config.js:
{
  "plugins": [
    [
      "ecsdk-expo",
      {
        "ecsdkApiKey": process.env.ECSDK_API_KEY,
        "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY,
        ...
      }
    ]
  ]
}

Or set the environment variable: GOOGLE_MAPS_API_KEY
Get your API key from: https://console.cloud.google.com/`
    );
  }

  // Validate GitHub credentials (required for accessing private packages)
  if (shouldValidate && (!githubUsername || !githubToken)) {
    throw new Error(
      `ECSDK Config Plugin Error: GitHub credentials are required to access private ECSDK packages.

The ECSDK libraries are hosted on GitHub Packages and require authentication.

Please provide GitHub credentials in one of these ways:

1. Environment variables (recommended):
   - Set GPR_USER=your-github-username
   - Set GPR_API_KEY=your-github-token

2. Plugin configuration (not recommended for security):
   {
     "plugins": [
       [
         "ecsdk-expo",
         {
           "githubUsername": "your-username",
           "githubToken": "your-token",
           ...
         }
       ]
     ]
   }

3. For EAS builds, use EAS Secrets:
   eas secret:create --scope project --name GPR_USER --value your-username
   eas secret:create --scope project --name GPR_API_KEY --value your-token

Create a GitHub Personal Access Token with 'read:packages' permission at:
https://github.com/settings/tokens`
    );
  }

  // Validate google-services.json file
  // Since the plugin registers ECSDKFirebaseMessagingService in AndroidManifest,
  // google-services.json is required for Firebase/FCM to work properly
  if (shouldValidate && !googleServicesFile) {
    throw new Error(
      `ECSDK Config Plugin Error: 'googleServicesFile' is required.

The ECSDK plugin registers ECSDKFirebaseMessagingService for push notifications,
which requires Firebase configuration via google-services.json.

Please configure in your app.config.js:
{
  "plugins": [
    [
      "ecsdk-expo",
      {
        "ecsdkApiKey": process.env.ECSDK_API_KEY,
        "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY,
        "googleServicesFile": "./google-services.json",  // REQUIRED
        ...
      }
    ]
  ]
}

Or set the environment variable: GOOGLE_SERVICES_FILE

Download google-services.json from:
https://console.firebase.google.com/ → Project Settings → Your Android App → Download google-services.json`
    );
  }

  // Validate path format (only if googleServicesFile is provided)
  if (googleServicesFile && typeof googleServicesFile !== "string") {
    throw new Error(
      `ECSDK Config Plugin Error: 'googleServicesFile' must be a string path, got: ${typeof googleServicesFile}

Please provide a valid file path, e.g.:
  "googleServicesFile": "./google-services.json"`
    );
  }

  // Validate file exists (if we can determine project root)
  // Note: During config evaluation, project root might not be available
  // Full validation happens during the file copy operation

  // ============================================================================
  // APPLY CONFIGURATIONS
  // ============================================================================

  // iOS Configuration
  config = withReportInfoPlist(config);
  config = withReportBackgroundModes(config);
  // Configure GitHub authentication for SPM packages (required for private packages)
  config = withSPMGitHubAuth(config, {
    githubUsername,
    githubToken,
  });
  config = withSPMFrameworks(config);
  config = withAppDelegateInitialization(config, {
    apiKey: ecsdkApiKey,
    productKey,
  });

  // Android Configuration

  // Apply manifest configuration
  config = withECSDKManifest(config, {
    ecsdkApiKey,
    googleMapsApiKey,
  });

  // Apply strings.xml configuration
  config = withECSDKStrings(config, {
    productName,
    appName,
    shortDisplayName,
  });

  // Apply gradle.properties configuration
  config = withECSDKGradleProperties(config, {
    githubUsername,
    githubToken,
  });

  // Add GitHub Packages repository for ECSDK-Android library
  config = withGitHubPackagesRepository(config);

  // Add ECSDK library dependency to app build.gradle
  config = withECSDKDependency(config);

  // Add core library desugaring to app build.gradle
  config = withCoreLibraryDesugaring(config);

  // Apply MainApplication.kt modifications
  config = withECSDKMainApplication(config);

  // Add iOS modular headers for Firebase compatibility
  config = withIOSModularHeaders(config);

  // Configure Google Services (Firebase) if google-services.json is provided
  if (googleServicesFile) {
    // Add Google Services plugin to gradle files
    config = withGoogleServicesGradle(config);
    config = withGoogleServicesAppGradle(config);
    // Copy google-services.json file
    config = withGoogleServicesFile(config, {
      googleServicesFile,
    });
  }

  return config;
};
