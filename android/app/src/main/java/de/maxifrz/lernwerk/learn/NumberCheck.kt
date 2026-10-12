package de.maxifrz.lernwerk.learn

import java.math.BigInteger

// Compares typed numbers by value: "0,75", "0.75" and "3/4" are the same answer, "34" is not.
// A port of NumberCheck.swift. Swift's Int is 64-bit and the arithmetic checks for overflow; here Long with exact
// arithmetic, and an overflow gives null.

private fun mulOrNull(a: Long, b: Long): Long? = try { Math.multiplyExact(a, b) } catch (e: ArithmeticException) { null }
private fun addOrNull(a: Long, b: Long): Long? = try { Math.addExact(a, b) } catch (e: ArithmeticException) { null }

private fun gcd(a: Long, b: Long): Long {
    var x = a
    var y = b
    while (y != 0L) {
        val t = x % y
        x = y
        y = t
    }
    return if (x > 1L) x else 1L
}

/** A fraction in lowest terms with a positive denominator, so equal numbers are equal values. */
class Rational private constructor(val numerator: Long, val denominator: Long) {
    val isWhole: Boolean get() = denominator == 1L
    val doubleValue: Double get() = numerator.toDouble() / denominator.toDouble()

    fun lessThan(other: Rational): Boolean {
        val left = mulOrNull(numerator, other.denominator)
        val right = mulOrNull(other.numerator, denominator)
        if (left == null || right == null) return doubleValue < other.doubleValue
        return left < right
    }

    operator fun plus(other: Rational): Rational? {
        val x = mulOrNull(numerator, other.denominator) ?: return null
        val y = mulOrNull(other.numerator, denominator) ?: return null
        val d = mulOrNull(denominator, other.denominator) ?: return null
        val n = addOrNull(x, y) ?: return null
        return make(n, d)
    }

    operator fun minus(other: Rational): Rational? {
        val negated = make(-other.numerator, other.denominator) ?: return null
        return this + negated
    }

    operator fun times(other: Rational): Rational? {
        val n = mulOrNull(numerator, other.numerator) ?: return null
        val d = mulOrNull(denominator, other.denominator) ?: return null
        return make(n, d)
    }

    operator fun div(other: Rational): Rational? {
        if (other.numerator == 0L) return null
        val inverse = make(other.denominator, other.numerator) ?: return null
        return this * inverse
    }

    /** "3/4", or "2" for a whole number. */
    val fractionText: String get() = if (isWhole) "$numerator" else "$numerator/$denominator"

    /** With the decimal comma when the fraction ends after at most six digits, else as a fraction ("1/3"). */
    val germanText: String
        get() {
            if (isWhole) return "$numerator"
            var rest = denominator
            var twos = 0
            var fives = 0
            while (rest % 2 == 0L) { rest /= 2; twos += 1 }
            while (rest % 5 == 0L) { rest /= 5; fives += 1 }
            val digits = maxOf(twos, fives)
            if (rest != 1L || digits > 6) return fractionText
            val scale = BigInteger.TEN.pow(digits)
            val scaled = BigInteger.valueOf(numerator) * (scale / BigInteger.valueOf(denominator))
            val sign = if (scaled.signum() < 0) "-" else ""
            var text = scaled.abs().toString()
            while (text.length <= digits) text = "0$text"
            val cut = text.length - digits
            return sign + text.substring(0, cut) + "," + text.substring(cut)
        }

    override fun equals(other: Any?): Boolean = other is Rational && numerator == other.numerator && denominator == other.denominator
    override fun hashCode(): Int = 31 * numerator.hashCode() + denominator.hashCode()
    override fun toString(): String = fractionText

    companion object {
        /** null for a zero denominator or Long.MIN_VALUE. */
        fun make(numerator: Long, denominator: Long): Rational? {
            if (denominator == 0L || numerator == Long.MIN_VALUE || denominator == Long.MIN_VALUE) return null
            val divisor = gcd(Math.abs(numerator), Math.abs(denominator))
            val sign = if (denominator < 0) -1L else 1L
            return Rational(sign * numerator / divisor, Math.abs(denominator) / divisor)
        }

        /** A whole number. */
        fun whole(value: Long): Rational = Rational(value, 1L)
    }
}

internal fun isWhitespaceChar(c: Char): Boolean = c.isWhitespace()

/** Swift's `.whitespacesAndNewlines` trim. */
internal fun String.trimWs(): String = this.trim { it.isWhitespace() || it == '﻿' }

object NumberCheck {
    private val asciiDigits = Regex("^[0-9]+$")

    /**
     * A whole number, a decimal fraction with comma or point, a fraction "a/b" or a mixed number "1 1/2", with a
     * sign, and a trailing percent or degree sign that is ignored. Nothing else: no letters, no terms.
     */
    fun parse(text: String): Rational? {
        var cleaned = text.trimWs()
        for (minus in listOf("−", "–", "—", "‐")) cleaned = cleaned.replace(minus, "-")
        cleaned = cleaned.replace(' ', ' ')
        while (cleaned.isNotEmpty()) {
            val last = cleaned.last()
            if (last == '%' || last == '°' || last == ' ') cleaned = cleaned.dropLast(1) else break
        }
        if (cleaned.isEmpty()) return null

        var negative = false
        if (cleaned.startsWith("-")) {
            negative = true
            cleaned = cleaned.substring(1)
        } else if (cleaned.startsWith("+")) {
            cleaned = cleaned.substring(1)
        }
        cleaned = cleaned.trim { it == ' ' || it == '\t' }

        val parts = cleaned.split(' ').filter { it.isNotEmpty() }
        var value: Rational? = null
        if (parts.size == 1) {
            value = parseUnsigned(parts[0])
        } else if (parts.size == 2) {
            // "1 1/2": a whole number and a proper fraction, nothing else.
            val whole = parseWhole(parts[0])
            if (whole != null && parts[1].contains('/')) {
                val fraction = parseUnsigned(parts[1])
                if (fraction != null && fraction.lessThan(Rational.whole(1))) value = Rational.whole(whole) + fraction
            }
        }
        if (value == null) return null
        return if (negative) Rational.make(-value.numerator, value.denominator) else value
    }

    fun matches(given: String, expected: String): Boolean {
        val a = parse(given) ?: return false
        val b = parse(expected) ?: return false
        return a == b
    }

    private fun parseWhole(text: String): Long? {
        if (text.isEmpty() || text.codePointCount(0, text.length) > 15 || !asciiDigits.matches(text)) return null
        return text.toLong()
    }

    private fun parseUnsigned(text: String): Rational? {
        val slash = text.indexOf('/')
        if (slash >= 0) {
            val n = parseDecimalOrWhole(text.substring(0, slash)) ?: return null
            val d = parseDecimalOrWhole(text.substring(slash + 1)) ?: return null
            return n / d
        }
        return parseDecimalOrWhole(text)
    }

    private fun parseDecimalOrWhole(text: String): Rational? {
        val unified = text.replace(',', '.')
        val pieces = unified.split('.')
        if (pieces.size > 2) return null
        val integer = pieces[0]
        if (integer.isEmpty() && pieces.size != 2) return null
        val whole = if (integer.isEmpty()) 0L else (parseWhole(integer) ?: return null)
        if (pieces.size != 2) return Rational.whole(whole)
        val fraction = pieces[1]
        if (fraction.isEmpty() || fraction.length > 9 || !asciiDigits.matches(fraction)) return null
        val digits = fraction.toLong()
        var scale = 1L
        repeat(fraction.length) { scale *= 10 }
        val top = mulOrNull(whole, scale) ?: return null
        val total = addOrNull(top, digits) ?: return null
        return Rational.make(total, scale)
    }
}
