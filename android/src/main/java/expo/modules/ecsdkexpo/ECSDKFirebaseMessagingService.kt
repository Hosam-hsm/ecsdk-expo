package expo.modules.ecsdkexpo

import android.content.Intent
import android.os.Build
import com.elerts.ecsdk.ECSDK
import com.elerts.ecsdk.api.model.ECClientData
import com.elerts.ecsdk.api.model.ECUserData
import com.elerts.ecsdk.services.ECMessageListService
import com.elerts.ecsdk.utils.ECPreferenceManager
import com.elerts.ecsdk.utils.ECUtils
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * ECSDK Firebase Messaging Service
 * 
 * Handles FCM token registration and remote message reception for ELERTS push notifications.
 * 
 * This service:
 * 1. Receives and saves FCM tokens
 * 2. Sends tokens to the ELERTS server via ECSDK.clientUpdate
 * 3. Handles incoming push notifications by starting ECMessageListService
 * 
 * The ECMessageListService will pull down the full alert data and create a notification.
 */
class ECSDKFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "ECSDKFirebaseService"
        const val PROPERTY_REG_ID = "registration_id"
        
        // Service action - should match the string resource
        private const val LIST_MESSAGE_SERVICE_ACTION = "com.elerts.ecsdk.LIST_MESSAGE_SERVICE"
    }

    /**
     * Called when a new FCM token is generated.
     * This happens on app first start and whenever the token is refreshed.
     * 
     * @param token The new FCM token
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        
        // Save token to shared preferences
        ECPreferenceManager.putString(applicationContext, PROPERTY_REG_ID, token)
        
        // Send token to ELERTS server
        sendTokenToServer(token)
    }

    /**
     * Called when a remote message is received from FCM.
     * Starts the ECMessageListService to handle the alert notification.
     * 
     * @param remoteMessage The received remote message
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        // Start ECMessageListService to handle the alert
        val listService = Intent(this, ECMessageListService::class.java)
        listService.action = LIST_MESSAGE_SERVICE_ACTION
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(listService)
        } else {
            startService(listService)
        }
    }

    /**
     * Sends the FCM token to the ELERTS server.
     * 
     * @param token The FCM token to send
     */
    private fun sendTokenToServer(token: String) {
        try {
            val context = applicationContext
            
            // Create user data with device ID
            val regData = ECUserData(context).apply {
                deviceId = ECUtils.getDeviceId(context)
            }
            
            // Get client data (contains the token)
            val clientData = ECClientData(context)
            
            // Only update if we have a client token (user is registered)
            if (clientData.token != null) {
                ECSDK.clientUpdate(context, null, regData, clientData)
            }
        } catch (e: Exception) {
            // Log error but don't crash
            android.util.Log.e(TAG, "Error sending FCM token to ELERTS server", e)
        }
    }
}

