# Security Specification - SRMA 24 KEDIRI

## 1. Data Invariants
- **User Roles**: Only users with specific roles (dokter, wali_asuh, wali_kelas, kepala_sekolah, guru_mapel, wali_asama) can perform administrative or approval actions.
- **Permit Workflow**: Izin Sakit status must follow a strict flow: `pending_asuh` -> `pending_kelas` -> `approved`.
- **Identity Integrity**: Document authors/uids must strictly match `request.auth.uid`.
- **Admin Access**: User `boxsimokerto5@gmail.com` has master admin privileges.

## 2. The "Dirty Dozen" Payloads (Test Scenarios)
1.  **Identity Spoofing (User)**: Creating a user profile for a different UID.
2.  **Role Escalation**: A user attempting to update their own role to 'kepala_sekolah'.
3.  **Bypassing Permit Workflow**: Directly setting an `izin_sakit` status to 'approved' by a non-authorized role.
4.  **Impersonation (Mading)**: Posting to mading with someone else's `authorUid`.
5.  **Illegal Document ID**: Using a giant string or special characters as a document ID to exhaust resources.
6.  **Timestamp Spoofing**: Providing a client-side timestamp for `createdAt` instead of `serverTimestamp()`.
7.  **Shadow Update**: Adding a `is_verified` field to a progress record that doesn't exist in the schema.
8.  **Orphaned Permit**: Creating an `izin_sakit` for a non-existent student (this requires `get()` which is expensive, but we check role existence).
9.  **PII Leak**: A non-authenticated user attempting to list all student data.
10. **Notification Spam**: Creating system notifications as a regular user without proper role checks.
11. **Malicious ID (Poisoning)**: Injecting 1KB string into a `notifId` or `permitId`.
12. **Unauthorized Deletion**: A teacher attempting to delete an announcement created by the Principal.

## 3. Test Runner
*(Conceptual verification - we will use ESLint and deployment logic)*
The `firestore.rules` are designed to block all the above scenarios by:
- Using `uid == request.auth.uid` checks.
- Using `affectedKeys().hasOnly()` or `hasAny()` for updates.
- Using `isValid[Entity]` with strict key matching and type checking.
- Using `isValidId()` for path variable hardening.
