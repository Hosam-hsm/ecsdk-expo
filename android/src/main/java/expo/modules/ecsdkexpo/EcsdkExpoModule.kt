package expo.modules.ecsdkexpo

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import expo.modules.kotlin.Promise

import com.elerts.ecsdk.ECSDK
import com.elerts.ecsdk.api.model.ECUserData
import com.elerts.ecsdk.api.model.ECClientData
import com.elerts.ecsdk.ui.model.ECUIClientData
import com.elerts.ecsdk.utils.ECOrganizationHelper
import com.elerts.ecsdk.ui.utility.ECPhoneHelper
import com.elerts.ecsdk.api.ECAPIListener
import com.elerts.ecsdk.api.model.ECError
import com.elerts.ecsdk.utils.ECUtils
import com.elerts.ecsdk.utils.ECPreferenceManager
import com.elerts.ecsdk.ui.activity.ECProfileActivity
import com.elerts.ecsdk.api.model.organization.ECOrganizationData
import com.elerts.ecsdk.ui.ECUISDK
import com.elerts.ecsdk.ui.activity.ECReportActivity
import com.elerts.ecsdk.ui.activity.ECAddOrgActivity
import com.elerts.ecsdk.ui.notification.ECNotificationHelper
import com.google.gson.JsonArray
import com.google.firebase.messaging.FirebaseMessaging

class EcsdkExpoModule : Module() {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  override fun definition() = ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // Can be inferred from module's class name, but it's recommended to set it explicitly for clarity.
    // The module will be accessible from `requireNativeModule('EcsdkExpo')` in JavaScript.
    Name("EcsdkExpo")

    // Defines constant property on the module.
    Constant("PI") {
      Math.PI
    }

     // ECSDK Integration Methods
    
    // Initialize the ECSDK with configuration
    Function("initializeSDK") { config: Map<String, Any?> ->
      // Note: Actual ECSDK initialization should be done in the Application class
      // This method can be used to update configuration if needed
      // The actual initialization code should be in ECSDKApplication.kt
    }

    // Create a new client account
    AsyncFunction("createClient") { userData: Map<String, Any?>, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        
        val regData = ECUserData(context).apply {
          deviceId = userData["deviceId"] as? String ?: ECUtils.getDeviceId(context)
          firstName = userData["firstName"] as? String
          lastName = userData["lastName"] as? String
          email = userData["email"] as? String
          phone = userData["phone"] as? String
        }
        
        ECSDK.register(context, object : ECAPIListener<ECClientData> {
          override fun onAPICompleted(clientData: ECClientData?) {
            if (clientData != null && clientData.token != null) {
              promise.resolve(mapOf("token" to clientData.token))
            } else {
              promise.reject("ECSDK_ERROR", "Failed to register: no client data", null)
            }
          }
          
          override fun onAPIProgress(bytesUploaded: Long, totalBytes: Long) {}
          
          override fun onAPIError(error: ECError) {
            promise.reject("ECSDK_ERROR", error.errorMessage ?: "Unknown error", null)
          }
        }, regData)
        
      } catch (e: Exception) {
        promise.reject("ECSDK_ERROR", e.message, e)
      }
    }

    // Update client information
    AsyncFunction("updateClientInfo") { userData: Map<String, Any?>, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        
        val regData = ECUserData(context).apply {
          firstName = userData["firstName"] as? String
          lastName = userData["lastName"] as? String
          email = userData["email"] as? String
          phone = userData["phone"] as? String
        }
        
        val clientData = ECUIClientData(context)
        
        ECSDK.clientUpdate(context, object : ECAPIListener<ECUserData> {
          override fun onAPICompleted(result: ECUserData?) {
            promise.resolve(null)
          }
          
          override fun onAPIProgress(bytesUploaded: Long, totalBytes: Long) {}
          
          override fun onAPIError(error: ECError) {
            promise.reject("ECSDK_ERROR", error.errorMessage ?: "Unknown error", null)
          }
        }, regData, clientData)
        
      } catch (e: Exception) {
        promise.reject("ECSDK_ERROR", e.message, e)
      }
    }

    // Get active organization
    AsyncFunction("getActiveOrganization") { promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        
        val activeOrg = ECOrganizationHelper.getActiveOrg(context)
        if (activeOrg != null) {
          promise.resolve(mapOf(
            "organizationId" to activeOrg.id,
            "name" to activeOrg.name,
            "description" to ""
          ))
        } else {
          promise.resolve(mapOf(
            "organizationId" to 0,
            "name" to "",
            "description" to ""
          ))
        }
        
      } catch (e: Exception) {
        promise.reject("ECSDK_ERROR", e.message, e)
      }
    }

    // Show call police prompt
    Function("showCallPrompt") {
      val activity = appContext.currentActivity ?: throw Exception("No current activity")
      ECPhoneHelper.showCallPrompt(activity)
    }


    // Present organization screen
    Function("presentOrganizationScreen") {
      val activity = appContext.currentActivity ?: throw Exception("No current activity")
      val organizations = Intent(activity, ECAddOrgActivity::class.java)
      activity.startActivity(organizations)
    }

    // Present profile screen
    Function("presentProfileScreen") {
      val activity = appContext.currentActivity ?: throw Exception("No current activity")
      val profile = Intent(activity, ECProfileActivity::class.java)
      activity.startActivity(profile)
    }

    // List organizations
    AsyncFunction("listOrganizations") { joined: Boolean, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        
        ECOrganizationHelper.apiOrganizationList(context, joined, object : ECAPIListener<Map<String, List<ECOrganizationData>>> {
          override fun onAPICompleted(result: Map<String, List<ECOrganizationData>>?) {
            if (result != null) {
              val organizations = result["orgs"]
              val orgList = organizations?.map { org ->
                mapOf(
                  "organizationId" to org.id,
                  "name" to org.name,
                  "description" to ""
                )
              } ?: emptyList()
              promise.resolve(orgList)
            } else {
              promise.resolve(emptyList<Map<String, Any?>>())
            }
          }
          
          override fun onAPIProgress(bytesUploaded: Long, totalBytes: Long) {}
          
          override fun onAPIError(error: ECError) {
            promise.reject("ECSDK_ERROR", error.errorMessage ?: "Failed to get organizations", null)
          }
        })
        
      } catch (e: Exception) {
        promise.reject("ECSDK_ERROR", e.message, e)
      }
    }

    // Join organization
    AsyncFunction("joinOrganization") { organizationId: Int, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        val clientData = ECUIClientData(context)
        
        // First get all organizations to find the ones matching the IDs
        ECOrganizationHelper.apiOrganizationList(context, true, object : ECAPIListener<Map<String, List<ECOrganizationData>>> {
          override fun onAPICompleted(result: Map<String, List<ECOrganizationData>>?) {
            if (result != null) {
              val allOrgs = result["orgs"] ?: emptyList()
              val orgToJoin = allOrgs.find { org -> org.id.toString() == organizationId.toString() }
              
              if (orgToJoin != null) {
                ECSDK.joinOrganizations(context, object : ECAPIListener<JsonArray> {
                  override fun onAPICompleted(result: JsonArray?) {
                    // Set the org as active
                    ECOrganizationHelper.setActiveOrg(context, orgToJoin)
                    promise.resolve(mapOf("success" to true))
                  }
                  
                  override fun onAPIProgress(bytesUploaded: Long, totalBytes: Long) {}
                  
                  override fun onAPIError(error: ECError) {
                    promise.reject("ECSDK_ERROR", error.errorMessage ?: "Failed to join organization", null)
                  }
                }, clientData, listOf(orgToJoin))
              } else {
                promise.reject("ECSDK_ERROR", "Organization not found", null)
              }
            } else {
              promise.reject("ECSDK_ERROR", "Failed to get organizations", null)
            }
          }
          
          override fun onAPIProgress(bytesUploaded: Long, totalBytes: Long) {}
          
          override fun onAPIError(error: ECError) {
            promise.reject("ECSDK_ERROR", error.errorMessage ?: "Failed to get organizations", null)
          }
        })
        
      } catch (e: Exception) {
        promise.reject("ECSDK_ERROR", e.message, e)
      }
    }

    // Get available organizations
    Function("getAvailableOrganizations") {
      val context = appContext.reactContext ?: throw Exception("React context not available")
      
      val joinedOrgs = ECOrganizationHelper.getAppOrgs(context)
      if (joinedOrgs != null && joinedOrgs.isNotEmpty()) {
        joinedOrgs.map { org ->
          mapOf(
            "organizationId" to org.id,
            "name" to org.name,
            "description" to ""
          )
        }
      } else {
        emptyList<Map<String, Any?>>()
      }
    }

    // Set active organization
    AsyncFunction("setActiveOrganization") { organizationId: Int, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        
        // First try to find in joined organizations
        val joinedOrgs = ECOrganizationHelper.getAppOrgs(context)
        val targetOrgFromJoined = joinedOrgs?.find { it.id == organizationId }
        
        if (targetOrgFromJoined != null) {
          ECOrganizationHelper.setActiveOrg(context, targetOrgFromJoined)
          promise.resolve(mapOf("success" to true))
        } else {
          // If not found in joined orgs, search in all available orgs
          ECOrganizationHelper.apiOrganizationList(context, true, object : ECAPIListener<Map<String, List<ECOrganizationData>>> {
            override fun onAPICompleted(result: Map<String, List<ECOrganizationData>>?) {
              if (result != null) {
                val organizations = result["orgs"]
                val targetOrg = organizations?.find { it.id == organizationId }
                
                if (targetOrg != null) {
                  ECOrganizationHelper.setActiveOrg(context, targetOrg)
                  promise.resolve(mapOf("success" to true))
                } else {
                  promise.reject("ECSDK_ERROR", "Organization not found", null)
                }
              } else {
                promise.reject("ECSDK_ERROR", "Failed to get organizations", null)
              }
            }
            
            override fun onAPIProgress(bytesUploaded: Long, totalBytes: Long) {}
            
            override fun onAPIError(error: ECError) {
              promise.reject("ECSDK_ERROR", error.errorMessage ?: "Failed to get organizations", null)
            }
          })
        }
        
      } catch (e: Exception) {
        promise.reject("ECSDK_ERROR", e.message, e)
      }
    }

    // Present report screen
    Function("presentReportScreen") {
      val activity = appContext.currentActivity ?: throw Exception("No current activity")
      val context = appContext.reactContext ?: throw Exception("React context not available")
      
      // Check if there's an active organization
      val activeOrg = ECOrganizationHelper.getActiveOrg(context)
      
      // Warn user if no active org is selected (don't auto-select)
      if (activeOrg == null) {
        val joinedOrgs = ECOrganizationHelper.getAppOrgs(context)
        if (joinedOrgs != null && joinedOrgs.isNotEmpty()) {
          throw Exception("No active organization selected. Please select an organization from your joined organizations list before submitting a report.")
        } else {
          throw Exception("No active organization. Please join an organization first.")
        }
      }
      
      // Create Intent as per SDK documentation
      val reportIntent = Intent()
      reportIntent.setClass(activity, ECReportActivity::class.java)
      activity.startActivity(reportIntent)
    }

    // Show message list activity
    Function("showMessageList") {
      val activity = appContext.currentActivity ?: throw Exception("No current activity")
      val messageListIntent = Intent(activity, ECUISDK.getMessageListClass())
      activity.startActivity(messageListIntent)
    }

    // FCM Token Management
    
    // Get the current FCM token
    AsyncFunction("getFCMToken") { promise: Promise ->
      try {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
          if (task.isSuccessful) {
            val token = task.result
            if (token != null) {
              promise.resolve(token)
            } else {
              promise.reject("ECSDK_ERROR", "FCM token is null", null)
            }
          } else {
            promise.reject("ECSDK_ERROR", "Failed to get FCM token: ${task.exception?.message}", task.exception)
          }
        }
      } catch (e: Exception) {
        promise.reject("ECSDK_ERROR", e.message, e)
      }
    }

    // Update FCM token with ELERTS server
    AsyncFunction("updateFCMToken") { fcmToken: String?, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        
        // Save token to preferences
        if (fcmToken != null) {
          ECPreferenceManager.putString(context, ECSDKFirebaseMessagingService.PROPERTY_REG_ID, fcmToken)
        }
        
        // Create user data with device ID
        val regData = ECUserData(context).apply {
          deviceId = ECUtils.getDeviceId(context)
        }
        
        // Get client data
        val clientData = ECClientData(context)
        
        // Only update if we have a client token (user is registered)
        if (clientData.token != null) {
          ECSDK.clientUpdate(context, object : ECAPIListener<ECUserData> {
            override fun onAPICompleted(result: ECUserData?) {
              promise.resolve(mapOf("success" to true))
            }
            
            override fun onAPIProgress(bytesUploaded: Long, totalBytes: Long) {}
            
            override fun onAPIError(error: ECError) {
              promise.reject("ECSDK_ERROR", error.errorMessage ?: "Failed to update FCM token", null)
            }
          }, regData, clientData)
        } else {
          promise.reject("ECSDK_ERROR", "Client not registered. Please register first.", null)
        }
        
      } catch (e: Exception) {
        promise.reject("ECSDK_ERROR", e.message, e)
      }
    }

    // Get stored FCM token from preferences
    Function("getStoredFCMToken") {
      val context = appContext.reactContext ?: throw Exception("React context not available")
      ECPreferenceManager.getString(context, ECSDKFirebaseMessagingService.PROPERTY_REG_ID, null)
    }

    // Register for remote notifications (FCM)
    // Note: FCM auto-registers when Firebase initializes, but this method
    // can be used to manually trigger token refresh for consistency with iOS API
    Function("registerForRemoteNotifications") {
      // On Android, FCM automatically handles registration via ECSDKFirebaseMessagingService
      // This method triggers a token refresh which will call onNewToken() in the service
      // The service will automatically send the token to ELERTS server if user is registered
      FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
        if (task.isSuccessful) {
          val token = task.result
          android.util.Log.d("EcsdkAndroidExpoModule", "FCM token refreshed: ${token?.take(20)}...")
          // Token will be automatically handled by ECSDKFirebaseMessagingService.onNewToken()
          // if it's a new token, or can be manually updated via updateFCMToken()
        } else {
          android.util.Log.e("EcsdkAndroidExpoModule", "Failed to refresh FCM token: ${task.exception?.message}")
        }
      }
    }

    // User Login/Logout Management
    
    // Login with existing ELERTS client token
    Function("login") { clientToken: String ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        
        // Use ECUISDK.login() as per the SDK documentation
        ECUISDK.login(clientToken)
        
        android.util.Log.d("EcsdkAndroidExpoModule", "User logged in with token")
      } catch (e: Exception) {
        throw Exception("Failed to login: ${e.message}")
      }
    }
    
    // Logout current user
    Function("logout") {
      try {
        val context = appContext.reactContext ?: throw Exception("React context not available")
        
        // Use ECUISDK.logout() as per the SDK documentation
        ECUISDK.logout()
        
        android.util.Log.d("EcsdkAndroidExpoModule", "User logged out")
      } catch (e: Exception) {
        throw Exception("Failed to logout: ${e.message}")
      }
    }
    
    // Get current client token
    Function("getClientToken") {
      val context = appContext.reactContext ?: throw Exception("React context not available")
      val clientData = ECClientData(context)
      clientData.token
    }
  }
}
