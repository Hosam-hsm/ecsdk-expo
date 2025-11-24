const { withMainApplication } = require("@expo/config-plugins");

function withECSDKMainApplication(config) {
	return withMainApplication(config, (config) => {
		const { modResults } = config;
		let contents = modResults.contents;

		// Add imports if not present
		const importsNeeded = [];
		if (!contents.includes("import android.content.Context")) {
			importsNeeded.push("import android.content.Context");
		}
		if (!contents.includes("import android.content.res.Configuration")) {
			importsNeeded.push("import android.content.res.Configuration");
		}
		if (!contents.includes("import com.elerts.ecsdk.ui.ECUISDK")) {
			importsNeeded.push("import com.elerts.ecsdk.ui.ECUISDK");
		}

		if (importsNeeded.length > 0) {
			// Find the package declaration and add imports after it
			const packageMatch = contents.match(/package\s+[\w.]+\s*;?\s*\n/);
			if (packageMatch) {
				const insertPosition = packageMatch.index + packageMatch[0].length;
				const imports = `\n${importsNeeded.join("\n")}\n`;
				contents =
					contents.slice(0, insertPosition) + imports + contents.slice(insertPosition);
			}
		}

		// Add ECUISDK instance variable if not present
		if (!contents.includes("private lateinit var ecuisdk: ECUISDK")) {
			// Find the class declaration and add the variable
			const classMatch = contents.match(/class\s+\w+\s*:\s*Application\(\).*?{/);
			if (classMatch) {
				const insertPosition = classMatch.index + classMatch[0].length;
				const variable = `\n    private lateinit var ecuisdk: ECUISDK\n`;
				contents =
					contents.slice(0, insertPosition) + variable + contents.slice(insertPosition);
			}
		}

		// Initialize ECUISDK in onCreate if not present
		if (!contents.includes("ecuisdk = ECUISDK(this)")) {
			// Find onCreate method and add initialization
			const onCreateMatch = contents.match(/override\s+fun\s+onCreate\(\)\s*{/);
			if (onCreateMatch) {
				const insertPosition = onCreateMatch.index + onCreateMatch[0].length;
				const initialization = `\n        ecuisdk = ECUISDK(this)`;
				contents =
					contents.slice(0, insertPosition) +
					initialization +
					contents.slice(insertPosition);
			}
		}

		// Add attachBaseContext override if not present
		if (!contents.includes("override fun attachBaseContext")) {
			// Find onCreate method and add attachBaseContext before it
			const onCreateMatch = contents.match(/override\s+fun\s+onCreate\(\)\s*{/);
			if (onCreateMatch) {
				const insertPosition = onCreateMatch.index;
				const attachBaseContext = `override fun attachBaseContext(base: Context) {
        super.attachBaseContext(ECUISDK.getBaseContext(base))
    }



    `;
				contents =
					contents.slice(0, insertPosition) +
					attachBaseContext +
					contents.slice(insertPosition);
			}
		}

		// Add or update onConfigurationChanged override
		if (!contents.includes("ecuisdk.onConfigurationChanged(this)")) {
			// Check if onConfigurationChanged already exists
			const onConfigChangedMethodRegex =
				/override\s+fun\s+onConfigurationChanged\s*\([^)]*\)\s*{/;
			const methodMatch = contents.match(onConfigChangedMethodRegex);

			if (methodMatch) {
				// Method exists, find the matching closing brace
				const methodStart = methodMatch.index;
				const openBracePos = methodStart + methodMatch[0].length - 1;
				let braceCount = 1;
				let pos = openBracePos + 1;
				let closingBracePos = -1;

				// Find the matching closing brace
				while (pos < contents.length && braceCount > 0) {
					if (contents[pos] === "{") braceCount++;
					else if (contents[pos] === "}") braceCount--;
					if (braceCount === 0) {
						closingBracePos = pos;
						break;
					}
					pos++;
				}

				if (closingBracePos !== -1) {
					// Find the last line before the closing brace to determine indentation
					const beforeClosingBrace = contents.substring(
						openBracePos + 1,
						closingBracePos,
					);
					const lines = beforeClosingBrace.split("\n");
					const lastLine = lines[lines.length - 1];
					const indentMatch = lastLine.match(/^(\s*)/);
					const indent = indentMatch ? indentMatch[1] : "    ";

					// Add ecuisdk call before the closing brace
					const ecuisdkCall = `${indent}ecuisdk.onConfigurationChanged(this)\n`;
					contents =
						contents.slice(0, closingBracePos) +
						ecuisdkCall +
						contents.slice(closingBracePos);
				}
			} else {
				// Method doesn't exist, create it
				const attachBaseContextMatch = contents.match(
					/override\s+fun\s+attachBaseContext\(base:\s*Context\)\s*{[\s\S]*?}\s*\n/,
				);
				if (attachBaseContextMatch) {
					const insertPosition =
						attachBaseContextMatch.index + attachBaseContextMatch[0].length;
					const onConfigurationChanged = `override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        ecuisdk.onConfigurationChanged(this)
    }



    `;
					contents =
						contents.slice(0, insertPosition) +
						onConfigurationChanged +
						contents.slice(insertPosition);
				} else {
					// If attachBaseContext doesn't exist, add before onCreate
					const onCreateMatch = contents.match(/override\s+fun\s+onCreate\(\)\s*{/);
					if (onCreateMatch) {
						const insertPosition = onCreateMatch.index;
						const onConfigurationChanged = `override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        ecuisdk.onConfigurationChanged(this)
    }



    `;
						contents =
							contents.slice(0, insertPosition) +
							onConfigurationChanged +
							contents.slice(insertPosition);
					}
				}
			}
		}

		modResults.contents = contents;
		return config;
	});
}

module.exports = {
	withECSDKMainApplication,
};

