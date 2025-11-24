const { withPodfile, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Config plugin to set up GitHub authentication for SPM packages
 *
 * For local builds: Creates/updates .netrc file in user's home directory
 * For EAS builds: Creates a build script that sets up authentication during build
 *
 * This is required for iOS to download private Swift packages from GitHub Packages
 */
const withSPMGitHubAuth = (config, { githubUsername, githubToken }) => {
	return withDangerousMod(config, [
		"ios",
		async (config) => {
			// Get GitHub credentials from plugin params or environment variables
			const gprUser = githubUsername || process.env.GPR_USER;
			const gprKey = githubToken || process.env.GPR_API_KEY;

			if (!gprUser || !gprKey) {
				console.warn("⚠️  GitHub credentials not provided for iOS SPM authentication.");
				console.warn(
					"   Set GPR_USER and GPR_API_KEY environment variables or pass githubUsername and githubToken to the plugin.",
				);
				return config;
			}

			// For local builds, create/update .netrc in home directory
			// Note: For EAS builds, you need to configure authentication via build hooks in eas.json
			// See plugin documentation for EAS build configuration
			try {
				const os = require("os");
				const netrcPath = path.join(os.homedir(), ".netrc");

				// Read existing .netrc if it exists
				let netrcContent = "";
				if (fs.existsSync(netrcPath)) {
					netrcContent = fs.readFileSync(netrcPath, "utf8");
				}

				// Check if GitHub Packages entry already exists
				const githubPackagesPattern = /machine\s+github\.com[\s\S]*?(?=machine|\n\n|$)/;
				const existingEntry = netrcContent.match(githubPackagesPattern);

				// Create/update GitHub Packages entry
				const githubEntry = `machine github.com
  login ${gprUser}
  password ${gprKey}

`;

				if (existingEntry) {
					// Replace existing entry
					netrcContent = netrcContent.replace(githubPackagesPattern, githubEntry);
				} else {
					// Append new entry
					netrcContent += githubEntry;
				}

				// Set proper permissions (read/write for owner only)
				fs.writeFileSync(netrcPath, netrcContent, {
					mode: 0o600,
				});
			} catch (error) {
				console.error(
					`❌ Error configuring GitHub authentication for SPM: ${error.message}`,
				);
				console.warn("   Please manually configure .netrc file in your home directory:");
				console.warn("   machine github.com");
				console.warn(`   login ${gprUser}`);
				console.warn("   password <your-token>");
			}

			return config;
		},
	]);
};

/**
 * Config plugin to add SPM frameworks to the main app target
 * This automatically adds ELERTSKitCore.framework and ELERTSKitUI.framework and configures framework search paths
 */
const withSPMFrameworks = (config) => {
	return withPodfile(config, (config) => {
		const podfile = config.modResults;

		// Extract project name from Podfile target (most reliable)
		const targetMatch = podfile.contents.match(/target\s+['"]([^'"]+)['"]/);
		let projectName = targetMatch ? targetMatch[1] : null;

		// Fallback to config values if not found in Podfile
		if (!projectName) {
			projectName =
				config.ios?.scheme ||
				config.name?.replace(/[^a-zA-Z0-9]/g, "") ||
				config.slug
					?.replace(/[^a-zA-Z0-9]/g, "")
					.split("-")
					.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
					.join("") ||
				"ECSDKExample";
		}

		// Find the post_install block
		const postInstallMatch = podfile.contents.match(
			/(post_install\s+do\s+\|installer\|[\s\S]*?)(\s+end)/,
		);

		if (postInstallMatch) {
			// Extract the existing post_install content
			const existingPostInstall = postInstallMatch[1];
			const endBlock = postInstallMatch[2];

			// Check if our code is already added
			if (podfile.contents.includes("Added SPM frameworks to main target")) {
				return config;
			}

			// The code to inject
			const spmFrameworkCode = `
    # Automatically add SPM frameworks to main app target
    main_project = installer.aggregate_targets.find { |target| target.user_project.path.basename.to_s == '${projectName}.xcodeproj' }&.user_project

    if main_project
      main_target = main_project.targets.find { |target| target.name == '${projectName}' }

      if main_target
        frameworks_group = main_project.main_group.find_subpath('Frameworks', true)

        # Find or create Embed Frameworks build phase
        embed_frameworks_phase = main_target.build_phases.find do |phase|
          phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) &&
            phase.name == 'Embed Frameworks'
        end

        unless embed_frameworks_phase
          embed_frameworks_phase = main_project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
          embed_frameworks_phase.name = 'Embed Frameworks'
          embed_frameworks_phase.dst_subfolder_spec = '10'  # Frameworks destination
          main_target.build_phases << embed_frameworks_phase
        end

        # ----- COPY BETWEEN THESE LINES TO ADD A NEW FRAMEWORK -----
        # Add ELERTSKitCore framework reference
        elertskitcore_ref = frameworks_group.new_reference('ELERTSKitCore.framework')
        elertskitcore_ref.source_tree = 'BUILT_PRODUCTS_DIR'
        elertskitcore_ref.path = 'ELERTSKitCore.framework'
        main_target.frameworks_build_phase.add_file_reference(elertskitcore_ref)
        
        # Embed ELERTSKitCore with signing
        elertskitcore_embed = embed_frameworks_phase.add_file_reference(elertskitcore_ref)
        elertskitcore_embed.settings = { 'ATTRIBUTES' => ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }

        # Add ELERTSKitUI framework reference
        elertskitui_ref = frameworks_group.new_reference('ELERTSKitUI.framework')
        elertskitui_ref.source_tree = 'BUILT_PRODUCTS_DIR'
        elertskitui_ref.path = 'ELERTSKitUI.framework'
        main_target.frameworks_build_phase.add_file_reference(elertskitui_ref)
        
        # Embed ELERTSKitUI with signing
        elertskitui_embed = embed_frameworks_phase.add_file_reference(elertskitui_ref)
        elertskitui_embed.settings = { 'ATTRIBUTES' => ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }
        # ----- COPY BETWEEN THESE LINES TO ADD A NEW FRAMEWORK -----
        # Note: SKPhotoBrowser and TLPhotoPicker are transitive dependencies that will be copied via Run Script

        # Add framework search paths for SPM frameworks
        main_target.build_configurations.each do |config|
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] = '$(inherited) $(BUILT_PRODUCTS_DIR)/PackageFrameworks $(PODS_XCFRAMEWORKS_BUILD_DIR) $(CONFIGURATION_BUILD_DIR)'

          # Handle OTHER_LDFLAGS as array or string - let SPM handle framework linking
          ldflags = config.build_settings['OTHER_LDFLAGS'] || []
          ldflags = [ldflags] if ldflags.is_a?(String)
          ldflags << '-Wl,-rpath,@executable_path/Frameworks'
          ldflags << '-Wl,-rpath,@loader_path/Frameworks'
          config.build_settings['OTHER_LDFLAGS'] = ldflags
        end

        # Add Run Script phase to copy SPM transitive frameworks and resource bundles
        copy_frameworks_script_name = 'Copy ELERTSKit Frameworks and Bundles'
        existing_script = main_target.build_phases.find do |phase|
          phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) &&
            phase.name == copy_frameworks_script_name
        end

        unless existing_script
          copy_frameworks_script = main_project.new(Xcodeproj::Project::Object::PBXShellScriptBuildPhase)
          copy_frameworks_script.name = copy_frameworks_script_name
          copy_frameworks_script.shell_script = <<-'SCRIPT'
# Copy SPM transitive dependency frameworks from PackageFrameworks to app Frameworks
if [ -d "\${BUILT_PRODUCTS_DIR}/PackageFrameworks" ]; then
  mkdir -p "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}"
  
  # Copy SKPhotoBrowser.framework if it exists
  if [ -d "\${BUILT_PRODUCTS_DIR}/PackageFrameworks/SKPhotoBrowser.framework" ]; then
    cp -RL "\${BUILT_PRODUCTS_DIR}/PackageFrameworks/SKPhotoBrowser.framework" "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/"
    /usr/bin/codesign --force --sign \${EXPANDED_CODE_SIGN_IDENTITY} --preserve-metadata=identifier,entitlements "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/SKPhotoBrowser.framework"
  fi
  
  # Copy TLPhotoPicker.framework if it exists
  if [ -d "\${BUILT_PRODUCTS_DIR}/PackageFrameworks/TLPhotoPicker.framework" ]; then
    cp -RL "\${BUILT_PRODUCTS_DIR}/PackageFrameworks/TLPhotoPicker.framework" "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/"
    /usr/bin/codesign --force --sign \${EXPANDED_CODE_SIGN_IDENTITY} --preserve-metadata=identifier,entitlements "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/TLPhotoPicker.framework"
  fi
fi

# Copy resource bundles
cp -RL "\${BUILT_PRODUCTS_DIR}/TLPhotoPicker_TLPhotoPicker.bundle" "\${BUILT_PRODUCTS_DIR}/\${UNLOCALIZED_RESOURCES_FOLDER_PATH}/" 2>/dev/null || true
cp -RL "\${BUILT_PRODUCTS_DIR}/SKPhotoBrowser_SKPhotoBrowser.bundle" "\${BUILT_PRODUCTS_DIR}/\${UNLOCALIZED_RESOURCES_FOLDER_PATH}/" 2>/dev/null || true
SCRIPT
          copy_frameworks_script.shell_path = '/bin/sh'
          copy_frameworks_script.show_env_vars_in_log = '0'
          
          # Insert before "Copy Bundle Resources" phase if it exists, otherwise append
          copy_resources_phase = main_target.build_phases.find do |phase|
            phase.is_a?(Xcodeproj::Project::Object::PBXResourcesBuildPhase)
          end
          
          if copy_resources_phase
            copy_resources_index = main_target.build_phases.index(copy_resources_phase)
            main_target.build_phases.insert(copy_resources_index, copy_frameworks_script)
          else
            main_target.build_phases << copy_frameworks_script
          end
          
          puts "✅ Added Run Script phase to copy ELERTSKit frameworks and resource bundles"
        end

        main_project.save
        puts "✅ Added SPM frameworks to main target with search paths"
      end
    end`;

			// Replace the post_install block with the existing content + new code
			podfile.contents = podfile.contents.replace(
				postInstallMatch[0],
				existingPostInstall + spmFrameworkCode + endBlock,
			);
		} else {
			// If no post_install block exists, add one
			const targetEndMatch = podfile.contents.match(
				/(target\s+['"][^'"]+['"]\s+do[\s\S]*?)(\s+end\s*$)/,
			);
			if (targetEndMatch) {
				const postInstallBlock = `
  post_install do |installer|
    # Automatically add SPM frameworks to main app target
    main_project = installer.aggregate_targets.find { |target| target.user_project.path.basename.to_s == '${projectName}.xcodeproj' }&.user_project

    if main_project
      main_target = main_project.targets.find { |target| target.name == '${projectName}' }

      if main_target
        frameworks_group = main_project.main_group.find_subpath('Frameworks', true)

        # Find or create Embed Frameworks build phase
        embed_frameworks_phase = main_target.build_phases.find do |phase|
          phase.is_a?(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase) &&
            phase.name == 'Embed Frameworks'
        end

        unless embed_frameworks_phase
          embed_frameworks_phase = main_project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
          embed_frameworks_phase.name = 'Embed Frameworks'
          embed_frameworks_phase.dst_subfolder_spec = '10'  # Frameworks destination
          main_target.build_phases << embed_frameworks_phase
        end

        # ----- COPY BETWEEN THESE LINES TO ADD A NEW FRAMEWORK -----
        # Add ELERTSKitCore framework reference
        elertskitcore_ref = frameworks_group.new_reference('ELERTSKitCore.framework')
        elertskitcore_ref.source_tree = 'BUILT_PRODUCTS_DIR'
        elertskitcore_ref.path = 'ELERTSKitCore.framework'
        main_target.frameworks_build_phase.add_file_reference(elertskitcore_ref)
        
        # Embed ELERTSKitCore with signing
        elertskitcore_embed = embed_frameworks_phase.add_file_reference(elertskitcore_ref)
        elertskitcore_embed.settings = { 'ATTRIBUTES' => ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }

        # Add ELERTSKitUI framework reference
        elertskitui_ref = frameworks_group.new_reference('ELERTSKitUI.framework')
        elertskitui_ref.source_tree = 'BUILT_PRODUCTS_DIR'
        elertskitui_ref.path = 'ELERTSKitUI.framework'
        main_target.frameworks_build_phase.add_file_reference(elertskitui_ref)
        
        # Embed ELERTSKitUI with signing
        elertskitui_embed = embed_frameworks_phase.add_file_reference(elertskitui_ref)
        elertskitui_embed.settings = { 'ATTRIBUTES' => ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] }
        # ----- COPY BETWEEN THESE LINES TO ADD A NEW FRAMEWORK -----
        # Note: SKPhotoBrowser and TLPhotoPicker are transitive dependencies that will be copied via Run Script

        # Add framework search paths for SPM frameworks
        main_target.build_configurations.each do |config|
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] = '$(inherited) $(BUILT_PRODUCTS_DIR)/PackageFrameworks $(PODS_XCFRAMEWORKS_BUILD_DIR) $(CONFIGURATION_BUILD_DIR)'

          # Handle OTHER_LDFLAGS as array or string - let SPM handle framework linking
          ldflags = config.build_settings['OTHER_LDFLAGS'] || []
          ldflags = [ldflags] if ldflags.is_a?(String)
          ldflags << '-Wl,-rpath,@executable_path/Frameworks'
          ldflags << '-Wl,-rpath,@loader_path/Frameworks'
          config.build_settings['OTHER_LDFLAGS'] = ldflags
        end

        # Add Run Script phase to copy SPM transitive frameworks and resource bundles
        copy_frameworks_script_name = 'Copy ELERTSKit Frameworks and Bundles'
        existing_script = main_target.build_phases.find do |phase|
          phase.is_a?(Xcodeproj::Project::Object::PBXShellScriptBuildPhase) &&
            phase.name == copy_frameworks_script_name
        end

        unless existing_script
          copy_frameworks_script = main_project.new(Xcodeproj::Project::Object::PBXShellScriptBuildPhase)
          copy_frameworks_script.name = copy_frameworks_script_name
          copy_frameworks_script.shell_script = <<-'SCRIPT'
# Copy SPM transitive dependency frameworks from PackageFrameworks to app Frameworks
if [ -d "\${BUILT_PRODUCTS_DIR}/PackageFrameworks" ]; then
  mkdir -p "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}"
  
  # Copy SKPhotoBrowser.framework if it exists
  if [ -d "\${BUILT_PRODUCTS_DIR}/PackageFrameworks/SKPhotoBrowser.framework" ]; then
    cp -RL "\${BUILT_PRODUCTS_DIR}/PackageFrameworks/SKPhotoBrowser.framework" "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/"
    /usr/bin/codesign --force --sign \${EXPANDED_CODE_SIGN_IDENTITY} --preserve-metadata=identifier,entitlements "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/SKPhotoBrowser.framework"
  fi
  
  # Copy TLPhotoPicker.framework if it exists
  if [ -d "\${BUILT_PRODUCTS_DIR}/PackageFrameworks/TLPhotoPicker.framework" ]; then
    cp -RL "\${BUILT_PRODUCTS_DIR}/PackageFrameworks/TLPhotoPicker.framework" "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/"
    /usr/bin/codesign --force --sign \${EXPANDED_CODE_SIGN_IDENTITY} --preserve-metadata=identifier,entitlements "\${BUILT_PRODUCTS_DIR}/\${FRAMEWORKS_FOLDER_PATH}/TLPhotoPicker.framework"
  fi
fi

# Copy resource bundles
cp -RL "\${BUILT_PRODUCTS_DIR}/TLPhotoPicker_TLPhotoPicker.bundle" "\${BUILT_PRODUCTS_DIR}/\${UNLOCALIZED_RESOURCES_FOLDER_PATH}/" 2>/dev/null || true
cp -RL "\${BUILT_PRODUCTS_DIR}/SKPhotoBrowser_SKPhotoBrowser.bundle" "\${BUILT_PRODUCTS_DIR}/\${UNLOCALIZED_RESOURCES_FOLDER_PATH}/" 2>/dev/null || true
SCRIPT
          copy_frameworks_script.shell_path = '/bin/sh'
          copy_frameworks_script.show_env_vars_in_log = '0'
          
          # Insert before "Copy Bundle Resources" phase if it exists, otherwise append
          copy_resources_phase = main_target.build_phases.find do |phase|
            phase.is_a?(Xcodeproj::Project::Object::PBXResourcesBuildPhase)
          end
          
          if copy_resources_phase
            copy_resources_index = main_target.build_phases.index(copy_resources_phase)
            main_target.build_phases.insert(copy_resources_index, copy_frameworks_script)
          else
            main_target.build_phases << copy_frameworks_script
          end
          
          puts "✅ Added Run Script phase to copy ELERTSKit frameworks and resource bundles"
        end

        main_project.save
        puts "✅ Added SPM frameworks to main target with search paths"
      end
    end
  end`;
				podfile.contents = podfile.contents.replace(
					targetEndMatch[0],
					targetEndMatch[1] + postInstallBlock + targetEndMatch[2],
				);
			}
		}

		return config;
	});
};

module.exports = {
	withSPMGitHubAuth,
	withSPMFrameworks,
};
