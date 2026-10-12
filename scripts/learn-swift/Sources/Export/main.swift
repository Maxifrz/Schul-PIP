// Writes the fixtures the desktop and Android ports are tested against: for every shipped course, every node and a few
// seeds, the exercises the Swift engines build; plus the random generator's streams and the quests chosen for a range
// of days. Usage: LearnExport <output directory>
import Foundation
@testable import Lernwerk

let seeds: [UInt64] = [1, 7]

func json(_ value: Any) -> Data {
    (try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes])) ?? Data()
}

func media(_ media: ExerciseMedia?) -> Any {
    guard let media else { return NSNull() }
    switch media {
    case let .speech(text, language):
        return ["type": "speech", "text": text, "language": language]
    case let .board(board):
        return ["type": "board", "fen": board.fen, "flipped": board.flipped, "marked": board.marked]
    case let .staff(staff):
        return [
            "type": "staff", "clef": staff.clef.rawValue, "keySignature": staff.keySignature, "time": staff.time ?? NSNull(),
            "chord": staff.chord,
            "notes": staff.notes.map { ["letter": $0.pitch.letter, "octave": $0.pitch.octave, "alteration": $0.pitch.alteration, "value": $0.value.rawValue, "rest": $0.isRest] as [String: Any] },
        ]
    case let .tones(tones):
        return ["type": "tones", "midi": tones.midi, "together": tones.together]
    }
}

func exercise(_ e: LearnExercise) -> [String: Any] {
    [
        "id": e.id, "kind": e.kind.rawValue, "cardKeys": e.cardKeys, "prompt": e.prompt, "correctAnswers": e.correctAnswers,
        "options": e.options, "pairs": e.pairs.map { ["key": $0.key, "front": $0.front, "back": $0.back] },
        "solution": e.solution, "media": media(e.media), "mode": e.mode.rawValue, "explanation": e.explanation,
        "skill": e.skill, "level": e.level?.rawValue ?? NSNull(), "hints": e.hints, "coach": e.coach,
    ]
}

func day(_ d: LearnDay) -> String { "\(d.year)-\(d.month)-\(d.day)" }

func quest(_ q: Quest) -> [String: Any] {
    ["id": q.id, "kind": q.kind.rawValue, "target": q.target, "reward": q.reward, "title": q.title]
}

let arguments = CommandLine.arguments
guard arguments.count == 2 else {
    FileHandle.standardError.write(Data("usage: LearnExport <output directory>\n".utf8))
    exit(2)
}
let out = URL(fileURLWithPath: arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: out.appendingPathComponent("courses"), withIntermediateDirectories: true)

for provider in CourseCatalog.providers {
    let course = provider.course
    var nodes: [[String: Any]] = []
    for node in course.nodes where node.kind != .chest {
        var runs: [[String: Any]] = []
        for seed in seeds {
            let exercises = provider.lessonExercises(for: node, seed: seed)
            runs.append(["seed": seed, "exercises": exercises.map(exercise)])
        }
        nodes.append(["id": node.id, "runs": runs])
    }
    let map = provider.skillMap()
    let skills = map.skills.map { skill -> [String: Any] in
        ["id": skill.id, "title": skill.title, "goal": skill.goal, "levels": skill.levels.map(\.rawValue),
         "prerequisites": skill.prerequisites, "nodeIDs": skill.nodeIDs]
    }
    let structure = course.sections.map { section -> [String: Any] in
        ["id": section.id, "title": section.title, "units": section.units.map { unit -> [String: Any] in
            ["id": unit.id, "number": unit.number, "title": unit.title, "summary": unit.summary, "tip": unit.tip,
             "nodes": unit.nodes.map { ["id": $0.id, "kind": $0.kind.rawValue, "index": $0.index, "title": $0.title] as [String: Any] }]
        }]
    }
    let document: [String: Any] = [
        "course": course.id, "title": course.title, "subtitle": course.subtitle, "kind": course.kind.rawValue,
        "color": course.color, "symbol": course.symbol, "sections": structure, "skills": skills, "nodes": nodes,
    ]
    try json(document).write(to: out.appendingPathComponent("courses/\(course.id).json"))
}

// The random generator: raw words, bounded integers, doubles and shuffles, for a few seeds.
var streams: [[String: Any]] = []
for seed in [0, 1, 42, 0xDEAD_BEEF, UInt64.max] as [UInt64] {
    var raw = LearnRandom(seed: seed)
    let words = (0..<8).map { _ in String(raw.next()) }
    var ints = LearnRandom(seed: seed)
    let bounded = (0..<24).map { (i: Int) -> Int in Int.random(in: 0..<(((i + 3) * 7) % 23 + 2), using: &ints) }
    var ranged = LearnRandom(seed: seed)
    let closed = (0..<12).map { _ in Int.random(in: -5...12, using: &ranged) }
    var doubles = LearnRandom(seed: seed)
    let reals = (0..<6).map { _ in String(Double.random(in: 0..<7.5, using: &doubles).bitPattern) }
    var shuffles = LearnRandom(seed: seed)
    let shuffled = [Array(0..<2), Array(0..<5), Array(0..<12)].map { $0.shuffled(using: &shuffles) }
    var picks = LearnRandom(seed: seed)
    let chosen = (0..<8).map { _ in [10, 20, 30, 40, 50].randomElement(using: &picks)! }
    streams.append([
        "seed": String(seed), "words": words, "bounded": bounded, "closed": closed, "doubleBits": reals,
        "shuffles": shuffled, "picks": chosen,
    ])
}
let nodeSeeds = CourseCatalog.courses.prefix(2).flatMap { $0.nodes.prefix(6).map { node in
    ["node": node.id, "base": "5", "seed": String(Exercises.seed(for: node, base: 5))] as [String: Any]
} }
try json(["streams": streams, "nodeSeeds": nodeSeeds]).write(to: out.appendingPathComponent("random.json"))

// Quests by date.
var calendar = Calendar(identifier: .gregorian)
calendar.timeZone = TimeZone(identifier: "UTC")!
var days: [[String: Any]] = []
for offset in 0..<120 {
    let date = calendar.date(from: DateComponents(year: 2026, month: 1, day: 1 + offset))!
    let d = LearnDay(date, calendar: calendar)
    days.append(["day": day(d), "quests": QuestBoard.dailyQuests(for: d).map(quest)])
}
var weeks: [[String: Any]] = []
for offset in 0..<30 {
    let date = calendar.date(from: DateComponents(year: 2026, month: 1, day: 5 + 7 * offset))!
    let d = LearnDay(date, calendar: calendar)
    weeks.append(["start": day(d), "quest": quest(QuestBoard.weeklyQuest(for: d))])
}
try json(["daily": days, "weekly": weeks]).write(to: out.appendingPathComponent("quests.json"))
print("wrote fixtures to \(out.path)")
