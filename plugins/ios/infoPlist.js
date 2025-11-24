const { withInfoPlist } = require("@expo/config-plugins");

/**
 * Config plugin to add Info.plist privacy permissions for Report A Problem feature
 */
const withReportInfoPlist = (config) => {
	return withInfoPlist(config, (config) => {
		// Add privacy permissions required for Report A Problem
		config.modResults.NSCameraUsageDescription =
			config.modResults.NSCameraUsageDescription ||
			"This app needs access to your camera to take photos when reporting a problem.";
		config.modResults.NSLocationAlwaysUsageDescription =
			config.modResults.NSLocationAlwaysUsageDescription ||
			"This app needs access to your location to include location information when reporting a problem.";
		config.modResults.NSLocationWhenInUseUsageDescription =
			config.modResults.NSLocationWhenInUseUsageDescription ||
			"This app needs access to your location to include location information when reporting a problem.";
		config.modResults.NSPhotoLibraryUsageDescription =
			config.modResults.NSPhotoLibraryUsageDescription ||
			"This app needs access to your photo library to attach photos when reporting a problem.";
		config.modResults.NSMicrophoneUsageDescription =
			config.modResults.NSMicrophoneUsageDescription ||
			"This app needs access to your microphone to record audio when reporting a problem.";

		return config;
	});
};

/**
 * Config plugin to add background modes for Report A Problem feature
 * Background modes are added to Info.plist
 */
const withReportBackgroundModes = (config) => {
	return withInfoPlist(config, (config) => {
		// Add background modes array if it doesn't exist
		if (!config.modResults.UIBackgroundModes) {
			config.modResults.UIBackgroundModes = [];
		}

		// Ensure it's an array
		if (typeof config.modResults.UIBackgroundModes === "string") {
			config.modResults.UIBackgroundModes = [
				config.modResults.UIBackgroundModes,
			];
		}

		// Add required background modes if not already present
		const requiredModes = [
			"fetch",
			"remote-notification",
		];
		requiredModes.forEach((mode) => {
			if (!config.modResults.UIBackgroundModes.includes(mode)) {
				config.modResults.UIBackgroundModes.push(mode);
			}
		});

		return config;
	});
};

module.exports = {
	withReportInfoPlist,
	withReportBackgroundModes,
};
