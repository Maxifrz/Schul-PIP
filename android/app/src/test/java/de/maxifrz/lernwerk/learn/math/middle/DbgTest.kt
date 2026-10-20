package de.maxifrz.lernwerk.learn.math.middle
import org.junit.Test
class DbgTest {
    @Test fun dbg() {
        System.setProperty("mmdebug", "1")
        val node = mathMiddleProvider.course.nodes.first { it.id == "mathm.u07.l2" }
        mathMiddleProvider.exercises(node, 1uL)
    }
}
