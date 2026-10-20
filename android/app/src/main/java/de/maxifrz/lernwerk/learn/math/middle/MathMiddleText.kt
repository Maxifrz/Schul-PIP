package de.maxifrz.lernwerk.learn.math.middle

// Maths text the way a student reads it in the app: minus (U+2212), the decimal comma, superscript powers.
// A port of MathMiddleText (MathMiddleText.swift and the extensions of MathMiddleSupport.swift).

object MathMiddleText {
    const val minus = "−"

    /** "-5" with the real minus sign, "0", "12". */
    fun int(n: Int): String = if (n < 0) minus + (-n).toString() else n.toString()

    /** With the sign in front, also for plus: "+5", minus 5. */
    fun signed(n: Int): String = if (n < 0) minus + (-n).toString() else "+$n"

    private fun unicodeMinus(text: String): String = text.replace("-", minus)

    /** A fraction as "3/4" or "-3/4", a whole number as "2". */
    fun fraction(q: MathMiddleQ): String = unicodeMinus(q.value.fractionText)

    /** A number with the decimal comma when its decimal ends ("0,75"), else a fraction ("1/3"). */
    fun number(q: MathMiddleQ): String = unicodeMinus(q.value.germanText)

    /** A mixed number "2 3/5"; a proper fraction or a whole number as is. */
    fun mixed(q: MathMiddleQ): String {
        val value = q.value
        val n = value.numerator
        val d = value.denominator
        if (value.isWhole || !(Math.abs(n) > d)) return fraction(q)
        val whole = Math.abs(n) / d
        val rest = Math.abs(n) % d
        return (if (n < 0) minus else "") + "$whole $rest/$d"
    }

    /** A fraction with the numerator and denominator as given, not reduced. */
    fun fraction(numerator: Int, denominator: Int): String = int(numerator) + "/" + denominator.toString()

    private val superscripts = mapOf(
        '0' to '⁰', '1' to '¹', '2' to '²', '3' to '³', '4' to '⁴', '5' to '⁵', '6' to '⁶', '7' to '⁷', '8' to '⁸',
        '9' to '⁹', '-' to '⁻',
    )
    private val subscripts = mapOf(
        '0' to '₀', '1' to '₁', '2' to '₂', '3' to '₃', '4' to '₄', '5' to '₅', '6' to '₆', '7' to '₇', '8' to '₈',
        '9' to '₉',
    )

    /** An exponent in superscript digits: 2 gives "²". */
    fun sup(n: Int): String = n.toString().map { superscripts[it] ?: it }.joinToString("")

    /** An index in subscript digits. */
    fun sub(n: Int): String = n.toString().map { subscripts[it] ?: it }.joinToString("")

    /** "3⁴", "(-2)³": a negative base gets brackets. */
    fun power(base: Int, exponent: Int): String = (if (base < 0) "(" + int(base) + ")" else base.toString()) + sup(exponent)

    /** A power of a letter or a bracket: "x³". */
    fun power(base: String, exponent: Int): String = base + sup(exponent)

    private fun monomial(coefficient: Int, variable: String): String {
        if (variable.isEmpty()) return int(coefficient)
        return when (coefficient) {
            1 -> variable
            -1 -> minus + variable
            else -> int(coefficient) + variable
        }
    }

    /** A polynomial from its coefficients, the highest power first. Zero terms are left out; all zero gives "0". */
    fun polynomial(coefficients: List<Int>, variable: String = "x"): String {
        var text = ""
        val top = coefficients.size - 1
        coefficients.forEachIndexed { index, coefficient ->
            if (coefficient == 0) return@forEachIndexed
            val p = top - index
            val name = if (p == 0) "" else if (p == 1) variable else variable + sup(p)
            val piece = monomial(Math.abs(coefficient), name)
            text = if (text.isEmpty()) (if (coefficient < 0) minus else "") + piece
            else text + (if (coefficient < 0) " $minus " else " + ") + piece
        }
        return if (text.isEmpty()) "0" else text
    }

    fun linear(a: Int, b: Int, variable: String = "x"): String = polynomial(listOf(a, b), variable)

    fun line(m: Int, b: Int): String = "y = " + linear(m, b)

    /** A term with a bracket: "3(x - 4)" from the factor and the bracket content. */
    fun bracket(factor: Int, inside: String): String =
        (if (factor == 1) "" else if (factor == -1) minus else int(factor)) + "(" + inside + ")"

    /** The decimal text of a number with exactly `places` digits after the comma. */
    fun fixed(q: MathMiddleQ, places: Int): String {
        var scale = 1L
        repeat(places) { scale *= 10 }
        val scaled = q.value.numerator * scale / q.value.denominator
        val sign = if (scaled < 0) minus else ""
        var digits = Math.abs(scaled).toString()
        while (digits.length <= places) digits = "0$digits"
        val cut = digits.length - places
        return if (places == 0) sign + digits else sign + digits.substring(0, cut) + "," + digits.substring(cut)
    }

    fun euro(q: MathMiddleQ): String = fixed(q, 2) + " €"

    /** A price: "92 €" when it is a whole number of euros, else with cents ("37,50 €"). */
    fun euroAmount(q: MathMiddleQ): String {
        if (q.isWhole) return int(q.numerator) + " €"
        return if (100 % q.denominator == 0) euro(q) else number(q) + " €"
    }

    fun gcd(a: Int, b: Int): Int {
        var x = Math.abs(a)
        var y = Math.abs(b)
        while (y != 0) { val t = x % y; x = y; y = t }
        return x
    }

    fun lcm(a: Int, b: Int): Int = a / gcd(a, b) * b

    /** A quantity the way it is written in a text: with the decimal comma when that ends, else as a mixed number. */
    fun amount(q: MathMiddleQ): String {
        val decimal = number(q)
        return if (decimal.contains("/")) mixed(q) else decimal
    }

    /** A list the German way: "a", "a und b", "a, b und c". */
    fun listed(items: List<String>): String {
        val last = items.lastOrNull() ?: return ""
        if (items.size <= 1) return last
        return items.dropLast(1).joinToString(", ") + " und " + last
    }

    /** A number in a calculation: a negative one gets brackets. */
    fun bracketed(n: Int): String = if (n < 0) "(" + int(n) + ")" else n.toString()

    /** A whole number with a thin space between the thousands: 50 000. */
    fun grouped(n: Int): String {
        val digits = Math.abs(n.toLong()).toString()
        val result = StringBuilder(if (n < 0) minus else "")
        digits.forEachIndexed { index, character ->
            if (index > 0 && (digits.length - index) % 3 == 0) result.append(' ')
            result.append(character)
        }
        return result.toString()
    }

    /** A sum or difference with the sign in front of the second summand: "x + 3", "x - 3". */
    fun plusMinus(n: Int): String = if (n < 0) "$minus ${-n}" else "+ $n"
}
