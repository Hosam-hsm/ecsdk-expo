/**
 * Example implementation of ecsdk-expo in a React Native app
 *
 * This file demonstrates how to use the ECSDK module in your application.
 * Copy this code to your App.tsx or create a separate screen.
 *
 * NOTE: SDK initialization is handled automatically by the config plugin.
 * Make sure to configure the plugin in app.config.js with your API key and product key.
 */

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import EcsdkExpoModule, { Organization, UserProfile } from "ecsdk-expo";

const Button = ({
  title,
  onPress,
  disabled,
  color,
}: {
  title: string;
  onPress: () => void;
  disabled: boolean;
  color: string;
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? "#ccc" : color,
        padding: 10,
        borderRadius: 5,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: disabled ? "#666" : "white",
          fontSize: 14,
          fontWeight: "bold",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
};

function SDKExample() {
  const { top } = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [initialized, setInitialized] = useState(false);
  const [currentOrganization, setCurrentOrganization] =
    useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showOrgSelectionModal, setShowOrgSelectionModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Initialize on component mount
  useEffect(() => {
    checkRegistrationStatus();
  }, []);

  /**
   * Check if user is already registered
   * In a real app, check if you have a saved client token
   * SDK is automatically initialized in AppDelegate by the config plugin
   */
  async function checkRegistrationStatus() {
    setLoading(true);
    try {
      // SDK is initialized automatically in AppDelegate, so we can safely mark as initialized
      // Try to access the SDK to verify it's ready
      const token = EcsdkExpoModule.getClientToken();
      setInitialized(true); // SDK is ready (initialized in AppDelegate)

      if (token) {
        setClientToken(token);
        setIsRegistered(true);
        setStatusMessage("User is logged in");
        // Refresh organization data
        await refreshOrganizationData();
      } else {
        setStatusMessage("Ready to register");
      }
    } catch (error) {
      console.error("Error checking status:", error);
      // Even if there's an error, SDK should be initialized in AppDelegate
      setInitialized(true);
      setStatusMessage("SDK ready (check failed)");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Register a new client with ECSDK
   */
  async function handleRegister() {
    if (!initialized) {
      Alert.alert("Error", "Please wait for SDK initialization");
      return;
    }

    setLoading(true);
    setStatusMessage("Registering...");
    try {
      const profile: UserProfile = {};

      const clientTokenResponse = await EcsdkExpoModule.createClient(profile);
      // IMPORTANT: Save this token to your backend/storage
      setClientToken(clientTokenResponse.token);
      setIsRegistered(true);
      setStatusMessage("Registration successful!");
      await refreshOrganizationData();
    } catch (error: any) {
      setStatusMessage("Registration failed");
      Alert.alert("Registration Error", error.message || "Unknown error");
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Logout current user
   * Call this when user logs out of your app
   */
  async function handleLogout() {
    setLoading(true);
    setStatusMessage("Logging out...");
    try {
      EcsdkExpoModule.logout();

      // Verify logout
      const token = EcsdkExpoModule.getClientToken();
      if (!token) {
        setClientToken(null);
        setIsRegistered(false);
        setCurrentOrganization(null);
        setStatusMessage("Logout successful");
        Alert.alert(
          "Success",
          "Logged out successfully. User session cleared from ELERTS."
        );
      } else {
        setStatusMessage("Logout verification failed");
        Alert.alert("Warning", "Logout may not have completed");
      }
    } catch (error: any) {
      setStatusMessage("Logout failed");
      Alert.alert("Logout Error", error.message || "Unknown error");
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Show organization selection modal
   */
  async function handleSelectOrganization() {
    try {
      setLoading(true);
      setStatusMessage("Loading organizations...");

      // Get available organizations
      const availableOrgs = await EcsdkExpoModule.listOrganizations(false);
      setOrganizations(availableOrgs);

      if (availableOrgs.length === 0) {
        setStatusMessage("No organizations available");
        Alert.alert(
          "No Organizations",
          "No organizations are available. Please check your API key."
        );
        return;
      }

      setLoading(false);
      setSelectedOrgId(null);
      setShowOrgSelectionModal(true);
    } catch (error: any) {
      setLoading(false);
      setStatusMessage("Failed to load organizations");
      Alert.alert("Error", error.message || "Unknown error");
      console.error("Select organization error:", error);
    }
  }

  /**
   * Handle joining the selected organization
   */
  async function handleJoinSelectedOrganization() {
    if (!selectedOrgId) {
      Alert.alert("Error", "Please select an organization first");
      return;
    }

    try {
      setLoading(true);
      setStatusMessage("Joining organization...");

      const selectedOrg = organizations.find(
        (org) => org.organizationId.toString() === selectedOrgId
      );

      if (!selectedOrg) {
        throw new Error("Selected organization not found");
      }

      // Join the selected organization
      EcsdkExpoModule.joinOrganization(selectedOrg.organizationId);

      // Set it as active (joinOrganizations already does this, but ensure it's set)
      EcsdkExpoModule.setActiveOrganization(selectedOrg.organizationId);

      // Update state
      setStatusMessage(`Joined and selected: ${selectedOrg.name}`);

      // Refresh joined organizations list
      refreshOrganizationData();

      // Close modal
      setShowOrgSelectionModal(false);
      setSelectedOrgId(null);

      Alert.alert(
        "Success",
        `Successfully joined and selected "${selectedOrg.name}"`
      );
    } catch (error: any) {
      setStatusMessage("Failed to join organization");
      Alert.alert("Error", error.message || "Failed to join organization");
      console.error("Join organization error:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Refresh organization data
   */
  async function refreshOrganizationData() {
    try {
      const activeOrg = await EcsdkExpoModule.getActiveOrganization();
      if (activeOrg.organizationId !== 0) {
        setCurrentOrganization(activeOrg);
      }
    } catch (error: any) {
      console.error("Error refreshing organization data:", error);
    }
  }

  /**
   * Handle presenting Report A Problem view controller
   */
  function handleReportAProblem() {
    EcsdkExpoModule.presentReportScreen();
  }

  /**
   * Handle presenting Organization Management view controller
   */
  async function handlePresentOrganizationViewController() {
    EcsdkExpoModule.presentOrganizationScreen();
  }

  /**
   * Show the message list
   */
  function handleShowMessageList() {
    EcsdkExpoModule.showMessageList();
  }

  /**
   * Show the call police prompt
   */
  function handleCallPrompt() {
    EcsdkExpoModule.showCallPrompt();
  }

  /**
   * Show the profile screen
   */
  function handleShowProfile() {
    EcsdkExpoModule.presentProfileScreen();
  }

  /**
   * Request notification permission
   * iOS: Permission is requested automatically when calling registerForRemoteNotifications()
   * Android 13+: Requires POST_NOTIFICATIONS permission
   */
  async function requestNotificationPermission() {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: "Notification Permission",
            message:
              "This app needs notification permission to receive alerts from ECSDK",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log("Notification permission granted");
          return true;
        } else {
          console.log("Notification permission denied");
          Alert.alert(
            "Permission Required",
            "Notifications are disabled. You won't receive push notifications from ECSDK. You can enable them in Settings."
          );
          return false;
        }
      } catch (err) {
        console.warn("Permission request error:", err);
        return false;
      }
    }
    // iOS: Permission is requested automatically when registering
    // Android < 13: No runtime permission needed
    return true;
  }

  /**
   * Register for remote notifications
   * iOS: Requests APNS token and shows permission dialog if needed
   * Android: Triggers FCM token refresh (permission should be requested first on Android 13+)
   */
  async function handleRegisterForRemoteNotifications() {
    setLoading(true);
    setStatusMessage("Registering for remote notifications...");

    try {
      // Request permission first (Android 13+)
      if (Platform.OS === "android" && Platform.Version >= 33) {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );

        if (!hasPermission) {
          const granted = await requestNotificationPermission();
          if (!granted) {
            setStatusMessage("Permission denied");
            setLoading(false);
            return;
          }
        }
      }

      // Register for remote notifications
      EcsdkExpoModule.registerForRemoteNotifications();

      setStatusMessage("Registered for remote notifications");
      Alert.alert(
        "Success",
        Platform.OS === "ios"
          ? "Registered for APNS. Check notification permission in Settings if needed."
          : "Registered for FCM. Token will be automatically sent to ELERTS server."
      );
    } catch (error: any) {
      setStatusMessage("Failed to register for notifications");
      Alert.alert("Error", error.message || "Unknown error");
      console.error("Register notifications error:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Get FCM Token
   * Note: Token can be retrieved without permission, but notifications won't work without it
   */
  async function handleGetFCMToken() {
    setLoading(true);
    setStatusMessage("Getting FCM token...");

    try {
      // Check permission status (Android 13+)
      if (Platform.OS === "android" && Platform.Version >= 33) {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );

        if (!hasPermission) {
          Alert.alert(
            "Permission Warning",
            "Notification permission not granted. Token will be retrieved but notifications won't work. Grant permission?",
            [
              {
                text: "Request Permission",
                onPress: async () => {
                  await requestNotificationPermission();
                  // Continue with token retrieval
                  await getFCMTokenInternal();
                },
              },
              {
                text: "Continue Anyway",
                onPress: () => getFCMTokenInternal(),
              },
            ]
          );
          return;
        }
      }

      await getFCMTokenInternal();
    } catch (error: any) {
      setStatusMessage("Failed to get FCM token");
      Alert.alert("Error", error.message || "Unknown error");
      console.error("FCM token error:", error);
      setLoading(false);
    }
  }

  async function getFCMTokenInternal() {
    try {
      const fcmToken = await EcsdkExpoModule.getFCMToken();
      setStatusMessage("FCM token retrieved");
      Alert.alert("FCM Token", `Token: ${fcmToken.substring(0, 50)}...`, [
        {
          text: "Copy",
          onPress: () => console.log("Token:", fcmToken),
        },
        {
          text: "OK",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: top,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>ECSDK-Expo Example</Text>

        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.statusText}>{statusMessage}</Text>
          {loading && (
            <ActivityIndicator
              size="small"
              color="#007AFF"
              style={styles.loader}
            />
          )}
          {isRegistered && (
            <Text style={styles.successText}>✓ Client Registered</Text>
          )}
          {clientToken && (
            <Text style={styles.infoText}>Token: {clientToken}...</Text>
          )}
          {initialized && (
            <Text style={styles.successText}>✓ SDK Initialized</Text>
          )}
        </View>

        {/* Registration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registration</Text>
          <Button
            title="Register Client"
            onPress={handleRegister}
            disabled={loading || isRegistered || !initialized}
            color="#007AFF"
          />
        </View>

        {/* Login/Logout Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Logout</Text>
          <Text style={styles.helperText}>
            In production: Save token from registration to your server, then use
            login() when user logs in.
          </Text>

          <View style={styles.spacer} />
          <Button
            title="Logout"
            onPress={handleLogout}
            disabled={loading || !isRegistered}
            color="#FF5722"
          />
        </View>

        {/* Organization Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organization Management</Text>

          <Button
            title="Select & Join Organization"
            onPress={handleSelectOrganization}
            disabled={loading || !isRegistered}
            color="#9C27B0"
          />
          <View style={styles.spacer} />
          <Button
            title="🏢 Manage Organizations (Native UI)"
            onPress={handlePresentOrganizationViewController}
            disabled={loading || !isRegistered}
            color="#FF9800"
          />
        </View>

        {/* Report A Problem Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report A Problem</Text>
          <Text style={styles.helperText}>
            Make sure you have an active organization set before reporting a
            problem.
          </Text>
          <View style={styles.spacer} />
          <Button
            title="Report A Problem"
            onPress={handleReportAProblem}
            disabled={loading || !currentOrganization}
            color="#E91E63"
          />
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ECSDK Features</Text>
          <Button
            title="💬 View Messages"
            onPress={handleShowMessageList}
            disabled={loading || !currentOrganization}
            color="#007AFF"
          />
          <View style={styles.spacer} />
          <Button
            title="📞 Call Police"
            onPress={handleCallPrompt}
            disabled={loading || !currentOrganization}
            color="#FF3B30"
          />
          <View style={styles.spacer} />
          <Button
            title="👤 Show Profile"
            onPress={handleShowProfile}
            disabled={loading || !currentOrganization}
            color="#34C759"
          />
        </View>

        {/* Push Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Push Notifications ({Platform.OS === "ios" ? "APNS" : "FCM"})
          </Text>
          <Text style={styles.helperText}>
            {Platform.OS === "ios"
              ? "iOS: Registering will request APNS token and show permission dialog if needed."
              : "Android: FCM auto-registers, but you can manually refresh the token. Android 13+ requires permission."}
          </Text>
          <View style={styles.spacer} />
          <Button
            title={
              Platform.OS === "ios"
                ? "📱 Register for APNS"
                : "📱 Register for FCM"
            }
            onPress={handleRegisterForRemoteNotifications}
            disabled={loading}
            color="#FF9500"
          />
          {Platform.OS === "android" && (
            <>
              <View style={styles.spacer} />
              <Button
                title="🔔 Get FCM Token"
                onPress={handleGetFCMToken}
                disabled={loading}
                color="#FF9500"
              />
            </>
          )}
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.helpTitle}>Complete Workflow:</Text>
          <Text style={styles.helpText}>
            1. Initialize SDK - Set API key in environment{"\n"}
            2. Register Client - Get your auth token{"\n"}
            3. Update Profile - Add your details{"\n"}
            4. Save token to your server for the user{"\n"}
            5. Login - Restore session with saved token{"\n"}
            6. Get Organization List - See available orgs{"\n"}
            7. Select & Join Organization - Choose and join your org{"\n"}
            8. Submit Reports - Use the ECSDK features{"\n"}
            9. View Messages - Check notifications{"\n"}
            10. Logout - Clear session when user logs out
          </Text>
        </View>
      </ScrollView>

      {/* Organization Selection Modal */}
      <Modal
        visible={showOrgSelectionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOrgSelectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Organization</Text>
            <Text style={styles.modalSubtitle}>
              Choose an organization to join and use for reporting:
            </Text>

            <ScrollView style={styles.modalScrollView}>
              {organizations.map((org) => (
                <TouchableOpacity
                  key={org.organizationId}
                  style={styles.orgItem}
                  onPress={() =>
                    setSelectedOrgId(org.organizationId.toString())
                  }
                >
                  <View style={styles.checkboxContainer}>
                    <View
                      style={[
                        styles.checkbox,
                        selectedOrgId === org.organizationId.toString() &&
                          styles.checkboxChecked,
                      ]}
                    >
                      {selectedOrgId === org.organizationId.toString() && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <View style={styles.orgItemText}>
                      <Text style={styles.orgItemName}>{org.name}</Text>
                      {org.description && (
                        <Text style={styles.orgItemPhone}>
                          Description: {org.description}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowOrgSelectionModal(false);
                  setSelectedOrgId(null);
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  !selectedOrgId && styles.modalButtonDisabled,
                ]}
                onPress={handleJoinSelectedOrganization}
                disabled={!selectedOrgId || loading}
              >
                <Text
                  style={[
                    styles.modalButtonTextConfirm,
                    !selectedOrgId && styles.modalButtonTextDisabled,
                  ]}
                >
                  Join
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function SDKExampleWrapper() {
  return (
    <SafeAreaProvider>
      <SDKExample />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#000",
  },
  section: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    color: "#000",
  },
  helperText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
    fontStyle: "italic",
  },
  statusText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  successText: {
    fontSize: 14,
    color: "#34C759",
    fontWeight: "600",
    marginTop: 5,
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  loader: {
    marginTop: 10,
  },
  spacer: {
    height: 10,
  },
  orgInfo: {
    backgroundColor: "#F8F8F8",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  helpText: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    width: "90%",
    maxHeight: "80%",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#000",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  modalScrollView: {
    maxHeight: 400,
    marginBottom: 16,
  },
  orgItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 4,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  checkmark: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  orgItemText: {
    flex: 1,
  },
  orgItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  orgItemPhone: {
    fontSize: 14,
    color: "#666",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  modalButtonCancel: {
    backgroundColor: "#E0E0E0",
  },
  modalButtonConfirm: {
    backgroundColor: "#007AFF",
  },
  modalButtonDisabled: {
    backgroundColor: "#CCCCCC",
    opacity: 0.5,
  },
  modalButtonTextCancel: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextConfirm: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextDisabled: {
    color: "#999",
  },
});
