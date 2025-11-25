const { withAppDelegate } = require("@expo/config-plugins");

/**
 * Config plugin to inject ELERTSKit initialization into AppDelegate
 * This ensures initialization happens in willFinishLaunchingWithOptions on the main thread
 *
 * @param {Object} options - Plugin options
 * @param {string} options.apiKey - ELERTSKit API key (required)
 * @param {string} options.productKey - Product key (short name for your app without spaces, optional)
 */
const withAppDelegateInitialization = (config, options = {}) => {
	return withAppDelegate(config, (config) => {
		const appDelegate = config.modResults;

		// Get API key from plugin options or config.extra
		const apiKey = options.apiKey || config.extra?.ecsdkApiKey;

		// Get product key from plugin options or config.extra
		const productKey = options.productKey || config.extra?.ecsdkProductKey;

		if (!apiKey) {
			throw new Error(
				`ECSDK Config Plugin Error: ECSDK API key is required for iOS AppDelegate initialization but not found.

The API key should be provided via:
1. Plugin options: { apiKey: "your-key" }
2. Config extra field: config.extra.ecsdkApiKey

This error indicates the main plugin validation may have been bypassed.
Please ensure 'ecsdkApiKey' is provided in the plugin configuration.`,
			);
		}

		// Check if we've already added the initialization
		if (appDelegate.contents.includes("ELERTSKit.initializeDataUI")) {
			return config;
		}

		// Add import statements if not present
		if (!appDelegate.contents.includes("import ELERTSKitCore")) {
			// Find the last import statement and add after it
			const importMatch = appDelegate.contents.match(/(import\s+[^\n]+\n)/g);
			if (importMatch) {
				const lastImport = importMatch[importMatch.length - 1];
				const lastImportIndex = appDelegate.contents.lastIndexOf(lastImport);
				appDelegate.contents =
					appDelegate.contents.slice(0, lastImportIndex + lastImport.length) +
					"import ELERTSKitCore\n" +
					"import ELERTSKitUI\n" +
					appDelegate.contents.slice(lastImportIndex + lastImport.length);
			} else {
				// If no imports found, add at the top
				appDelegate.contents =
					"import ELERTSKitCore\nimport ELERTSKitUI\n" + appDelegate.contents;
			}
		}

		// Find willFinishLaunchingWithOptions method
		// Handle both Swift and Objective-C patterns
		const willFinishLaunchingPattern =
			/(func\s+application\([^)]*willFinishLaunchingWithOptions[^)]*\)\s*->\s*Bool\s*\{)/;
		const willFinishMatch = appDelegate.contents.match(willFinishLaunchingPattern);

		if (willFinishMatch) {
			// Find the opening brace and inject code after it
			const methodStart = willFinishMatch.index + willFinishMatch[0].length;
			const productKeyCode = productKey
				? `ELERTSKit.productKey = "${productKey}"`
				: `if let productKey = Bundle.main.object(forInfoDictionaryKey: "ECSDK_PRODUCT_KEY") as? String {
            ELERTSKit.productKey = productKey
        }`;

			const initializationCode = `
        // Initialize ELERTSKit - injected by ecsdk-expo plugin
        // This must be called in willFinishLaunchingWithOptions on the main thread
        var ecsdkApiKey = "${apiKey}"
        if let apiKeyFromPlist = Bundle.main.object(forInfoDictionaryKey: "ECSDK_API_KEY") as? String {
            ecsdkApiKey = apiKeyFromPlist
        }
        ELERTSKit.initializeDataUI(apiKey: ecsdkApiKey)
        ELERTSKit.backgroundFetchManager = EKBackgroundFetchManager()
        ${productKeyCode}
        
        // Set EKNotificationManager delegate for remote notifications
        EKNotificationManager.default.delegate = self
`;

			// Find the first line after the opening brace (skip whitespace)
			let insertIndex = methodStart;
			while (
				insertIndex < appDelegate.contents.length &&
				(appDelegate.contents[insertIndex] === " " ||
					appDelegate.contents[insertIndex] === "\n" ||
					appDelegate.contents[insertIndex] === "\t")
			) {
				insertIndex++;
			}

			appDelegate.contents =
				appDelegate.contents.slice(0, insertIndex) +
				initializationCode +
				appDelegate.contents.slice(insertIndex);
		} else {
			// If willFinishLaunchingWithOptions doesn't exist, try didFinishLaunchingWithOptions
			const didFinishPattern =
				/(func\s+application\([^)]*didFinishLaunchingWithOptions[^)]*\)\s*->\s*Bool\s*\{)/;
			const didFinishMatch = appDelegate.contents.match(didFinishPattern);

			if (didFinishMatch) {
				const methodStart = didFinishMatch.index + didFinishMatch[0].length;
				const productKeyCode = productKey
					? `ELERTSKit.productKey = "${productKey}"`
					: `if let productKey = Bundle.main.object(forInfoDictionaryKey: "ECSDK_PRODUCT_KEY") as? String {
              ELERTSKit.productKey = productKey
          }`;

				const initializationCode = `
        // Initialize ELERTSKit - injected by ecsdk-expo plugin
        // This must be called on the main thread
        var ecsdkApiKey = "${apiKey}"
        if let apiKeyFromPlist = Bundle.main.object(forInfoDictionaryKey: "ECSDK_API_KEY") as? String {
            ecsdkApiKey = apiKeyFromPlist
        }
        ELERTSKit.initializeDataUI(apiKey: ecsdkApiKey)
        ELERTSKit.backgroundFetchManager = EKBackgroundFetchManager()
        ${productKeyCode}
        
        // Set EKNotificationManager delegate for remote notifications
        EKNotificationManager.default.delegate = self
`;

				let insertIndex = methodStart;
				while (
					insertIndex < appDelegate.contents.length &&
					(appDelegate.contents[insertIndex] === " " ||
						appDelegate.contents[insertIndex] === "\n" ||
						appDelegate.contents[insertIndex] === "\t")
				) {
					insertIndex++;
				}

				appDelegate.contents =
					appDelegate.contents.slice(0, insertIndex) +
					initializationCode +
					appDelegate.contents.slice(insertIndex);
			} else {
				console.warn(
					"⚠️  Could not find willFinishLaunchingWithOptions or didFinishLaunchingWithOptions in AppDelegate. ELERTSKit initialization will not be injected automatically.",
				);
			}
		}

		// Add EKNotificationManagerDelegate to class declaration if not present
		if (!appDelegate.contents.includes("EKNotificationManagerDelegate")) {
			// Find the class declaration line - match "class AppDelegate :" followed by the base class and optional protocols
			const classPattern = /(public\s+class\s+AppDelegate\s*:\s*[^{,]+)/;
			const classMatch = appDelegate.contents.match(classPattern);
			if (classMatch) {
				// Replace with the same pattern but add the protocol
				// This handles both cases: with or without existing protocols
				appDelegate.contents = appDelegate.contents.replace(
					classPattern,
					"$1, EKNotificationManagerDelegate",
				);
			}
		}

		// Add background fetch handler if it doesn't exist
		if (!appDelegate.contents.includes("performFetchWithCompletionHandler")) {
			// Find the end of the AppDelegate class (before the closing brace)
			// Look for the last method or property before the closing brace
			const classEndPattern = /(\n\s*\}\s*$)/;
			const classEndMatch = appDelegate.contents.match(classEndPattern);

			if (classEndMatch) {
				const backgroundFetchCode = `
  
  // Background fetch handler - injected by ecsdk-expo plugin
  // Enables store and forward when there is poor connectivity
  public func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
      ELERTSKit.backgroundFetchManager.application(application, performFetchWithCompletionHandler: completionHandler)
  }
`;

				// Insert before the closing brace
				const insertIndex = classEndMatch.index;
				appDelegate.contents =
					appDelegate.contents.slice(0, insertIndex) +
					backgroundFetchCode +
					appDelegate.contents.slice(insertIndex);
			} else {
				// If we can't find the class end, try to add it before the last closing brace
				const lastBraceIndex = appDelegate.contents.lastIndexOf("\n}");
				if (lastBraceIndex !== -1) {
					const backgroundFetchCode = `
  
  // Background fetch handler - injected by ecsdk-expo plugin
  // Enables store and forward when there is poor connectivity
  public func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
      ELERTSKit.backgroundFetchManager.application(application, performFetchWithCompletionHandler: completionHandler)
  }
`;
					appDelegate.contents =
						appDelegate.contents.slice(0, lastBraceIndex) +
						backgroundFetchCode +
						appDelegate.contents.slice(lastBraceIndex);
				}
			}
		}

		// Add remote notification handlers if they don't exist
		if (!appDelegate.contents.includes("didRegisterForRemoteNotificationsWithDeviceToken")) {
			// Find the end of the AppDelegate class (before the closing brace)
			const classEndPattern = /(\n\s*\}\s*$)/;
			const classEndMatch = appDelegate.contents.match(classEndPattern);

			if (classEndMatch) {
				const remoteNotificationCode = `
  
  // MARK: - Remote Notifications - injected by ecsdk-expo plugin
  
  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    EKNotificationManager.default.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }
  
  public func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    EKNotificationManager.default.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }
  
  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    EKNotificationManager.default.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
  
  // MARK: - EKNotificationManagerDelegate - injected by ecsdk-expo plugin
  
  public func getTopViewController() -> UIViewController? {
    guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
          let rootViewController = windowScene.windows.first?.rootViewController else {
      return nil
    }
    
    // Get the topmost view controller
    var topViewController = rootViewController
    while let presented = topViewController.presentedViewController {
      topViewController = presented
    }
    
    return topViewController
  }
  
  public func openViewForNotification() {
    // Show the alert list if the user taps on a notification
    DispatchQueue.main.async { [weak self] in
      guard let topViewController = self?.getTopViewController() else {
        return
      }
      
      // Check if client token is available
      guard EKKeychain.getString(.token) != nil else {
        let alert = UIAlertController(
          title: "Not Logged In",
          message: "Please login first before viewing messages.",
          preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        topViewController.present(alert, animated: true)
        return
      }
      
      // Create and present the message list view controller
      let messageListVC = EKUIThreadListViewController()
      let navController = UINavigationController(rootViewController: messageListVC)
      topViewController.present(navController, animated: true, completion: nil)
    }
  }
`;

				// Insert before the closing brace
				const insertIndex = classEndMatch.index;
				appDelegate.contents =
					appDelegate.contents.slice(0, insertIndex) +
					remoteNotificationCode +
					appDelegate.contents.slice(insertIndex);
			} else {
				// If we can't find the class end, try to add it before the last closing brace
				const lastBraceIndex = appDelegate.contents.lastIndexOf("\n}");
				if (lastBraceIndex !== -1) {
					const remoteNotificationCode = `
  
  // MARK: - Remote Notifications - injected by ecsdk-expo plugin
  
  public func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    EKNotificationManager.default.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }
  
  public func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    EKNotificationManager.default.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }
  
  public func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    EKNotificationManager.default.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
  
  // MARK: - EKNotificationManagerDelegate - injected by ecsdk-expo plugin
  
  public func getTopViewController() -> UIViewController? {
    guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
          let rootViewController = windowScene.windows.first?.rootViewController else {
      return nil
    }
    
    // Get the topmost view controller
    var topViewController = rootViewController
    while let presented = topViewController.presentedViewController {
      topViewController = presented
    }
    
    return topViewController
  }
  
  public func openViewForNotification() {
    // Show the alert list if the user taps on a notification
    DispatchQueue.main.async { [weak self] in
      guard let topViewController = self?.getTopViewController() else {
        return
      }
      
      // Check if client token is available
      guard EKKeychain.getString(.token) != nil else {
        let alert = UIAlertController(
          title: "Not Logged In",
          message: "Please login first before viewing messages.",
          preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        topViewController.present(alert, animated: true)
        return
      }
      
      // Create and present the message list view controller
      let messageListVC = EKUIThreadListViewController()
      let navController = UINavigationController(rootViewController: messageListVC)
      topViewController.present(navController, animated: true, completion: nil)
    }
  }
`;
					appDelegate.contents =
						appDelegate.contents.slice(0, lastBraceIndex) +
						remoteNotificationCode +
						appDelegate.contents.slice(lastBraceIndex);
				}
			}
		}

		return config;
	});
};

module.exports = {
	withAppDelegateInitialization,
};
