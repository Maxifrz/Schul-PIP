package de.maxifrz.lernwerk.learn.math.middle
import de.maxifrz.lernwerk.learn.LearnExercise
import org.junit.Test
class DbgTest {
    @Test fun dbg() {
        for (s in listOf("5⁶", "5⁸", "5⁹", "5⁵", "a¹⁰", "5²", "5³")) System.err.println("DBG fold '$s' -> '${LearnExercise.folded(s)}'")
    }
}
