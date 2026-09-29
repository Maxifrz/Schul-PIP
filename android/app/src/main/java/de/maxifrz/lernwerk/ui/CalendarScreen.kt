package de.maxifrz.lernwerk.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.ui.draw.alpha
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import de.maxifrz.lernwerk.data.Exam
import de.maxifrz.lernwerk.data.Repository
import de.maxifrz.lernwerk.data.Subjects
import de.maxifrz.lernwerk.data.TimetableEntry
import de.maxifrz.lernwerk.holidays.Bundesland
import de.maxifrz.lernwerk.holidays.CalendarDay
import de.maxifrz.lernwerk.holidays.ClockTime
import de.maxifrz.lernwerk.holidays.ExamCountdown
import de.maxifrz.lernwerk.holidays.HolidayCalendar
import de.maxifrz.lernwerk.holidays.PublicHoliday
import de.maxifrz.lernwerk.holidays.SchoolHoliday
import de.maxifrz.lernwerk.holidays.TimetableLayout
import de.maxifrz.lernwerk.holidays.Weekday
import java.util.Calendar

private enum class CalendarMode(val label: String) { TIMETABLE("Stunden"), EXAMS("Klausuren"), HOLIDAYS("Ferien") }

/** Stundenplan, Klausurenplan and Ferien/Feiertage in one tab: the school calendar, separate from the AI study
 * plan, which is about exam preparation rather than the weekly rhythm. */
@Composable
fun CalendarScreen(app: AppState) {
    val colors = Quill.colors
    var mode by remember { mutableStateOf(CalendarMode.TIMETABLE) }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                PixelCaption("Schulkalender")
                QText("Kalender", work(30f, FontWeight.Light, tracking = -1.1f), colors.ink)
            }
            Segmented(CalendarMode.entries.map { it.label }, CalendarMode.entries.indexOf(mode)) { mode = CalendarMode.entries[it] }
        }
        when (mode) {
            CalendarMode.TIMETABLE -> TimetablePane(app)
            CalendarMode.EXAMS -> ExamsPane(app)
            CalendarMode.HOLIDAYS -> HolidaysPane(app)
        }
    }
}

@Composable
private fun Segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    val colors = Quill.colors
    Row(Modifier.background(colors.hover, RoundedCornerShape(50)).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        options.forEachIndexed { index, option ->
            Box(
                Modifier
                    .height(30.dp)
                    .background(if (index == selected) colors.surface else Color.Transparent, RoundedCornerShape(50))
                    .clickable { onSelect(index) }
                    .padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                QText(option, work(12.5f, FontWeight.Medium), colors.ink)
            }
        }
    }
}

private fun subjectColor(subject: String): Color? = Subjects.color(subject)?.let(::hex)

// MARK: Timetable

@Composable
private fun TimetablePane(app: AppState) {
    val repository = app.repository
    val colors = Quill.colors
    var editing by remember { mutableStateOf<TimetableEntry?>(null) }
    var creating by remember { mutableStateOf(false) }
    val minuteHeight = 1.15f

    val layoutEntries = repository.timetable.map { TimetableLayout.Entry(it.weekday, it.startMinute, it.endMinute) }
    val placements = TimetableLayout.placements(layoutEntries)
    val (start, end) = TimetableLayout.dayRange(layoutEntries)
    val present = repository.timetable.map { it.weekday }.toSet()
    val days = listOf(1, 2, 3, 4, 5) + listOf(6, 7).filter { it in present }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 10.dp), horizontalArrangement = Arrangement.End) {
            OutlineButton("+ Stunde", { creating = true }, height = 34.dp)
        }
        if (repository.timetable.isEmpty()) {
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                QText("Noch kein Stundenplan", work(18f, FontWeight.Medium), colors.ink)
                QText("Trag deine Fächer mit Wochentag und Uhrzeit ein.", work(14f), colors.muted, Modifier.padding(top = 6.dp))
            }
        } else {
            val totalHeight = (end - start) * minuteHeight
            Row(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).horizontalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                Box(Modifier.width(38.dp).height(totalHeight.dp)) {
                    for (minute in (start / 60) * 60..end step 60) {
                        QText(
                            ClockTime.label(minute),
                            work(10.5f),
                            colors.faint,
                            Modifier.offset(y = ((minute - start) * minuteHeight - 6).dp),
                        )
                    }
                }
                days.forEach { weekday ->
                    Column(Modifier.width(96.dp)) {
                        QText(Weekday.fromNumber(weekday).shortLabel, work(12.5f, FontWeight.Medium), colors.muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                        Box(Modifier.fillMaxWidth().height(totalHeight.dp)) {
                            for (minute in (start / 60) * 60..end step 60) {
                                QuillDivider(colors.lineSoft, Modifier.offset(y = ((minute - start) * minuteHeight).dp))
                            }
                            repository.timetable.forEachIndexed { index, entry ->
                                if (entry.weekday != weekday) return@forEachIndexed
                                // placements[i] is the layout for layoutEntries[i], which is repository.timetable[i] — same order, same index.
                                val placement = placements.getOrNull(index) ?: TimetableLayout.Placement(index, 0, 1)
                                val color = subjectColor(entry.subject) ?: colors.accent
                                val columnWidth = 96.dp / placement.columns
                                Column(
                                    Modifier
                                        .offset(x = columnWidth * placement.column, y = ((entry.startMinute - start) * minuteHeight).dp)
                                        .width(columnWidth - 3.dp)
                                        .height(((entry.endMinute - entry.startMinute) * minuteHeight).dp)
                                        .background(color.copy(alpha = 0.16f), RoundedCornerShape(6.dp))
                                        .border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                                        .clickable { editing = entry }
                                        .padding(horizontal = 5.dp, vertical = 3.dp),
                                ) {
                                    QText(entry.subject.ifEmpty { "Fach" }, work(11.5f, FontWeight.SemiBold), color, maxLines = 2)
                                    if (entry.room.isNotEmpty()) QText(entry.room, work(10f), color, maxLines = 1)
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.width(20.dp))
            }
        }
    }

    if (creating) {
        TimetableEntryDialog(null, onSave = { repository.addTimetableEntry(it) }, onDelete = {}, onDismiss = { creating = false })
    }
    editing?.let { entry ->
        TimetableEntryDialog(
            entry,
            onSave = { repository.updateTimetableEntry(it) },
            onDelete = { repository.deleteTimetableEntry(entry) },
            onDismiss = { editing = null },
        )
    }
}

@Composable
private fun TimetableEntryDialog(entry: TimetableEntry?, onSave: (TimetableEntry) -> Unit, onDelete: () -> Unit, onDismiss: () -> Unit) {
    val colors = Quill.colors
    var subject by remember { mutableStateOf(entry?.subject ?: "") }
    var room by remember { mutableStateOf(entry?.room ?: "") }
    var weekday by remember { mutableStateOf(Weekday.fromNumber(entry?.weekday ?: 1)) }
    var startText by remember { mutableStateOf(ClockTime.label(entry?.startMinute ?: ClockTime.minutes(8, 0))) }
    var endText by remember { mutableStateOf(ClockTime.label(entry?.endMinute ?: ClockTime.minutes(8, 45))) }
    var subjectMenu by remember { mutableStateOf(false) }
    var weekdayMenu by remember { mutableStateOf(false) }

    val startMinute = parseClock(startText)
    val endMinute = parseClock(endText)
    val valid = subject.isNotBlank() && startMinute != null && endMinute != null && endMinute > startMinute

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = colors.surface,
        title = { QText(if (entry == null) "Neue Stunde" else "Stunde bearbeiten", work(18f, FontWeight.Medium), colors.ink) },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Box {
                    QuillRow("Fach") {
                        Row(Modifier.clickable { subjectMenu = true }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            subjectColor(subject)?.let { Box(Modifier.size(9.dp).background(it, CircleShape)) }
                            QText(subject.ifEmpty { "Wählen" }, work(15.5f), if (subject.isEmpty()) colors.faint else colors.ink)
                        }
                    }
                    DropdownMenu(subjectMenu, { subjectMenu = false }, containerColor = colors.surface) {
                        Subjects.all.forEach { s ->
                            DropdownMenuItem(text = {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Box(Modifier.size(9.dp).background(hex(s.color), CircleShape))
                                    QText(s.name, work(15f), colors.ink)
                                }
                            }, onClick = { subject = s.name; subjectMenu = false })
                        }
                    }
                }
                QuillRow("Raum") { editableField(room, { room = it }, "optional") }
                Box {
                    QuillRow("Wochentag") {
                        QText(weekday.label, work(15.5f), colors.ink, modifier = Modifier.clickable { weekdayMenu = true })
                    }
                    DropdownMenu(weekdayMenu, { weekdayMenu = false }, containerColor = colors.surface) {
                        Weekday.entries.forEach { day ->
                            DropdownMenuItem(text = { QText(day.label, work(15f), colors.ink) }, onClick = { weekday = day; weekdayMenu = false })
                        }
                    }
                }
                QuillRow("Von") { editableField(startText, { startText = it }, "08:00", monospace = true) }
                QuillRow("Bis") { editableField(endText, { endText = it }, "08:45", monospace = true) }
                if (entry != null) {
                    Spacer(Modifier.height(14.dp))
                    OutlineButton("Stunde löschen", { onDelete(); onDismiss() }, height = 40.dp)
                }
            }
        },
        confirmButton = {
            LinkButton("Sichern", {
                onSave(
                    (entry ?: TimetableEntry(subject = "", weekday = 1, startMinute = 0, endMinute = 0))
                        .copy(subject = subject.trim(), room = room.trim(), weekday = weekday.number, startMinute = startMinute ?: 0, endMinute = endMinute ?: 0),
                )
                onDismiss()
            }, color = if (valid) colors.link else colors.faint)
        },
        dismissButton = { LinkButton("Abbrechen", onDismiss) },
    )
}

/** "H:MM" or "HH:MM" to minutes since midnight; null when it is not a real time. */
private fun parseClock(text: String): Int? {
    val parts = text.trim().split(":")
    if (parts.size != 2) return null
    val hour = parts[0].toIntOrNull() ?: return null
    val minute = parts[1].toIntOrNull() ?: return null
    if (hour !in 0..23 || minute !in 0..59) return null
    return ClockTime.minutes(hour, minute)
}

@Composable
private fun editableField(value: String, onChange: (String) -> Unit, placeholder: String, monospace: Boolean = false) {
    val colors = Quill.colors
    Box(Modifier.widthIn(min = 60.dp)) {
        if (value.isEmpty()) QText(placeholder, work(15.5f), colors.faint)
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = work(15.5f).copy(color = colors.ink, textAlign = TextAlign.End, fontFamily = if (monospace) androidx.compose.ui.text.font.FontFamily.Monospace else null),
            cursorBrush = SolidColor(colors.accent),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

// MARK: Exams

@Composable
private fun ExamsPane(app: AppState) {
    val repository = app.repository
    val colors = Quill.colors
    val today = remember { CalendarDay.today() }
    var editing by remember { mutableStateOf<Exam?>(null) }
    var creating by remember { mutableStateOf(false) }

    val sorted = repository.exams.sortedBy { it.date }
    val upcoming = sorted.filter { it.calendarDay >= today }
    val past = sorted.filter { it.calendarDay < today }.reversed()

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 10.dp), horizontalArrangement = Arrangement.End) {
            OutlineButton("+ Klausur", { creating = true }, height = 34.dp)
        }
        if (repository.exams.isEmpty()) {
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                QText("Noch keine Klausuren", work(18f, FontWeight.Medium), colors.ink)
                QText(
                    "Trag deine nächste Klausur ein, um zu sehen, wie viele Schultage bis dahin bleiben.",
                    work(14f), colors.muted, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp, start = 40.dp, end = 40.dp),
                )
            }
        } else {
            LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
                if (app.settings.bundesland == null) {
                    item {
                        QText(
                            "Wähle unter „Ferien“ dein Bundesland, dann zeigt jede Klausur auch die Schultage bis dahin.",
                            work(13f), colors.muted,
                            modifier = Modifier.fillMaxWidth().background(colors.hover, RoundedCornerShape(10.dp)).padding(12.dp),
                        )
                        Spacer(Modifier.height(14.dp))
                    }
                }
                items(upcoming, key = { it.id }) { exam -> examRow(exam, today, app.settings.bundesland) { editing = exam } }
                if (past.isNotEmpty()) {
                    item { PixelCaption("Vorbei", Modifier.padding(top = 22.dp, bottom = 4.dp)) }
                    items(past, key = { it.id }) { exam -> examRow(exam, today, app.settings.bundesland, dimmed = true) { editing = exam } }
                }
                item { Spacer(Modifier.height(30.dp)) }
            }
        }
    }

    if (creating) {
        ExamDialog(null, onSave = { repository.addExam(it) }, onDelete = {}, onDismiss = { creating = false })
    }
    editing?.let { exam ->
        ExamDialog(exam, onSave = { repository.updateExam(it) }, onDelete = { repository.deleteExam(exam) }, onDismiss = { editing = null })
    }
}

@Composable
private fun examRow(exam: Exam, today: CalendarDay, state: Bundesland?, dimmed: Boolean = false, onClick: () -> Unit) {
    val colors = Quill.colors
    Column(Modifier.fillMaxWidth().alpha(if (dimmed) 0.55f else 1f).clickable(onClick = onClick).padding(vertical = 13.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Box(Modifier.padding(top = 5.dp)) { Box(Modifier.size(10.dp).background(subjectColor(exam.subject) ?: colors.accent, CircleShape)) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                QText(exam.subject.ifEmpty { "Klausur" }, work(16f, FontWeight.Medium), colors.ink)
                if (exam.topic.isNotEmpty()) QText(exam.topic, work(14f), colors.ink2, Modifier.padding(top = 3.dp))
                if (exam.room.isNotEmpty()) QText("Raum ${exam.room}", work(12.5f), colors.faint, Modifier.padding(top = 3.dp))
            }
            Column(horizontalAlignment = Alignment.End) {
                QText(exam.calendarDay.germanLabel, work(13.5f, FontWeight.Medium), colors.ink2)
                QText(ExamCountdown.daysLabel(today, exam.calendarDay), work(12.5f), colors.muted, Modifier.padding(top = 3.dp))
                if (state != null) {
                    ExamCountdown.schoolDaysLabel(today, exam.calendarDay, state)?.let {
                        QText(it, work(11.5f, FontWeight.Medium), colors.link, Modifier.padding(top = 3.dp))
                    }
                }
            }
        }
        QuillDivider(colors.lineSoft, Modifier.padding(top = 13.dp))
    }
        .let { if (dimmed) it.also {} else it }
}

@Composable
private fun ExamDialog(exam: Exam?, onSave: (Exam) -> Unit, onDelete: () -> Unit, onDismiss: () -> Unit) {
    val colors = Quill.colors
    var subject by remember { mutableStateOf(exam?.subject ?: "") }
    var topic by remember { mutableStateOf(exam?.topic ?: "") }
    var room by remember { mutableStateOf(exam?.room ?: "") }
    // A plain date field: fewer surprises than a native picker dialog inside an AlertDialog, and the student can
    // just type it.
    var dateText by remember { mutableStateOf((exam?.calendarDay ?: CalendarDay.today().adding(7)).shortLabel) }
    var subjectMenu by remember { mutableStateOf(false) }

    val parsedDate = parseGermanDate(dateText)
    val valid = subject.isNotBlank() && parsedDate != null

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = colors.surface,
        title = { QText(if (exam == null) "Neue Klausur" else "Klausur bearbeiten", work(18f, FontWeight.Medium), colors.ink) },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Box {
                    QuillRow("Fach") {
                        Row(Modifier.clickable { subjectMenu = true }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            subjectColor(subject)?.let { Box(Modifier.size(9.dp).background(it, CircleShape)) }
                            QText(subject.ifEmpty { "Wählen" }, work(15.5f), if (subject.isEmpty()) colors.faint else colors.ink)
                        }
                    }
                    DropdownMenu(subjectMenu, { subjectMenu = false }, containerColor = colors.surface) {
                        Subjects.all.forEach { s ->
                            DropdownMenuItem(text = {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Box(Modifier.size(9.dp).background(hex(s.color), CircleShape))
                                    QText(s.name, work(15f), colors.ink)
                                }
                            }, onClick = { subject = s.name; subjectMenu = false })
                        }
                    }
                }
                QuillRow("Thema") { editableField(topic, { topic = it }, "optional") }
                QuillRow("Termin") { editableField(dateText, { dateText = it }, "TT.MM.JJJJ", monospace = true) }
                QuillRow("Raum") { editableField(room, { room = it }, "optional") }
                if (exam != null) {
                    Spacer(Modifier.height(14.dp))
                    OutlineButton("Klausur löschen", { onDelete(); onDismiss() }, height = 40.dp)
                }
            }
        },
        confirmButton = {
            LinkButton("Sichern", {
                val d = parsedDate ?: return@LinkButton
                val millis = Calendar.getInstance().apply {
                    clear()
                    set(d.year, d.month - 1, d.day, 8, 0)
                }.timeInMillis
                onSave((exam ?: Exam(subject = "", date = 0)).copy(subject = subject.trim(), topic = topic.trim(), room = room.trim(), date = millis))
                onDismiss()
            }, color = if (valid) colors.link else colors.faint)
        },
        dismissButton = { LinkButton("Abbrechen", onDismiss) },
    )
}

/** "12.05.2026" to a [CalendarDay]; null when it is not a real date. */
private fun parseGermanDate(text: String): CalendarDay? {
    val parts = text.trim().split(".")
    if (parts.size != 3) return null
    val day = parts[0].toIntOrNull() ?: return null
    val month = parts[1].toIntOrNull() ?: return null
    val year = parts[2].toIntOrNull() ?: return null
    if (month !in 1..12 || day !in 1..31 || year < 2000) return null
    return CalendarDay(year, month, day)
}

// MARK: Holidays

@Composable
private fun HolidaysPane(app: AppState) {
    val colors = Quill.colors
    val settings = app.settings
    val today = remember { CalendarDay.today() }
    var picking by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            settings.bundesland?.let { QText(it.label, work(14f, FontWeight.Medium), colors.muted, Modifier.weight(1f)) } ?: Spacer(Modifier.weight(1f))
            OutlineButton(if (settings.bundesland == null) "Bundesland" else "Ändern", { picking = true }, height = 34.dp)
        }
        val state = settings.bundesland
        if (state == null) {
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                QText("Für welches Bundesland?", work(18f, FontWeight.Medium), colors.ink)
                QText(
                    "Ferien und Feiertage sind je nach Bundesland unterschiedlich; wähl deins, um sie hier und bei den Klausuren zu sehen.",
                    work(14f), colors.muted, textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp, start = 40.dp, end = 40.dp),
                )
                Spacer(Modifier.height(16.dp))
                PrimaryButton("Bundesland wählen", { picking = true })
            }
        } else {
            val current = HolidayCalendar.currentSchoolHoliday(today, state)
            val upcomingSchool = HolidayCalendar.schoolHolidays(state).filter { it.end >= today }.take(10)
            val upcomingPublic = HolidayCalendar.publicHolidays(state).filter { it.date >= today }.take(10)
            LazyColumn(Modifier.fillMaxSize().padding(horizontal = 20.dp)) {
                if (current != null) {
                    item {
                        Row(
                            Modifier.fillMaxWidth().background(colors.accent.copy(alpha = 0.14f), RoundedCornerShape(10.dp)).padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            QText("Ferien jetzt: ${current.name}, bis ${current.end.germanLabel}", work(14f, FontWeight.Medium), colors.ink)
                        }
                        Spacer(Modifier.height(6.dp))
                    }
                }
                item { PixelCaption("Ferien", Modifier.padding(top = if (current != null) 12.dp else 4.dp, bottom = 4.dp)) }
                items(upcomingSchool, key = { it.name + it.start.iso }) { holiday -> schoolHolidayRow(holiday, today) }
                item { PixelCaption("Feiertage", Modifier.padding(top = 24.dp, bottom = 4.dp)) }
                items(upcomingPublic, key = { it.name + it.date.iso }) { holiday -> publicHolidayRow(holiday, today) }
                item { Spacer(Modifier.height(30.dp)) }
            }
        }
    }

    if (picking) {
        BundeslandPicker(settings.bundesland, onPick = { settings.updateBundesland(it); picking = false }, onDismiss = { picking = false })
    }
}

@Composable
private fun schoolHolidayRow(holiday: SchoolHoliday, today: CalendarDay) {
    val colors = Quill.colors
    Column {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                QText(holiday.name, work(15.5f, FontWeight.Medium), colors.ink)
                QText("${holiday.start.shortLabel} – ${holiday.end.shortLabel}", work(13f), colors.muted, Modifier.padding(top = 3.dp))
            }
            QText(if (holiday.contains(today)) "läuft" else ExamCountdown.daysLabel(today, holiday.start), work(12.5f, FontWeight.Medium), colors.link)
        }
        QuillDivider(colors.lineSoft, Modifier.padding(vertical = 11.dp))
    }
}

@Composable
private fun publicHolidayRow(holiday: PublicHoliday, today: CalendarDay) {
    val colors = Quill.colors
    Column {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                QText(holiday.name, work(15.5f, FontWeight.Medium), colors.ink)
                QText(holiday.date.germanLabel, work(13f), colors.muted, Modifier.padding(top = 3.dp))
            }
            QText(ExamCountdown.daysLabel(today, holiday.date), work(12.5f, FontWeight.Medium), colors.muted)
        }
        QuillDivider(colors.lineSoft, Modifier.padding(vertical = 11.dp))
    }
}

@Composable
private fun BundeslandPicker(selection: Bundesland?, onPick: (Bundesland) -> Unit, onDismiss: () -> Unit) {
    val colors = Quill.colors
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = colors.surface,
        title = { QText("Bundesland", work(18f, FontWeight.Medium), colors.ink) },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState())) {
                Bundesland.entries.sortedBy { it.label }.forEach { state ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onPick(state) }.padding(vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        QText(state.label, work(15.5f), colors.ink, Modifier.weight(1f))
                        if (state == selection) QText("✓", work(15f, FontWeight.Bold), colors.accent)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { LinkButton("Abbrechen", onDismiss) },
    )
}
