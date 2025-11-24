// Events type for the module (currently empty, but can be extended for event listeners)
export type EcsdkExpoModuleEvents = {
	// Add event types here if the module emits events
	// Example:
	// onChange: (params: { value: string }) => void;
};

// ============================================================================
// Common Types (Both Platforms)
// ============================================================================

export type UserProfile = {
	firstName?: string;
	lastName?: string;
	email?: string;
	phone?: string;
	deviceId?: string; // Android only
};

export type Organization = {
	organizationId: number;
	name: string;
	description: string;
};

export type ClientTokenResponse = {
	token: string;
};
