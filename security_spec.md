# Security Specification

This file outlines the security invariants, adversarial scenarios ("Dirty Dozen" payloads), and rules verification details for the Firestore database schema.

## 1. Data Invariants
1. **User Isolation**: A user can only read, write, update, or delete documents inside their own nested path `/users/{userId}/**`. Cross-user reading or writing is strictly rejected.
2. **Title Length Constraints**: The task title cannot exceed 128 characters to prevent Denals of Wallet.
3. **Task ID Integrity**: Document IDs and task/log IDs must be safe alphanumeric characters.
4. **Immutable Fields**: `createdAt` is set at document creation and cannot be mutated afterwards.
5. **Verified Users**: Written operations are restricted to authenticated, logged-in users with a valid `request.auth.uid`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

### Payload 1: Spying on Another User's Tasks (Cross-User Read)
* **Goal**: Authenticated as `attacker_uid`, read `/users/victim_uid/tasks/task-1`.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 2: Poisoning Victim's Task List (Cross-User Write)
* **Goal**: Authenticated as `attacker_uid`, write research task inside `/users/victim_uid/tasks/task-1`.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 3: Resource Poisoning via Huge Title (Denial of Wallet)
* **Goal**: Authenticated as `user1`, write a task with a title containing a 2MB string.
* **Expected outcome**: `PERMISSION_DENIED` due to title length bounds.

### Payload 4: Spoofing Task Ownership (Identity Spoofing)
* **Goal**: Authenticated as `user1`, create task inside `/users/user1/tasks/task-1` with mismatched field or values.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 5: Corruptor ID (Path Variable Poisoning)
* **Goal**: Authenticated as `user1`, write a task with a document ID containing malicious symbols `/users/user1/tasks/task%20$attack`.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 6: Modifying Immutable `createdAt`
* **Goal**: Authenticated as `user1`, update `/users/user1/tasks/task-1` changing `createdAt` to a newly forged timestamp.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 7: Overwriting Another User's Focus Logs
* **Goal**: Authenticated as `attacker_uid`, write inside `/users/victim_uid/logs/log-1`.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 8: Crafting Fake Focus Minutes
* **Goal**: Authenticated as `user1`, write focus log with high value `999999` duration minutes.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 9: Writing AI Plan for Another User
* **Goal**: Authenticated as `attacker_uid`, modify `/users/victim_uid/ai_plan/plan`.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 10: Forging Client Timestamps on Logs
* **Goal**: Authenticated as `user1`, write log using forged future Client-Side ISO string bounds.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 11: Hijacking Custom Categories of Another User
* **Goal**: Authenticated as `attacker_uid`, inject custom categories inside `/users/victim_uid/custom_categories/cat-1`.
* **Expected outcome**: `PERMISSION_DENIED`

### Payload 12: Invalid Custom Category Color Length
* **Goal**: Authenticated as `user1`, register a custom color with standard length of 200 characters to break UI.
* **Expected outcome**: `PERMISSION_DENIED`
