package com.fieldmonitoring.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.ui.theme.Fs

/**
 * The FieldSight mark: an eye whose outline is two leaves (dark green and
 * leaf green) with an orange pupil - "seeing the field". Same drawing as the
 * launcher icon (res/drawable/ic_launcher_foreground.xml), on a light ground.
 */
@Composable
fun FieldSightMark(size: Dp = 40.dp, onDark: Boolean = false) {
    Canvas(Modifier.size(size)) {
        val s = this.size.width / 60f // drawn on a 60 x 60 grid
        fun p(x: Float, y: Float) = Offset(x * s, y * s)
        val upper = Path().apply {
            moveTo(p(4f, 31f).x, p(4f, 31f).y)
            cubicTo(p(14f, 11f).x, p(14f, 11f).y, p(48f, 7f).x, p(48f, 7f).y, p(58f, 25f).x, p(58f, 25f).y)
            cubicTo(p(44f, 21f).x, p(44f, 21f).y, p(20f, 21f).x, p(20f, 21f).y, p(4f, 31f).x, p(4f, 31f).y)
            close()
        }
        val lower = Path().apply {
            moveTo(p(56f, 29f).x, p(56f, 29f).y)
            cubicTo(p(46f, 49f).x, p(46f, 49f).y, p(12f, 53f).x, p(12f, 53f).y, p(2f, 35f).x, p(2f, 35f).y)
            cubicTo(p(16f, 39f).x, p(16f, 39f).y, p(40f, 39f).x, p(40f, 39f).y, p(56f, 29f).x, p(56f, 29f).y)
            close()
        }
        drawPath(upper, if (onDark) Color.White else Fs.Primary)
        drawPath(lower, Fs.Leaf)
        drawCircle(if (onDark) Fs.Primary else Color.White, radius = 11f * s, center = p(30f, 30f))
        drawCircle(Fs.Primary, radius = 11f * s, center = p(30f, 30f), style = androidx.compose.ui.graphics.drawscope.Stroke(2.5f * s))
        drawCircle(Fs.Accent, radius = 6f * s, center = p(30f, 30f))
    }
}

/** Mark + "FieldSight" wordmark ("Field" in dark green, "Sight" in leaf green). */
@Composable
fun FieldSightLogo(markSize: Dp = 34.dp, textSize: TextUnit = 22.sp) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FieldSightMark(markSize)
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(color = Fs.Primary, fontWeight = FontWeight.Bold)) { append("Field") }
                withStyle(SpanStyle(color = Fs.Leaf, fontWeight = FontWeight.Bold)) { append("Sight") }
            },
            fontSize = textSize,
        )
    }
}
