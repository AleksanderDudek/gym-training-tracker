package io.github.aleksanderdudek.gymtracker.zdrowie

import android.os.Bundle
import android.text.Html
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge

/**
 * Polityka prywatności. Otwiera ją Health Connect (link w oknie zgody i w ustawieniach uprawnień)
 * oraz przycisk na ekranie głównym. Bez niej Health Connect w ogóle nie pokaże okna zgody.
 */
class RationaleActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_rationale)
        findViewById<TextView>(R.id.policy).text =
            Html.fromHtml(getString(R.string.policy), Html.FROM_HTML_MODE_COMPACT)
    }
}
