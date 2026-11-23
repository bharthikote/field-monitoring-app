package com.fieldmonitoring.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Colour tokens from the field-app-ui skill (.claude/skills/field-app-ui). */
object Fs {
    val Primary = Color(0xFF00664A)
    val PrimaryContainer = Color(0xFFE3EFE8)
    val Leaf = Color(0xFF5BAF2E)
    val LeafContainer = Color(0xFFEAF5E3)
    val Accent = Color(0xFFF47A2A)
    val AccentContainer = Color(0xFFFDF0E4)
    val Danger = Color(0xFFC23A1E)
    val DangerContainer = Color(0xFFFBE3E5)
    val Background = Color(0xFFE8EEEA)
    val Surface = Color.White
    val Field = Color(0xFFEEF4F0)
    // Darkened from the KT app's #9DB5A8 so labels and inactive tabs reach
    // 4.5:1 contrast on white (skill, section 5).
    val LabelMuted = Color(0xFF5F7A6C)
    val OnSurface = Color(0xFF1F2A24)
    val Divider = Color(0xFFD5DDD8)
}

object FsShape {
    val Card = RoundedCornerShape(20.dp)
    val Control = RoundedCornerShape(10.dp)
    val Pill = RoundedCornerShape(50)
    val Dialog = RoundedCornerShape(24.dp)
    val Tile = RoundedCornerShape(16.dp)
}

private val colors = lightColorScheme(
    primary = Fs.Primary,
    onPrimary = Color.White,
    primaryContainer = Fs.PrimaryContainer,
    onPrimaryContainer = Fs.Primary,
    secondary = Fs.Leaf,
    onSecondary = Color.White,
    secondaryContainer = Fs.LeafContainer,
    tertiary = Fs.Accent,
    onTertiary = Color.White,
    tertiaryContainer = Fs.AccentContainer,
    error = Fs.Danger,
    errorContainer = Fs.DangerContainer,
    background = Fs.Background,
    onBackground = Fs.OnSurface,
    surface = Fs.Surface,
    onSurface = Fs.OnSurface,
    surfaceVariant = Fs.Field,
    onSurfaceVariant = Fs.LabelMuted,
    outline = Fs.Divider,
    outlineVariant = Fs.Divider,
)

// System sans-serif for now (the skill's Ubuntu font can be bundled later;
// it adds ~1 MB). Sizes and weights follow the skill.
private val typography = Typography(
    headlineSmall = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Fs.Primary),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Bold),
    bodyLarge = TextStyle(fontSize = 16.sp),
    bodyMedium = TextStyle(fontSize = 15.sp),
    bodySmall = TextStyle(fontSize = 13.sp),
    labelLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold),
    labelMedium = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Medium),
)

object FsText {
    val Label = TextStyle(fontSize = 14.sp, color = Fs.LabelMuted)
    val Value = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Fs.OnSurface)
    val FormLabel = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Medium, color = Fs.Leaf)
    val Placeholder = TextStyle(fontSize = 14.sp, fontStyle = FontStyle.Italic, color = Fs.LabelMuted)
}

@Composable
fun FieldSightTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = colors,
        typography = typography,
        shapes = Shapes(small = FsShape.Control, medium = FsShape.Control, large = FsShape.Card),
        content = content,
    )
}
