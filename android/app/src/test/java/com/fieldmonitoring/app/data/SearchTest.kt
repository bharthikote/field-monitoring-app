package com.fieldmonitoring.app.data

import org.junit.Assert.assertEquals
import org.junit.Test

class SearchTest {
    private fun farmer(name: String, phone: String, village: String = "Hosur") =
        Farmer(id = phone, name = name, phone = phone, villageId = "v", villageName = village)

    private val farmers = listOf(
        farmer("Asha Devi", "123456789"),
        farmer("Ravi Kumar", "1234567891", "Kolar"),
        farmer("Meena", "998877665"),
    )

    @Test fun phoneNumberMatchesExactlyLikeTheServer() {
        // "123456789" must not also find "1234567891" (server rule, demoPlots.js)
        assertEquals(listOf("Asha Devi"), Search.farmers(farmers, "123456789").map { it.name })
    }

    @Test fun shortDigitsSearchAsText() {
        assertEquals(2, Search.farmers(farmers, "12345").size)
    }

    @Test fun textMatchesNameOrVillageIgnoringCase() {
        assertEquals(listOf("Asha Devi"), Search.farmers(farmers, "asha").map { it.name })
        assertEquals(listOf("Ravi Kumar"), Search.farmers(farmers, "kolar").map { it.name })
    }

    @Test fun blankQueryReturnsEveryone() = assertEquals(3, Search.farmers(farmers, "  ").size)

    @Test fun plotsSearchByCropAndExactPhone() {
        val plots = listOf(
            DemoPlot("p1", "f1", "Asha", "123456789", "ongoing", "demo", cropName = "Tomato", varietyName = "Padma F1", villageId = "v"),
            DemoPlot("p2", "f2", "Ravi", "1234567891", "ongoing", "demo", cropName = "Chilli", varietyName = "Jwala", villageId = "v"),
        )
        assertEquals(listOf("p1"), Search.plots(plots, "tomato").map { it.id })
        assertEquals(listOf("p2"), Search.plots(plots, "1234567891").map { it.id })
    }
}
