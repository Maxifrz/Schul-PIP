import SwiftData
import SwiftUI
import UniformTypeIdentifiers

/// The Kurs tab: sign in to the server, courses and work groups, and inside each one the chat, the saved results and the
/// members. Everything lives on the student's own Supabase project (see supabase/README.md).
struct SocialView: View {
    @ObservedObject private var store = SocialStore.shared
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selected: SocialGroup?

    private var margin: CGFloat { sizeClass == .compact ? 20 : 40 }

    var body: some View {
        Group {
            switch store.phase {
            case .unconfigured: ServerSetup(margin: margin)
            case .signedOut: AuthForm(margin: margin)
            case .signedIn:
                if let group = selected {
                    GroupScreen(group: group, margin: margin) { selected = nil }
                        .id(group.id)
                } else {
                    GroupList(margin: margin, onOpen: { selected = $0 })
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .overlay(alignment: .top) { ErrorBanner() }
        .onChange(of: store.phase) { _, phase in
            if phase != .signedIn { selected = nil }
        }
    }
}

struct ErrorBanner: View {
    @ObservedObject private var store = SocialStore.shared

    var body: some View {
        if let text = store.error {
            HStack(spacing: 12) {
                Text(text)
                    .font(.work(14, .medium))
                    .foregroundStyle(Quill.bg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button { store.error = nil } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Quill.bg)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Quill.ink, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .transition(.opacity)
            .zIndex(5)
        }
    }
}

/// A plain text field in the app's look.
struct QuillField: View {
    let title: String
    @Binding var text: String
    var secure = false
    var keyboard: UIKeyboardType = .default

    var body: some View {
        Group {
            if secure {
                SecureField(title, text: $text)
            } else {
                TextField(title, text: $text)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
        }
        .font(.work(16))
        .foregroundStyle(Quill.ink)
        .padding(.horizontal, 16)
        .frame(height: 48)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }
}

// MARK: Setup and sign-in

private struct ServerSetup: View {
    let margin: CGFloat
    @ObservedObject private var store = SocialStore.shared
    @State private var url = ""
    @State private var key = ""
    @State private var problem: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageHeader(caption: "Zusammenarbeit", title: "Kurse")
                Text("Kurse, Gruppenarbeit und Chat laufen über einen Server, den du selbst anlegst (Supabase, kostenlos). Die Anleitung steht in supabase/README.md im Projekt: Projekt anlegen, schema.sql einfügen, Adresse und anon-Schlüssel hier eintragen.")
                    .font(.work(15))
                    .lineSpacing(4)
                    .foregroundStyle(Quill.muted)
                QuillField(title: "Projekt-Adresse (https://….supabase.co)", text: $url, keyboard: .URL)
                QuillField(title: "anon public key", text: $key)
                if let problem {
                    Text(problem).font(.work(13.5)).foregroundStyle(Quill.warn)
                }
                Button("Verbinden") { problem = store.saveServer(url: url, key: key) }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 16))
                    .disabled(url.isEmpty || key.isEmpty)
            }
            .frame(maxWidth: 560, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.top, margin > 20 ? 44 : 20)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

private struct AuthForm: View {
    let margin: CGFloat
    @ObservedObject private var store = SocialStore.shared
    @State private var registering = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PageHeader(caption: "Zusammenarbeit", title: registering ? "Konto anlegen" : "Anmelden")
                if registering {
                    QuillField(title: "Name, den die anderen sehen", text: $name)
                }
                QuillField(title: "E-Mail", text: $email, keyboard: .emailAddress)
                QuillField(title: "Passwort (mindestens 6 Zeichen)", text: $password, secure: true)
                Button(registering ? "Konto anlegen" : "Anmelden") {
                    Task {
                        if registering {
                            await store.signUp(name: name, email: email, password: password)
                        } else {
                            await store.signIn(email: email, password: password)
                        }
                    }
                }
                .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 16))
                .disabled(email.isEmpty || password.isEmpty || store.busy)
                HStack(spacing: 18) {
                    Button(registering ? "Ich habe schon ein Konto" : "Neu hier? Konto anlegen") {
                        registering.toggle()
                        store.error = nil
                    }
                    Button("Server ändern") { store.forgetServer() }
                }
                .font(.work(14, .medium))
                .foregroundStyle(Quill.muted)
                .buttonStyle(.plain)
            }
            .frame(maxWidth: 560, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.top, margin > 20 ? 44 : 20)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

// MARK: Courses

private struct GroupList: View {
    let margin: CGFloat
    let onOpen: (SocialGroup) -> Void
    @ObservedObject private var store = SocialStore.shared
    @State private var creating = false
    @State private var joining = false
    @State private var name = ""
    @State private var code = ""

    private var courses: [SocialGroup] { store.groups.filter(\.isCourse) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageHeader(caption: "Zusammenarbeit", title: "Kurse")
                HStack(spacing: 10) {
                    Button("Kurs anlegen") { creating = true }
                        .buttonStyle(QuillPrimaryButtonStyle(height: 44, fontSize: 15))
                    Button("Mit Code beitreten") { joining = true }
                        .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                }
                if courses.isEmpty {
                    Text("Du bist in keinem Kurs. Lege einen an und gib den Code deinen Mitschülern, oder tritt mit einem Code bei.")
                        .font(.work(15))
                        .lineSpacing(4)
                        .foregroundStyle(Quill.muted)
                        .padding(.top, 8)
                }
                VStack(spacing: 10) {
                    ForEach(courses) { course in
                        courseRow(course)
                    }
                }
                HStack(spacing: 18) {
                    if let me = store.me {
                        Text(me.name).font(.work(13)).foregroundStyle(Quill.faint)
                    }
                    Button("Abmelden") { Task { await store.signOut() } }
                    Button("Server ändern") { store.forgetServer() }
                }
                .font(.work(13.5, .medium))
                .foregroundStyle(Quill.muted)
                .buttonStyle(.plain)
                .padding(.top, 14)
            }
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.top, margin > 20 ? 44 : 20)
            .padding(.bottom, 40)
        }
        .refreshable { await store.refreshGroups() }
        .task { await store.refreshGroups() }
        .alert("Kurs anlegen", isPresented: $creating) {
            TextField("Name, z. B. Mathe LK 12", text: $name)
            Button("Anlegen") {
                let text = name
                name = ""
                Task { if let group = await store.createGroup(name: text, parent: nil) { onOpen(group) } }
            }
            Button("Abbrechen", role: .cancel) { name = "" }
        }
        .alert("Mit Code beitreten", isPresented: $joining) {
            TextField("Code, z. B. K7M2QX", text: $code)
                .textInputAutocapitalization(.characters)
            Button("Beitreten") {
                let text = code
                code = ""
                Task { if let group = await store.join(code: text) { onOpen(group) } }
            }
            Button("Abbrechen", role: .cancel) { code = "" }
        }
    }

    private func courseRow(_ course: SocialGroup) -> some View {
        let subs = store.groups.filter { $0.parentId == course.id }
        return Button { onOpen(course) } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(course.name)
                    .font(.work(19, .semibold))
                    .foregroundStyle(Quill.ink)
                Text(subs.isEmpty ? "Code \(course.joinCode)" : "Code \(course.joinCode) · \(subs.count) \(subs.count == 1 ? "Gruppe" : "Gruppen")")
                    .font(.mono(11.5, .medium))
                    .foregroundStyle(Quill.faint)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: Inside a group

private enum GroupTab: String, CaseIterable, Identifiable {
    case chat, board, results, groups, members
    var id: String { rawValue }

    var title: String {
        switch self {
        case .chat: return "Chat"
        case .board: return "Tafelbild"
        case .results: return "Dateien"
        case .groups: return "Gruppen"
        case .members: return "Mitglieder"
        }
    }
}

private struct GroupScreen: View {
    let group: SocialGroup
    let margin: CGFloat
    let back: () -> Void
    @ObservedObject private var store = SocialStore.shared
    @State private var tab: GroupTab = .chat
    @State private var leaving = false

    private var tabs: [GroupTab] { group.isCourse ? GroupTab.allCases : GroupTab.allCases.filter { $0 != .groups } }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(tabs) { option in
                        Button { tab = option } label: {
                            Text(option.title)
                                .font(.work(13.5, .medium))
                                .foregroundStyle(option == tab ? Quill.bg : Quill.ink)
                                .padding(.horizontal, 14)
                                .frame(height: 34)
                                .background(option == tab ? Quill.ink : Color.clear, in: Capsule())
                                .overlay(Capsule().stroke(option == tab ? Color.clear : Quill.line2, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, margin)
            }
            .scrollIndicators(.hidden)
            .padding(.bottom, 10)
            switch tab {
            case .chat: ChatPane(group: group, margin: margin)
            case .board: BoardsPane(group: group, margin: margin)
            case .results: ResultsPane(group: group, margin: margin)
            case .groups: SubgroupsPane(course: group, margin: margin)
            case .members: MembersPane(group: group, margin: margin)
            }
        }
        .confirmationDialog("„\(group.name)“ verlassen?", isPresented: $leaving, titleVisibility: .visible) {
            Button("Verlassen", role: .destructive) {
                Task {
                    await store.leave(group)
                    back()
                }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Du kannst mit dem Code wieder beitreten.")
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button(action: back) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Quill.ink)
                    .frame(width: 40, height: 40)
                    .background(Quill.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Zurück")
            VStack(alignment: .leading, spacing: 2) {
                Text(group.name)
                    .font(.work(22, .heavy))
                    .tracking(-0.5)
                    .foregroundStyle(Quill.ink)
                    .lineLimit(1)
                Text(group.isCourse ? "KURS · CODE \(group.joinCode)" : "GRUPPE · CODE \(group.joinCode)")
                    .font(.mono(10.5, .medium))
                    .tracking(0.6)
                    .foregroundStyle(Quill.faint)
            }
            Spacer(minLength: 0)
            ShareLink(item: "Tritt „\(group.name)“ in Schul-PIP bei. Code: \(group.joinCode)") {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Quill.ink)
                    .frame(width: 40, height: 40)
            }
            Menu {
                Button("Verlassen", role: .destructive) { leaving = true }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Quill.ink)
                    .frame(width: 40, height: 40)
            }
        }
        .padding(.horizontal, margin)
        .padding(.top, 12)
        .padding(.bottom, 12)
    }
}

// MARK: Sending files

/// What the file buttons of chat and results need: the system file picker and a pick from the library.
private struct FileSources: ViewModifier {
    @Binding var pickingFile: Bool
    @Binding var pickingMaterial: Bool
    let onFile: (URL) -> Void

    func body(content: Content) -> some View {
        content
            .fileImporter(isPresented: $pickingFile, allowedContentTypes: [.pdf, .image, MaterialStore.docxType, .plainText]) { result in
                if case let .success(url) = result { onFile(url) }
            }
            .sheet(isPresented: $pickingMaterial) {
                MaterialPicker { material in
                    pickingMaterial = false
                    if let url = SocialFiles.copy(of: material) { onFile(url) }
                }
            }
    }
}

private extension View {
    func fileSources(file: Binding<Bool>, material: Binding<Bool>, onFile: @escaping (URL) -> Void) -> some View {
        modifier(FileSources(pickingFile: file, pickingMaterial: material, onFile: onFile))
    }
}

enum SocialFiles {
    /// A copy of a library document in a temporary folder, named like its title, so the group sees "Aufgaben.pdf" and
    /// not the file name the library uses inside the app.
    static func copy(of material: StudyMaterial) -> URL? {
        let ext = (material.fileName as NSString).pathExtension
        let title = material.title.replacingOccurrences(of: "/", with: "-")
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let target = folder.appendingPathComponent(ext.isEmpty ? title : "\(title).\(ext)")
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: material.fileURL, to: target)
            return target
        } catch {
            return nil
        }
    }
}

private struct MaterialPicker: View {
    let pick: (StudyMaterial) -> Void
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var materials: [StudyMaterial]

    var body: some View {
        NavigationStack {
            List(materials.filter { !$0.isTrashed }) { material in
                Button { pick(material) } label: {
                    Text(material.title).font(.work(16)).foregroundStyle(Quill.ink)
                }
            }
            .overlay {
                if materials.isEmpty {
                    Text("Deine Bibliothek ist leer.").font(.work(15)).foregroundStyle(Quill.muted)
                }
            }
            .navigationTitle("Aus der Bibliothek")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
            }
        }
    }
}

/// Saves a file from a group into the library.
@MainActor
private func saveToLibrary(path: String, name: String, context: ModelContext, store: SocialStore) async {
    guard let file = await store.download(path: path, name: name) else { return }
    do {
        let material = try MaterialStore.importFile(from: file)
        context.insert(material)
        store.error = "„\(material.title)“ liegt jetzt in deiner Bibliothek."
    } catch {
        store.error = "Diese Datei lässt sich nicht in die Bibliothek legen."
    }
}

// MARK: Chat

private struct ChatPane: View {
    let group: SocialGroup
    let margin: CGFloat
    @ObservedObject private var store = SocialStore.shared
    @Environment(\.modelContext) private var modelContext
    @State private var draft = ""
    @State private var pickingFile = false
    @State private var pickingMaterial = false

    private var messages: [SocialMessage] { store.messages[group.id] ?? [] }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if messages.isEmpty {
                            Text("Noch nichts geschrieben. Fang an.")
                                .font(.work(15))
                                .foregroundStyle(Quill.muted)
                                .padding(.top, 40)
                        }
                        ForEach(messages) { message in
                            bubble(message).id(message.id)
                        }
                    }
                    .padding(.horizontal, margin)
                    .padding(.vertical, 10)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: messages.last?.id) { _, id in
                    guard let id else { return }
                    withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(id, anchor: .bottom) }
                }
                .onAppear {
                    if let id = messages.last?.id { proxy.scrollTo(id, anchor: .bottom) }
                }
            }
            composer
        }
        .task(id: group.id) {
            // The chat refreshes every few seconds while it is open; there are no push messages.
            while !Task.isCancelled {
                await store.refreshMessages(group)
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
        .fileSources(file: $pickingFile, material: $pickingMaterial) { url in
            Task { await store.sendFile(url, in: group) }
        }
    }

    private func bubble(_ message: SocialMessage) -> some View {
        let mine = message.userId == store.me?.userId
        return VStack(alignment: mine ? .trailing : .leading, spacing: 3) {
            Text(mine ? Social.timeLabel(message.createdAt) : "\(message.author) · \(Social.timeLabel(message.createdAt))")
                .font(.mono(10.5, .medium))
                .foregroundStyle(Quill.faint)
            VStack(alignment: .leading, spacing: 8) {
                if !message.body.isEmpty {
                    Text(message.body)
                        .font(.work(15.5))
                        .foregroundStyle(mine ? Quill.bg : Quill.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let path = message.attachmentPath {
                    Button {
                        Task { await saveToLibrary(path: path, name: message.attachmentName ?? "Datei", context: modelContext, store: store) }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "paperclip")
                            Text(message.attachmentName ?? "Datei")
                                .lineLimit(1)
                            Image(systemName: "arrow.down.to.line")
                        }
                        .font(.work(14, .medium))
                        .foregroundStyle(mine ? Quill.bg : Quill.ink)
                        .padding(.horizontal, 10)
                        .frame(height: 34)
                        .background((mine ? Quill.bg : Quill.ink).opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(mine ? Quill.ink : Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(mine ? Color.clear : Quill.line2, lineWidth: 1))
            .contextMenu {
                if mine {
                    Button("Löschen", role: .destructive) { Task { await store.delete(message) } }
                } else {
                    Button("Melden", role: .destructive) { Task { await store.report(message) } }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: mine ? .trailing : .leading)
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Menu {
                Button { pickingFile = true } label: { Label("Datei wählen", systemImage: "doc") }
                Button { pickingMaterial = true } label: { Label("Aus der Bibliothek", systemImage: "books.vertical") }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Quill.ink)
                    .frame(width: 44, height: 44)
                    .background(Quill.surface, in: Circle())
                    .overlay(Circle().stroke(Quill.line2, lineWidth: 1))
            }
            .accessibilityLabel("Anhängen")
            TextField("Nachricht", text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .font(.work(16))
                .foregroundStyle(Quill.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(Quill.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            Button(action: send) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Quill.bg)
                    .frame(width: 44, height: 44)
                    .background(Quill.ink, in: Circle())
                    .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.35 : 1)
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Senden")
        }
        .padding(.horizontal, margin)
        .padding(.vertical, 10)
        .background(Quill.bg)
    }

    private func send() {
        let text = draft
        draft = ""
        Task { await store.send(text, in: group) }
    }
}

// MARK: Results

private struct ResultsPane: View {
    let group: SocialGroup
    let margin: CGFloat
    @ObservedObject private var store = SocialStore.shared
    @Environment(\.modelContext) private var modelContext
    @State private var pickingFile = false
    @State private var pickingMaterial = false
    @State private var pendingURL: URL?
    @State private var title = ""

    private var results: [SocialResult] { store.results[group.id] ?? [] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Hier sichert die Gruppe, was fertig ist: Lösungen, Zusammenfassungen, Plakate. Jeder kann sie in seine Bibliothek laden.")
                    .font(.work(14.5))
                    .lineSpacing(4)
                    .foregroundStyle(Quill.muted)
                Menu {
                    Button { pickingFile = true } label: { Label("Datei wählen", systemImage: "doc") }
                    Button { pickingMaterial = true } label: { Label("Aus der Bibliothek", systemImage: "books.vertical") }
                } label: {
                    Text("Ergebnis hinzufügen")
                        .font(.work(15, .medium))
                        .foregroundStyle(Quill.bg)
                        .padding(.horizontal, 20)
                        .frame(height: 44)
                        .background(Quill.ink, in: Capsule())
                }
                if results.isEmpty {
                    Text("Noch keine Ergebnisse.").font(.work(15)).foregroundStyle(Quill.faint).padding(.top, 8)
                }
                ForEach(results) { result in
                    row(result)
                }
            }
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.vertical, 12)
        }
        .refreshable { await store.refreshResults(group) }
        .task(id: group.id) { await store.refreshResults(group) }
        .fileSources(file: $pickingFile, material: $pickingMaterial) { url in
            title = url.deletingPathExtension().lastPathComponent
            pendingURL = url
        }
        .alert("Wie heißt das Ergebnis?", isPresented: Binding(get: { pendingURL != nil }, set: { if !$0 { pendingURL = nil } })) {
            TextField("Titel", text: $title)
            Button("Speichern") {
                if let url = pendingURL {
                    let text = title.trimmingCharacters(in: .whitespacesAndNewlines)
                    Task { await store.addResult(url, title: text.isEmpty ? url.lastPathComponent : text, in: group) }
                }
                pendingURL = nil
            }
            Button("Abbrechen", role: .cancel) { pendingURL = nil }
        }
    }

    private func row(_ result: SocialResult) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(result.title).font(.work(16.5, .semibold)).foregroundStyle(Quill.ink)
                Text("\(result.author) · \(Social.timeLabel(result.createdAt))")
                    .font(.mono(10.5, .medium))
                    .foregroundStyle(Quill.faint)
            }
            Spacer(minLength: 0)
            Button {
                Task { await saveToLibrary(path: result.path, name: result.fileName, context: modelContext, store: store) }
            } label: {
                Image(systemName: "arrow.down.to.line")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Quill.ink)
                    .frame(width: 40, height: 40)
                    .background(Quill.hover, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("In die Bibliothek sichern")
        }
        .padding(14)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        .contextMenu {
            if result.userId == store.me?.userId {
                Button("Löschen", role: .destructive) { Task { await store.delete(result) } }
            }
        }
    }
}

// MARK: Work groups and members

private struct SubgroupsPane: View {
    let course: SocialGroup
    let margin: CGFloat
    @ObservedObject private var store = SocialStore.shared
    @State private var creating = false
    @State private var name = ""
    @State private var opened: SocialGroup?

    var body: some View {
        let split = store.subgroups(of: course)
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Arbeitsgruppen im Kurs, jede mit eigenem Chat und eigenen Ergebnissen.")
                    .font(.work(14.5))
                    .foregroundStyle(Quill.muted)
                Button("Gruppe anlegen") { creating = true }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 44, fontSize: 15))
                ForEach(split.mine) { group in
                    Button { opened = group } label: {
                        row(group, trailing: "Öffnen")
                    }
                    .buttonStyle(.plain)
                }
                if !split.open.isEmpty {
                    PixelCaption(text: "Offen für dich").padding(.top, 10)
                    ForEach(split.open) { group in
                        Button { Task { await store.join(subgroup: group) } } label: {
                            row(group, trailing: "Beitreten")
                        }
                        .buttonStyle(.plain)
                    }
                }
                if split.mine.isEmpty, split.open.isEmpty {
                    Text("Noch keine Gruppen.").font(.work(15)).foregroundStyle(Quill.faint).padding(.top, 8)
                }
            }
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.vertical, 12)
        }
        .refreshable { await store.refreshGroups() }
        .task { await store.refreshGroups() }
        .alert("Gruppe anlegen", isPresented: $creating) {
            TextField("Name, z. B. Referat Weimarer Republik", text: $name)
            Button("Anlegen") {
                let text = name
                name = ""
                Task { opened = await store.createGroup(name: text, parent: course) }
            }
            Button("Abbrechen", role: .cancel) { name = "" }
        }
        .fullScreenCover(item: $opened) { group in
            GroupScreen(group: group, margin: margin) { opened = nil }
                .overlay(alignment: .top) { ErrorBanner() }
                .background(Quill.bg.ignoresSafeArea())
        }
    }

    private func row(_ group: SocialGroup, trailing: String) -> some View {
        HStack {
            Text(group.name).font(.work(16.5, .semibold)).foregroundStyle(Quill.ink)
            Spacer(minLength: 0)
            Text(trailing).font(.work(14, .medium)).foregroundStyle(Quill.muted)
        }
        .padding(16)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }
}

private struct MembersPane: View {
    let group: SocialGroup
    let margin: CGFloat
    @ObservedObject private var store = SocialStore.shared

    private var iAmOwner: Bool {
        store.members[group.id]?.first { $0.userId == store.me?.userId }?.role == "owner"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(store.members[group.id] ?? []) { member in
                    HStack {
                        Text(member.name).font(.work(16, .medium)).foregroundStyle(Quill.ink)
                        Spacer(minLength: 0)
                        if member.role == "owner" {
                            Text("GRÜNDER").font(.mono(10.5, .medium)).tracking(0.6).foregroundStyle(Quill.faint)
                        } else if member.role == "mod" {
                            Text("MODERATOR").font(.mono(10.5, .medium)).tracking(0.6).foregroundStyle(Quill.link)
                        }
                        if iAmOwner, member.role != "owner" {
                            Menu {
                                if member.role == "mod" {
                                    Button("Moderation entziehen") { Task { await store.setRole("member", of: member.userId, in: group) } }
                                } else {
                                    Button("Zum Moderator machen") { Task { await store.setRole("mod", of: member.userId, in: group) } }
                                }
                            } label: {
                                Image(systemName: "ellipsis").foregroundStyle(Quill.faint).frame(width: 32, height: 24)
                            }
                        }
                    }
                    .padding(.vertical, 10)
                    QuillDivider(color: Quill.lineSoft)
                }
            }
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.vertical, 12)
        }
        .task(id: group.id) { await store.refreshMembers(group) }
    }
}
