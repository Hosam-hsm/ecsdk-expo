import ExpoModulesCore
import ELERTSKitCore
import ELERTSKitUI

// Helper function to extract organization ID from EKOrganization
private func getOrganizationId(from org: EKOrganization) -> Int {
  var orgId: Int = 0
  let mirror = Mirror(reflecting: org)
  for child in mirror.children {
    if let label = child.label {
      // Try common property name variations
      if label == "organizationId" || label == "id" || label == "_organizationId" || 
         label == "organizationID" || label == "_id" || label.contains("organizationId") {
        if let value = child.value as? Int {
          orgId = value
          break
        }
      }
    }
  }
  return orgId
}

// Helper function to convert EKOrganization to dictionary
private func organizationToDict(_ org: EKOrganization) -> [String: Any] {
  return [
    "organizationId": getOrganizationId(from: org),
    "name": org.name,
    "description": org.description
  ]
}

// Helper function to create profile field items
private func createProfileFieldItems() -> [EKUIProfileFieldItem] {
  let firstNameField = EKUIProfileFieldItem(
    name: "First Name",
    type: EKUIProfileItemType.firstName
  )
  
  let lastNameField = EKUIProfileFieldItem(
    name: "Last Name",
    type: EKUIProfileItemType.lastName
  )
  
  let emailField = EKUIProfileFieldItem(
    name: "Email",
    type: EKUIProfileItemType.email
  )
  
  let phoneField = EKUIProfileFieldItem(
    name: "Mobile Number",
    type: EKUIProfileItemType.phone
  )
  
  return [firstNameField, lastNameField, emailField, phoneField]
}

// Helper function to create profile view controller config
private func createProfileVCConfig() -> EKUIProfileConfig {
  return EKUIProfileConfig(
    name: "My Info",
    header: nil,
    footer: "Update your profile information",
    isRequired: true,
    allowEmailRegistration: true,
    items: createProfileFieldItems()
  )
}

// Custom profile view controller with custom dismiss buttons
private class CustomProfileViewController: EKUIProfileViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    
    // Set up custom navigation bar buttons
    setupCustomButtons()
  }
  
  private func setupCustomButtons() {
    // Create cancel button
    let cancelButton = UIBarButtonItem(
      barButtonSystemItem: .cancel,
      target: self,
      action: #selector(cancelButtonTapped)
    )
    self.navigationItem.leftBarButtonItem = cancelButton
    
    // Create save button
    let saveButton = UIBarButtonItem(
      barButtonSystemItem: .save,
      target: self,
      action: #selector(saveButtonTapped)
    )
    self.navigationItem.rightBarButtonItem = saveButton
  }
  
  @objc private func cancelButtonTapped() {
    // Dismiss without saving
    self.dismiss(animated: true, completion: nil)
  }
  
  @objc private func saveButtonTapped() {
    // Save values with completion handler
    self.saveValues { [weak self] (saved) in
      guard let self = self else { return }
      
      // The saveValues method will check for errors and show them
      // It will also save to keychain and update ELERTS Cloud
      // Dismiss the view controller in the callback
      if saved {
        DispatchQueue.main.async {
          self.dismiss(animated: true, completion: nil)
        }
      }
    }
  }
}

public class EcsdkExpoModule: Module {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('EcsdkExpo')` in JavaScript.
    Name("EcsdkExpo")

    // Defines constant property on the module.
    Constant("PI") {
      Double.pi
    }
    
    // Get client token
    Function("getClientToken") {
      return ELERTSKit.getClientToken()
    }

    // Create a new client account
    AsyncFunction("createClient") { (profileDict: [String: Any], promise: Promise) -> Void in
      let firstName = profileDict["firstName"] as? String ?? ""
      let lastName = profileDict["lastName"] as? String ?? ""
      let email = profileDict["email"] as? String ?? ""
      let phone = profileDict["phone"] as? String ?? ""
      // Note: otherFields is not currently supported as it requires [EKUserProfileField]?
      // Passing nil for now - can be extended later if needed
      
      let profile = EKUserProfile(
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        otherFields: nil
      )
      
      ELERTSKit.createClient(profile: profile) { result in
        switch result {
        case .success(let clientToken):
          promise.resolve(clientToken)
        case .failure(let error):
          promise.reject("CREATE_CLIENT_ERROR", "Error creating account: \(error.localizedDescription)")
        }
      }
    }

    // Join organization
    AsyncFunction("joinOrganization") { (organizationId: Int, promise: Promise) -> Void in
      guard EKKeychain.getString(.token) != nil else {
        promise.reject("JOIN_ORG_ERROR", "No client token available. Please login first.")
        return
      }
      
      let organization = EKOrganization(organizationId: organizationId)
      ELERTSKit.joinOrganization([organization]) { joinResult in
        switch joinResult {
        case .success:
          promise.resolve(["success": true])
        case .failure(let error):
          promise.reject("JOIN_ORG_ERROR", "Error joining org: \(error.localizedDescription)")
        }
      }
    }

    // List organizations (joined or available)
    AsyncFunction("listOrganizations") { (joined: Bool, promise: Promise) -> Void in
      guard EKKeychain.getString(.token) != nil else {
        promise.reject("LIST_ORG_ERROR", "No client token available. Please login first.")
        return
      }
      
      // Call the SDK's API to list organizations
      // The SDK may automatically update ELERTSKit.organizations internally
      _ = EKAPI.Organization.list(joined: joined).go(EKAPI.Organization.ListResult.self) { result in
        switch result {
        case .success(let listResult):
          // Unwrap optional Set and convert to array of dictionaries
          guard let organizations = listResult.organizations else {
            promise.resolve([])
            return
          }
          
          // Ensure ELERTSKit.organizations is updated with the fetched organizations
          ELERTSKit.organizations.fire(organizations)
          
          let orgs = Array(organizations).map { (org: EKOrganization) -> [String: Any] in
            return organizationToDict(org)
          }
          promise.resolve(orgs)
        case .failure(let error):
          promise.reject("LIST_ORG_ERROR", "Error listing organizations: \(error.localizedDescription)")
        @unknown default:
          promise.reject("LIST_ORG_ERROR", "Unknown error listing organizations")
        }
      }
    }

    // Set active organization
    AsyncFunction("setActiveOrganization") { (organizationId: Int, promise: Promise) -> Void in
      // Try to find the organization in the SDK's organizations list first
      // This ensures we use the full organization object with all its data
      var organizationToSet: EKOrganization? = nil
      
      if let organizations = ELERTSKit.organizations.lastDataFired {
        organizationToSet = organizations.first { org in
          getOrganizationId(from: org) == organizationId
        }
      }
      
      if organizationToSet == nil {
        organizationToSet = EKOrganization(organizationId: organizationId)
      }
      
      ELERTSKit.activeOrganization.fire(organizationToSet!)
      promise.resolve(["success": true])
    }

    // Get active organization
    AsyncFunction("getActiveOrganization") { (promise: Promise) -> Void in
      if let activeOrg = ELERTSKit.activeOrganization.lastDataFired as? EKOrganization {
        promise.resolve(organizationToDict(activeOrg))
      } else {
        // Return dictionary with organizationId: 0 to indicate no active organization
        promise.resolve([
          "organizationId": 0,
          "name": "",
          "description": ""
        ])
      }
    }

    // Get list of available organizations
    Function("getAvailableOrganizations") {
      if let organizations = ELERTSKit.organizations.lastDataFired {
        // Convert Set to Array if needed
        let orgArray = Array(organizations)
        return orgArray.map { (org: EKOrganization) -> [String: Any] in
          return organizationToDict(org)
        }
      }
      return []
    }

    // Update client info
    AsyncFunction("updateClientInfo") { (profileDict: [String: Any], promise: Promise) -> Void in
      let firstName = profileDict["firstName"] as? String ?? ""
      let lastName = profileDict["lastName"] as? String ?? ""
      let email = profileDict["email"] as? String ?? ""
      let phone = profileDict["phone"] as? String ?? ""
      // Note: otherFields is not currently supported as it requires [EKUserProfileField]?
      // Passing nil for now - can be extended later if needed
      
      let profile = EKUserProfile(
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        otherFields: nil
      )
      
      ELERTSKit.updateClientInfo(profile: profile) { result in
        switch result {
        case .success:
          promise.resolve(true)
        case .failure(let error):
          promise.reject("UPDATE_CLIENT_ERROR", "Error updating account: \(error.localizedDescription)")
        }
      }
    }

    // Login with client token
    Function("login") { (clientToken: String) -> Void in
      ELERTSKitUI.login(elertsClientToken: clientToken)
    }

    // Logout
    Function("logout") {
      ELERTSKitUI.logout()
    }

    // Present report screen
    Function("presentReportScreen") {
      DispatchQueue.main.async {
        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
          return
        }
        
        // Get the topmost view controller
        var topViewController = rootViewController
        while let presented = topViewController.presentedViewController {
          topViewController = presented
        }
        
        // Check if active organization is set
        guard let activeOrg = ELERTSKit.activeOrganization.lastDataFired as? EKOrganization else {
          let alert = UIAlertController(
            title: "No Active Organization",
            message: "Please select and join an organization before reporting a problem.",
            preferredStyle: .alert
          )
          alert.addAction(UIAlertAction(title: "OK", style: .default))
          topViewController.present(alert, animated: true)
          return
        }
        
        // Try to find the full organization object from the SDK's list
        var fullOrg: EKOrganization? = nil
        if let organizations = ELERTSKit.organizations.lastDataFired {
          let orgId = getOrganizationId(from: activeOrg)
          fullOrg = organizations.first { org in
            getOrganizationId(from: org) == orgId
          }
        }
        
        // Use the full organization object if found, otherwise use the active one
        let orgToUse = fullOrg ?? activeOrg
        ELERTSKit.activeOrganization.fire(orgToUse)
        
        // Create and present the report view controller
        let reportVC = EKUIReportViewController.initInNavigationController(reportConfig: EKUIReportConfig.defaultConfig())
        topViewController.present(reportVC, animated: true, completion: nil)
      }
    }

    // Present organization screen
    Function("presentOrganizationScreen") {
      DispatchQueue.main.async {
        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
          return
        }
        
        // Get the topmost view controller
        var topViewController = rootViewController
        while let presented = topViewController.presentedViewController {
          topViewController = presented
        }
        
        // Check if client token is available
        guard EKKeychain.getString(.token) != nil else {
          let alert = UIAlertController(
            title: "Not Logged In",
            message: "Please login first before managing organizations.",
            preferredStyle: .alert
          )
          alert.addAction(UIAlertAction(title: "OK", style: .default))
          topViewController.present(alert, animated: true)
          return
        }
        
        // Create and present the organization view controller
        let organizationVC = EKUIOrganizationViewController(
          config: EKUIOrgFeedConfig(
            name: "",
            header: nil,
            footer: nil,
            orgFeedItem: EKUIOrgFeedItem(name: "", fieldName: "")
          )
        )
        let navController = UINavigationController(rootViewController: organizationVC)
        topViewController.present(navController, animated: true, completion: nil)
      }
    }

    // Present profile screen
    Function("presentProfileScreen") {
      DispatchQueue.main.async {
        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
          return
        }
        
        // Get the topmost view controller
        var topViewController = rootViewController
        while let presented = topViewController.presentedViewController {
          topViewController = presented
        }
        
        // Check if client token is available
        guard EKKeychain.getString(.token) != nil else {
          let alert = UIAlertController(
            title: "Not Logged In",
            message: "Please login first before updating your profile.",
            preferredStyle: .alert
          )
          alert.addAction(UIAlertAction(title: "OK", style: .default))
          topViewController.present(alert, animated: true)
          return
        }
        
        // Create profile config
        let userProfileConfig = createProfileVCConfig()
        
        // Create custom profile view controller with config
        let userProfileVC = CustomProfileViewController(config: userProfileConfig)
        
        // Wrap in navigation controller
        let navController = UINavigationController(rootViewController: userProfileVC)
        
        // Present the profile view controller
        topViewController.present(navController, animated: true, completion: nil)
      }
    }

    // Show call police prompt
    Function("showCallPrompt") {
      DispatchQueue.main.async {
        // Get active organization to retrieve phone info (optional, for reference)
        // The phone and phoneTitle can be used for logging or custom implementation if needed
        if let activeOrg = ELERTSKit.activeOrganization.lastDataFired as? EKOrganization {
          let _ = activeOrg.phone
          let _ = activeOrg.phoneTitle
        }
        
        // Show the call alert using EKCallHelper
        // customNumber: nil (uses default police number)
        // panicSent: nil (no panic callback - SDK will log to console when user calls)
        // showOrgName: false (don't show organization name in alert)
        EKCallHelper.showCallAlert(customNumber: nil, panicSent: nil, showOrgName: false)
      }
    }

    // Show message list
    Function("showMessageList") {
      DispatchQueue.main.async {
        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
          return
        }
        
        // Get the topmost view controller
        var topViewController = rootViewController
        while let presented = topViewController.presentedViewController {
          topViewController = presented
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
        // EKUIThreadListViewController displays the list of messages
        // When a user taps on a message, the SDK will automatically handle navigation
        // to EKUIThreadMessageViewController for message detail
        let messageListVC = EKUIThreadListViewController()
        let navController = UINavigationController(rootViewController: messageListVC)
        topViewController.present(navController, animated: true, completion: nil)
      }
    }

    // Register for remote notifications
    Function("registerForRemoteNotifications") {
      EKNotificationManager.registerForRemoteNotification()
    }
  }
}
