package com.fieldmonitoring.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** One JSON setup for the whole app: tolerant of fields the server adds later. */
val AppJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
    explicitNulls = false
    coerceInputValues = true
}

@Serializable
data class User(
    val id: String,
    val userCode: String? = null,
    val name: String,
    val mobileNumber: String? = null,
    val email: String? = null,
    val role: String,
    val status: String? = null,
)

@Serializable
data class LoginResponse(val token: String, val user: User)

@Serializable
data class Village(
    val id: String,
    val name: String,
    @SerialName("block_name") val blockName: String? = null,
    @SerialName("district_name") val districtName: String? = null,
    @SerialName("state_name") val stateName: String? = null,
    @SerialName("country_name") val countryName: String? = null,
)

@Serializable
data class Farmer(
    val id: String,
    val name: String,
    val phone: String,
    val status: String? = null,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("farmer_type") val farmerType: String? = null,
    val gender: String? = null,
    val age: Int? = null,
    @SerialName("birth_date") val birthDate: String? = null,
    val address: String? = null,
    @SerialName("education_level") val educationLevel: String? = null,
    val literacy: String? = null,
    @SerialName("phone_type") val phoneType: String? = null,
    val email: String? = null,
    @SerialName("village_id") val villageId: String,
    @SerialName("village_name") val villageName: String? = null,
    @SerialName("district_name") val districtName: String? = null,
    @SerialName("state_name") val stateName: String? = null,
    @SerialName("country_name") val countryName: String? = null,
)

@Serializable
data class DemoPlot(
    val id: String,
    @SerialName("farmer_id") val farmerId: String? = null,
    @SerialName("farmer_name") val farmerName: String,
    @SerialName("farmer_phone") val farmerPhone: String,
    @SerialName("demo_status") val status: String,
    @SerialName("plot_type") val plotType: String,
    val cycle: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("gps_lat") val gpsLat: String? = null,
    @SerialName("gps_lng") val gpsLng: String? = null,
    @SerialName("crop_name") val cropName: String,
    @SerialName("variety_name") val varietyName: String,
    @SerialName("village_id") val villageId: String,
    @SerialName("village_name") val villageName: String? = null,
    @SerialName("district_name") val districtName: String? = null,
)

@Serializable
data class MasterItem(
    val id: String,
    val name: String,
    @SerialName("acknowledge_only") val acknowledgeOnly: Boolean = false,
)

@Serializable
data class Variety(val id: String, @SerialName("crop_id") val cropId: String, val name: String)

@Serializable
data class OpenIssue(
    @SerialName("demo_plot_id") val demoPlotId: String,
    @SerialName("issue_type_id") val issueTypeId: String,
    @SerialName("issue_type_name") val issueTypeName: String,
    val status: String,
    @SerialName("holder_name") val holderName: String? = null,
)

@Serializable
data class Master(
    val crops: List<MasterItem> = emptyList(),
    val varieties: List<Variety> = emptyList(),
    val issueTypes: List<MasterItem> = emptyList(),
    val goodThings: List<MasterItem> = emptyList(),
    val diseases: List<MasterItem> = emptyList(),
    val pests: List<MasterItem> = emptyList(),
    val techniques: List<MasterItem> = emptyList(),
)

/** Everything the phone needs offline, from GET /sync/bundle. */
@Serializable
data class Bundle(
    val serverTime: String = "",
    val villages: List<Village> = emptyList(),
    val farmers: List<Farmer> = emptyList(),
    val demoPlots: List<DemoPlot> = emptyList(),
    val openIssues: List<OpenIssue> = emptyList(),
    val master: Master = Master(),
)

@Serializable
data class NamedPhoto(val name: String? = null, val photoUrl: String? = null)

/** A visit already on the server (GET /visits?demo_plot_id=). */
@Serializable
data class ServerVisit(
    val id: String,
    @SerialName("action_plan") val actionPlan: String = "",
    val comments: String = "",
    @SerialName("overall_photo_url") val overallPhotoUrl: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("visited_by_name") val visitedByName: String? = null,
    val issues: List<NamedPhoto> = emptyList(),
    val goodThings: List<NamedPhoto> = emptyList(),
    val techniques: List<NamedPhoto> = emptyList(),
    val diseases: List<NamedPhoto> = emptyList(),
    val pests: List<NamedPhoto> = emptyList(),
)

@Serializable
data class VisitList(val visits: List<ServerVisit> = emptyList())

/**
 * A visit logged on the phone. It waits in the outbox until the server has
 * it. [photos] maps the server's multipart field name (overallPhoto,
 * issuePhoto_<id>, diseasePhoto_<id>, diseasePhotoOther, ...) to a JPEG file
 * in the app's own storage.
 */
@Serializable
data class VisitDraft(
    val clientId: String,
    val demoPlotId: String,
    val plotType: String,
    val actionPlan: String,
    val comments: String,
    val issueTypeIds: List<String> = emptyList(),
    val goodThingIds: List<String> = emptyList(),
    val techniqueIds: List<String> = emptyList(),
    val diseaseIds: List<String> = emptyList(),
    val pestIds: List<String> = emptyList(),
    val diseaseOther: String = "",
    val pestOther: String = "",
    val photos: Map<String, String> = emptyMap(),
    val gpsLat: Double? = null,
    val gpsLng: Double? = null,
    val gpsAccuracy: Float? = null,
    val createdAtMillis: Long = 0,
)
