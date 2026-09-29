import SwiftUI

/// How slides and elements move while presenting. The planning (which step shows what) is `MotionPlanner`; this maps
/// the chosen effects to SwiftUI transitions.
enum PresentEffects {
    /// The side new content comes from.
    static func edge(_ direction: MotionDirection) -> Edge {
        switch direction {
        case .left: return .leading
        case .right: return .trailing
        case .up: return .top
        case .down: return .bottom
        }
    }

    private static func opposite(_ direction: MotionDirection) -> Edge {
        switch direction {
        case .left: return .trailing
        case .right: return .leading
        case .up: return .bottom
        case .down: return .top
        }
    }

    /// How a slide comes in. A slide without a transition keeps the short cross-fade the presenter always had.
    static func transition(_ slide: Slide) -> AnyTransition {
        guard let setting = slide.transition else { return .opacity }
        switch setting.kind {
        case .none: return .identity
        case .fade: return .opacity
        case .push: return .asymmetric(insertion: .move(edge: edge(setting.direction)), removal: .move(edge: opposite(setting.direction)))
        case .cover: return .asymmetric(insertion: .move(edge: edge(setting.direction)), removal: .opacity)
        case .zoom: return .asymmetric(insertion: .scale(scale: 0.6).combined(with: .opacity), removal: .opacity)
        }
    }

    static func animation(_ slide: Slide?) -> Animation? {
        guard let setting = slide?.transition else { return .easeInOut(duration: 0.2) }
        return setting.kind == .none ? nil : .easeInOut(duration: setting.seconds)
    }

    /// How an element comes in.
    static func entrance(_ element: SlideElement, _ animation: ElementAnimation) -> AnyTransition {
        switch animation.kind {
        case .appear:
            return .opacity
        case .fade:
            return .opacity
        case .fly:
            return AnyTransition.move(edge: edge(animation.direction)).combined(with: .opacity)
        case .zoom:
            let anchor = UnitPoint(x: element.centerX / SlideSize.width, y: element.centerY / SlideSize.height)
            return AnyTransition.scale(scale: 0.2, anchor: anchor).combined(with: .opacity)
        case .wipe:
            return .modifier(active: WipeModifier(progress: 0, direction: animation.direction), identity: WipeModifier(progress: 1, direction: animation.direction))
        }
    }

    static func animation(_ animation: ElementAnimation) -> Animation {
        if animation.kind == .appear { return Animation.linear(duration: 0.01).delay(animation.delaySeconds) }
        return Animation.easeInOut(duration: animation.seconds).delay(animation.delaySeconds)
    }
}

/// Reveals a view from one side, as PowerPoint's wipe does.
private struct WipeModifier: ViewModifier, Animatable {
    var progress: Double
    let direction: MotionDirection

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    private var alignment: Alignment {
        switch direction {
        case .left: return .leading
        case .right: return .trailing
        case .up: return .top
        case .down: return .bottom
        }
    }

    private var horizontal: Bool { direction == .left || direction == .right }

    func body(content: Content) -> some View {
        content.mask {
            GeometryReader { proxy in
                Rectangle()
                    .frame(
                        width: horizontal ? proxy.size.width * progress : proxy.size.width,
                        height: horizontal ? proxy.size.height : proxy.size.height * progress
                    )
                    .frame(width: proxy.size.width, height: proxy.size.height, alignment: alignment)
            }
        }
    }
}

/// A slide as it looks after `steps` of its click steps. Fixed elements are always there; the others come in with their
/// own effect when their step is played. Stacking order is the slide's own.
struct PresentSlideView: View {
    let slide: Slide
    let theme: SlideTheme
    let images: [String: UIImage]
    let index: Int
    let steps: Int

    var body: some View {
        if MotionPlanner.timeline(slide).isEmpty {
            SlideCanvas(slide: slide, theme: theme, images: images, index: index)
        } else {
            let layers = MotionPlanner.layers(slide)
            let animations = Dictionary(
                slide.elements.compactMap { element in element.animation.map { (element.id, $0) } },
                uniquingKeysWith: { first, _ in first }
            )
            ZStack {
                SlideCanvas(slide: backdrop, theme: theme, images: images, index: index)
                ForEach(Array(layers.enumerated()), id: \.offset) { _, layer in
                    switch layer {
                    case let .fixed(elements):
                        SlideCanvas(slide: only(elements), theme: theme, images: images, index: index, layerOnly: true)
                    case let .animated(element, step):
                        AnimatedLayer(
                            element: element,
                            animation: animations[element.id] ?? ElementAnimation(),
                            visible: step < steps
                        ) {
                            SlideCanvas(slide: only([element]), theme: theme, images: images, index: index, layerOnly: true)
                        }
                    }
                }
            }
            .clipped()
        }
    }

    /// The background and decorations alone.
    private var backdrop: Slide { only([]) }

    private func only(_ elements: [SlideElement]) -> Slide {
        var copy = slide
        copy.elements = elements
        return copy
    }
}

private struct AnimatedLayer<Content: View>: View {
    let element: SlideElement
    let animation: ElementAnimation
    let visible: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        ZStack {
            if visible {
                content().transition(PresentEffects.entrance(element, animation))
            }
        }
        .animation(PresentEffects.animation(animation), value: visible)
    }
}
