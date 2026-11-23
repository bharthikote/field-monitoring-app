package com.fieldmonitoring.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class FarmerTest {
    private val today = LocalDate.of(2026, 11, 23)
    private val ok = FarmerDraft(
        clientId = "c1", name = "Asha Devi", phone = "9876543210", villageId = "v1", villageName = "Hosur",
        farmerType = "key_farmer", gender = "female", age = "34", birthDate = "1992-05-10",
        educationLevel = "secondary", literacy = "yes", phoneType = "smartphone",
    )

    @Test fun completeFarmerPasses() = assertNull(FarmerRules.validate(ok, null, today))

    @Test fun requiredFieldsLikeThePreviousApp() {
        listOf(
            ok.copy(name = " "), ok.copy(farmerType = ""), ok.copy(gender = ""), ok.copy(age = ""),
            ok.copy(birthDate = ""), ok.copy(villageId = ""), ok.copy(educationLevel = ""),
            ok.copy(literacy = ""), ok.copy(phoneType = ""),
        ).forEach { assertEquals("Please fill in all required fields", FarmerRules.validate(it, null, today)) }
        // Address, email, social media and photo are optional.
        assertNull(FarmerRules.validate(ok.copy(address = "", email = "", socialMedia = emptyList(), photo = null), null, today))
    }

    @Test fun phoneMustBeDigits() =
        assertEquals("Enter the phone number as 6 to 15 digits", FarmerRules.validate(ok.copy(phone = "12345"), null, today))

    @Test fun phoneAlreadyRegisteredIsCaughtOffline() =
        assertEquals("Ravi is already registered with this phone number", FarmerRules.validate(ok, "Ravi", today))

    @Test fun ageAtLeast15() =
        assertEquals("Age must be a whole number of 15 or above", FarmerRules.validate(ok.copy(age = "14"), null, today))

    @Test fun birthDateNotInFuture() =
        assertEquals("The birth date can't be in the future", FarmerRules.validate(ok.copy(birthDate = "2027-01-01"), null, today))

    @Test fun badEmailRejected() =
        assertEquals("That email address looks invalid", FarmerRules.validate(ok.copy(email = "asha@"), null, today))

    @Test fun typingAgeSetsBirthYear() {
        assertEquals("1992-05-10", FarmerRules.birthDateForAge("34", "1990-05-10", today))
        assertEquals("1996-11-23", FarmerRules.birthDateForAge("30", "", today))
    }

    @Test fun formFieldsMatchPostFarmers() {
        val fields = FarmerRules.formFields(ok.copy(socialMedia = listOf("facebook", "tiktok"), address = " Near temple ")).toMap()
        assertEquals("c1", fields["clientId"])
        assertEquals("v1", fields["villageId"])
        assertEquals("key_farmer", fields["farmerType"])
        assertEquals("""["facebook","tiktok"]""", fields["socialMedia"])
        assertEquals("Near temple", fields["address"])
        assertTrue("email" !in fields)
    }

    // --- Saved offline, sent on sync ---

    private val store = FakeStore()
    private val remote = FakeRemote()
    private val repo = Repository(store, remote, Dispatchers.Unconfined)

    @Test fun newFarmerShowsUpLocallyUntilSent() = runBlocking {
        assertNull(repo.saveFarmer(ok.copy(phone = "98765 43210")))
        val local = repo.localFarmers().single()
        assertEquals("local:c1", local.id)
        assertEquals("9876543210", local.phone) // stored as digits only
        assertEquals(RecordState.PENDING, local.status)

        remote.answers += { """{"farmer":{"id":"f-server","name":"Asha Devi"}}""" }
        repo.syncNow()

        assertEquals("c1", remote.posted.single().toMap()["clientId"])
        assertEquals(RecordState.SENT, store.records.getValue("c1").state)
        assertEquals("f-server", store.records.getValue("c1").serverId)
        assertTrue("sent farmers come from the server copy now", repo.localFarmers().isEmpty())
    }

    @Test fun samePhoneTwiceOnThisPhoneIsRefused() {
        repo.saveFarmer(ok)
        assertEquals(
            "Asha Devi is already registered with this phone number",
            repo.saveFarmer(ok.copy(clientId = "c2", name = "Someone Else")),
        )
    }

    @Test fun duplicateFoundOnTheServerNeedsAttention() = runBlocking {
        repo.saveFarmer(ok)
        remote.answers += { throw ApiException("Ravi is already registered with this phone number.", status = 409, code = "duplicate_phone") }
        repo.syncNow()
        val farmer = repo.localFarmers().single()
        assertEquals(RecordState.ATTENTION, farmer.status)
        assertEquals("Ravi is already registered with this phone number.", store.records.getValue("c1").error)
    }
}
