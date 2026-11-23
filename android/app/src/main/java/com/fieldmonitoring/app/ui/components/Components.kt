package com.fieldmonitoring.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsShape
import com.fieldmonitoring.app.ui.theme.FsText

// ---------- App chrome ----------

/**
 * White top bar: back (or menu) on the left, logo in the middle, sync status
 * and bell on the right (skill section 2). The sync icon shows a checkmark
 * when nothing is waiting, or the number of unsent records.
 */
@Composable
fun TopBar(
    onBack: (() -> Unit)?,
    onMenu: (() -> Unit)? = null,
    pending: Int,
    attention: Int,
    syncing: Boolean,
    onSync: () -> Unit,
) {
    Surface(color = Fs.Surface, shadowElevation = 2.dp) {
        Box(
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .height(60.dp)
                .padding(horizontal = 4.dp),
        ) {
            when {
                onBack != null -> IconButton(onBack, Modifier.align(Alignment.CenterStart)) {
                    Icon(AppIcons.Back, "Back", tint = Fs.OnSurface)
                }
                onMenu != null -> IconButton(onMenu, Modifier.align(Alignment.CenterStart)) {
                    Icon(AppIcons.Menu, "Menu", tint = Fs.OnSurface)
                }
            }
            Box(Modifier.align(Alignment.Center)) { FieldSightLogo(markSize = 30.dp, textSize = 20.sp) }
            Row(Modifier.align(Alignment.CenterEnd).padding(end = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                SyncButton(pending, attention, syncing, onSync)
            }
        }
    }
}

@Composable
fun SyncButton(pending: Int, attention: Int, syncing: Boolean, onSync: () -> Unit) {
    val waiting = pending + attention
    IconButton(onSync, enabled = !syncing) {
        Box {
            if (syncing) {
                CircularProgressIndicator(Modifier.size(22.dp), color = Fs.Primary, strokeWidth = 2.5.dp)
            } else {
                Icon(AppIcons.Sync, "Sync now", tint = Fs.Primary)
            }
            val badgeColor = if (attention > 0) Fs.Danger else if (waiting > 0) Fs.Accent else Fs.Leaf
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 6.dp, y = (-6).dp)
                    .heightIn(min = 18.dp)
                    .widthIn(min = 18.dp)
                    .clip(CircleShape)
                    .background(badgeColor),
                contentAlignment = Alignment.Center,
            ) {
                if (waiting > 0) {
                    Text(
                        if (waiting > 99) "99+" else waiting.toString(),
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 4.dp),
                    )
                } else {
                    Icon(AppIcons.Check, "All synced", tint = Color.White, modifier = Modifier.size(13.dp))
                }
            }
        }
    }
}

// ---------- Buttons (one hierarchy everywhere, skill section 3) ----------

private val ButtonPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp)

@Composable
private fun FsButton(
    text: String,
    container: Color,
    content: Color,
    onClick: () -> Unit,
    modifier: Modifier,
    enabled: Boolean,
    icon: ImageVector?,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = 48.dp).widthIn(min = 120.dp),
        shape = FsShape.Control,
        contentPadding = ButtonPadding,
        colors = ButtonDefaults.buttonColors(
            containerColor = container,
            contentColor = content,
            disabledContainerColor = container.copy(alpha = 0.4f),
            disabledContentColor = content.copy(alpha = 0.7f),
        ),
    ) {
        if (icon != null) {
            Icon(icon, null, Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(text, style = androidx.compose.material3.MaterialTheme.typography.labelLarge)
    }
}

/** Filled dark green: Edit, confirm in dialogs, Log In. */
@Composable
fun PrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null) =
    FsButton(text, Fs.Primary, Color.White, onClick, modifier, enabled, icon)

/** Filled leaf green: Create, Add, Save. */
@Composable
fun CreateButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null) =
    FsButton(text, Fs.Leaf, Color.White, onClick, modifier, enabled, icon)

/** Tonal: secondary actions (Show more, Retry, Cancel in dialogs). */
@Composable
fun TonalButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, icon: ImageVector? = null) =
    FsButton(text, Fs.PrimaryContainer, Fs.Primary, onClick, modifier, enabled, icon)

/** Filled red: Cancel on forms, the final confirm of a destructive action. */
@Composable
fun DangerButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) =
    FsButton(text, Fs.Danger, Color.White, onClick, modifier, enabled, null)

/** Small destructive chip (Deactivate, Discard). */
@Composable
fun DangerChip(text: String, onClick: () -> Unit) = Chip(text, Fs.DangerContainer, Fs.Danger, onClick)

@Composable
fun TonalChip(text: String, onClick: () -> Unit) = Chip(text, Fs.PrimaryContainer, Fs.Primary, onClick)

@Composable
private fun Chip(text: String, container: Color, content: Color, onClick: () -> Unit) {
    Box(
        Modifier
            .heightIn(min = 40.dp)
            .clip(FsShape.Control)
            .background(container)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = content, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}

// ---------- Status pills ----------

enum class PillKind { Ongoing, Completed, Terminated, Pending, Attention, Neutral }

@Composable
fun StatusPill(text: String, kind: PillKind) {
    val (bg, fg) = when (kind) {
        PillKind.Ongoing -> Fs.Accent to Color.White
        PillKind.Completed -> Fs.Primary to Color.White
        PillKind.Terminated -> Fs.DangerContainer to Fs.Danger
        PillKind.Pending -> Fs.Field to Fs.LabelMuted
        PillKind.Attention -> Fs.DangerContainer to Fs.Danger
        PillKind.Neutral -> Fs.PrimaryContainer to Fs.Primary
    }
    Text(
        text,
        color = fg,
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .clip(FsShape.Pill)
            .background(bg)
            .padding(horizontal = 12.dp, vertical = 5.dp),
    )
}

fun plotStatusPill(status: String): Pair<String, PillKind> = when (status) {
    "completed" -> "Completed" to PillKind.Completed
    "terminated" -> "Terminated" to PillKind.Terminated
    else -> "Ongoing" to PillKind.Ongoing
}

// ---------- Cards and detail grids ----------

@Composable
fun FsCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val colors = CardDefaults.cardColors(containerColor = Fs.Surface)
    val elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    if (onClick != null) {
        Card(onClick = onClick, modifier = modifier.fillMaxWidth(), shape = FsShape.Tile, colors = colors, elevation = elevation) {
            Column(Modifier.padding(16.dp), content = content)
        }
    } else {
        Card(modifier = modifier.fillMaxWidth(), shape = FsShape.Card, colors = colors, elevation = elevation) {
            Column(Modifier.padding(16.dp), content = content)
        }
    }
}

/** Read-only grid: muted label over bold value, [columns] per row. */
@Composable
fun DetailGrid(items: List<Pair<String, String>>, columns: Int = 3) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items.chunked(columns).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (label, value) ->
                    Column(Modifier.weight(1f)) {
                        Text(label, style = FsText.Label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(value.ifBlank { "-" }, style = FsText.Value)
                    }
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
fun SectionTitle(text: String, color: Color = Fs.Primary, modifier: Modifier = Modifier) {
    Text(text, color = color, fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = modifier)
}

@Composable
fun EmptyState(message: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(
        modifier.fillMaxWidth().padding(vertical = 32.dp, horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(message, color = Fs.LabelMuted, textAlign = TextAlign.Center, fontSize = 15.sp)
        action?.invoke()
    }
}

/** Snackbar-like line for an error inside a form. */
@Composable
fun ErrorText(text: String) {
    Text(text, color = Fs.Danger, fontSize = 14.sp, fontWeight = FontWeight.Medium)
}

// ---------- Form fields (labels above, filled, no border) ----------

@Composable
fun FormLabel(text: String, required: Boolean = false) {
    Text(if (required) "$text*" else text, style = FsText.FormLabel, modifier = Modifier.padding(bottom = 6.dp))
}

@Composable
fun FsTextField(
    label: String?,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    required: Boolean = false,
    placeholder: String = "",
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboardType: KeyboardType = KeyboardType.Text,
    password: Boolean = false,
    leading: ImageVector? = null,
    error: String? = null,
) {
    Column(modifier) {
        if (label != null) FormLabel(label, required)
        TextField(
            value = value,
            onValueChange = onChange,
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            singleLine = singleLine,
            minLines = minLines,
            placeholder = { Text(placeholder, style = FsText.Placeholder) },
            leadingIcon = leading?.let { { Icon(it, null, tint = Fs.LabelMuted) } },
            shape = FsShape.Control,
            visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboardType),
            isError = error != null,
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Fs.Field,
                unfocusedContainerColor = Fs.Field,
                errorContainerColor = Fs.Field,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                errorIndicatorColor = Color.Transparent,
                cursorColor = Fs.Primary,
            ),
        )
        if (error != null) {
            Spacer(Modifier.height(4.dp))
            ErrorText(error)
        }
    }
}

/** A dropdown-looking field that opens the searchable picker. */
@Composable
fun SelectField(label: String?, display: String, onClick: () -> Unit, modifier: Modifier = Modifier, required: Boolean = false) {
    Column(modifier) {
        if (label != null) FormLabel(label, required)
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(FsShape.Control)
                .background(Fs.Field)
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (display.isBlank()) {
                Text("Select option...", style = FsText.Placeholder, modifier = Modifier.weight(1f))
            } else {
                Text(display, color = Fs.OnSurface, fontSize = 15.sp, modifier = Modifier.weight(1f))
            }
            Icon(AppIcons.DropDown, null, tint = Fs.Primary)
        }
    }
}

// ---------- Tabs with a dot under the active one ----------

@Composable
fun DotTabs(tabs: List<String>, selected: Int, onSelect: (Int) -> Unit, activeColor: Color = Fs.Leaf) {
    Column(Modifier.fillMaxWidth().background(Fs.Surface)) {
        Row(Modifier.fillMaxWidth()) {
            tabs.forEachIndexed { index, title ->
                val active = index == selected
                Column(
                    Modifier
                        .weight(1f)
                        .clickable { onSelect(index) }
                        .padding(top = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        title,
                        color = if (active) activeColor else Fs.LabelMuted,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(6.dp))
                    Box(
                        Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(if (active) activeColor else Color.Transparent),
                    )
                }
            }
        }
        HorizontalDivider(color = Fs.Divider, modifier = Modifier.offset(y = (-5).dp))
    }
}

/** Two-way toggle (selected half filled orange). */
@Composable
fun Segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        options.forEachIndexed { i, text ->
            val active = i == selected
            Box(
                Modifier
                    .weight(1f)
                    .height(44.dp)
                    .clip(FsShape.Control)
                    .background(if (active) Fs.Accent else Fs.PrimaryContainer)
                    .clickable { onSelect(i) },
                contentAlignment = Alignment.Center,
            ) {
                Text(text, color = if (active) Color.White else Fs.Primary, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun ThinDivider() = HorizontalDivider(color = Fs.Divider)

@Composable
fun OutlinedBox(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(modifier, shape = FsShape.Control, border = BorderStroke(1.dp, Fs.Divider), color = Fs.Surface) { content() }
}
