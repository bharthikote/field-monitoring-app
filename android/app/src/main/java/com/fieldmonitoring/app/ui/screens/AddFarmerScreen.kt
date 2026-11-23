package com.fieldmonitoring.app.ui.screens

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.data.Choice
import com.fieldmonitoring.app.data.FarmerDraft
import com.fieldmonitoring.app.data.FarmerRules
import com.fieldmonitoring.app.data.Photos
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.Format
import com.fieldmonitoring.app.ui.components.AppIcons
import com.fieldmonitoring.app.ui.components.CreateButton
import com.fieldmonitoring.app.ui.components.DangerButton
import com.fieldmonitoring.app.ui.components.ErrorText
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
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID

private enum class Pick { Type, Gender, Village, Education, Literacy, PhoneType, Social }

/**
 * Add Farmer (KT-style form): photo at the top, labels above fields, two
 * fields per row where they fit. Works offline - the farmer is saved on the
 * phone, shows in the Farmers list straight away with "Pending sync", and is
 * sent with the next sync. Same required fields as the previous app.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddFarmerScreen(vm: AppViewModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val villages = vm.bundle.villages

    val clientId = rememberSaveable { UUID.randomUUID().toString() }
    var name by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var farmerType by rememberSaveable { mutableStateOf("") }
    var gender by rememberSaveable { mutableStateOf("") }
    var age by rememberSaveable { mutableStateOf("") }
    var birthDate by rememberSaveable { mutableStateOf("") }
    var villageId by rememberSaveable { mutableStateOf(villages.singleOrNull()?.id ?: "") }
    var address by rememberSaveable { mutableStateOf("") }
    var education by rememberSaveable { mutableStateOf("") }
    var literacy by rememberSaveable { mutableStateOf("") }
    var phoneType by rememberSaveable { mutableStateOf("") }
    var social by rememberSaveable { mutableStateOf(listOf<String>()) }
    var email by rememberSaveable { mutableStateOf("") }
    var photo by rememberSaveable { mutableStateOf<String?>(null) }
    var picking by remember { mutableStateOf<Pick?>(null) }
    var datePicker by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Phone number already on file? Say so as soon as it's typed, not on Save.
    val cleanPhone = FarmerRules.cleanPhone(phone)
    val owner = if (cleanPhone.length >= 6) vm.repo.phoneOwner(cleanPhone) else null

    // --- Photo ---
    var cameraTarget by remember { mutableStateOf<Pair<File, Uri>?>(null) }
    fun keep(uri: Uri, cleanup: File?) {
        scope.launch {
            val saved = withContext(Dispatchers.IO) { Photos.keep(context, uri) }
            cleanup?.delete()
            if (saved != null) {
                photo?.let { File(it).delete() }
                photo = saved.path
            } else {
                error = "Couldn't read that photo. Try again."
            }
        }
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        cameraTarget?.let { (file, uri) -> if (ok) keep(uri, file) else file.delete() }
        cameraTarget = null
    }
    val gallery = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> uri?.let { keep(it, null) } }

    Column(
        Modifier
            .fillMaxSize()
            .background(Fs.Background)
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SectionTitle("Add Farmer")

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            val bitmap = remember(photo) { photo?.let { BitmapFactory.decodeFile(it, BitmapFactory.Options().apply { inSampleSize = 4 }) } }
            Box(
                Modifier.size(112.dp).clip(FsShape.Tile).background(Fs.Field).clickable {
                    val target = Photos.newCameraTarget(context)
                    cameraTarget = target
                    camera.launch(target.second)
                },
                contentAlignment = Alignment.BottomCenter,
            ) {
                if (bitmap != null) {
                    Image(bitmap.asImageBitmap(), "Farmer photo", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                } else {
                    Icon(AppIcons.Person, null, tint = Fs.LabelMuted, modifier = Modifier.size(64.dp).align(Alignment.Center))
                }
                Text(
                    if (bitmap == null) "Add photo" else "Edit",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.fillMaxWidth().background(Fs.Primary.copy(alpha = 0.75f)).padding(vertical = 4.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Photo (optional)", style = FsText.Label)
                TonalChip("From gallery") { gallery.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
                if (photo != null) TonalChip("Remove") { photo?.let { File(it).delete() }; photo = null }
            }
        }

        Text("The Farmer ID is given by the server when this farmer is synced.", style = FsText.Label)
        FsTextField("Name", name, { name = it }, required = true)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SelectField("Type", FarmerRules.labelOf(FarmerRules.TYPES, farmerType), { picking = Pick.Type }, Modifier.weight(1f), required = true)
            SelectField("Gender", FarmerRules.labelOf(FarmerRules.GENDERS, gender), { picking = Pick.Gender }, Modifier.weight(1f), required = true)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            FsTextField(
                "Age", age,
                { typed ->
                    age = typed.filter { it.isDigit() }.take(3)
                    if (age.isNotEmpty()) birthDate = FarmerRules.birthDateForAge(age, birthDate)
                },
                Modifier.weight(1f), required = true, keyboardType = KeyboardType.Number,
            )
            SelectField("Birth Date", if (birthDate.isBlank()) "" else Format.date(birthDate), { datePicker = true }, Modifier.weight(1f), required = true)
        }
        FsTextField(
            "Phone Number", phone, { phone = it.filter { c -> c.isDigit() || c == ' ' || c == '-' }.take(20) },
            required = true, keyboardType = KeyboardType.Phone, leading = AppIcons.Phone,
            error = owner?.let { "$it is already registered with this phone number" },
        )
        SelectField(
            "Village",
            villages.firstOrNull { it.id == villageId }?.let { v -> listOfNotNull(v.name, v.districtName).joinToString(", ") }.orEmpty(),
            { picking = Pick.Village },
            required = true,
        )
        if (villages.isEmpty()) Text("No villages downloaded yet. Sync while online first.", color = Fs.Danger, fontSize = 13.sp)
        FsTextField("Address Details", address, { address = it }, singleLine = false, minLines = 2)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SelectField("Educational Lvl", FarmerRules.labelOf(FarmerRules.EDUCATION, education), { picking = Pick.Education }, Modifier.weight(1f), required = true)
            SelectField("Literacy", FarmerRules.labelOf(FarmerRules.LITERACY, literacy), { picking = Pick.Literacy }, Modifier.weight(1f), required = true)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            SelectField("Phone Type", FarmerRules.labelOf(FarmerRules.PHONE_TYPES, phoneType), { picking = Pick.PhoneType }, Modifier.weight(1f), required = true)
            SelectField(
                "Social Media",
                social.joinToString(", ") { FarmerRules.labelOf(FarmerRules.SOCIAL, it) },
                { picking = Pick.Social },
                Modifier.weight(1f),
            )
        }
        FsTextField("Email", email, { email = it.trim() }, keyboardType = KeyboardType.Email)

        error?.let { ErrorText(it) }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CreateButton("Save", {
                error = vm.saveFarmer(
                    FarmerDraft(
                        clientId = clientId,
                        name = name,
                        phone = phone,
                        villageId = villageId,
                        villageName = villages.firstOrNull { it.id == villageId }?.name.orEmpty(),
                        farmerType = farmerType,
                        gender = gender,
                        age = age,
                        birthDate = birthDate,
                        address = address,
                        educationLevel = education,
                        literacy = literacy,
                        phoneType = phoneType,
                        socialMedia = social,
                        email = email,
                        photo = photo,
                        createdAtMillis = System.currentTimeMillis(),
                    ),
                )
            })
            DangerButton("Cancel", {
                photo?.let { File(it).delete() }
                vm.back()
            })
        }
        Text("* Required fields", style = FsText.Label)
        Spacer(Modifier.height(24.dp))
    }

    picking?.let { which ->
        fun choices(list: List<Choice>) = list.map { PickOption(it.id, it.label) }
        val (title, options, selected) = when (which) {
            Pick.Type -> Triple("Type", choices(FarmerRules.TYPES), setOf(farmerType))
            Pick.Gender -> Triple("Gender", choices(FarmerRules.GENDERS), setOf(gender))
            Pick.Education -> Triple("Educational level", choices(FarmerRules.EDUCATION), setOf(education))
            Pick.Literacy -> Triple("Literacy", choices(FarmerRules.LITERACY), setOf(literacy))
            Pick.PhoneType -> Triple("Phone type", choices(FarmerRules.PHONE_TYPES), setOf(phoneType))
            Pick.Social -> Triple("Social media", choices(FarmerRules.SOCIAL), social.toSet())
            Pick.Village -> Triple(
                "Village",
                villages.map { v -> PickOption(v.id, v.name, listOfNotNull(v.blockName, v.districtName, v.stateName).joinToString(", ")) },
                setOf(villageId),
            )
        }
        SearchPicker(
            title = title,
            options = options,
            selected = selected,
            multi = which == Pick.Social,
            onDismiss = { picking = null },
            onDone = { ids ->
                val one = ids.firstOrNull().orEmpty()
                when (which) {
                    Pick.Type -> farmerType = one
                    Pick.Gender -> gender = one
                    Pick.Education -> education = one
                    Pick.Literacy -> literacy = one
                    Pick.PhoneType -> phoneType = one
                    Pick.Village -> villageId = one
                    Pick.Social -> social = FarmerRules.SOCIAL.map { it.id }.filter { it in ids }
                }
                picking = null
            },
        )
    }

    if (datePicker) {
        val initial = runCatching { LocalDate.parse(birthDate) }.getOrNull()
        val state = rememberDatePickerState(
            initialSelectedDateMillis = initial?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { datePicker = false },
            confirmButton = {
                TextButton({
                    state.selectedDateMillis?.let { millis ->
                        val picked = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
                        birthDate = picked.toString()
                        val years = java.time.Period.between(picked, LocalDate.now()).years
                        if (years >= 0) age = years.toString()
                    }
                    datePicker = false
                }) { Text("OK", color = Fs.Primary, fontWeight = FontWeight.Bold) }
            },
            dismissButton = { TextButton({ datePicker = false }) { Text("Cancel", color = Fs.Primary) } },
        ) { DatePicker(state) }
    }
}
