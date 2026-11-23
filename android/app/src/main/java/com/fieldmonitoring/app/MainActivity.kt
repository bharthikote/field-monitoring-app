package com.fieldmonitoring.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.fieldmonitoring.app.ui.FieldSightRoot
import com.fieldmonitoring.app.ui.theme.FieldSightTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FieldSightTheme {
                FieldSightRoot()
            }
        }
    }
}
