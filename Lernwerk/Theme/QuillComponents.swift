import SwiftUI

/// Small uppercase label in the pixel font, used above titles and sections.
struct PixelCaption: View {
    let text: String
    var color: Color = Quill.hint
    var size: CGFloat = 10

    var body: some View {
        Text(text.uppercased())
            .font(.pixel(size))
            .tracking(size * 0.1)
            .foregroundStyle(color)
    }
}

/// Caption, large light title and an optional action, as at the top of every tab.
struct PageHeader<Trailing: View>: View {
    let caption: String
    let title: String
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(alignment: .bottom, spacing: 20) {
            VStack(alignment: .leading, spacing: 14) {
                PixelCaption(text: caption)
                Text(title)
                    .font(.work(40, .light))
                    .tracking(-1.1)
                    .foregroundStyle(Quill.ink)
            }
            Spacer(minLength: 0)
            trailing
        }
    }
}

extension PageHeader where Trailing == EmptyView {
    init(caption: String, title: String) {
        self.init(caption: caption, title: title) { EmptyView() }
    }
}

/// Centered reading column with the prototype's generous margins.
struct ContentColumn<Content: View>: View {
    var maxWidth: CGFloat = 760
    var top: CGFloat = 44
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .frame(maxWidth: maxWidth, alignment: .leading)
        .padding(.horizontal, 40)
        .padding(.top, top)
        .padding(.bottom, 60)
        .frame(maxWidth: .infinity)
    }
}

/// Back button, centered title and a trailing slot, for pushed screens.
struct DetailHeader<Trailing: View>: View {
    let backTitle: String
    let title: String
    let onBack: () -> Void
    @ViewBuilder var trailing: Trailing

    var body: some View {
        ZStack {
            Text(title)
                .font(.work(16, .medium))
                .tracking(-0.24)
                .foregroundStyle(Quill.ink)
                .lineLimit(1)
                .padding(.horizontal, 180)
            HStack {
                Button(action: onBack) {
                    HStack(spacing: 8) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 17, weight: .medium))
                            .foregroundStyle(Quill.ink)
                        Text(backTitle)
                            .font(.work(15))
                            .foregroundStyle(Quill.muted)
                    }
                    .padding(.leading, 10)
                    .padding(.trailing, 12)
                    .frame(height: 38)
                    .contentShape(Capsule())
                }
                .buttonStyle(QuillPressStyle())
                Spacer()
                trailing
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 10)
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }
}

struct QuillDivider: View {
    var color: Color = Quill.line

    var body: some View {
        Rectangle().fill(color).frame(height: 1)
    }
}

/// Filled ink capsule, the primary action.
struct QuillPrimaryButtonStyle: ButtonStyle {
    var height: CGFloat = 44
    var fontSize: CGFloat = 15

    func makeBody(configuration: Configuration) -> some View {
        QuillPrimaryLabel(configuration: configuration, height: height, fontSize: fontSize)
    }

    private struct QuillPrimaryLabel: View {
        let configuration: Configuration
        let height: CGFloat
        let fontSize: CGFloat
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(.work(fontSize, .medium))
                .tracking(-fontSize * 0.01)
                .foregroundStyle(Quill.bg)
                .padding(.horizontal, height * 0.46)
                .frame(height: height)
                .background(Quill.ink, in: Capsule())
                .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.4)
        }
    }
}

/// Hairline capsule for secondary actions.
struct QuillOutlineButtonStyle: ButtonStyle {
    var height: CGFloat = 34
    var fontSize: CGFloat = 13.5
    var weight: QuillFont.Weight = .regular

    func makeBody(configuration: Configuration) -> some View {
        QuillOutlineLabel(configuration: configuration, height: height, fontSize: fontSize, weight: weight)
    }

    private struct QuillOutlineLabel: View {
        let configuration: Configuration
        let height: CGFloat
        let fontSize: CGFloat
        let weight: QuillFont.Weight
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(.work(fontSize, weight))
                .foregroundStyle(Quill.ink)
                .padding(.horizontal, 14)
                .frame(height: height)
                .background(configuration.isPressed ? Quill.hover : Color.clear, in: Capsule())
                .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
                .opacity(isEnabled ? 1 : 0.4)
        }
    }
}

/// Plain rows and links that only dim while pressed.
struct QuillPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Quill.hoverSoft : Color.clear)
            .contentShape(Rectangle())
    }
}

struct StatusDot: View {
    var color: Color = Quill.accent
    var size: CGFloat = 6

    var body: some View {
        Circle().fill(color).frame(width: size, height: size)
    }
}

/// Round check used for topics and material selection.
struct CheckCircle: View {
    let isOn: Bool
    var size: CGFloat = 22

    var body: some View {
        ZStack {
            Circle()
                .fill(isOn ? Quill.accent : Color.clear)
            Circle()
                .strokeBorder(isOn ? Quill.accent : Quill.line3, lineWidth: 1.5)
            if isOn {
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.45, weight: .bold))
                    .foregroundStyle(Quill.onAccent)
            }
        }
        .frame(width: size, height: size)
        .animation(.easeInOut(duration: 0.2), value: isOn)
    }
}

/// Thin progress bar in the accent color.
struct QuillProgressBar: View {
    let fraction: Double

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Quill.line)
                Capsule()
                    .fill(Quill.accent)
                    .frame(width: geometry.size.width * min(max(fraction, 0), 1))
            }
        }
        .frame(height: 4)
        .animation(.easeInOut(duration: 0.3), value: fraction)
    }
}

/// Three pulsing accent dots, the Quill loading indicator.
struct PulsingDots: View {
    var size: CGFloat = 5

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30)) { timeline in
            HStack(spacing: size) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Quill.accent)
                        .frame(width: size, height: size)
                        .opacity(Self.opacity(at: timeline.date, delay: Double(index) * 0.18))
                }
            }
        }
    }

    private static func opacity(at date: Date, delay: Double) -> Double {
        let period = 1.1
        let phase = (date.timeIntervalSinceReferenceDate - delay).truncatingRemainder(dividingBy: period) / period
        let t = phase < 0 ? phase + 1 : phase
        if t < 0.3 { return 0.22 + t / 0.3 * 0.78 }
        if t < 0.6 { return 1 - (t - 0.3) / 0.3 * 0.78 }
        return 0.22
    }
}

/// Settings-style row: label left, control right, hairline below.
struct QuillRow<Trailing: View>: View {
    let label: String
    var verticalPadding: CGFloat = 12
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: 14) {
            Text(label)
                .font(.work(15.5))
                .foregroundStyle(Quill.ink)
            Spacer(minLength: 8)
            trailing
        }
        .padding(.vertical, verticalPadding)
        .padding(.horizontal, 2)
        .overlay(alignment: .bottom) { QuillDivider() }
    }
}

extension View {
    /// Footnote below a section.
    func quillFootnote() -> some View {
        font(.work(12.5))
            .foregroundStyle(Quill.faint)
            .lineSpacing(3)
            .padding(.top, 10)
            .padding(.horizontal, 2)
            .fixedSize(horizontal: false, vertical: true)
    }
}
