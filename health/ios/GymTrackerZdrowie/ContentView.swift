import SwiftUI

// Jedyny ekran: klucz, zgoda na Zdrowie, „Wyślij teraz” z ostatnim wynikiem, odłączenie
// i dwa zdania o prywatności. Reszta dzieje się w tle.

struct ContentView: View {
    @Environment(\.scenePhase) private var phase
    @State private var key = KeyStore.load()
    @State private var status = Sync.status()
    @State private var keyError: String?
    @State private var healthNote: String?
    @State private var note: String?
    @State private var sending = false
    @State private var confirmDisconnect = false

    var body: some View {
        NavigationStack {
            Form {
                keySection
                if key != nil {
                    healthSection
                    sendSection
                    disconnectSection
                } else if let note {
                    Section { Text(note) }
                }
                Section("Prywatność") {
                    Text(
                        "Dane są szyfrowane na tym telefonie kluczem z GYM TRACKER. Serwer przechowuje tylko "
                            + "najnowszą zaszyfrowaną paczkę, najwyżej 7 dni, i nie zna klucza — odczytać ją może "
                            + "tylko GYM TRACKER, w którym klucz powstał.")
                }
            }
            .navigationTitle("GYM TRACKER Zdrowie")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
        }
        .onChange(of: phase, initial: true) { _, now in
            if now == .active { Task { await send(force: false) } }
        }
        .onReceive(NotificationCenter.default.publisher(for: Sync.changed).receive(on: RunLoop.main)) { _ in
            status = Sync.status()
        }
        .confirmationDialog("Odłączyć telefon?", isPresented: $confirmDisconnect, titleVisibility: .visible) {
            Button("Odłącz", role: .destructive) { Task { await disconnect() } }
        } message: {
            Text("Telefon przestanie wysyłać dane, a paczka zniknie z serwera. To, co GYM TRACKER już ma, zostaje.")
        }
    }

    private var keySection: some View {
        Section {
            if let key {
                LabeledContent("Klucz", value: "\(key.prefix(8))…")
            } else {
                Text("W GYM TRACKER: Ustawienia → Zdrowie z telefonu → Kopiuj klucz. Potem wróć tutaj i wklej.")
            }
            // PasteButton nie pyta o zgodę na schowek: użytkownik sam go stuka, więc iOS mu ufa.
            PasteButton(payloadType: String.self) { texts in
                Task { @MainActor in paste(texts.first ?? "") }
            }
            if let keyError {
                Text(keyError).foregroundStyle(.red)
            }
        } header: {
            Text("Klucz")
        } footer: {
            if key != nil { Text("Nowy klucz z GYM TRACKER zastępuje ten.") }
        }
    }

    private var healthSection: some View {
        Section {
            Button("Zezwól na dostęp do Zdrowia") { Task { await authorize() } }
            if let healthNote { Text(healthNote).foregroundStyle(.secondary) }
        } header: {
            Text("Zdrowie")
        } footer: {
            Text(
                "Kroki, dystans, piętra, minuty ćwiczeń, tętno, tętno spoczynkowe, sen, waga i przejazdy rowerem. "
                    + "Zgody zmienisz w Ustawieniach: Zdrowie → Dostęp do danych i urządzenia → GYM TRACKER Zdrowie.")
        }
    }

    private var sendSection: some View {
        Section {
            Button {
                Task { await send(force: true) }
            } label: {
                HStack {
                    Text("Wyślij teraz")
                    if sending {
                        Spacer()
                        ProgressView()
                    }
                }
            }
            .disabled(sending)
            if let status {
                Text(status.text())
                if let last = status.lastSent() { Text(last).foregroundStyle(.secondary) }
            } else {
                Text("Jeszcze nic nie wysłano.").foregroundStyle(.secondary)
            }
        } header: {
            Text("Wysyłka")
        } footer: {
            Text("Telefon wysyła też sam, gdy w Zdrowiu przybędzie danych — kroki najwyżej co godzinę.")
        }
    }

    private var disconnectSection: some View {
        Section {
            Button("Odłącz", role: .destructive) { confirmDisconnect = true }
        }
    }

    private func paste(_ text: String) {
        guard let clean = Seal.cleanKey(text) else {
            keyError = "Klucz to 64 znaki: cyfry i litery od a do f."
            return
        }
        guard KeyStore.save(clean) else {
            keyError = "Nie udało się zapisać klucza. Spróbuj jeszcze raz."
            return
        }
        keyError = nil
        note = nil
        key = clean
        Background.startObservers()
        Background.scheduleRefresh()
        Task { await send(force: true) }
    }

    private func authorize() async {
        guard HealthReader.available else {
            healthNote = "To urządzenie nie ma aplikacji Zdrowie."
            return
        }
        do {
            try await HealthReader.shared.requestAuthorization()
        } catch {
            healthNote = "Zdrowie nie pokazało okna zgód. Spróbuj jeszcze raz."
            return
        }
        // HealthKit nie zdradza, na co się zgodzono — sprawdzi to dopiero wysyłka.
        healthNote = nil
        Background.startObservers()
        await send(force: true)
    }

    private func send(force: Bool) async {
        guard key != nil else { return }
        sending = true
        await Sync.shared.run(force: force)
        status = Sync.status()
        sending = false
    }

    private func disconnect() async {
        guard let key, let keys = Seal.deriveKeys(key) else { return }
        // Najpierw klucz, potem czekanie na wysyłkę w toku — inaczej mogłaby założyć skrzynkę na nowo.
        KeyStore.delete()
        self.key = nil
        Background.stopObservers()
        await Sync.shared.idle()
        let forgotten = await Sender.shared.forget(box: keys.box)
        Sync.reset()
        status = nil
        note = forgotten
            ? "Odłączone. Paczka zniknęła z serwera."
            : "Odłączone. Serwer nie odpowiedział — paczka zniknie z niego sama po 7 dniach."
    }
}
