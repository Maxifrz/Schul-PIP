package de.maxifrz.lernwerk.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.withInfiniteAnimationFrameMillis
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Small uppercase label in the pixel font, used above titles and sections. */
@Composable
fun PixelCaption(text: String, modifier: Modifier = Modifier, color: Color = Quill.colors.hint, size: Float = 10f) {
    QText(text.uppercase(), pixel(size), color, modifier)
}

@Composable
fun QText(
    text: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    maxLines: Int = Int.MAX_VALUE,
    textAlign: androidx.compose.ui.text.style.TextAlign? = null,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = style.copy(color = color, textAlign = textAlign ?: style.textAlign),
        maxLines = maxLines,
        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
    )
}

/** Caption, large light title and an optional action, as at the top of every tab. */
@Composable
fun PageHeader(caption: String, title: String, modifier: Modifier = Modifier, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            PixelCaption(caption)
            QText(title, work(40f, FontWeight.Light, tracking = -1.1f), Quill.colors.ink)
        }
        trailing()
    }
}

/** Centered reading column with the prototype's generous margins. */
@Composable
fun ContentColumn(maxWidth: Dp = 760.dp, top: Dp = 44.dp, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(
            Modifier
                .widthIn(max = maxWidth + 80.dp)
                .fillMaxWidth()
                .padding(start = 40.dp, end = 40.dp, top = top, bottom = 60.dp),
            content = content,
        )
    }
}

/** Back button, centered title and a trailing slot, for pushed screens. */
@Composable
fun DetailHeader(backTitle: String, title: String, onBack: () -> Unit, trailing: @Composable RowScope.() -> Unit = {}) {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .padding(top = 6.dp, bottom = 10.dp)
            .height(38.dp),
    ) {
        QText(
            title,
            work(16f, FontWeight.Medium, tracking = -0.24f),
            Quill.colors.ink,
            Modifier.align(Alignment.Center).padding(horizontal = 180.dp),
            maxLines = 1,
        )
        Row(Modifier.fillMaxWidth().align(Alignment.Center), verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier
                    .height(38.dp)
                    .pressable(CircleShape, onClick = onBack)
                    .padding(start = 10.dp, end = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Chevron(left = true, color = Quill.colors.ink, size = 16.dp)
                QText(backTitle, work(15f), Quill.colors.muted)
            }
            Spacer(Modifier.weight(1f))
            trailing()
        }
    }
    QuillDivider(Quill.colors.lineSoft)
}

@Composable
fun QuillDivider(color: Color = Quill.colors.line, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(color))
}

/** Background highlight while pressed, like the iOS press style. */
@Composable
fun Modifier.pressable(
    shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(0.dp),
    enabled: Boolean = true,
    onClick: () -> Unit,
): Modifier {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    return this
        .background(if (pressed) Quill.colors.hoverSoft else Color.Transparent, shape)
        .clickable(interaction, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
}

/** Filled ink capsule, the primary action. */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 44.dp,
    fontSize: Float = 15f,
    enabled: Boolean = true,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    Box(
        modifier
            .height(height)
            .alpha(if (enabled) (if (pressed) 0.85f else 1f) else 0.4f)
            .background(Quill.colors.ink, CircleShape)
            .clickable(interaction, null, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = height * 0.46f),
        contentAlignment = Alignment.Center,
    ) {
        QText(text, work(fontSize, FontWeight.Medium, tracking = -fontSize * 0.01f), Quill.colors.bg, maxLines = 1)
    }
}

/** Hairline capsule for secondary actions. */
@Composable
fun OutlineButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 34.dp,
    fontSize: Float = 13.5f,
    weight: FontWeight = FontWeight.Normal,
    enabled: Boolean = true,
    leading: (@Composable () -> Unit)? = null,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    Row(
        modifier
            .height(height)
            .alpha(if (enabled) 1f else 0.4f)
            .background(if (pressed) Quill.colors.hover else Color.Transparent, CircleShape)
            .border(1.dp, Quill.colors.line2, CircleShape)
            .clickable(interaction, null, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        leading?.invoke()
        QText(text, work(fontSize, weight), Quill.colors.ink, maxLines = 1)
    }
}

/** Text-only link button. */
@Composable
fun LinkButton(text: String, onClick: () -> Unit, color: Color = Quill.colors.link, style: TextStyle = work(15f, FontWeight.Medium)) {
    QText(text, style, color, Modifier.pressable(RoundedCornerShape(6.dp), onClick = onClick).padding(4.dp))
}

@Composable
fun StatusDot(color: Color = Quill.colors.accent, size: Dp = 6.dp) {
    Box(Modifier.size(size).background(color, CircleShape))
}

/** Round check used for topics and material selection. */
@Composable
fun CheckCircle(isOn: Boolean, size: Dp = 22.dp) {
    val colors = Quill.colors
    val fill by animateColorAsState(if (isOn) colors.accent else Color.Transparent, tween(200), label = "check")
    val ring by animateColorAsState(if (isOn) colors.accent else colors.line3, tween(200), label = "ring")
    Canvas(Modifier.size(size)) {
        drawCircle(fill)
        drawCircle(ring, radius = this.size.minDimension / 2 - 0.75.dp.toPx(), style = Stroke(1.5.dp.toPx()))
        if (isOn) {
            val w = this.size.width
            val path = androidx.compose.ui.graphics.Path().apply {
                moveTo(w * 0.29f, w * 0.52f)
                lineTo(w * 0.44f, w * 0.66f)
                lineTo(w * 0.71f, w * 0.37f)
            }
            drawPath(path, colors.onAccent, style = Stroke(w * 0.1f, cap = StrokeCap.Round))
        }
    }
}

/** Thin progress bar in the accent color. */
@Composable
fun QuillProgressBar(fraction: Float, modifier: Modifier = Modifier) {
    val animated by animateFloatAsState(fraction.coerceIn(0f, 1f), tween(300), label = "progress")
    val colors = Quill.colors
    Canvas(modifier.fillMaxWidth().height(4.dp)) {
        val radius = CornerRadius(size.height / 2)
        drawRoundRect(colors.line, cornerRadius = radius)
        drawRoundRect(colors.accent, size = Size(size.width * animated, size.height), cornerRadius = radius)
    }
}

/** Three pulsing accent dots, the Quill loading indicator. */
@Composable
fun PulsingDots(size: Dp = 5.dp) {
    var millis by remember { mutableLongStateOf(0L) }
    LaunchedEffect(Unit) {
        while (true) withInfiniteAnimationFrameMillis { millis = it }
    }
    val accent = Quill.colors.accent
    Canvas(Modifier.size(width = size * 5, height = size)) {
        val dot = size.toPx()
        for (index in 0 until 3) {
            val t = ((millis / 1000.0 - index * 0.18) % 1.1 / 1.1).let { if (it < 0) it + 1 else it }
            val opacity = when {
                t < 0.3 -> 0.22 + t / 0.3 * 0.78
                t < 0.6 -> 1 - (t - 0.3) / 0.3 * 0.78
                else -> 0.22
            }
            drawCircle(accent.copy(alpha = opacity.toFloat()), dot / 2, Offset(dot / 2 + index * dot * 2, dot / 2))
        }
    }
}

/** Settings-style row: label left, control right, hairline below. */
@Composable
fun QuillRow(label: String, verticalPadding: Dp = 12.dp, trailing: @Composable RowScope.() -> Unit) {
    Column {
        Row(
            Modifier.fillMaxWidth().heightIn(min = 44.dp).padding(vertical = verticalPadding, horizontal = 2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            QText(label, work(15.5f), Quill.colors.ink)
            Spacer(Modifier.weight(1f))
            trailing()
        }
        QuillDivider()
    }
}

/** Footnote below a section. */
@Composable
fun Footnote(text: String) {
    QText(text, work(12.5f, lineHeight = 18f), Quill.colors.faint, Modifier.padding(top = 10.dp, start = 2.dp, end = 2.dp))
}

/** Capsule switch in the accent color. */
@Composable
fun QuillSwitch(checked: Boolean, onChange: (Boolean) -> Unit) {
    val colors = Quill.colors
    val track by animateColorAsState(if (checked) colors.accent else colors.line2, tween(200), label = "track")
    val offset by animateFloatAsState(if (checked) 1f else 0f, tween(200), label = "thumb")
    Canvas(
        Modifier
            .size(width = 50.dp, height = 30.dp)
            .clickable(remember { MutableInteractionSource() }, null, role = Role.Switch) { onChange(!checked) },
    ) {
        drawRoundRect(track, cornerRadius = CornerRadius(size.height / 2))
        val inset = 2.dp.toPx()
        val radius = size.height / 2 - inset
        drawCircle(Color.White, radius, Offset(inset + radius + offset * (size.width - 2 * inset - 2 * radius), size.height / 2))
    }
}

/** Chevron drawn as two strokes, instead of pulling in an icon font. */
@Composable
fun Chevron(left: Boolean = false, color: Color = Quill.colors.hint, size: Dp = 12.dp) {
    Canvas(Modifier.size(size)) {
        val w = this.size.width
        val path = androidx.compose.ui.graphics.Path().apply {
            if (left) {
                moveTo(w * 0.65f, w * 0.12f); lineTo(w * 0.3f, w * 0.5f); lineTo(w * 0.65f, w * 0.88f)
            } else {
                moveTo(w * 0.35f, w * 0.12f); lineTo(w * 0.7f, w * 0.5f); lineTo(w * 0.35f, w * 0.88f)
            }
        }
        drawPath(path, color, style = Stroke(w * 0.13f, cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}

/** Warning dot with a message, used for errors and notices. */
@Composable
fun Notice(text: String, color: Color = Quill.colors.warn, textColor: Color = Quill.colors.ink2, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        Box(Modifier.padding(top = 7.dp)) { StatusDot(color) }
        QText(text, work(14f, lineHeight = 20f), textColor)
    }
}
