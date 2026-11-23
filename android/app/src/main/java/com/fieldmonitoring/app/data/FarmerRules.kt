package com.fieldmonitoring.app.data

import kotlinx.serialization.Serializable
import java.time.LocalDate

/** A farmer registered on the phone, waiting in the outbox (kind "farmer"). */
@Serializable
data class FarmerDraft(
    val clientId: String,
    val name: String,
    val phone: String,
    val villageId: String,
    val villageName: String = "",
    val farmerType: String = "",
    val gender: String = "",
    val age: String = "",
    val birthDate: String = "", // YYYY-MM-DD
    val address: String = "",
    val educationLevel: String = "",
    val literacy: String = "",
    val phoneType: String = "",
    val socialMedia: List<String> = emptyList(),
    val email: String = "",
    val photo: String? = null, // local JPEG until sent
    val createdAtMillis: Long = 0,
)

data class Choice(val id: String, val label: String)

/**
 * The Add Farmer form's options and rules - the same as the previous app's
 * detailed form and POST /farmers (backend/src/routes/farmers.js).
 */
object FarmerRules {
    val TYPES = listOf(
        Choice("key_farmer", "Key Farmer"),
        Choice("core_farmer", "Core Farmer"),
        Choice("farmer", "Farmer"),
        Choice("community_trainer_farmer", "Community Trainer Farmer"),
    )
    val GENDERS = listOf(Choice("male", "Male"), Choice("female", "Female"), Choice("others", "Others"))
    val EDUCATION = listOf(
        Choice("primary", "Primary"),
        Choice("secondary", "Secondary"),
        Choice("higher", "Higher"),
        Choice("adult", "Adult"),
        Choice("no_school", "No School"),
    )
    val LITERACY = listOf(Choice("yes", "Yes"), Choice("no", "No"))
    val PHONE_TYPES = listOf(Choice("smartphone", "Smart Phone"), Choice("cellphone", "Cell Phone"), Choice("no_phone", "No Phone"))
    val SOCIAL = listOf(
        Choice("facebook", "Facebook"),
        Choice("instagram", "Instagram"),
        Choice("snapchat", "Snapchat"),
        Choice("telegram", "Telegram"),
        Choice("tiktok", "TikTok"),
        Choice("twitter", "Twitter"),
    )

    const val MIN_AGE = 15
    private val PHONE = Regex("^\\d{6,15}$")
    private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun labelOf(list: List<Choice>, id: String?) = list.firstOrNull { it.id == id }?.label ?: ""

    /** Phone numbers are typed with spaces or dashes sometimes; store digits only. */
    fun cleanPhone(raw: String) = raw.filter { it.isDigit() }

    /**
     * Returns a message for the first problem, or null when the farmer can be
     * saved. [phoneOwner] names the farmer who already has this phone number
     * (on the server copy or registered on this phone), if any.
     */
    fun validate(d: FarmerDraft, phoneOwner: String?, today: LocalDate = LocalDate.now()): String? {
        if (d.name.isBlank() || d.phone.isBlank() || d.villageId.isBlank() || d.farmerType.isBlank() ||
            d.gender.isBlank() || d.age.isBlank() || d.birthDate.isBlank() || d.educationLevel.isBlank() ||
            d.literacy.isBlank() || d.phoneType.isBlank()
        ) return "Please fill in all required fields"
        if (!PHONE.matches(d.phone)) return "Enter the phone number as 6 to 15 digits"
        if (phoneOwner != null) return "$phoneOwner is already registered with this phone number"
        val age = d.age.toIntOrNull()
        if (age == null || age < MIN_AGE || age > 120) return "Age must be a whole number of $MIN_AGE or above"
        val birth = runCatching { LocalDate.parse(d.birthDate) }.getOrNull() ?: return "Pick the birth date"
        if (birth.isAfter(today)) return "The birth date can't be in the future"
        if (d.email.isNotBlank() && !EMAIL.matches(d.email.trim())) return "That email address looks invalid"
        if (d.socialMedia.any { s -> SOCIAL.none { it.id == s } }) return "Unknown social media choice"
        return null
    }

    /** Birth date year follows the age typed (month and day kept, or today's). */
    fun birthDateForAge(age: String, current: String, today: LocalDate = LocalDate.now()): String {
        val years = age.toIntOrNull() ?: return current
        val base = runCatching { LocalDate.parse(current) }.getOrNull() ?: today
        return runCatching { base.withYear(today.year - years) }.getOrElse { base.withDayOfMonth(28).withYear(today.year - years) }.toString()
    }

    /** Text fields for POST /farmers (multipart, with the optional "photo" file). */
    fun formFields(d: FarmerDraft): List<Pair<String, String>> = buildList {
        add("clientId" to d.clientId)
        add("name" to d.name.trim())
        add("phone" to d.phone)
        add("villageId" to d.villageId)
        add("farmerType" to d.farmerType)
        add("gender" to d.gender)
        add("age" to d.age)
        add("birthDate" to d.birthDate)
        add("educationLevel" to d.educationLevel)
        add("literacy" to d.literacy)
        add("phoneType" to d.phoneType)
        if (d.address.isNotBlank()) add("address" to d.address.trim())
        if (d.email.isNotBlank()) add("email" to d.email.trim())
        if (d.socialMedia.isNotEmpty()) add("socialMedia" to d.socialMedia.joinToString(",", "[", "]") { "\"$it\"" })
    }

    /** How a farmer still on the phone shows in lists and on the profile. */
    fun asFarmer(d: FarmerDraft, recordState: String) = Farmer(
        id = LOCAL_PREFIX + d.clientId,
        name = d.name.trim(),
        phone = d.phone,
        status = recordState,
        farmerType = d.farmerType,
        gender = d.gender,
        age = d.age.toIntOrNull(),
        birthDate = d.birthDate,
        address = d.address.ifBlank { null },
        educationLevel = d.educationLevel,
        literacy = d.literacy,
        phoneType = d.phoneType,
        email = d.email.ifBlank { null },
        villageId = d.villageId,
        villageName = d.villageName,
    )

    const val LOCAL_PREFIX = "local:"
}
