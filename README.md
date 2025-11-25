# ecsdk-expo

Expo module for ECSDK-iOS and ECSDK-Android (ELERTS See Say Now SDK). This module provides a React Native interface to the ELERTS See Say Now SDK, enabling users to report incidents, receive notifications, manage organizations, and interact with emergency services.

## Overview

The `ecsdk-expo` module bridges the native ELERTS See Say Now SDK (ECSDK) for both iOS and Android platforms, providing a unified JavaScript API. The SDK enables applications to:

- **Report Incidents**: Allow users to report problems and incidents through native UI screens
- **Organization Management**: Join and manage organizations within the ELERTS ecosystem
- **Push Notifications**: Receive real-time alerts and messages via APNS (iOS) and FCM (Android)
- **User Profile Management**: Create and update user profiles
- **Message Threads**: View and interact with message threads
- **Emergency Services**: Quick access to call emergency services

## Features

- ✅ **Cross-platform**: Works on both iOS and Android
- ✅ **Zero-config native setup**: Automatic configuration via Expo config plugin
- ✅ **TypeScript support**: Full TypeScript definitions included
- ✅ **Native UI integration**: Access to native ECSDK UI screens
- ✅ **Push notifications**: APNS (iOS) and FCM (Android) support
- ✅ **Organization management**: Join, list, and switch between organizations
- ✅ **User authentication**: Client token-based authentication system

## Installation

### Prerequisites

- React Native project with Expo SDK
- For iOS: Xcode 14+ and CocoaPods
- For Android: Android Studio with Gradle
- GitHub Personal Access Token with `read:packages` permission (for accessing private ECSDK packages)
- ECSDK API Key from ELERTS
- Google Maps API Key (required for Android)
- Firebase project with `google-services.json` (for Android push notifications)

### Install the Package

```bash
npm install ecsdk-expo
# or
yarn add ecsdk-expo
# or
bun add ecsdk-expo
```

### Configuration

The module uses an Expo config plugin to automatically configure native code. Add the plugin to your `app.config.js` or `app.json`:

```javascript
// app.config.js
export default {
  plugins: [
    [
      "ecsdk-expo",
      {
        // Required
        ecsdkApiKey: process.env.ECSDK_API_KEY,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        googleServicesFile:
          process.env.GOOGLE_SERVICES_FILE || "./google-services.json",

        // Optional
        productKey: process.env.ECSDK_PRODUCT_KEY || "PROVIDED BY ELERTS", // Used for both iOS and Android
        appName: "Your App Name",
        shortDisplayName: "Short Name",

        // Note: GitHub credentials (GPR_USER and GPR_API_KEY) are automatically
        // read from environment variables. You don't need to include them here.
        // The plugin will automatically generate:
        // - iOS: .netrc file in your home directory
        // - Android: gradle.properties entries
      },
    ],
  ],
};
```

### Environment Variables

Set the following environment variables:

```bash
# Required
export ECSDK_API_KEY="your-ecsdk-api-key"
export GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
export GOOGLE_SERVICES_FILE="./google-services.json"

# Required for accessing private GitHub packages
# These are automatically used by the plugin - no need to include in plugin config
export GPR_USER="your-github-username"
export GPR_API_KEY="your-github-personal-access-token"

# Optional
export ECSDK_PRODUCT_KEY="your-product-key" # Used for both iOS and Android
```

**Note:** The plugin automatically reads `GPR_USER` and `GPR_API_KEY` from environment variables and uses them to:

- **iOS**: Generate `.netrc` file in your home directory for SPM package authentication
- **Android**: Add credentials to `gradle.properties` for Maven repository authentication

You do **not** need to include `githubUsername` and `githubToken` in the plugin configuration. The plugin handles this automatically from environment variables.

### Platform-Specific Setup

#### iOS

1. Run `npx pod-install` after installing the package
2. The config plugin automatically:
   - Configures Info.plist with required permissions
   - Sets up SPM packages with GitHub authentication (reads from `GPR_USER` and `GPR_API_KEY` env vars)
   - Generates `.netrc` file in your home directory for GitHub Packages authentication
   - Adds `use_modular_headers!` to Podfile for Firebase compatibility
   - Initializes the SDK in AppDelegate (`willFinishLaunchingWithOptions` or `didFinishLaunchingWithOptions`)
   - Configures background modes (fetch, remote-notification)
   - Adds background fetch handler (`performFetchWithCompletionHandler`)
   - Implements remote notification handlers (device token registration, notification receipt, error handling)
   - Implements `EKNotificationManagerDelegate` protocol with notification tap handling
   - Sets up `EKBackgroundFetchManager` for store-and-forward functionality

#### Android

1. Place your `google-services.json` file in the project root (or path specified in config)
2. The config plugin automatically:
   - Configures AndroidManifest.xml
   - Sets up Gradle dependencies
   - Configures GitHub Packages repository (reads from `GPR_USER` and `GPR_API_KEY` env vars)
   - Adds GitHub credentials to `gradle.properties` automatically
   - Initializes the SDK in MainApplication (`ECUISDK` instance)
   - Adds `attachBaseContext` override for proper context handling
   - Adds `onConfigurationChanged` override for configuration changes
   - Sets up Firebase/FCM (Google Services plugin and `google-services.json`)
   - Configures core library desugaring for Java 17 compatibility

### EAS Build Configuration

For EAS builds, configure GitHub authentication in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "GPR_USER": "your-github-username",
        "GPR_API_KEY": "your-github-token",
        "ECSDK_API_KEY": "your-ecsdk-api-key",
        "GOOGLE_MAPS_API_KEY": "your-google-maps-api-key",
        "GOOGLE_SERVICES_FILE": "./google-services.json"
      },
      "ios": {
        "prebuildCommand": "bash -c 'mkdir -p $HOME/.netrc && echo \"machine github.com\\n  login $GPR_USER\\n  password $GPR_API_KEY\\n\" >> $HOME/.netrc && chmod 600 $HOME/.netrc'"
      }
    }
  }
}
```

Or use EAS Secrets (recommended):

```bash
eas secret:create --scope project --name GPR_USER --value your-username
eas secret:create --scope project --name GPR_API_KEY --value your-token
eas secret:create --scope project --name ECSDK_API_KEY --value your-api-key
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value your-maps-key
```

## Usage

### Basic Example

```typescript
import EcsdkExpoModule, { UserProfile, Organization } from "ecsdk-expo";

// Check if user is already logged in
const token = EcsdkExpoModule.getClientToken();
if (token) {
  console.log("User is logged in");
} else {
  // Register a new client
  const profile: UserProfile = {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+1234567890",
  };

  const response = await EcsdkExpoModule.createClient(profile);
  console.log("Client token:", response.token);

  // Save this token to your backend for future logins
}

// Login with existing token
EcsdkExpoModule.login(savedToken);

// Get available organizations
const organizations = await EcsdkExpoModule.listOrganizations(false);

// Join an organization
await EcsdkExpoModule.joinOrganization(organizations[0].organizationId);

// Set active organization
await EcsdkExpoModule.setActiveOrganization(organizations[0].organizationId);

// Present report screen
EcsdkExpoModule.presentReportScreen();
```

### Complete Workflow Example

```typescript
import React, { useEffect, useState } from "react";
import { View, Button, Alert } from "react-native";
import EcsdkExpoModule, { UserProfile, Organization } from "ecsdk-expo";

function App() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  useEffect(() => {
    initializeSDK();
  }, []);

  async function initializeSDK() {
    // Check if user has existing session
    const token = EcsdkExpoModule.getClientToken();

    if (token) {
      // User is already logged in
      setIsRegistered(true);
      await loadOrganization();
    }
  }

  async function registerUser() {
    try {
      const profile: UserProfile = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      const response = await EcsdkExpoModule.createClient(profile);

      // IMPORTANT: Save token to your backend
      await saveTokenToBackend(response.token);

      setIsRegistered(true);
      Alert.alert("Success", "Registration successful!");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  }

  async function loadOrganization() {
    try {
      const org = await EcsdkExpoModule.getActiveOrganization();
      if (org.organizationId !== 0) {
        setCurrentOrg(org);
      }
    } catch (error) {
      console.error("Failed to load organization:", error);
    }
  }

  async function joinOrganization(orgId: number) {
    try {
      await EcsdkExpoModule.joinOrganization(orgId);
      await EcsdkExpoModule.setActiveOrganization(orgId);
      await loadOrganization();
      Alert.alert("Success", "Organization joined!");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  }

  function handleReport() {
    if (!currentOrg) {
      Alert.alert("Error", "Please join an organization first");
      return;
    }
    EcsdkExpoModule.presentReportScreen();
  }

  return (
    <View>
      {!isRegistered && <Button title="Register" onPress={registerUser} />}

      {isRegistered && !currentOrg && (
        <Button
          title="Join Organization"
          onPress={() => joinOrganization(123)}
        />
      )}

      {currentOrg && <Button title="Report Problem" onPress={handleReport} />}
    </View>
  );
}
```

## API Reference

### Types

#### `UserProfile`

User profile information for registration and updates.

```typescript
type UserProfile = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  deviceId?: string; // Android only
};
```

#### `Organization`

Organization information.

```typescript
type Organization = {
  organizationId: number;
  name: string;
  description: string;
};
```

#### `ClientTokenResponse`

Response from client creation.

```typescript
type ClientTokenResponse = {
  token: string;
};
```

### Common Methods (iOS & Android)

#### `getClientToken()`

Get the current client token.

**Returns:** `string | null` - The client token, or `null` if not logged in.

**Example:**

```typescript
const token = EcsdkExpoModule.getClientToken();
if (token) {
  console.log("User is logged in:", token);
}
```

---

#### `createClient(profile: UserProfile)`

Create a new client account.

**Parameters:**

- `profile` (UserProfile): User profile information

**Returns:** `Promise<ClientTokenResponse>` - Promise that resolves with the client token

**Example:**

```typescript
const profile: UserProfile = {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
};
const response = await EcsdkExpoModule.createClient(profile);
console.log("Token:", response.token);
```

---

#### `updateClientInfo(profile: UserProfile)`

Update client information.

**Parameters:**

- `profile` (UserProfile): Updated user profile information

**Returns:** `Promise<void>`

**Example:**

```typescript
await EcsdkExpoModule.updateClientInfo({
  firstName: "Jane",
  email: "jane@example.com",
});
```

---

#### `login(clientToken: string)`

Login with an existing client token.

**Parameters:**

- `clientToken` (string): The client token to login with

**Example:**

```typescript
EcsdkExpoModule.login(savedToken);
```

---

#### `logout()`

Logout the current user and clear the session.

**Example:**

```typescript
EcsdkExpoModule.logout();
```

---

#### `getActiveOrganization()`

Get the currently active organization.

**Returns:** `Promise<Organization>` - The active organization

**Example:**

```typescript
const org = await EcsdkExpoModule.getActiveOrganization();
console.log("Active org:", org.name);
```

---

#### `setActiveOrganization(organizationId: number)`

Set the active organization.

**Parameters:**

- `organizationId` (number): The ID of the organization to set as active

**Returns:** `Promise<{ success: boolean }>`

**Example:**

```typescript
await EcsdkExpoModule.setActiveOrganization(123);
```

---

#### `listOrganizations(joined: boolean)`

List organizations (joined or available).

**Parameters:**

- `joined` (boolean): If `true`, returns joined organizations; if `false`, returns available organizations

**Returns:** `Promise<Organization[]>`

**Example:**

```typescript
// Get available organizations
const available = await EcsdkExpoModule.listOrganizations(false);

// Get joined organizations
const joined = await EcsdkExpoModule.listOrganizations(true);
```

---

#### `joinOrganization(organizationId: number)`

Join an organization.

**Parameters:**

- `organizationId` (number): The ID of the organization to join

**Returns:** `Promise<{ success: boolean }>`

**Example:**

```typescript
await EcsdkExpoModule.joinOrganization(123);
```

---

#### `getAvailableOrganizations()`

Get list of available organizations (synchronous).

**Returns:** `Organization[]`

**Example:**

```typescript
const orgs = EcsdkExpoModule.getAvailableOrganizations();
```

---

#### `presentReportScreen()`

Present the native report screen.

- **iOS**: Presents `EKUIReportViewController`
- **Android**: Shows `ECReportActivity`

**Example:**

```typescript
EcsdkExpoModule.presentReportScreen();
```

---

#### `presentOrganizationScreen()`

Present the native organization management screen.

- **iOS**: Presents `EKUIOrganizationViewController`
- **Android**: Shows `ECAddOrgActivity`

**Example:**

```typescript
EcsdkExpoModule.presentOrganizationScreen();
```

---

#### `presentProfileScreen()`

Present the native profile update screen.

- **iOS**: Presents `EKUIProfileViewController`
- **Android**: Shows `ECProfileActivity`

**Example:**

```typescript
EcsdkExpoModule.presentProfileScreen();
```

---

#### `showCallPrompt()`

Show call police prompt dialog.

- **iOS**: Uses `EKCallHelper.showCallAlert`
- **Android**: Uses `ECPhoneHelper.showCallPrompt`

**Example:**

```typescript
EcsdkExpoModule.showCallPrompt();
```

---

#### `showMessageList()`

Show the message list screen.

- **iOS**: Presents `EKUIThreadListViewController`
- **Android**: Shows message list activity

**Example:**

```typescript
EcsdkExpoModule.showMessageList();
```

---

#### `registerForRemoteNotifications()`

Register for remote notifications.

- **iOS**: Calls `EKNotificationManager.registerForRemoteNotification()` (APNS)
- **Android**: Triggers FCM token refresh

**Note:** On Android 13+, you should request `POST_NOTIFICATIONS` permission first.

**Example:**

```typescript
// iOS: Permission is requested automatically
EcsdkExpoModule.registerForRemoteNotifications();

// Android 13+: Request permission first
if (Platform.OS === "android" && Platform.Version >= 33) {
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    EcsdkExpoModule.registerForRemoteNotifications();
  }
}
```

### Android-Only Methods

#### `getFCMToken()`

Get the current FCM token.

**Platform:** Android only

**Returns:** `Promise<string>` - The FCM token

**Example:**

```typescript
if (Platform.OS === "android") {
  const token = await EcsdkExpoModule.getFCMToken();
  console.log("FCM Token:", token);
}
```

---

#### `updateFCMToken(fcmToken?: string)`

Update FCM token with ELERTS server.

**Platform:** Android only

**Parameters:**

- `fcmToken` (string, optional): The FCM token to update. If not provided, uses the current token.

**Returns:** `Promise<{ success: boolean }>`

**Example:**

```typescript
if (Platform.OS === "android") {
  await EcsdkExpoModule.updateFCMToken();
  // Or with explicit token
  const token = await EcsdkExpoModule.getFCMToken();
  await EcsdkExpoModule.updateFCMToken(token);
}
```

---

#### `getStoredFCMToken()`

Get stored FCM token from preferences.

**Platform:** Android only

**Returns:** `string | null` - The stored FCM token, or `null` if not stored

**Example:**

```typescript
if (Platform.OS === "android") {
  const storedToken = EcsdkExpoModule.getStoredFCMToken();
  if (storedToken) {
    console.log("Stored token:", storedToken);
  }
}
```

## Platform-Specific Notes

### iOS

- **APNS**: Push notifications use Apple Push Notification Service (APNS)
- **Permissions**: Camera, microphone, location, and photo library permissions are automatically configured
- **Background Modes**: Background fetch and remote notifications are enabled
- **SDK Initialization**: Automatically initialized in `AppDelegate` via config plugin:
  - Initializes `ELERTSKit` in `willFinishLaunchingWithOptions` (or `didFinishLaunchingWithOptions` as fallback)
  - Sets up `EKBackgroundFetchManager` for store-and-forward functionality
  - Configures `EKNotificationManager.default.delegate` for remote notifications
  - Implements `EKNotificationManagerDelegate` protocol with notification tap handling
  - Adds remote notification handlers (device token registration, notification receipt, error handling)
  - Adds background fetch handler for poor connectivity scenarios
- **Modular Headers**: Automatically adds `use_modular_headers!` to Podfile for Firebase compatibility

### Android

- **FCM**: Push notifications use Firebase Cloud Messaging (FCM)
- **Permissions**: Android 13+ requires `POST_NOTIFICATIONS` permission (request manually)
- **Google Services**: Requires `google-services.json` file for Firebase/FCM
- **SDK Initialization**: Automatically initialized in `MainApplication` via config plugin:
  - Initializes `ECUISDK` instance in `onCreate()`
  - Adds `attachBaseContext` override for proper context wrapping
  - Adds `onConfigurationChanged` override for configuration change handling
- **Firebase Messaging Service**: `ECSDKFirebaseMessagingService` is automatically registered
- **Core Library Desugaring**: Automatically configured for Java 17 compatibility

## Error Handling

All async methods may throw errors. Always wrap API calls in try-catch blocks:

```typescript
try {
  const response = await EcsdkExpoModule.createClient(profile);
  // Handle success
} catch (error) {
  console.error("Error:", error);
  // Handle error
}
```

## Best Practices

1. **Token Management**: Always save the client token to your backend after registration. Use it to restore sessions on app launch.

2. **Organization Selection**: Allow users to select and join organizations before using reporting features.

3. **Error Handling**: Implement proper error handling for all async operations.

4. **Permissions**: Request notification permissions before registering for push notifications (especially on Android 13+).

5. **SDK Initialization**: The SDK is automatically initialized by the config plugin. You don't need to manually initialize it.

6. **Environment Variables**: Use environment variables for sensitive configuration (API keys, tokens) instead of hardcoding.

## Troubleshooting

### iOS Issues

**Problem:** SPM packages fail to download

- **Solution:** Ensure GitHub credentials are properly configured in `.netrc` or via environment variables

**Problem:** SDK not initialized

- **Solution:** Check that the config plugin is properly configured in `app.config.js` and run `npx pod-install`

### Android Issues

**Problem:** FCM token not updating

- **Solution:** Ensure `google-services.json` is in the correct location and Firebase is properly configured

**Problem:** Build fails with GitHub Packages authentication

- **Solution:** Ensure `GPR_USER` and `GPR_API_KEY` environment variables are set. The plugin automatically adds them to `gradle.properties` (Android) and `.netrc` (iOS) during prebuild

**Problem:** Notifications not received on Android 13+

- **Solution:** Request `POST_NOTIFICATIONS` permission before calling `registerForRemoteNotifications()`

## Contributing

Contributions are very welcome! Please refer to guidelines described in the [contributing guide](https://github.com/expo/expo#contributing).

## License

MIT

## Support

For issues and questions:

- GitHub Issues: [https://github.com/Hosam-hsm/ecsdk-expo/issues](https://github.com/Hosam-hsm/ecsdk-expo/issues)
- ELERTS Documentation: Contact ELERTS support for SDK-specific questions
