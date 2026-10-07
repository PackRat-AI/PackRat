import Foundation

#if os(iOS)
import Contacts
import ContactsUI
import SwiftUI

/// Settings › Emergency Contacts. The people told when a trip starts and
/// alerted if the user doesn't come back on time.
struct EmergencyContactsView: View {
    private var store = SafetyCheckInStore.shared
    @State private var editing: ContactDraft?
    @State private var errorMessage: String?

    var body: some View {
        List {
            if store.contacts.isEmpty, store.contactsLoaded {
                ContentUnavailableView {
                    Label("No Emergency Contacts", systemImage: "person.crop.circle.badge.exclamationmark")
                } description: {
                    Text("Add someone who should know where you've gone and when you'll be back. They don't need PackRat.")
                } actions: {
                    Button("Add Contact") { editing = ContactDraft() }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("emergency_contacts_add_empty")
                }
                .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(store.contacts) { contact in
                        Button { editing = ContactDraft(contact) } label: { row(contact) }
                            .buttonStyle(.plain)
                            .swipeActions {
                                Button("Delete", role: .destructive) { delete(contact) }
                            }
                    }
                } footer: {
                    Text("Contacts get a text or email from PackRat, never from your own number. The first one explains who added them and why.")
                }
            }
        }
        .navigationTitle("Emergency Contacts")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Add", systemImage: "plus") { editing = ContactDraft() }
                    .accessibilityIdentifier("emergency_contacts_add")
            }
        }
        .sheet(item: $editing) { draft in
            EmergencyContactForm(draft: draft)
        }
        .alert("Couldn't Remove Contact", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .task { await store.loadContacts() }
        .refreshable { await store.loadContacts() }
    }

    private func row(_ contact: EmergencyContact) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "person.crop.circle.fill")
                .font(.title)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(contact.name).font(.body.weight(.semibold))
                    if contact.isDefault {
                        Text("Default")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(.tint.opacity(0.15), in: Capsule())
                            .foregroundStyle(.tint)
                    }
                }
                Text(contact.reachableAt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
        .accessibilityIdentifier("emergency_contact_row_\(contact.name)")
    }

    private func delete(_ contact: EmergencyContact) {
        Task {
            do {
                try await store.deleteContact(contact.id)
            } catch {
                errorMessage = "Check your connection and try again."
            }
        }
    }
}

struct ContactDraft: Identifiable {
    let id = UUID()
    var existingId: String?
    var name = ""
    var phone = ""
    var email = ""
    var isDefault = false

    init() {}

    init(_ contact: EmergencyContact) {
        existingId = contact.id
        name = contact.name
        phone = contact.phone ?? ""
        email = contact.email ?? ""
        isDefault = contact.isDefault
    }
}

/// Add or edit one contact. Can fill itself from the phone's address book.
struct EmergencyContactForm: View {
    @State var draft: ContactDraft
    @Environment(\.dismiss) private var dismiss
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showingPicker = false
    private var store = SafetyCheckInStore.shared

    init(draft: ContactDraft) {
        _draft = State(initialValue: draft)
    }

    private var normalizedPhone: String? { PhoneNumberFormat.normalize(draft.phone) }
    private var trimmedEmail: String { draft.email.trimmingCharacters(in: .whitespaces) }

    private var validationMessage: String? {
        if draft.phone.isEmpty, trimmedEmail.isEmpty { return nil }
        if !draft.phone.isEmpty, normalizedPhone == nil {
            return "Include the country code for numbers outside the US and Canada, e.g. +44 7700 900123."
        }
        if !trimmedEmail.isEmpty, !trimmedEmail.contains("@") { return "That email address doesn't look right." }
        return nil
    }

    private var canSave: Bool {
        !draft.name.trimmingCharacters(in: .whitespaces).isEmpty
            && (!draft.phone.isEmpty || !trimmedEmail.isEmpty)
            && validationMessage == nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Button {
                        showingPicker = true
                    } label: {
                        Label("Choose from Contacts", systemImage: "person.crop.circle.badge.plus")
                    }
                }
                Section {
                    TextField("Name", text: $draft.name)
                        .textContentType(.name)
                        .accessibilityIdentifier("emergency_contact_name")
                    TextField("Mobile number", text: $draft.phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .accessibilityIdentifier("emergency_contact_phone")
                    TextField("Email", text: $draft.email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("emergency_contact_email")
                } footer: {
                    if let validationMessage {
                        Text(validationMessage).foregroundStyle(.red)
                    } else {
                        Text("Add a mobile number, an email, or both. Both is surest: a text for speed, an email as backup.")
                    }
                }
                Section {
                    Toggle("Default contact", isOn: $draft.isDefault)
                } footer: {
                    Text("Your default contact is selected each time you start a trip.")
                }
                if let errorMessage {
                    Section { Text(errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle(draft.existingId == nil ? "New Contact" : "Edit Contact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button("Save", action: save)
                            .disabled(!canSave)
                            .accessibilityIdentifier("emergency_contact_save")
                    }
                }
            }
            .background(
                ContactPicker(isPresented: $showingPicker) { contact in
                    draft.name = CNContactFormatter.string(from: contact, style: .fullName) ?? draft.name
                    if let mobile = contact.phoneNumbers.first(where: { $0.label == CNLabelPhoneNumberMobile })
                        ?? contact.phoneNumbers.first {
                        draft.phone = mobile.value.stringValue
                    }
                    if let email = contact.emailAddresses.first {
                        draft.email = email.value as String
                    }
                }
            )
        }
    }

    private func save() {
        isSaving = true
        errorMessage = nil
        let name = draft.name.trimmingCharacters(in: .whitespaces)
        let phone = draft.phone.isEmpty ? nil : normalizedPhone
        let email = trimmedEmail.isEmpty ? nil : trimmedEmail
        Task {
            defer { isSaving = false }
            do {
                if let id = draft.existingId {
                    try await store.updateContact(id, name: name, phone: phone, email: email, isDefault: draft.isDefault)
                } else {
                    try await store.addContact(name: name, phone: phone, email: email, isDefault: draft.isDefault)
                }
                dismiss()
            } catch {
                errorMessage = "Couldn't save. Check your connection and try again."
            }
        }
    }
}

/// Presents the system contact picker. It runs out of process, so PackRat
/// never needs access to the whole address book.
private struct ContactPicker: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let onPick: (CNContact) -> Void

    func makeUIViewController(context: Context) -> UIViewController { UIViewController() }

    func updateUIViewController(_ host: UIViewController, context: Context) {
        guard isPresented, host.presentedViewController == nil else { return }
        let picker = CNContactPickerViewController()
        picker.delegate = context.coordinator
        picker.displayedPropertyKeys = [CNContactPhoneNumbersKey, CNContactEmailAddressesKey]
        DispatchQueue.main.async { host.present(picker, animated: true) }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, CNContactPickerDelegate {
        let parent: ContactPicker
        init(_ parent: ContactPicker) { self.parent = parent }

        func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
            parent.onPick(contact)
            parent.isPresented = false
        }

        func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
            parent.isPresented = false
        }
    }
}
#endif

/// Mobile numbers go to the server in E.164 (+14155550123), which is what SMS
/// delivery needs.
enum PhoneNumberFormat {
    /// Numbers written with a leading + keep their country code. Ten-digit
    /// numbers (or eleven starting with 1) are read as US/Canada. Anything
    /// else needs a country code, since guessing one would text a stranger.
    static func normalize(_ input: String) -> String? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let digits = trimmed.filter(\.isNumber)
        if trimmed.hasPrefix("+") {
            return (7...15).contains(digits.count) && digits.first != "0" ? "+\(digits)" : nil
        }
        if trimmed.hasPrefix("00") {
            let rest = digits.dropFirst(2)
            return (7...15).contains(rest.count) ? "+\(rest)" : nil
        }
        if digits.count == 10 { return "+1\(digits)" }
        if digits.count == 11, digits.first == "1" { return "+\(digits)" }
        return nil
    }
}
