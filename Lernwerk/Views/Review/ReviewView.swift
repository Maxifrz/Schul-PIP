import SwiftUI

/// The Lernen tab: courses with a path of lessons, quests, and the review of the student's own cards.
struct ReviewView: View {
    let select: (AppTab) -> Void

    var body: some View {
        LearnHomeView(select: select)
    }
}
