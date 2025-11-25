const APP_VARIANT = process.env.APP_VARIANT || "development";

const getUniqueIdentifier = () => {
  if (APP_VARIANT === "preview") {
    return "com.reflexmarta.otg.app.qa";
  }
  if (APP_VARIANT === "production") {
    return "com.reflexmarta.otg.app";
  }
  return "com.reflexmarta.otg.app.dev";
};

const getAppName = () => {
  if (APP_VARIANT === "preview") {
    return "Marta OTG (QA)";
  }
  if (APP_VARIANT === "production") {
    return "Marta OTG";
  }
  return "Marta OTG (Dev)";
};

/**
 * Validate ECSDK plugin configuration
 * This runs during config evaluation, before prebuild
 */
const validateECSDKConfig = () => {
  const errors = [];
  const warnings = [];

  // Check if ECSDK API key is set
  if (!process.env.ECSDK_API_KEY) {
    errors.push("ECSDK_API_KEY environment variable is required");
  }

  // Check if Google Maps API key is set (required for Android)
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    errors.push(
      "GOOGLE_MAPS_API_KEY environment variable is required for Android"
    );
  }

  // Check if GitHub credentials are set (required for private packages)
  if (!process.env.GPR_USER || !process.env.GPR_API_KEY) {
    errors.push(
      "GPR_USER and GPR_API_KEY environment variables are required to access private ECSDK packages"
    );
  }

  // Check if Google Services file path is set (required for Firebase/FCM)
  if (!process.env.GOOGLE_SERVICES_FILE) {
    errors.push(
      "GOOGLE_SERVICES_FILE environment variable is required for Firebase/FCM push notifications"
    );
  }

  // Check if plugin is in plugins array
  // We can't check this here since config hasn't been merged yet,
  // but we'll validate the plugin itself will throw if not configured

  if (errors.length > 0) {
    const errorMessage = `ECSDK Configuration Error:

Missing required environment variables:
${errors.map((e) => `  - ${e}`).join("\n")}

Please set the following environment variables:
  - ECSDK_API_KEY
  - GOOGLE_MAPS_API_KEY
  - GPR_USER
  - GPR_API_KEY
  - GOOGLE_SERVICES_FILE

And ensure the 'ecsdk-expo' plugin is configured in your app.config.js plugins array.

Example configuration:
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
}`;

    throw new Error(errorMessage);
  }

  if (warnings.length > 0) {
    console.warn("ECSDK Configuration Warnings:");
    warnings.forEach((w) => console.warn(`  ⚠️  ${w}`));
  }
};

export default ({ config }) => {
  const finalConfig = {
    ...config,
    name: getAppName(),
    ios: {
      ...config.ios,
      bundleIdentifier: getUniqueIdentifier(),
    },
    android: {
      ...config.android,
      package: getUniqueIdentifier(),
    },
    plugins: [
      ...(config.plugins || []),
      [
        "ecsdk-expo",
        {
          ecsdkApiKey: process.env.ECSDK_API_KEY,
          googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
          googleServicesFile: process.env.GOOGLE_SERVICES_FILE,
          productKey: process.env.ECSDK_PRODUCT_KEY,
        },
      ],
    ],
  };

  return finalConfig;
};
