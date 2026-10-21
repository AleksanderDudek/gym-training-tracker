import HealthKit
import SwiftUI
#if os(iOS)
import BackgroundTasks
import UIKit
#endif

// Wejście aplikacji. Wysyłka bez otwierania aplikacji ma dwie drogi, obie zakładane przy każdym
// uruchomieniu — także tym w tle, bo iOS budzi aplikację właśnie przez nie:
//
// - obserwatory HealthKit z dostarczaniem w tle: nowe kroki budzą aplikację najwyżej co godzinę
//   (częściej iOS kroków nie dostarcza), trening, sen i waga od razu;
// - zadanie odświeżania w tle — zapas, gdy przez dłuższy czas nic nowego nie przyszło.

@main
struct GymTrackerZdrowieApp: App {
    #if os(iOS)
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    #endif
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .onChange(of: phase) { _, now in
            if now == .background { Background.scheduleRefresh() }
        }
    }
}

#if os(iOS)
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Rejestracja zadania musi się zmieścić przed końcem tej metody — później iOS jej nie przyjmie.
        Background.registerRefresh()
        Background.startObservers()
        Background.scheduleRefresh()
        return true
    }
}
#endif

@MainActor
enum Background {
    nonisolated static let refreshID = "io.github.aleksanderdudek.gymtracker.zdrowie.sync"

    private static var queries: [HKObserverQuery] = []

    private static let watched: [(HKSampleType, HKUpdateFrequency)] = [
        (HKQuantityType(.stepCount), .hourly),
        (HKObjectType.workoutType(), .immediate),
        (HKCategoryType(.sleepAnalysis), .immediate),
        (HKQuantityType(.bodyMass), .immediate),
    ]

    /// Przy starcie i po udzieleniu zgód — obserwator założony przed zgodą mógł skończyć się błędem.
    static func startObservers() {
        guard HealthReader.available else { return }
        let store = HealthReader.shared.store
        queries.forEach(store.stop)
        queries = watched.map { type, frequency in
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
                let done = Handoff(completion)
                // Completion zawsze, także po błędzie: bez niego iOS ponawia z coraz dłuższą przerwą,
                // a po trzech razach w ogóle przestaje budzić aplikację.
                guard error == nil else { return completion() }
                Task {
                    await Sync.shared.run()
                    done.value()
                }
            }
            store.execute(query)
            store.enableBackgroundDelivery(for: type, frequency: frequency) { _, _ in }
            return query
        }
    }

    /// Completion obserwatora i zadanie w tle nie są oznaczone jako bezpieczne między wątkami,
    /// ale wolno ich użyć z dowolnego — dokumentacja wymaga tylko wywołania po skończonej pracy.
    private struct Handoff<T>: @unchecked Sendable {
        let value: T
        init(_ value: T) { self.value = value }
    }

    #if os(iOS)
    /// `nonisolated`: iOS woła blok na kolejce w tle, a blok utworzony na głównym aktorze
    /// sprawdzałby w Swift 6, czy działa na głównym wątku — i przerywał aplikację.
    nonisolated static func registerRefresh() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: refreshID, using: nil) { task in
            // Następne od razu: jeśli iOS przerwie to, łańcuch odświeżeń się nie urwie.
            scheduleRefresh()
            let bg = Handoff(task)
            let work = Task {
                await Sync.shared.run()
                bg.value.setTaskCompleted(success: !Task.isCancelled)
            }
            task.expirationHandler = { work.cancel() }
        }
    }
    #endif

    /// Najwcześniej za godzinę; kiedy naprawdę, decyduje iOS (bateria, zwyczaje użytkownika).
    nonisolated static func scheduleRefresh() {
        #if os(iOS)
        let request = BGAppRefreshTaskRequest(identifier: refreshID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 3600)
        try? BGTaskScheduler.shared.submit(request)
        #endif
    }
}
