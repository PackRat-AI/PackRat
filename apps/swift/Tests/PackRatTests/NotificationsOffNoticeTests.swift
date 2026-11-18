import Testing
import UserNotifications
@testable import PackRat

@Suite("NotificationsOffNotice")
struct NotificationsOffNoticeTests {
    @Test("shows when notifications are refused and alerts are on")
    func refused() {
        #expect(NotificationAuthorization.showsNotice(status: .denied, alertsOn: true))
    }

    @Test("shows when notifications were never asked for")
    func neverAsked() {
        #expect(NotificationAuthorization.showsNotice(status: .notDetermined, alertsOn: true))
    }

    @Test("hides when notifications are allowed")
    func allowed() {
        #expect(!NotificationAuthorization.showsNotice(status: .authorized, alertsOn: true))
        #expect(!NotificationAuthorization.showsNotice(status: .provisional, alertsOn: true))
    }

    @Test("hides while the permission is still being read")
    func unread() {
        #expect(!NotificationAuthorization.showsNotice(status: nil, alertsOn: true))
    }

    @Test("hides when the alerts are switched off")
    func alertsOff() {
        #expect(!NotificationAuthorization.showsNotice(status: .denied, alertsOn: false))
    }
}
