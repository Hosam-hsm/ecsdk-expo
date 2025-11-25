const {
	withGradleProperties,
	withProjectBuildGradle,
	withAppBuildGradle,
	withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withECSDKGradleProperties(config, { githubUsername, githubToken }) {
	return withGradleProperties(config, (config) => {
		// Add GitHub credentials to gradle.properties if provided
		// These are used to access the ECSDK-Android library from GitHub Packages
		const gprUser = githubUsername;
		const gprKey = githubToken;

		if (gprUser) {
			// Remove existing GPR_USER if present
			config.modResults = config.modResults.filter(
				(item) => item.type !== "property" || item.key !== "gpr.usr",
			);
			config.modResults.push({
				type: "property",
				key: "gpr.usr",
				value: gprUser,
			});
		}

		if (gprKey) {
			// Remove existing GPR_API_KEY if present
			config.modResults = config.modResults.filter(
				(item) => item.type !== "property" || item.key !== "gpr.key",
			);
			config.modResults.push({
				type: "property",
				key: "gpr.key",
				value: gprKey,
			});
		}

		return config;
	});
}

/**
 * Add GitHub Packages repository to project-level build.gradle
 */
function withGitHubPackagesRepository(config) {
	return withProjectBuildGradle(config, (config) => {
		const { modResults } = config;
		let contents = modResults.contents;

		// Add GitHub Packages repository if not present
		if (!contents.includes("maven.pkg.github.com/elerts/ecsdk-android")) {
			// Find the allprojects repositories block
			const allProjectsRegex = /allprojects\s*{[\s\S]*?repositories\s*{([^}]*?)}/;
			const match = contents.match(allProjectsRegex);

			if (match) {
				const insertPosition = match.index + match[0].length - 1;
				const githubPackagesRepo = `


    // GitHub Packages for ECSDK-Android
    maven {
      name = "GitHubPackages"
      url = uri("https://maven.pkg.github.com/elerts/ecsdk-android")
      credentials {
        username = System.getenv("GPR_USER") ?: project.findProperty("gpr.usr")
        password = System.getenv("GPR_API_KEY") ?: project.findProperty("gpr.key")
      }
    }`;

				contents =
					contents.slice(0, insertPosition) +
					githubPackagesRepo +
					contents.slice(insertPosition);
			}
		}

		modResults.contents = contents;
		return config;
	});
}

/**
 * Add Google Services plugin to project-level build.gradle
 */
function withGoogleServicesGradle(config) {
	return withProjectBuildGradle(config, (config) => {
		const { modResults } = config;
		let contents = modResults.contents;

		// Add Google Services classpath to buildscript dependencies if not present
		if (!contents.includes("com.google.gms:google-services")) {
			// Find the buildscript dependencies block
			const dependenciesRegex = /buildscript\s*{[\s\S]*?dependencies\s*{([^}]*)}/;
			const match = contents.match(dependenciesRegex);

			if (match) {
				const dependenciesContent = match[1];
				const lastClasspath = dependenciesContent.lastIndexOf("classpath");

				if (lastClasspath !== -1) {
					// Find the end of the last classpath line
					const insertPosition = match.index + match[0].length - 1;
					const googleServicesClasspath =
						"\n    classpath('com.google.gms:google-services:4.4.0')";

					contents =
						contents.slice(0, insertPosition) +
						googleServicesClasspath +
						contents.slice(insertPosition);
				}
			}
		}

		modResults.contents = contents;
		return config;
	});
}

/**
 * Add Google Services plugin to app-level build.gradle
 */
function withGoogleServicesAppGradle(config) {
	return withAppBuildGradle(config, (config) => {
		const { modResults } = config;
		let contents = modResults.contents;

		// Add Google Services plugin after other apply plugin statements if not present
		if (!contents.includes('apply plugin: "com.google.gms.google-services"')) {
			// Find the last apply plugin statement
			const applyPluginRegex = /apply plugin: ["']com\.facebook\.react["']/;
			const match = contents.match(applyPluginRegex);

			if (match) {
				const insertPosition = match.index + match[0].length;
				const googleServicesPlugin = '\napply plugin: "com.google.gms.google-services"';

				contents =
					contents.slice(0, insertPosition) +
					googleServicesPlugin +
					contents.slice(insertPosition);
			}
		}

		modResults.contents = contents;
		return config;
	});
}

/**
 * Add ECSDK library dependency to app-level build.gradle
 */
function withECSDKDependency(config) {
	return withAppBuildGradle(config, (config) => {
		const { modResults } = config;
		let contents = modResults.contents;

		// Add ECSDK dependency if not present
		if (!contents.includes("com.elerts.libraries:elertsui")) {
			// Find the dependencies block
			const dependenciesRegex = /dependencies\s*{/;
			const match = contents.match(dependenciesRegex);

			if (match) {
				const insertPosition = match.index + match[0].length;
				const ecsdkDependency =
					"\n    implementation 'com.elerts.libraries:elertsui:2.2.6'";

				contents =
					contents.slice(0, insertPosition) +
					ecsdkDependency +
					contents.slice(insertPosition);
			}
		}

		modResults.contents = contents;
		return config;
	});
}

/**
 * Add core library desugaring to app build.gradle
 */
function withCoreLibraryDesugaring(config) {
	return withAppBuildGradle(config, (config) => {
		let contents = config.modResults.contents;

		// Add coreLibraryDesugaringEnabled to android block if not present
		if (!contents.includes("coreLibraryDesugaringEnabled")) {
			// Find the android { block and add compileOptions inside it
			const androidBlockMatch = contents.match(/android\s*{/);
			if (androidBlockMatch) {
				const insertPosition = androidBlockMatch.index + androidBlockMatch[0].length;
				const compileOptions = `
    compileOptions {
        coreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
`;

				contents =
					contents.slice(0, insertPosition) +
					compileOptions +
					contents.slice(insertPosition);
			}
		}

		// Add desugar dependency if not present
		if (!contents.includes("desugar_jdk_libs")) {
			const dependenciesMatch = contents.match(/dependencies\s*{/);
			if (dependenciesMatch) {
				const insertPosition = dependenciesMatch.index + dependenciesMatch[0].length;
				const desugarDependency = `
    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'`;

				contents =
					contents.slice(0, insertPosition) +
					desugarDependency +
					contents.slice(insertPosition);
			}
		}

		config.modResults.contents = contents;
		return config;
	});
}

/**
 * Copy google-services.json to android/app if provided
 */
function withGoogleServicesFile(config, { googleServicesFile }) {
	return withDangerousMod(config, [
		"android",
		async (config) => {
			if (!googleServicesFile) {
				return config;
			}

			const projectRoot = config.modRequest.projectRoot;
			const sourceFile = path.resolve(projectRoot, googleServicesFile);
			const targetDir = path.join(config.modRequest.platformProjectRoot, "app");
			const targetFile = path.join(targetDir, "google-services.json");

			try {
				// Check if source file exists
				if (!fs.existsSync(sourceFile)) {
					console.warn(`⚠️  google-services.json not found at: ${sourceFile}`);
					console.warn(
						"   Skipping automatic copy. Please add it manually to android/app/",
					);
					return config;
				}

				// Ensure target directory exists
				if (!fs.existsSync(targetDir)) {
					fs.mkdirSync(targetDir, {
						recursive: true,
					});
				}

				// Copy the file
				fs.copyFileSync(sourceFile, targetFile);
			} catch (error) {
				console.error(`❌ Error copying google-services.json: ${error.message}`);
				console.warn("   Please manually copy google-services.json to android/app/");
			}

			return config;
		},
	]);
}

/**
 * Add use_modular_headers! to iOS Podfile for Firebase compatibility
 */
function withIOSModularHeaders(config) {
	return withDangerousMod(config, [
		"ios",
		async (config) => {
			const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");

			try {
				if (!fs.existsSync(podfilePath)) {
					console.warn(`⚠️  Podfile not found at: ${podfilePath}`);
					return config;
				}

				let podfileContents = fs.readFileSync(podfilePath, "utf8");

				// Check if use_modular_headers! already exists
				if (!podfileContents.includes("use_modular_headers!")) {
					// Find the target block and add use_modular_headers! after use_expo_modules!
					// Match pattern: target 'AppName' do\n  use_expo_modules!
					const targetMatch = podfileContents.match(
						/target\s+['"][^'"]+['"]\s+do\s*\n\s*use_expo_modules!\s*\n/,
					);

					if (targetMatch) {
						const insertPosition = targetMatch.index + targetMatch[0].length;
						const modularHeaders = `  use_modular_headers!\n\n`;

						podfileContents =
							podfileContents.slice(0, insertPosition) +
							modularHeaders +
							podfileContents.slice(insertPosition);

						fs.writeFileSync(podfilePath, podfileContents, "utf8");
					} else {
						console.warn(
							`⚠️  Could not find target block in Podfile. Please add 'use_modular_headers!' manually.`,
						);
					}
				}

				return config;
			} catch (error) {
				console.error(`❌ Error modifying Podfile: ${error.message}`);
				console.warn("   Please manually add 'use_modular_headers!' to your Podfile");
				return config;
			}
		},
	]);
}

module.exports = {
	withECSDKGradleProperties,
	withGitHubPackagesRepository,
	withGoogleServicesGradle,
	withGoogleServicesAppGradle,
	withECSDKDependency,
	withCoreLibraryDesugaring,
	withGoogleServicesFile,
	withIOSModularHeaders,
};
