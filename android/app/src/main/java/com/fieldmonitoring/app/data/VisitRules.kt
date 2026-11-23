package com.fieldmonitoring.app.data

/**
 * The same checks POST /visits makes, run on the phone before a visit is
 * saved offline - so a visit never sits in the outbox only to be refused
 * later. Returns a message for the user, or null when the visit is complete.
 */
object VisitRules {
    const val OVERALL_PHOTO = "overallPhoto"

    fun issuePhoto(id: String) = "issuePhoto_$id"
    fun goodThingPhoto(id: String) = "goodThingPhoto_$id"
    fun diseasePhoto(id: String) = "diseasePhoto_$id"
    fun pestPhoto(id: String) = "pestPhoto_$id"
    const val DISEASE_OTHER_PHOTO = "diseasePhotoOther"
    const val PEST_OTHER_PHOTO = "pestPhotoOther"

    fun validate(draft: VisitDraft): String? {
        if (draft.actionPlan.isBlank()) return "Enter the action plan"
        if (draft.comments.isBlank()) return "Enter your comments"
        if (OVERALL_PHOTO !in draft.photos) return "Add a photo of the visit"
        if (draft.diseaseIds.any { diseasePhoto(it) !in draft.photos }) return "Add a photo for every disease selected"
        if (draft.diseaseOther.isNotBlank() && DISEASE_OTHER_PHOTO !in draft.photos) return "Add a photo for the Other disease"
        if (draft.pestIds.any { pestPhoto(it) !in draft.photos }) return "Add a photo for every pest selected"
        if (draft.pestOther.isNotBlank() && PEST_OTHER_PHOTO !in draft.photos) return "Add a photo for the Other pest"
        if (draft.plotType != "adoption" && draft.techniqueIds.isNotEmpty()) return "Techniques are only recorded on adoption plots"
        return null
    }

    /** Text fields sent with the photos, in the shape POST /visits reads. */
    fun formFields(draft: VisitDraft): List<Pair<String, String>> = buildList {
        add("clientId" to draft.clientId)
        add("demoPlotId" to draft.demoPlotId)
        add("actionPlan" to draft.actionPlan.trim())
        add("comments" to draft.comments.trim())
        add("issueTypeIds" to jsonList(draft.issueTypeIds))
        add("goodThingIds" to jsonList(draft.goodThingIds))
        if (draft.plotType == "adoption") add("techniqueIds" to jsonList(draft.techniqueIds))
        add("diseaseIds" to jsonList(draft.diseaseIds))
        add("pestIds" to jsonList(draft.pestIds))
        if (draft.diseaseOther.isNotBlank()) add("diseaseOther" to draft.diseaseOther.trim())
        if (draft.pestOther.isNotBlank()) add("pestOther" to draft.pestOther.trim())
        if (draft.gpsLat != null && draft.gpsLng != null) {
            add("gpsLat" to draft.gpsLat.toString())
            add("gpsLng" to draft.gpsLng.toString())
            draft.gpsAccuracy?.let { add("gpsAccuracy" to it.toString()) }
        }
    }

    private fun jsonList(ids: List<String>) = ids.joinToString(",", "[", "]") { "\"$it\"" }
}
