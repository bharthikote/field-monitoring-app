package com.fieldmonitoring.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsShape
import com.fieldmonitoring.app.ui.theme.FsText

data class PickOption(val id: String, val label: String, val note: String? = null)

/**
 * Searchable picker (skill: "Searchable picker"): a search box with a close
 * button, then the options separated by thin lines. [multi] shows a check per
 * row and a Done button. Works from the downloaded lists, so it works offline.
 */
@Composable
fun SearchPicker(
    title: String,
    options: List<PickOption>,
    selected: Set<String>,
    multi: Boolean,
    onDismiss: () -> Unit,
    onDone: (Set<String>) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var chosen by remember { mutableStateOf(selected) }
    val shown = options.filter { query.isBlank() || it.label.contains(query.trim(), ignoreCase = true) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = FsShape.Dialog, color = Fs.Surface, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp)) {
                Text(title, color = Fs.Primary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp)) {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = { Text("Search...", style = FsText.Placeholder) },
                        singleLine = true,
                        shape = FsShape.Control,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Fs.Primary,
                            unfocusedBorderColor = Fs.Primary,
                            cursorColor = Fs.Primary,
                        ),
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onDismiss) { Icon(AppIcons.Close, "Close", tint = Fs.OnSurface) }
                }
                LazyColumn(Modifier.heightIn(max = 380.dp).padding(top = 8.dp)) {
                    items(shown, key = { it.id }) { option ->
                        val isOn = option.id in chosen
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (multi) {
                                        chosen = if (isOn) chosen - option.id else chosen + option.id
                                    } else {
                                        onDone(setOf(option.id))
                                    }
                                }
                                .padding(vertical = 12.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    option.label,
                                    color = Fs.Primary,
                                    fontSize = 16.sp,
                                    fontWeight = if (isOn) FontWeight.Bold else FontWeight.Normal,
                                    modifier = Modifier.weight(1f),
                                )
                                if (isOn) Icon(AppIcons.Check, "Selected", tint = Fs.Leaf, modifier = Modifier.size(22.dp))
                            }
                            option.note?.let { Text(it, color = Fs.Accent, fontSize = 13.sp) }
                        }
                        ThinDivider()
                    }
                    if (shown.isEmpty()) {
                        item { Text("Nothing matches", style = FsText.Label, modifier = Modifier.padding(vertical = 16.dp)) }
                    }
                }
                if (multi) {
                    Row(
                        Modifier.fillMaxWidth().padding(top = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End),
                    ) {
                        TonalButton("Cancel", onDismiss)
                        PrimaryButton("Done (${chosen.size})", { onDone(chosen) })
                    }
                }
            }
        }
    }
}

/**
 * Confirmation dialog: green header band, one plain sentence, the safe choice
 * (Cancel) tonal on the left, the action on the right named for what it does
 * (skill: "Confirmation dialog" - fixes the KT app's "Process" button).
 */
@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmText: String,
    destructive: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = FsShape.Dialog, color = Fs.Surface, modifier = Modifier.fillMaxWidth()) {
            Column {
                Box(
                    Modifier.fillMaxWidth().background(Fs.Primary).padding(vertical = 18.dp, horizontal = 20.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Text(message, color = Fs.OnSurface, fontSize = 16.sp, modifier = Modifier.padding(20.dp))
                Row(
                    Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    TonalButton("Cancel", onDismiss, Modifier.weight(1f))
                    if (destructive) {
                        DangerButton(confirmText, onConfirm, Modifier.weight(1f))
                    } else {
                        PrimaryButton(confirmText, onConfirm, Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
