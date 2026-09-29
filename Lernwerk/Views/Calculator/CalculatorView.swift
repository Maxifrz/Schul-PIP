import SwiftUI
import UIKit

/// The calculator tab: the calculator app (CAS, graphics, sliders and animations) in a web view. A graphic it exports
/// goes into a document of the library as a new page.
struct CalculatorView: View {
    @ObservedObject private var host = MatheHost.shared

    var body: some View {
        MatheWebView()
            .ignoresSafeArea(.keyboard)
            .sheet(item: $host.pendingImage, onDismiss: { host.cancelPendingImage() }) { pending in
                DocumentChooser { material in
                    host.insert(pending, into: material)
                }
            }
    }
}
