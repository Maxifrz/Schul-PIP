package de.maxifrz.lernwerk.learn

// The registry of course providers. A port of `CourseCatalog` (CoursePath.swift) without the hard-coded list: each
// course module registers its provider once, so the logic core knows no course.
object CourseCatalog {
    private val registry = mutableListOf<CourseProvider>()
    private val lock = Any()

    /** Adds a provider; one with the same course id is replaced. */
    fun registerProvider(provider: CourseProvider) = synchronized(lock) {
        val index = registry.indexOfFirst { it.course.id == provider.course.id }
        if (index >= 0) registry[index] = provider else registry.add(provider)
    }

    /** For tests: forgets every registered provider. */
    fun clearProviders() = synchronized(lock) { registry.clear() }

    fun providers(): List<CourseProvider> = synchronized(lock) { registry.toList() }

    fun courses(): List<Course> = providers().map { it.course }

    fun provider(forCourse: String): CourseProvider? = providers().firstOrNull { it.course.id == forCourse }

    /** The provider whose course id is the node id's prefix up to a dot. */
    fun providerForNode(nodeID: String): CourseProvider? = providers().firstOrNull { nodeID.startsWith(it.course.id + ".") }
}
