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
 *         "productKey": "PROVIDED BY ELERTS",                   // Optional, default: "PROVIDED BY ELERTS" (used for both iOS and Android)
 *         "appName": "Your App Name",                           // Optional
 *         "shortDisplayName": "Short Name",                     // Optional
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
 * EAS Build Configuration:
 * For EAS builds, you need to configure GitHub authentication in eas.json:
 *
 * {
 *   "build": {
 *     "production": {
 *       "env": {
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
 * Or use EAS Secrets (recommended):
 * 1. Set secrets: eas secret:create --scope project --name GPR_USER --value your-username
 * 2. Set secrets: eas secret:create --scope project --name GPR_API_KEY --value your-token
 * 3. Reference in eas.json env section (they're automatically available)
 * 4. Add prebuildCommand for iOS as shown above
 *
 * For Android: The gradle.properties approach works automatically in EAS builds
 * since the credentials are written to the project file during prebuild.
 *
 * @param {import('@expo/config-plugins').ExportedConfig} config
 * @param {Object} props - Plugin configuration
 * @param {string} props.ecsdkApiKey - ECSDK API Key from ELERTS (required)
 * @param {string} props.googleMapsApiKey - Google Maps API Key (required for Android)
 * @param {string} [props.googleServicesFile] - Path to google-services.json (optional, for Android FCM)
 * @param {string} [props.productKey] - Product key (default: "PROVIDED BY ELERTS", used for both iOS and Android)
 * @param {string} [props.appName] - App name (optional)
 * @param {string} [props.shortDisplayName] - Short display name (optional)
 * @param {string} [props.githubUsername] - GitHub username for ECSDK package access (optional, use env vars instead)
 * @param {string} [props.githubToken] - GitHub personal access token (optional, use env vars instead)
 */
module.exports = function withECSDK(config, props = {}) {
  const {
    ecsdkApiKey,
    googleMapsApiKey,
    googleServicesFile,
    productKey = "PROVIDED BY ELERTS",
    appName,
    shortDisplayName,
    githubUsername,
    githubToken,
  } = props;

  // ============================================================================
  // VALIDATION - Fail fast during prebuild if required configuration is missing
  // ============================================================================

  // Validate required ECSDK API Key
  if (!ecsdkApiKey) {
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
  if (!googleMapsApiKey) {
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
  // Check both plugin params and environment variables
  const gprUser = githubUsername || process.env.GPR_USER;
  const gprKey = githubToken || process.env.GPR_API_KEY;

  if (!gprUser || !gprKey) {
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
  if (!googleServicesFile) {
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

  // Validate path format
  if (typeof googleServicesFile !== "string") {
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
    productKey,
    appName,
    shortDisplayName,
  });

  // Apply gradle.properties configuration
  // This will use environment variables (GPR_USER, GPR_API_KEY) if plugin params not provided
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
