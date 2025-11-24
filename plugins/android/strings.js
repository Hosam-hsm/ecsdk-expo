const { withStringsXml } = require("@expo/config-plugins");

function withECSDKStrings(config, { productName, appName, shortDisplayName }) {
	return withStringsXml(config, async (config) => {
		const strings = config.modResults;

		// Add PRODUCT string
		if (productName) {
			strings.resources.string = strings.resources.string || [];

			// Remove existing if present
			strings.resources.string = strings.resources.string.filter(
				(item) => item.$.name !== "PRODUCT",
			);

			// Add new
			strings.resources.string.push({
				$: {
					name: "PRODUCT",
					translatable: "false",
				},
				_: productName,
			});
		}

		// Add app_name string (if provided)
		if (appName) {
			strings.resources.string = strings.resources.string || [];

			// Remove existing if present
			strings.resources.string = strings.resources.string.filter(
				(item) => item.$.name !== "app_name",
			);

			// Add new
			strings.resources.string.push({
				$: {
					name: "app_name",
					translatable: "false",
				},
				_: appName,
			});
		}

		// Add short_display_name string
		if (shortDisplayName) {
			strings.resources.string = strings.resources.string || [];

			// Remove existing if present
			strings.resources.string = strings.resources.string.filter(
				(item) => item.$.name !== "short_display_name",
			);

			// Add new
			strings.resources.string.push({
				$: {
					name: "short_display_name",
					translatable: "false",
				},
				_: shortDisplayName,
			});
		}

		// Add LIST_MESSAGE_SERVICE string (required for FCM service)
		strings.resources.string = strings.resources.string || [];

		// Remove existing if present
		strings.resources.string = strings.resources.string.filter(
			(item) => item.$.name !== "LIST_MESSAGE_SERVICE",
		);

		// Add new
		strings.resources.string.push({
			$: {
				name: "LIST_MESSAGE_SERVICE",
				translatable: "false",
			},
			_: "com.elerts.ecsdk.LIST_MESSAGE_SERVICE",
		});

		return config;
	});
}

module.exports = {
	withECSDKStrings,
};

