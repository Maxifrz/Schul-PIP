import Foundation
import UserNotifications

/// The daily study plan reminder. iOS runs no app code when a notification fires, so the next two weeks are
/// scheduled ahead with the topics open on each day and replaced whenever the plan changes or the app opens.
enum PlanNotifications {
    /// A stable name for the plan's notifications; plans have no identifier of their own.
    static func key(for plan: StudyPlan) -> String {
        "plan-\(Int64(plan.createdAt.timeIntervalSince1970 * 1000))"
    }

    /// Asks for permission once; false when the student declined now or earlier.
    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .denied:
            return false
        default:
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        }
    }

    static func update(_ plan: StudyPlan, now: Date = Date()) {
        let prefix = key(for: plan) + "-"
        let upcoming = plan.reminderMinute.map { minute in
            PlanReminder.upcoming(
                planTitle: plan.title,
                examDate: plan.examDate,
                items: plan.topics.map(\.reminderItem),
                minuteOfDay: minute,
                from: now
            )
        } ?? []
        replace(prefix: prefix, with: upcoming)
    }

    static func remove(_ plan: StudyPlan) {
        replace(prefix: key(for: plan) + "-", with: [])
    }

    static func updateAll(_ plans: [StudyPlan]) {
        plans.forEach { update($0) }
    }

    private static func replace(prefix: String, with notifications: [PlanReminder.Notification]) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { requests in
            let old = requests.map(\.identifier).filter { $0.hasPrefix(prefix) }
            center.removePendingNotificationRequests(withIdentifiers: old)
            for notification in notifications {
                let content = UNMutableNotificationContent()
                content.title = notification.title
                content.body = notification.body
                content.sound = .default
                let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: notification.fireDate)
                let trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
                let day = String(format: "%04d%02d%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
                center.add(UNNotificationRequest(identifier: prefix + day, content: content, trigger: trigger))
            }
        }
    }
}
