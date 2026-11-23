package com.fieldmonitoring.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.data.DemoPlot
import com.fieldmonitoring.app.data.Farmer
import com.fieldmonitoring.app.data.Search
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.Format
import com.fieldmonitoring.app.ui.Screen
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.DetailGrid
import com.fieldmonitoring.app.ui.components.EmptyState
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.components.FsTextField
import com.fieldmonitoring.app.ui.components.SectionTitle
import com.fieldmonitoring.app.ui.components.StatusPill
import com.fieldmonitoring.app.ui.components.plotStatusPill
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsText

private const val LIST_LIMIT = 300

@Composable
private fun SearchHeader(title: String, query: String, onQuery: (String) -> Unit, count: Int, hint: String) {
    Column(Modifier.fillMaxWidth().background(Fs.Background).padding(16.dp)) {
        SectionTitle(title)
        Spacer(Modifier.height(10.dp))
        FsTextField(
            label = null,
            value = query,
            onChange = onQuery,
            placeholder = hint,
            leading = AppIcons.Search,
            keyboardType = KeyboardType.Text,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            if (Search.isPhone(query)) "Exact phone number match: $count found" else "$count found",
            style = FsText.Label,
        )
    }
}

/** Farmers in the user's villages, searchable offline by name, phone or village. */
@Composable
fun FarmersScreen(vm: AppViewModel) {
    var query by rememberSaveable { mutableStateOf("") }
    val results = Search.farmers(vm.bundle.farmers, query)
    Column(Modifier.fillMaxSize().background(Fs.Background)) {
        SearchHeader("Farmers", query, { query = it }, results.size, "Name, phone number or village")
        if (results.isEmpty()) {
            EmptyState(
                if (vm.bundle.farmers.isEmpty()) "No farmers downloaded yet. Sync while online to get the farmers in your villages."
                else "No farmer matches \"$query\".",
            )
        }
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(results.take(LIST_LIMIT), key = { it.id }) { farmer ->
                FarmerRow(farmer) { vm.open(Screen.FarmerDetail(farmer.id)) }
            }
        }
    }
}

@Composable
private fun FarmerRow(farmer: Farmer, onClick: () -> Unit) {
    FsCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(44.dp).clip(CircleShape).background(Fs.PrimaryContainer),
                contentAlignment = Alignment.Center,
            ) { Icon(AppIcons.Person, null, tint = Fs.Primary) }
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text(farmer.name, color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Text(listOfNotNull(farmer.phone, farmer.villageName).joinToString("  |  "), color = Fs.Leaf, fontSize = 14.sp)
            }
            farmer.farmerType?.let { Text(Format.label(it), style = FsText.Label) }
        }
    }
}

/** Demo or adoption plots in the user's villages, searchable offline. */
@Composable
fun PlotsScreen(vm: AppViewModel, plotType: String) {
    var query by rememberSaveable { mutableStateOf("") }
    val all = vm.bundle.demoPlots.filter { it.plotType == plotType }
    val results = Search.plots(all, query)
    val title = if (plotType == "adoption") "Adoption Plots" else "Demo Plots"
    Column(Modifier.fillMaxSize().background(Fs.Background)) {
        SearchHeader(title, query, { query = it }, results.size, "Farmer, phone, crop or village")
        if (results.isEmpty()) {
            EmptyState(if (all.isEmpty()) "No ${title.lowercase()} in your villages yet." else "No plot matches \"$query\".")
        }
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(results.take(LIST_LIMIT), key = { it.id }) { plot ->
                PlotRow(plot) { vm.open(Screen.PlotDetail(plot.id)) }
            }
        }
    }
}

@Composable
internal fun PlotRow(plot: DemoPlot, onClick: () -> Unit) {
    FsCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(plot.cropName, color = Fs.Leaf, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.weight(1f))
            val (label, kind) = plotStatusPill(plot.status)
            StatusPill(label, kind)
        }
        Spacer(Modifier.height(10.dp))
        DetailGrid(
            listOf(
                "Farmer" to plot.farmerName,
                "Variety" to plot.varietyName,
                "Village" to (plot.villageName ?: ""),
                "Phone" to plot.farmerPhone,
                "Cycle" to Format.label(plot.cycle).takeIf { plot.cycle != null }.orEmpty(),
                "Created" to Format.date(plot.createdAt),
            ),
        )
    }
}
