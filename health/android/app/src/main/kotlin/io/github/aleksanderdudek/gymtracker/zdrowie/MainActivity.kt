package io.github.aleksanderdudek.gymtracker.zdrowie

import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ClipboardManager
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.annotation.StringRes
import androidx.core.net.toUri
import androidx.core.view.isVisible
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Jedyny ekran: klucz, dostęp do Health Connect, wysyłka i prywatność. Przy każdym powrocie na ekran
 * stan czyta się od nowa — zgodę można cofnąć w ustawieniach systemu, a klucz wkleić w każdej chwili.
 */
class MainActivity : ComponentActivity() {

    private enum class Send { NO, IF_DUE, NOW }

    private lateinit var keys: Keys
    private lateinit var keyStatus: TextView
    private lateinit var keyMessage: TextView
    private lateinit var hcStatus: TextView
    private lateinit var hcInstall: Button
    private lateinit var hcAllow: Button
    private lateinit var hcSettings: Button
    private lateinit var bgStatus: TextView
    private lateinit var sendStatus: TextView
    private lateinit var sendNow: Button
    private lateinit var disconnect: Button

    /** Klucz, Health Connect i choć jedna zgoda — jest co wysłać. */
    private var ready = false
    private var backgroundAvailable = false
    private var syncing = false
    private var syncingByHand = false

    /** Przycisk wciśnięty w trakcie wysyłki automatycznej — po niej pójdzie jeszcze raz, bez przerwy. */
    private var again = false

    private val askAccess = registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
        refresh(if (granted.any { it in HealthReader.READ }) Send.NOW else Send.NO)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        keys = Keys(this)
        keyStatus = findViewById(R.id.keyStatus)
        keyMessage = findViewById(R.id.keyMessage)
        hcStatus = findViewById(R.id.hcStatus)
        hcInstall = findViewById(R.id.hcInstall)
        hcAllow = findViewById(R.id.hcAllow)
        hcSettings = findViewById(R.id.hcSettings)
        bgStatus = findViewById(R.id.bgStatus)
        sendStatus = findViewById(R.id.sendStatus)
        sendNow = findViewById(R.id.sendNow)
        disconnect = findViewById(R.id.disconnect)

        findViewById<Button>(R.id.keyPaste).setOnClickListener { pasteKey() }
        hcInstall.setOnClickListener { openStore() }
        hcAllow.setOnClickListener {
            // O czytanie w tle pytamy tylko, gdy Health Connect na tym telefonie to umie.
            askAccess.launch(if (backgroundAvailable) HealthReader.READ + HealthReader.BACKGROUND else HealthReader.READ)
        }
        hcSettings.setOnClickListener { open(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)) }
        sendNow.setOnClickListener { send(force = true) }
        disconnect.setOnClickListener { confirmDisconnect() }
        findViewById<Button>(R.id.privacyMore).setOnClickListener { open(Intent(this, RationaleActivity::class.java)) }
    }

    override fun onResume() {
        super.onResume()
        refresh(Send.IF_DUE)
    }

    private fun refresh(send: Send) {
        lifecycleScope.launch {
            val key = keys.hex
            keyStatus.text = if (key == null) getString(R.string.key_missing) else getString(R.string.key_set, key.take(8))
            disconnect.isVisible = key != null

            val status = HealthReader.status(this@MainActivity)
            var granted = emptySet<String>()
            var failed = false
            backgroundAvailable = false
            if (status == HealthReader.Status.AVAILABLE) {
                try {
                    val reader = HealthReader(applicationContext)
                    granted = reader.granted()
                    backgroundAvailable = reader.backgroundAvailable()
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    failed = true
                }
            }
            val read = granted intersect HealthReader.READ
            val background = backgroundAvailable && HealthReader.BACKGROUND in granted

            hcStatus.text = when {
                status == HealthReader.Status.NEEDS_INSTALL -> getString(R.string.hc_needs_install)
                status == HealthReader.Status.UNSUPPORTED -> getString(R.string.hc_unsupported)
                failed -> getString(R.string.hc_error)
                read.isEmpty() -> getString(R.string.hc_access_none)
                read.size == HealthReader.READ.size -> getString(R.string.hc_access_all)
                else -> getString(R.string.hc_access_some, read.size, HealthReader.READ.size)
            }
            hcInstall.isVisible = status == HealthReader.Status.NEEDS_INSTALL
            hcAllow.isVisible = status == HealthReader.Status.AVAILABLE && !failed &&
                (read.size < HealthReader.READ.size || (backgroundAvailable && !background))
            hcSettings.isVisible = status == HealthReader.Status.AVAILABLE
            bgStatus.isVisible = status == HealthReader.Status.AVAILABLE && !failed && read.isNotEmpty()
            bgStatus.setText(
                when {
                    background -> R.string.bg_on
                    backgroundAvailable -> R.string.bg_denied
                    else -> R.string.bg_unavailable
                },
            )

            ready = key != null && status == HealthReader.Status.AVAILABLE && read.isNotEmpty()
            // Praca w tle tylko z kluczem i zgodą na czytanie w tle; bez nich i tak by się nie udała.
            // Przy chwilowym błędzie Health Connect zostawiamy, jak było.
            if (!failed) {
                if (ready && background) SyncWorker.schedule(this@MainActivity) else SyncWorker.cancel(this@MainActivity)
            }
            renderSend()
            if (ready && send != Send.NO) send(force = send == Send.NOW)
        }
    }

    private fun send(force: Boolean) {
        if (syncing) {
            if (force) again = true
            return
        }
        syncing = true
        syncingByHand = force
        renderSend()
        lifecycleScope.launch {
            try {
                Sync.start(this@MainActivity, force).await()
            } finally {
                syncing = false
                renderSend()
                if (again) {
                    again = false
                    send(force = true)
                }
            }
        }
    }

    private fun renderSend() {
        sendNow.isEnabled = ready && !syncing
        val last = Sync.last(this)
        sendStatus.text = when {
            syncing && syncingByHand -> getString(R.string.sending)
            last == null -> getString(if (ready) R.string.send_never else R.string.send_needs)
            else -> describe(last)
        }
    }

    /** „dziś 14:05 — wysłane: 14 dni”, pod spodem ostatnia udana wysyłka i rodzaje danych. */
    private fun describe(last: Sync.Last): String {
        val what = when (last.outcome) {
            Sync.Outcome.SENT -> resources.getQuantityString(R.plurals.result_sent, last.days, last.days)
            Sync.Outcome.TOO_OFTEN -> getString(R.string.result_too_often)
            Sync.Outcome.OFFLINE -> getString(R.string.result_offline)
            Sync.Outcome.REJECTED -> getString(R.string.result_rejected)
            Sync.Outcome.NOTHING -> getString(R.string.result_nothing)
            else -> getString(R.string.result_failed)
        }
        val lines = mutableListOf(getString(R.string.result_line, whenText(last.at), what))
        if (last.outcome != Sync.Outcome.SENT && last.sentAt > 0) {
            lines += getString(R.string.result_previous, whenText(last.sentAt))
        }
        if (last.sentAt > 0 && last.kinds.isNotEmpty()) {
            lines += getString(R.string.result_kinds, Kind.entries.filter { it in last.kinds }.joinToString(", ") { getString(nameOf(it)) })
        }
        return lines.joinToString("\n")
    }

    private fun whenText(ms: Long): String {
        val zone = ZoneId.systemDefault()
        val t = Instant.ofEpochMilli(ms).atZone(zone)
        val today = LocalDate.now(zone)
        val time = t.format(DateTimeFormatter.ofPattern("HH:mm"))
        return when (t.toLocalDate()) {
            today -> getString(R.string.when_today, time)
            today.minusDays(1) -> getString(R.string.when_yesterday, time)
            else -> t.format(DateTimeFormatter.ofPattern("d.MM. HH:mm"))
        }
    }

    @StringRes
    private fun nameOf(kind: Kind): Int = when (kind) {
        Kind.STEPS -> R.string.kind_steps
        Kind.DISTANCE -> R.string.kind_distance
        Kind.FLOORS -> R.string.kind_floors
        Kind.RESTING_HR -> R.string.kind_resting_hr
        Kind.HEART_RATE -> R.string.kind_heart_rate
        Kind.SLEEP -> R.string.kind_sleep
        Kind.WEIGHT -> R.string.kind_weight
        Kind.RIDES -> R.string.kind_rides
    }

    /** Klucz tylko ze schowka i tylko na stuknięcie — Android i tak nie da go czytać w tle. */
    private fun pasteKey() {
        val clipboard = getSystemService(ClipboardManager::class.java)
        val text = clipboard?.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(this)?.toString().orEmpty()
        when {
            text.isBlank() -> showKeyMessage(R.string.key_clipboard_empty, error = true)
            !keys.save(text) -> showKeyMessage(R.string.key_invalid, error = true)
            else -> {
                // Klucz do danych o zdrowiu nie powinien czekać w schowku na przypadkowe wklejenie.
                clipboard?.clearPrimaryClip()
                showKeyMessage(R.string.key_saved, error = false)
                refresh(Send.NOW)
            }
        }
    }

    private fun showKeyMessage(@StringRes text: Int, error: Boolean) {
        keyMessage.setText(text)
        keyMessage.setTextColor(getColor(if (error) R.color.error else R.color.text))
        keyMessage.isVisible = true
    }

    /** Sklep Play z ekranem wprowadzenia Health Connect — tak każe dokumentacja Health Connect. */
    private fun openStore() {
        val market = Intent(Intent.ACTION_VIEW, "market://details?id=${HealthReader.PROVIDER}&url=healthconnect%3A%2F%2Fonboarding".toUri())
            .setPackage("com.android.vending")
            .putExtra("overlay", true)
            .putExtra("callerId", packageName)
        try {
            startActivity(market)
        } catch (_: ActivityNotFoundException) {
            // Telefon bez Sklepu Play: strona sklepu w przeglądarce.
            open(Intent(Intent.ACTION_VIEW, "https://play.google.com/store/apps/details?id=${HealthReader.PROVIDER}".toUri()))
        }
    }

    private fun open(intent: Intent) {
        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.hc_unsupported, Toast.LENGTH_SHORT).show()
        }
    }

    private fun confirmDisconnect() {
        AlertDialog.Builder(this)
            .setTitle(R.string.disconnect_title)
            .setMessage(R.string.disconnect_message)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.disconnect) { _, _ ->
                lifecycleScope.launch {
                    val forgotten = Sync.startDisconnect(this@MainActivity).await()
                    keyMessage.isVisible = false
                    Toast.makeText(
                        this@MainActivity,
                        if (forgotten) R.string.disconnected else R.string.disconnected_offline,
                        Toast.LENGTH_LONG,
                    ).show()
                    refresh(Send.NO)
                }
            }
            .show()
    }
}
