package com.fieldmonitoring.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.fieldmonitoring.app.data.Gps
import com.fieldmonitoring.app.data.GpsFix
import com.fieldmonitoring.app.data.MasterItem
import com.fieldmonitoring.app.data.Photos
import com.fieldmonitoring.app.data.VisitDraft
import com.fieldmonitoring.app.data.VisitRules
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.CreateButton
import com.fieldmonitoring.app.ui.components.DangerButton
import com.fieldmonitoring.app.ui.components.EmptyState
import com.fieldmonitoring.app.ui.components.ErrorText
import com.fieldmonitoring.app.ui.components.FormLabel
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.components.FsTextField
import com.fieldmonitoring.app.ui.components.PickOption
import com.fieldmonitoring.app.ui.components.SearchPicker
import com.fieldmonitoring.app.ui.components.SectionTitle
import com.fieldmonitoring.app.ui.components.SelectField
import com.fieldmonitoring.app.ui.components.TonalChip
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsShape
import com.fieldmonitoring.app.ui.theme.FsText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

private enum class ListKind(val title: String) {
    Issues("Issues observed today"),
    GoodThings("Good things observed"),
    Techniques("Techniques adopted"),
    Diseases("Diseases identified"),
    Pests("Pests identified"),
}

/**
 * Log Visit, fully offline: the lists come from the downloaded bundle, GPS
 * needs no data connection, photos are saved on the phone, and the finished
 * visit goes into the outbox. Same fields and rules as the online form.
 */
@Composable
fun LogVisitScreen(vm: AppViewModel, plotId: String) {
    val plot = vm.bundle.demoPlots.firstOrNull { it.id == plotId }
    if (plot == null) {
        EmptyState("This plot is no longer in your downloaded data.")
        return
    }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val master = vm.bundle.master
    val openIssues = vm.bundle.openIssues.filter { it.demoPlotId == plotId }.associateBy { it.issueTypeId }
    val isAdoption = plot.plotType == "adoption"

    val clientId = rememberSaveable { UUID.randomUUID().toString() }
    var actionPlan by rememberSaveable { mutableStateOf("") }
    var comments by rememberSaveable { mutableStateOf("") }
    var diseaseOther by rememberSaveable { mutableStateOf("") }
    var pestOther by rememberSaveable { mutableStateOf("") }
    val selected = remember { mutableStateMapOf<ListKind, Set<String>>() }
    val photos = remember { mutableStateMapOf<String, String>() }
    var picker by remember { mutableStateOf<ListKind?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var gps by remember { mutableStateOf<GpsFix?>(null) }
    var gpsState by remember { mutableStateOf("Getting your location...") }

    // --- GPS ---
    fun readGps() {
        gpsState = "Getting your location..."
        scope.launch {
            val fix = Gps.current(context)
            gps = fix
            gpsState = when {
                fix == null -> "Location not available. Turn on location and try again - the visit can still be saved."
                fix.accuracy > Gps.GOOD_ACCURACY_M -> "Location recorded (accuracy ${fix.accuracy.toInt()} m - move into the open for a better fix)"
                else -> "Location recorded (accuracy ${fix.accuracy.toInt()} m)"
            }
        }
    }
    val locationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) readGps() else gpsState = "Location permission was refused. The visit can still be saved without it."
    }
    LaunchedEffect(Unit) {
        val has = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (has) readGps() else locationPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }

    // --- Photos ---
    var cameraTarget by remember { mutableStateOf<Triple<String, File, Uri>?>(null) }
    var galleryField by remember { mutableStateOf<String?>(null) }
    fun keepPhoto(field: String, uri: Uri, cleanup: File?) {
        scope.launch {
            val saved = withContext(Dispatchers.IO) { Photos.keep(context, uri) }
            cleanup?.delete()
            if (saved == null) {
                error = "Couldn't read that photo. Try again."
            } else {
                photos[field]?.let { File(it).delete() }
                photos[field] = saved.path
            }
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val target = cameraTarget
        if (ok && target != null) keepPhoto(target.first, target.third, target.second)
        cameraTarget = null
    }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val field = galleryField
        if (uri != null && field != null) keepPhoto(field, uri, null)
        galleryField = null
    }
    val takePhoto: (String) -> Unit = { field ->
        val (file, uri) = Photos.newCameraTarget(context)
        cameraTarget = Triple(field, file, uri)
        camera.launch(uri)
    }
    val pickPhoto: (String) -> Unit = { field ->
        galleryField = field
        gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }

    fun itemsFor(kind: ListKind): List<MasterItem> = when (kind) {
        ListKind.Issues -> master.issueTypes
        ListKind.GoodThings -> master.goodThings
        ListKind.Techniques -> master.techniques
        ListKind.Diseases -> master.diseases
        ListKind.Pests -> master.pests
    }
    fun photoField(kind: ListKind, id: String) = when (kind) {
        ListKind.Issues -> VisitRules.issuePhoto(id)
        ListKind.GoodThings -> VisitRules.goodThingPhoto(id)
        ListKind.Diseases -> VisitRules.diseasePhoto(id)
        ListKind.Pests -> VisitRules.pestPhoto(id)
        ListKind.Techniques -> null
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(Fs.Background)
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column {
            SectionTitle("Log Visit")
            Text("${plot.farmerName} - ${plot.cropName} (${plot.varietyName})", style = FsText.Label)
        }

        FsCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(AppIcons.Place, null, tint = if (gps != null) Fs.Leaf else Fs.Accent)
                Text(gpsState, color = Fs.OnSurface, fontSize = 14.sp, modifier = Modifier.weight(1f).padding(start = 8.dp))
                TonalChip("Retry") { readGps() }
            }
        }

        FsCard {
            FormLabel("Photo of the visit", required = true)
            PhotoSlot(photos[VisitRules.OVERALL_PHOTO], { takePhoto(VisitRules.OVERALL_PHOTO) }, { pickPhoto(VisitRules.OVERALL_PHOTO) }, large = true)
        }

        FsTextField("Action plan", actionPlan, { actionPlan = it }, required = true, singleLine = false, minLines = 3)
        FsTextField("Comments", comments, { comments = it }, required = true, singleLine = false, minLines = 3)

        val kinds = ListKind.entries.filter { it != ListKind.Techniques || isAdoption }
        kinds.forEach { kind ->
            val chosen = selected[kind].orEmpty()
            val items = itemsFor(kind)
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectField(
                    kind.title,
                    if (chosen.isEmpty()) "" else "${chosen.size} selected",
                    { picker = kind },
                )
                chosen.mapNotNull { id -> items.firstOrNull { it.id == id } }.forEach { item ->
                    val field = photoField(kind, item.id)
                    val photoRequired = kind == ListKind.Diseases || kind == ListKind.Pests
                    ItemRow(
                        name = item.name,
                        note = if (kind == ListKind.Issues) openIssues[item.id]?.let { "Already open (${it.holderName ?: "unassigned"}) - recorded, not raised again" } else null,
                        photo = field?.let { photos[it] },
                        photoRequired = photoRequired,
                        onCamera = field?.let { { takePhoto(it) } },
                        onGallery = field?.let { { pickPhoto(it) } },
                        onRemove = {
                            selected[kind] = chosen - item.id
                            field?.let { f -> photos.remove(f)?.let { File(it).delete() } }
                        },
                    )
                }
                if (kind == ListKind.Diseases || kind == ListKind.Pests) {
                    val other = if (kind == ListKind.Diseases) diseaseOther else pestOther
                    val otherField = if (kind == ListKind.Diseases) VisitRules.DISEASE_OTHER_PHOTO else VisitRules.PEST_OTHER_PHOTO
                    FsTextField(
                        null,
                        other,
                        { if (kind == ListKind.Diseases) diseaseOther = it else pestOther = it },
                        placeholder = "Other ${if (kind == ListKind.Diseases) "disease" else "pest"} (not in the list)",
                    )
                    if (other.isNotBlank()) {
                        ItemRow(other, null, photos[otherField], true, { takePhoto(otherField) }, { pickPhoto(otherField) }, null)
                    }
                }
            }
        }

        error?.let { ErrorText(it) }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CreateButton("Save", {
                val draft = VisitDraft(
                    clientId = clientId,
                    demoPlotId = plotId,
                    plotType = plot.plotType,
                    actionPlan = actionPlan,
                    comments = comments,
                    issueTypeIds = selected[ListKind.Issues].orEmpty().toList(),
                    goodThingIds = selected[ListKind.GoodThings].orEmpty().toList(),
                    techniqueIds = if (isAdoption) selected[ListKind.Techniques].orEmpty().toList() else emptyList(),
                    diseaseIds = selected[ListKind.Diseases].orEmpty().toList(),
                    pestIds = selected[ListKind.Pests].orEmpty().toList(),
                    diseaseOther = diseaseOther,
                    pestOther = pestOther,
                    photos = photos.toMap(),
                    gpsLat = gps?.lat,
                    gpsLng = gps?.lng,
                    gpsAccuracy = gps?.accuracy,
                    createdAtMillis = System.currentTimeMillis(),
                )
                error = vm.saveVisit(draft)
            })
            DangerButton("Cancel", {
                photos.values.forEach { File(it).delete() }
                vm.back()
            })
        }
        Text("* Required fields", style = FsText.Label)
        Spacer(Modifier.height(24.dp))
    }

    picker?.let { kind ->
        SearchPicker(
            title = kind.title,
            options = itemsFor(kind).map { item ->
                PickOption(
                    item.id,
                    item.name,
                    if (kind == ListKind.Issues) openIssues[item.id]?.let { "Already open" } else null,
                )
            },
            selected = selected[kind].orEmpty(),
            multi = true,
            onDismiss = { picker = null },
            onDone = { chosen ->
                val removed = selected[kind].orEmpty() - chosen
                removed.forEach { id -> photoField(kind, id)?.let { f -> photos.remove(f)?.let { File(it).delete() } } }
                selected[kind] = chosen
                picker = null
            },
        )
    }
}

@Composable
private fun ItemRow(
    name: String,
    note: String?,
    photo: String?,
    photoRequired: Boolean,
    onCamera: (() -> Unit)?,
    onGallery: (() -> Unit)?,
    onRemove: (() -> Unit)?,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(FsShape.Control)
            .background(Fs.PrimaryContainer)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(name, color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f))
            if (onRemove != null) TonalChip("Remove", onRemove)
        }
        note?.let { Text(it, color = Fs.Accent, fontSize = 13.sp) }
        if (onCamera != null && onGallery != null) {
            Text(if (photoRequired) "Photo (required)" else "Photo (optional)", style = FsText.Label)
            PhotoSlot(photo, onCamera, onGallery, large = false)
        }
    }
}

@Composable
private fun PhotoSlot(path: String?, onCamera: () -> Unit, onGallery: () -> Unit, large: Boolean) {
    val bitmap = remember(path) {
        path?.let { BitmapFactory.decodeFile(it, BitmapFactory.Options().apply { inSampleSize = 4 }) }
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (bitmap != null) {
            Image(
                bitmap.asImageBitmap(),
                contentDescription = "Photo",
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(if (large) 120.dp else 72.dp).clip(FsShape.Tile),
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            TonalChip(if (bitmap == null) "Take photo" else "Retake", onCamera)
            TonalChip("From gallery", onGallery)
        }
    }
}
