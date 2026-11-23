package com.fieldmonitoring.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VisitRulesTest {
    private val base = VisitDraft(
        clientId = "11111111-1111-1111-1111-111111111111",
        demoPlotId = "22222222-2222-2222-2222-222222222222",
        plotType = "demo",
        actionPlan = "Stake the plants",
        comments = "Good growth",
        photos = mapOf(VisitRules.OVERALL_PHOTO to "/p/overall.jpg"),
    )

    @Test fun completeVisitPasses() = assertNull(VisitRules.validate(base))

    @Test fun actionPlanAndCommentsAreRequired() {
        assertEquals("Enter the action plan", VisitRules.validate(base.copy(actionPlan = "  ")))
        assertEquals("Enter your comments", VisitRules.validate(base.copy(comments = "")))
    }

    @Test fun overallPhotoIsRequired() =
        assertEquals("Add a photo of the visit", VisitRules.validate(base.copy(photos = emptyMap())))

    @Test fun everyDiseaseAndPestNeedsAPhoto() {
        assertEquals(
            "Add a photo for every disease selected",
            VisitRules.validate(base.copy(diseaseIds = listOf("d1"))),
        )
        assertNull(
            VisitRules.validate(
                base.copy(diseaseIds = listOf("d1"), photos = base.photos + (VisitRules.diseasePhoto("d1") to "/p/d1.jpg")),
            ),
        )
        assertEquals("Add a photo for every pest selected", VisitRules.validate(base.copy(pestIds = listOf("p1"))))
    }

    @Test fun otherDiseaseOrPestNeedsAPhoto() {
        assertEquals("Add a photo for the Other disease", VisitRules.validate(base.copy(diseaseOther = "Leaf curl")))
        assertEquals("Add a photo for the Other pest", VisitRules.validate(base.copy(pestOther = "Aphids")))
    }

    @Test fun issuePhotosAreOptional() = assertNull(VisitRules.validate(base.copy(issueTypeIds = listOf("i1"))))

    @Test fun techniquesOnlyOnAdoptionPlots() {
        assertEquals(
            "Techniques are only recorded on adoption plots",
            VisitRules.validate(base.copy(techniqueIds = listOf("t1"))),
        )
        assertNull(VisitRules.validate(base.copy(plotType = "adoption", techniqueIds = listOf("t1"))))
    }

    @Test fun formFieldsMatchWhatTheServerReads() {
        val fields = VisitRules.formFields(
            base.copy(issueTypeIds = listOf("a", "b"), gpsLat = 12.5, gpsLng = 77.25, gpsAccuracy = 8f, actionPlan = " trim me "),
        ).toMap()
        assertEquals(base.clientId, fields["clientId"])
        assertEquals("trim me", fields["actionPlan"])
        assertEquals("[\"a\",\"b\"]", fields["issueTypeIds"])
        assertEquals("[]", fields["pestIds"])
        assertEquals("12.5", fields["gpsLat"])
        assertEquals("8.0", fields["gpsAccuracy"])
        assertFalse("techniques are not sent for demo plots", "techniqueIds" in fields)
        assertTrue("techniqueIds" in VisitRules.formFields(base.copy(plotType = "adoption")).toMap())
    }

    @Test fun noGpsMeansNoGpsFields() {
        val fields = VisitRules.formFields(base).toMap()
        assertFalse("gpsLat" in fields)
    }
}
