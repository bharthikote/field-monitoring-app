package com.fieldmonitoring.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fieldmonitoring.app.ui.AppViewModel
import com.fieldmonitoring.app.ui.components.ErrorText
import com.fieldmonitoring.app.ui.components.FieldSightMark
import com.fieldmonitoring.app.ui.components.FieldSightLogo
import com.fieldmonitoring.app.ui.components.FsCard
import com.fieldmonitoring.app.ui.components.FsTextField
import com.fieldmonitoring.app.ui.components.PrimaryButton
import com.fieldmonitoring.app.ui.theme.Fs
import com.fieldmonitoring.app.ui.theme.FsText

/** Login is the only step that needs internet (PRD section 10). */
@Composable
fun LoginScreen(vm: AppViewModel) {
    var identifier by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    Column(
        Modifier
            .fillMaxSize()
            .background(Fs.Background)
            .statusBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        FieldSightMark(size = 88.dp)
        Spacer(Modifier.height(12.dp))
        FieldSightLogo(markSize = 0.dp, textSize = 30.sp)
        Text("Field monitoring that works offline", style = FsText.Label, textAlign = TextAlign.Center)
        Spacer(Modifier.height(28.dp))

        FsCard {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Log in", style = androidx.compose.material3.MaterialTheme.typography.headlineSmall)
                FsTextField("Mobile number or email", identifier, { identifier = it }, required = true)
                FsTextField("Password", password, { password = it }, required = true, password = true)
                vm.loginError?.let { ErrorText(it) }
                PrimaryButton(
                    if (vm.loginBusy) "Logging in..." else "Log In",
                    { vm.login(identifier, password) },
                    Modifier.fillMaxWidth(),
                    enabled = !vm.loginBusy,
                )
                Text(
                    "Forgot your password? Ask a Super Admin to reset it.",
                    style = FsText.Label,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        Text(
            "After the first login, FieldSight works without internet and sends your work when you are back online.",
            style = FsText.Label,
            textAlign = TextAlign.Center,
        )
    }
}
