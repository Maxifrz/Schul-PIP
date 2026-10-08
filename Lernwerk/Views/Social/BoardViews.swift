import PhotosUI
import SwiftData
import SwiftUI

// The Tafelbild: the class builds one lesson result together. Everybody proposes blocks, moderators accept, edit and reject
// them or put several up for a vote, and closing the board freezes the result. Nothing here is written by an AI.

/// The "Tafelbild" tab of a course or group: the boards by lesson, newest first.
struct BoardsPane: View {
    let group: SocialGroup
    let margin: CGFloat
    @ObservedObject private var store = SocialStore.shared
    @ObservedObject private var boards = BoardStore.shared
    @State private var creating = false
    @State private var opened: Board?

    private var list: [Board] { boards.boards[group.id] ?? [] }
    private var moderator: Bool { store.isModerator(in: group.id) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Pro Stunde ein gemeinsames Ergebnis: alle machen Vorschläge, die Moderation übernimmt, was ins Tafelbild gehört.")
                    .font(.work(14.5))
                    .lineSpacing(4)
                    .foregroundStyle(Quill.muted)
                if moderator {
                    Button("Ergebnissicherung starten") { creating = true }
                        .buttonStyle(QuillPrimaryButtonStyle(height: 44, fontSize: 15))
                } else {
                    Text("Eine Ergebnissicherung starten können nur Moderatoren, bei einem Kurs also der Gründer und wen er dazu macht.")
                        .font(.work(13.5))
                        .foregroundStyle(Quill.faint)
                }
                if list.isEmpty {
                    Text("Noch keine Ergebnissicherung.").font(.work(15)).foregroundStyle(Quill.faint).padding(.top, 8)
                }
                ForEach(list) { board in
                    Button { opened = board } label: { row(board) }
                        .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.vertical, 12)
        }
        .refreshable { await boards.refreshBoards(group) }
        .task(id: group.id) {
            await store.refreshMembers(group)
            await boards.refreshBoards(group)
        }
        .sheet(isPresented: $creating) {
            NewBoardSheet(group: group) { board in
                creating = false
                opened = board
            }
        }
        .fullScreenCover(item: $opened) { board in
            BoardScreen(boardID: board.id, group: group, margin: margin) { opened = nil }
                .background(Quill.bg.ignoresSafeArea())
        }
    }

    private func row(_ board: Board) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(board.title).font(.work(17, .semibold)).foregroundStyle(Quill.ink)
                Spacer(minLength: 8)
                StatusChip(board: board)
            }
            Text([board.dateLabel, board.topic].filter { !$0.isEmpty }.joined(separator: " · "))
                .font(.mono(11, .medium))
                .foregroundStyle(Quill.faint)
        }
        .padding(16)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }
}

private struct StatusChip: View {
    let board: Board

    var body: some View {
        Text(board.isFinal ? "FINAL" : (board.isLocked ? "GESPERRT" : "OFFEN"))
            .font(.mono(10, .medium))
            .tracking(0.6)
            .foregroundStyle(board.isFinal ? Quill.bg : Quill.ink)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(board.isFinal ? Quill.ink : Color.clear, in: Capsule())
            .overlay(Capsule().stroke(board.isFinal ? Color.clear : Quill.line3, lineWidth: 1))
    }
}

private struct NewBoardSheet: View {
    let group: SocialGroup
    let created: (Board) -> Void
    @ObservedObject private var boards = BoardStore.shared
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var topic = ""
    @State private var template: BoardTemplate

    init(group: SocialGroup, created: @escaping (Board) -> Void) {
        self.group = group
        self.created = created
        _template = State(initialValue: BoardTemplate.suggested(forName: group.name))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            PixelCaption(text: "Neue Ergebnissicherung")
            QuillField(title: "Thema der Stunde, z. B. Integralrechnung", text: $title)
            QuillField(title: "Worum geht es genau? (optional)", text: $topic)
            Text("Aufbau").font(.work(13.5, .medium)).foregroundStyle(Quill.muted)
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(BoardTemplate.allCases) { option in
                        Button { template = option } label: {
                            Text(option.title)
                                .font(.work(13.5))
                                .foregroundStyle(option == template ? Quill.bg : Quill.ink)
                                .padding(.horizontal, 14)
                                .frame(height: 34)
                                .background(option == template ? Quill.ink : Color.clear, in: Capsule())
                                .overlay(Capsule().stroke(option == template ? Color.clear : Quill.line2, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollIndicators(.hidden)
            Text("Bausteine: " + template.kinds.map(\.title).joined(separator: ", "))
                .font(.work(13))
                .foregroundStyle(Quill.faint)
            Spacer(minLength: 0)
            Button("Starten") {
                Task {
                    if let board = await boards.create(in: group, title: title, topic: topic, template: template) {
                        created(board)
                    }
                }
            }
            .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 16))
            .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || boards.busy)
        }
        .padding(24)
        .presentationDetents([.medium, .large])
        .presentationBackground(Quill.bg)
    }
}

// MARK: The board

private enum BoardTab: String, CaseIterable, Identifiable {
    case board, proposals, polls, history
    var id: String { rawValue }

    var title: String {
        switch self {
        case .board: return "Tafelbild"
        case .proposals: return "Vorschläge"
        case .polls: return "Abstimmung"
        case .history: return "Verlauf"
        }
    }
}

private struct ComposeRequest: Identifiable {
    let id = UUID()
    let kind: BlockKind
    var editing: BoardBlock?
    var replacing: BoardBlock?
}

struct BoardScreen: View {
    let boardID: UUID
    let group: SocialGroup
    let margin: CGFloat
    let close: () -> Void
    @ObservedObject private var store = SocialStore.shared
    @ObservedObject private var boards = BoardStore.shared
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @State private var tab: BoardTab = .board
    @State private var compose: ComposeRequest?
    @State private var selection: Set<UUID> = []
    @State private var pollQuestion = ""
    @State private var askingPoll = false
    @State private var confirmFinal = false
    @State private var reviewing = false

    private var board: Board? { boards.boards[group.id]?.first { $0.id == boardID } }
    private var blocks: [BoardBlock] { boards.blocks[boardID] ?? [] }
    private var moderator: Bool { store.isModerator(in: group.id) }
    private var me: UUID? { store.me?.userId }

    var body: some View {
        VStack(spacing: 0) {
            if let board {
                header(board)
                tabs(board)
                content(board)
            } else {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .overlay(alignment: .top) { ErrorBanner() }
        .task(id: boardID) {
            await store.refreshMembers(group)
            while !Task.isCancelled {
                if let board { await boards.refresh(board) }
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
        .task(id: tab) {
            if tab == .history, let board { await boards.refreshVersions(board) }
        }
        .sheet(item: $compose) { request in
            if let board {
                ComposeSheet(board: board, request: request, moderator: moderator)
            }
        }
        .alert("Frage der Abstimmung", isPresented: $askingPoll) {
            TextField("Welche Definition gehört ins Tafelbild?", text: $pollQuestion)
            Button("Starten") {
                guard let board else { return }
                let ids = Array(selection)
                selection = []
                tab = .polls
                Task { await boards.startPoll(in: board, question: pollQuestion, blocks: ids) }
            }
            Button("Abbrechen", role: .cancel) {}
        }
        .confirmationDialog("Ergebnissicherung abschließen?", isPresented: $confirmFinal, titleVisibility: .visible) {
            Button("Abschließen") {
                guard let board else { return }
                Task { await boards.finalize(board) }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Danach kann niemand mehr etwas ändern. Offene Abstimmungen werden beendet.")
        }
    }

    // MARK: Header and tabs

    private func header(_ board: Board) -> some View {
        HStack(spacing: 12) {
            Button(action: close) {
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
                Text(board.title).font(.work(21, .heavy)).tracking(-0.4).foregroundStyle(Quill.ink).lineLimit(2)
                Text("\(group.name.uppercased()) · \(board.dateLabel)")
                    .font(.mono(10.5, .medium))
                    .tracking(0.6)
                    .foregroundStyle(Quill.faint)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            StatusChip(board: board)
        }
        .padding(.horizontal, margin)
        .padding(.top, 12)
        .padding(.bottom, 10)
    }

    private func tabs(_ board: Board) -> some View {
        let open = blocks.filter(\.isProposed).count
        return ScrollView(.horizontal) {
            HStack(spacing: 6) {
                ForEach(BoardTab.allCases) { option in
                    Button { tab = option } label: {
                        Text(option == .proposals && open > 0 ? "Vorschläge · \(open)" : option.title)
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
    }

    @ViewBuilder
    private func content(_ board: Board) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                switch tab {
                case .board: boardTab(board)
                case .proposals: proposalsTab(board)
                case .polls: pollsTab(board)
                case .history: historyTab(board)
                }
            }
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.top, 4)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: Tafelbild

    @ViewBuilder
    private func boardTab(_ board: Board) -> some View {
        if moderator { moderationCard(board) }
        if board.isFinal { finalCard(board) }
        let sections = BoardLogic.sections(template: board.kind, blocks: blocks)
        if sections.isEmpty {
            Text("Noch nichts im Tafelbild. Macht Vorschläge, die Moderation übernimmt sie.")
                .font(.work(15)).foregroundStyle(Quill.faint).padding(.top, 8)
        }
        ForEach(sections, id: \.kind) { section in
            PixelCaption(text: section.kind.title).padding(.top, 6)
            ForEach(section.blocks) { block in
                BlockCard(block: block, mine: block.author == me) {
                    if board.isOpen {
                        if moderator {
                            Button("Bearbeiten") { compose = ComposeRequest(kind: block.blockKind, editing: block) }
                        }
                        Button("Korrektur vorschlagen") { compose = ComposeRequest(kind: block.blockKind, replacing: block) }
                        if moderator {
                            Button("Entfernen", role: .destructive) { Task { await boards.reject(block, in: board) } }
                        }
                    }
                }
            }
        }
        if board.isOpen {
            PixelCaption(text: "Beitrag erstellen").padding(.top, 12)
            FlowButtons(kinds: board.kind.kinds) { kind in compose = ComposeRequest(kind: kind) }
        } else if board.isLocked {
            Text("Das Tafelbild ist gesperrt. Die Moderation kann es wieder freigeben.")
                .font(.work(14)).foregroundStyle(Quill.faint)
        }
    }

    private func moderationCard(_ board: Board) -> some View {
        let stats = BoardLogic.stats(blocks)
        return VStack(alignment: .leading, spacing: 10) {
            PixelCaption(text: "Moderation")
            Text("\(stats.contributions) Beiträge · \(stats.accepted) übernommen · \(stats.open) offen · \(stats.rejected) abgelehnt · \(stats.people) Beteiligte")
                .font(.work(14))
                .foregroundStyle(Quill.ink2)
            if !board.isFinal {
                HStack(spacing: 8) {
                    Button(board.isLocked ? "Freigeben" : "Sperren") {
                        Task { await boards.setStatus(board.isLocked ? "open" : "locked", of: board) }
                    }
                    .buttonStyle(QuillOutlineButtonStyle(height: 38, fontSize: 14, weight: .medium))
                    Button("Abschließen") { confirmFinal = true }
                        .buttonStyle(QuillPrimaryButtonStyle(height: 38, fontSize: 14))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Quill.accentSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: After closing

    private func finalCard(_ board: Board) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            PixelCaption(text: "Abgeschlossen")
            Text("Das Stundenergebnis ist festgehalten. Daraus kannst du Lernmaterial machen, ohne dass eine KI etwas dazuschreibt.")
                .font(.work(14)).foregroundStyle(Quill.ink2)
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    Button("Als PDF in die Bibliothek") { saveAsPDF(board) }
                    Button("Karteikarten erzeugen") { makeCards(board) }
                    Button(reviewing ? "Prüft …" : "KI prüft das Ergebnis") { Task { await review(board) } }
                        .disabled(reviewing)
                }
                .buttonStyle(QuillOutlineButtonStyle(height: 38, fontSize: 14, weight: .medium))
            }
            .scrollIndicators(.hidden)
            if let note = boards.review[board.id] {
                Text(note)
                    .font(.work(14.5))
                    .lineSpacing(4)
                    .foregroundStyle(Quill.ink)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Quill.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }

    private func saveAsPDF(_ board: Board) {
        let data = BoardExport.pdf(board: board, groupName: group.name, blocks: blocks)
        do {
            let material = try MaterialStore.save(pdfData: data, title: "\(board.title) – \(group.name)")
            modelContext.insert(material)
            store.error = "„\(material.title)“ liegt jetzt in deiner Bibliothek."
        } catch {
            store.error = "Das PDF ließ sich nicht speichern."
        }
    }

    private func makeCards(_ board: Board) {
        let cards = BoardLogic.flashcards(board: board, blocks: blocks)
        for card in cards { modelContext.insert(ReviewCard(front: card.front, back: card.back, materialID: nil, page: nil)) }
        store.error = cards.isEmpty ? "Im Tafelbild stehen keine Definitionen, Formeln oder Merksätze für Karten." : "\(cards.count) Karteikarten sind unter „Karten“ gelandet."
    }

    private func review(_ board: Board) async {
        reviewing = true
        defer { reviewing = false }
        let request = LLMRequest(
            purpose: .studyAid,
            system: BoardLogic.reviewSystem,
            messages: [LLMMessage(role: .user, content: [.text(BoardLogic.reviewPrompt(board: board, groupName: group.name, blocks: blocks))])],
            maxTokens: 1200,
            effort: .low
        )
        do {
            let answer = try await settings.makeClient(for: .tutor).complete(request)
            boards.review[board.id] = answer.text.trimmingCharacters(in: .whitespacesAndNewlines)
        } catch {
            store.error = error.localizedDescription
        }
    }

    // MARK: Vorschläge

    @ViewBuilder
    private func proposalsTab(_ board: Board) -> some View {
        let proposals = blocks.filter(\.isProposed)
        if proposals.isEmpty {
            Text("Keine offenen Vorschläge.").font(.work(15)).foregroundStyle(Quill.faint).padding(.top, 8)
        }
        if moderator, board.isOpen, proposals.count >= 2 {
            HStack {
                Text(selection.count >= 2 ? "\(selection.count) für die Abstimmung gewählt" : "Wähle mindestens zwei Vorschläge für eine Abstimmung.")
                    .font(.work(13.5)).foregroundStyle(Quill.muted)
                Spacer(minLength: 8)
                Button("Abstimmung") {
                    pollQuestion = ""
                    askingPoll = true
                }
                .buttonStyle(QuillOutlineButtonStyle(height: 34, fontSize: 13.5, weight: .medium))
                .disabled(selection.count < 2)
            }
        }
        ForEach(proposals) { block in
            HStack(alignment: .top, spacing: 10) {
                if moderator, board.isOpen, proposals.count >= 2 {
                    Button {
                        if selection.contains(block.id) { selection.remove(block.id) } else { selection.insert(block.id) }
                    } label: {
                        Image(systemName: selection.contains(block.id) ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 22))
                            .foregroundStyle(selection.contains(block.id) ? Quill.accent : Quill.line3)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 14)
                }
                VStack(alignment: .leading, spacing: 8) {
                    BlockCard(block: block, mine: block.author == me, replacedTitle: replacedTitle(block), hasMenu: false) { EmptyView() }
                    if board.isOpen { proposalActions(block, board) }
                }
            }
        }
    }

    private func replacedTitle(_ block: BoardBlock) -> String? {
        guard let id = block.replacesBlock, let old = blocks.first(where: { $0.id == id }) else { return nil }
        return old.title.isEmpty ? old.blockKind.title : old.title
    }

    @ViewBuilder
    private func proposalActions(_ block: BoardBlock, _ board: Board) -> some View {
        HStack(spacing: 8) {
            if moderator {
                Button("Übernehmen") { Task { await boards.accept(block, in: board) } }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 34, fontSize: 13.5))
            }
            if moderator || block.author == me {
                Button("Bearbeiten") { compose = ComposeRequest(kind: block.blockKind, editing: block) }
                    .buttonStyle(QuillOutlineButtonStyle(height: 34, fontSize: 13.5, weight: .medium))
            }
            if moderator {
                Button("Ablehnen") { Task { await boards.reject(block, in: board) } }
                    .buttonStyle(QuillOutlineButtonStyle(height: 34, fontSize: 13.5, weight: .medium))
            } else if block.author == me {
                Button("Zurückziehen") { Task { await boards.withdraw(block, in: board) } }
                    .buttonStyle(QuillOutlineButtonStyle(height: 34, fontSize: 13.5, weight: .medium))
            }
        }
    }

    // MARK: Abstimmung

    @ViewBuilder
    private func pollsTab(_ board: Board) -> some View {
        let polls = (boards.polls[boardID] ?? []).reversed()
        if polls.isEmpty {
            Text(moderator ? "Noch keine Abstimmung. Wähle unter „Vorschläge“ mindestens zwei Beiträge aus." : "Noch keine Abstimmung.")
                .font(.work(15)).foregroundStyle(Quill.faint).padding(.top, 8)
        }
        ForEach(Array(polls)) { poll in
            pollCard(poll, board)
        }
    }

    private func pollCard(_ poll: BoardPoll, _ board: Board) -> some View {
        let shares = BoardLogic.shares(poll: poll, counts: boards.counts[boardID] ?? [])
        let mine = (boards.myVotes[boardID] ?? []).first { $0.pollId == poll.id }?.blockId
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(poll.question).font(.work(16.5, .semibold)).foregroundStyle(Quill.ink)
                Spacer(minLength: 8)
                Text(poll.isOpen ? "OFFEN" : "BEENDET").font(.mono(10, .medium)).tracking(0.6).foregroundStyle(Quill.faint)
            }
            ForEach(poll.optionIDs, id: \.self) { id in
                if let block = blocks.first(where: { $0.id == id }) {
                    optionRow(block, poll: poll, board: board, shares: shares, mine: mine)
                }
            }
            Text("\(shares.total) Stimmen").font(.mono(10.5, .medium)).foregroundStyle(Quill.faint)
            if poll.isOpen, moderator {
                Button("Abstimmung beenden und Gewinner übernehmen") { Task { await boards.closePoll(poll, in: board) } }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 38, fontSize: 14))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }

    private func optionRow(
        _ block: BoardBlock, poll: BoardPoll, board: Board, shares: (votes: [UUID: Int], percent: [UUID: Int], total: Int), mine: UUID?
    ) -> some View {
        let percent = shares.percent[block.id] ?? 0
        let isMine = mine == block.id
        let isWinner = poll.winner == block.id
        return Button {
            guard poll.isOpen else { return }
            Task { await boards.vote(poll, for: block.id, in: board) }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(block.title.isEmpty ? block.blockKind.title : block.title)
                        .font(.work(14.5, .semibold)).foregroundStyle(Quill.ink)
                    Spacer(minLength: 8)
                    if isMine { Image(systemName: "checkmark.circle.fill").foregroundStyle(Quill.accent) }
                    if isWinner { Text("ÜBERNOMMEN").font(.mono(10, .medium)).foregroundStyle(Quill.link) }
                    Text("\(percent) %").font(.mono(12, .medium)).foregroundStyle(Quill.muted)
                }
                if !block.body.isEmpty {
                    Text(block.body).font(.work(14)).foregroundStyle(Quill.ink2).multilineTextAlignment(.leading)
                }
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Quill.hover)
                        Capsule().fill(isMine || isWinner ? Quill.accent : Quill.line3)
                            .frame(width: geometry.size.width * CGFloat(percent) / 100)
                    }
                }
                .frame(height: 6)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Quill.bg, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(isMine ? Quill.accent : Quill.line, lineWidth: isMine ? 2 : 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: Verlauf

    @ViewBuilder
    private func historyTab(_ board: Board) -> some View {
        let list = boards.versions[boardID] ?? []
        Text("Jede Übernahme speichert eine Version. Ein Moderator kann zu einer früheren zurückkehren.")
            .font(.work(14.5)).foregroundStyle(Quill.muted)
        if list.isEmpty {
            Text("Noch keine Versionen.").font(.work(15)).foregroundStyle(Quill.faint)
        }
        ForEach(list) { version in
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(version.label).font(.work(15, .medium)).foregroundStyle(Quill.ink)
                    Text("\(Social.timeLabel(version.createdAt)) · \(version.profiles?.displayName ?? "")")
                        .font(.mono(10.5, .medium)).foregroundStyle(Quill.faint)
                }
                Spacer(minLength: 8)
                if moderator, board.isOpen {
                    Button("Wiederherstellen") { Task { await boards.restore(version, in: board) } }
                        .buttonStyle(QuillOutlineButtonStyle(height: 32, fontSize: 13, weight: .medium))
                }
            }
            .padding(.vertical, 8)
            QuillDivider(color: Quill.lineSoft)
        }
    }
}

// MARK: Pieces

/// One building block on the board or among the proposals.
private struct BlockCard<Actions: View>: View {
    let block: BoardBlock
    let mine: Bool
    var replacedTitle: String?
    var hasMenu = true
    @ViewBuilder var actions: Actions

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                PixelCaption(text: block.blockKind.title, color: Quill.accent)
                Spacer(minLength: 8)
                if hasMenu {
                    Menu {
                        actions
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Quill.faint)
                            .frame(width: 32, height: 24)
                    }
                }
            }
            if let replacedTitle {
                Text("Korrektur zu „\(replacedTitle)“").font(.work(12.5, .medium)).foregroundStyle(Quill.link)
            }
            if !block.title.isEmpty {
                Text(block.title).font(.work(17, .semibold)).foregroundStyle(Quill.ink)
            }
            if !block.body.isEmpty {
                Text(block.body)
                    .font(block.blockKind.wantsSymbols ? .system(size: 16.5, design: .monospaced) : .work(15.5))
                    .lineSpacing(4)
                    .foregroundStyle(Quill.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let path = block.attachmentPath {
                BoardImage(path: path)
            }
            Text("\(mine ? "Du" : block.authorName) · \(Social.timeLabel(block.createdAt))")
                .font(.mono(10.5, .medium))
                .foregroundStyle(Quill.faint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }
}

/// A picture from the group's folder, downloaded once.
private struct BoardImage: View {
    let path: String
    @State private var image: UIImage?
    @State private var failed = false
    private static let cache = NSCache<NSString, UIImage>()

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            } else if failed {
                Text("Das Bild lässt sich nicht laden.").font(.work(13)).foregroundStyle(Quill.faint)
            } else {
                ProgressView().frame(maxWidth: .infinity, minHeight: 80)
            }
        }
        .task(id: path) {
            if let cached = Self.cache.object(forKey: path as NSString) {
                image = cached
                return
            }
            guard let url = await SocialStore.shared.download(path: path, name: "skizze.jpg"),
                  let loaded = UIImage(contentsOfFile: url.path)
            else {
                failed = true
                return
            }
            Self.cache.setObject(loaded, forKey: path as NSString)
            image = loaded
        }
    }
}

/// The kinds of contribution as buttons that wrap onto several lines.
private struct FlowButtons: View {
    let kinds: [BlockKind]
    let pick: (BlockKind) -> Void

    var body: some View {
        WrapLayout(spacing: 8) {
            ForEach(kinds) { kind in
                Button { pick(kind) } label: {
                    Text("+ \(kind.title)")
                        .font(.work(14, .medium))
                        .foregroundStyle(Quill.ink)
                        .padding(.horizontal, 14)
                        .frame(height: 36)
                        .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct WrapLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 600
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: Writing a contribution

private struct ComposeSheet: View {
    let board: Board
    let request: ComposeRequest
    let moderator: Bool
    @ObservedObject private var boards = BoardStore.shared
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var text: String
    @State private var image: Data?
    @State private var showPhotos = false
    @State private var picked: PhotosPickerItem?

    private static let symbols = ["∫", "∑", "√", "π", "±", "×", "·", "÷", "≤", "≥", "≠", "≈", "→", "⇌", "∞", "Δ", "α", "β", "θ", "²", "³", "ⁿ", "₀", "₁", "₂", "ₐ", "ᵦ"]

    init(board: Board, request: ComposeRequest, moderator: Bool) {
        self.board = board
        self.request = request
        self.moderator = moderator
        let source = request.editing ?? request.replacing
        _title = State(initialValue: source?.title ?? "")
        _text = State(initialValue: source?.body ?? "")
    }

    private var heading: String {
        if request.editing != nil { return "\(request.kind.title) bearbeiten" }
        if request.replacing != nil { return "Korrektur vorschlagen" }
        return request.kind.title
    }

    private var canSend: Bool {
        let hasText = !title.trimmingCharacters(in: .whitespaces).isEmpty || !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return (hasText || image != nil) && !boards.busy
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            PixelCaption(text: heading)
            QuillField(title: request.kind.titleHint, text: $title)
            TextEditor(text: $text)
                .font(request.kind.wantsSymbols ? .system(size: 16.5, design: .monospaced) : .work(16))
                .scrollContentBackground(.hidden)
                .padding(10)
                .frame(minHeight: 140, maxHeight: 240)
                .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            if request.kind.wantsSymbols {
                ScrollView(.horizontal) {
                    HStack(spacing: 6) {
                        ForEach(Self.symbols, id: \.self) { symbol in
                            Button { text += symbol } label: {
                                Text(symbol)
                                    .font(.system(size: 18))
                                    .foregroundStyle(Quill.ink)
                                    .frame(width: 38, height: 38)
                                    .background(Quill.surface, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Quill.line2, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
            if request.kind == .sketch, request.editing == nil {
                HStack(spacing: 10) {
                    Button(image == nil ? "Foto hinzufügen" : "Foto ersetzen") { showPhotos = true }
                        .buttonStyle(QuillOutlineButtonStyle(height: 38, fontSize: 14, weight: .medium))
                    if image != nil { Text("Foto gewählt").font(.work(13.5)).foregroundStyle(Quill.muted) }
                }
            }
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                Button(request.editing != nil ? "Speichern" : "Vorschlagen") { send(acceptNow: false) }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 46, fontSize: 15.5))
                if moderator, request.editing == nil, board.isOpen {
                    Button("Direkt übernehmen") { send(acceptNow: true) }
                        .buttonStyle(QuillOutlineButtonStyle(height: 46, fontSize: 15.5, weight: .medium))
                }
            }
            .disabled(!canSend)
        }
        .padding(24)
        .presentationDetents([.large])
        .presentationBackground(Quill.bg)
        .photosPicker(isPresented: $showPhotos, selection: $picked, matching: .images)
        .onChange(of: picked) { _, item in
            guard let item else { return }
            picked = nil
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) { image = BoardExport.jpeg(from: data) }
            }
        }
    }

    private func send(acceptNow: Bool) {
        Task {
            let done: Bool
            if let editing = request.editing {
                done = await boards.edit(editing, title: title, body: text, in: board)
            } else {
                done = await boards.propose(
                    to: board, kind: request.kind, title: title, body: text, replacing: request.replacing?.id, image: image, acceptNow: acceptNow
                )
            }
            if done { dismiss() }
        }
    }
}
