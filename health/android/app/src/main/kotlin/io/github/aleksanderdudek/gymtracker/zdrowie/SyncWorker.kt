package io.github.aleksanderdudek.gymtracker.zdrowie

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Wysyłka w tle co godzinę — wzorzec z dokumentacji Health Connect. Działa tylko, gdy Health
 * Connect na tym telefonie umie czytać w tle i człowiek się na to zgodził; inaczej odczyt
 * skończyłby się wyjątkiem i aplikacja wysyła przy otwarciu i przyciskiem.
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // Nieudana próba czeka na następną godzinę: dane i tak się nie zestarzeją, a powtórki
        // co kilka minut tylko zużywałyby baterię.
        Sync.run(applicationContext, force = false, background = true)
        return Result.success()
    }

    companion object {
        private const val NAME = "wysylka-co-godzine"

        /** KEEP: kolejne otwarcie aplikacji nie przesuwa zaplanowanej wysyłki. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(1, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, request)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(NAME)
        }
    }
}
