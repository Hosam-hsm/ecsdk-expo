import { NativeModule, requireNativeModule } from "expo";
import {
	ClientTokenResponse,
	EcsdkExpoModuleEvents,
	Organization,
	UserProfile,
} from "./EcsdkExpo.types";

interface EcsdkExpoModuleMethods extends NativeModule<EcsdkExpoModuleEvents> {
	// ============================================================================
	// Common Methods (Both iOS and Android)
	// ============================================================================

	/**
	 * Get the current client token
	 * @returns The client token string, or null if not logged in
	 */
	getClientToken(): string | null;

	/**
	 * Create a new client account
	 * @param profile - User profile information
	 * @returns Promise that resolves with the client token
	 */
	createClient(profile: UserProfile): Promise<ClientTokenResponse>;

	/**
	 * Update client information
	 * @param profile - Updated user profile information
	 * @returns Promise that resolves when update is complete
	 */
	updateClientInfo(profile: UserProfile): Promise<void>;

	/**
	 * Login with an existing client token
	 * @param clientToken - The client token to login with
	 */
	login(clientToken: string): void;

	/**
	 * Logout the current user
	 */
	logout(): void;

	/**
	 * Get the currently active organization
	 * @returns Promise that resolves with the active organization
	 */
	getActiveOrganization(): Promise<Organization>;

	/**
	 * Set the active organization
	 * @param organizationId - The ID of the organization to set as active
	 * @returns Promise that resolves when the organization is set
	 */
	setActiveOrganization(organizationId: number): Promise<{
		success: boolean;
	}>;

	/**
	 * List organizations (joined or available)
	 * @param joined - If true, returns joined organizations; if false, returns available organizations
	 * @returns Promise that resolves with an array of organizations
	 */
	listOrganizations(joined: boolean): Promise<Organization[]>;

	/**
	 * Join an organization
	 * @param organizationId - The ID of the organization to join
	 * @returns Promise that resolves when the organization is joined
	 */
	joinOrganization(organizationId: number): Promise<{
		success: boolean;
	}>;

	/**
	 * Get list of available organizations
	 * @returns Array of available organizations
	 */
	getAvailableOrganizations(): Organization[];

	/**
	 * Present the report screen
	 * iOS: Presents EKUIReportViewController
	 * Android: Shows ECReportActivity
	 */
	presentReportScreen(): void;

	/**
	 * Present the organization management screen
	 * iOS: Presents EKUIOrganizationViewController
	 * Android: Shows ECAddOrgActivity
	 */
	presentOrganizationScreen(): void;

	/**
	 * Present the profile update screen
	 * iOS: Presents EKUIProfileViewController with custom buttons
	 * Android: Shows ECProfileActivity
	 */
	presentProfileScreen(): void;

	/**
	 * Show call police prompt dialog
	 * iOS: Uses EKCallHelper.showCallAlert
	 * Android: Uses ECPhoneHelper.showCallPrompt
	 */
	showCallPrompt(): void;

	/**
	 * Show the message list screen
	 * iOS: Presents EKUIThreadListViewController
	 * Android: Shows ECUISDK.getMessageListClass() activity
	 */
	showMessageList(): void;

	/**
	 * Register for remote notifications
	 * iOS: Calls EKNotificationManager.registerForRemoteNotification() (APNS)
	 * Android: Triggers FCM token refresh (FCM auto-registers, but this refreshes the token)
	 */
	registerForRemoteNotifications(): void;

	// ============================================================================
	// Android-Only Methods
	// ============================================================================

	/**
	 * Get the current FCM token
	 * @platform android
	 * @returns Promise that resolves with the FCM token
	 */
	getFCMToken(): Promise<string>;

	/**
	 * Update FCM token with ELERTS server
	 * @platform android
	 * @param fcmToken - The FCM token to update (optional, will use current token if not provided)
	 * @returns Promise that resolves when update is complete
	 */
	updateFCMToken(fcmToken?: string): Promise<{
		success: boolean;
	}>;

	/**
	 * Get stored FCM token from preferences
	 * @platform android
	 * @returns The stored FCM token, or null if not stored
	 */
	getStoredFCMToken(): string | null;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<EcsdkExpoModuleMethods>("EcsdkExpo");
