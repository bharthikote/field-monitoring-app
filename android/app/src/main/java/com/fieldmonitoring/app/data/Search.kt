package com.fieldmonitoring.app.data

/**
 * Offline search, with the server's rule: a query of 6 or more digits is a
 * phone number and must match exactly (so "123456789" never finds
 * "1234567891"); anything else matches name, phone, village or crop text.
 */
object Search {
    private val PHONE_LIKE = Regex("^\\d{6,}$")

    fun isPhone(query: String) = PHONE_LIKE.matches(query.trim())

    fun farmers(all: List<Farmer>, query: String): List<Farmer> {
        val q = query.trim()
        if (q.isEmpty()) return all
        if (isPhone(q)) return all.filter { it.phone == q }
        return all.filter {
            it.name.contains(q, true) || it.phone.contains(q) || (it.villageName?.contains(q, true) == true)
        }
    }

    fun plots(all: List<DemoPlot>, query: String): List<DemoPlot> {
        val q = query.trim()
        if (q.isEmpty()) return all
        if (isPhone(q)) return all.filter { it.farmerPhone == q }
        return all.filter {
            it.farmerName.contains(q, true) || it.farmerPhone.contains(q) ||
                it.cropName.contains(q, true) || it.varietyName.contains(q, true) ||
                (it.villageName?.contains(q, true) == true)
        }
    }
}
