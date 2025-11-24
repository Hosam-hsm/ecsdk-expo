const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

/**
 * Helper function to add a permission to the AndroidManifest.xml
 */
function addPermissionToManifest(androidManifest, permission) {
	if (!androidManifest.manifest["uses-permission"]) {
		androidManifest.manifest["uses-permission"] = [];
	}

	// Check if permission already exists
	const existingPermission = androidManifest.manifest["uses-permission"].find(
		(item) => item.$["android:name"] === permission,
	);

	if (!existingPermission) {
		androidManifest.manifest["uses-permission"].push({
			$: {
				"android:name": permission,
			},
		});
	}
}

function withECSDKManifest(config, { ecsdkApiKey, googleMapsApiKey }) {
	return withAndroidManifest(config, async (config) => {
		const androidManifest = config.modResults;
		const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

		// Add ECSDK API Key
		if (ecsdkApiKey) {
			AndroidConfig.Manifest.addMetaDataItemToMainApplication(
				mainApplication,
				"com.elerts.ApiKey",
				ecsdkApiKey,
			);
		}

		// Add Google Maps API Key (required by ECSDK)
		if (googleMapsApiKey) {
			AndroidConfig.Manifest.addMetaDataItemToMainApplication(
				mainApplication,
				"com.google.android.geo.API_KEY",
				googleMapsApiKey,
			);
		}

		// Add POST_NOTIFICATIONS permission for Android 13+ (API 33+)
		addPermissionToManifest(androidManifest, "android.permission.POST_NOTIFICATIONS");

		// Add Firebase Messaging Service
		// Check if service array exists
		if (!mainApplication.service) {
			mainApplication.service = [];
		}

		// Remove existing FCM service if present
		mainApplication.service = mainApplication.service.filter(
			(service) =>
				service.$["android:name"] !== "expo.modules.ecsdk.ECSDKFirebaseMessagingService",
		);

		// Add FCM service
		mainApplication.service.push({
			$: {
				"android:name": "expo.modules.ecsdk.ECSDKFirebaseMessagingService",
				"android:exported": "false",
			},
			"intent-filter": [
				{
					action: [
						{
							$: {
								"android:name": "com.google.firebase.MESSAGING_EVENT",
							},
						},
					],
				},
			],
		});

		return config;
	});
}

module.exports = {
	withECSDKManifest,
};
