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
                    Text("Contacts get an email from PackRat, never from your own address. The first one explains who added them and why.")
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
                    .foregroundStyle(contact.canBeNotified ? AnyShapeStyle(.secondary) : AnyShapeStyle(.orange))
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

    private var trimmedEmail: String { draft.email.trimmingCharacters(in: .whitespaces) }

    private var validationMessage: String? {
        if !trimmedEmail.isEmpty, !Self.looksLikeEmail(trimmedEmail) { return "That email address doesn't look right." }
        return nil
    }

    private var canSave: Bool {
        !draft.name.trimmingCharacters(in: .whitespaces).isEmpty
            && !trimmedEmail.isEmpty
            && validationMessage == nil
    }

    /// Something@something.tld — the server does the real validation.
    static func looksLikeEmail(_ value: String) -> Bool {
        let parts = value.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, !value.contains(" ") else { return false }
        let domain = parts[1]
        return domain.contains(".") && !domain.hasPrefix(".") && !domain.hasSuffix(".")
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
                        Text("They'll get an email when you start a trip, when you check in, and if you're overdue.")
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
        // Phone isn't edited here; an existing number is kept as is.
        let phone = draft.phone.isEmpty ? nil : draft.phone
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
        picker.displayedPropertyKeys = [CNContactEmailAddressesKey]
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
