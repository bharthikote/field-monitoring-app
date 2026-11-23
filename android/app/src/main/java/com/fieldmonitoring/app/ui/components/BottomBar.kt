package com.fieldmonitoring.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsShape

data class BottomTab(val label: String, val icon: ImageVector, val badge: Int = 0)

/**
 * Bottom navigation (Home, Issues, Farmers, Messages, Profile), as in the
 * previous app. Active tab: dark green icon and label on a light green pill;
 * inactive: muted. A red count shows on a tab's icon when something waits.
 */
@Composable
fun BottomBar(tabs: List<BottomTab>, selected: Int, onSelect: (Int) -> Unit) {
    Surface(color = Fs.Surface, shadowElevation = 8.dp) {
        Row(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .heightIn(min = 64.dp)
                .padding(horizontal = 4.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            tabs.forEachIndexed { index, tab ->
                val active = index == selected
                val color = if (active) Fs.Primary else Fs.LabelMuted
                Column(
                    Modifier
                        .weight(1f)
                        .clip(FsShape.Tile)
                        .clickable { onSelect(index) }
                        .padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier
                            .clip(FsShape.Pill)
                            .background(if (active) Fs.PrimaryContainer else Color.Transparent)
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                    ) {
                        Icon(tab.icon, tab.label, tint = color, modifier = Modifier.size(24.dp))
                        if (tab.badge > 0) {
                            Box(
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = 10.dp, y = (-4).dp)
                                    .heightIn(min = 18.dp)
                                    .widthIn(min = 18.dp)
                                    .clip(CircleShape)
                                    .background(Fs.Danger),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    if (tab.badge > 99) "99+" else tab.badge.toString(),
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 4.dp),
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(2.dp).width(1.dp))
                    Text(
                        tab.label,
                        color = color,
                        fontSize = 12.sp,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}
