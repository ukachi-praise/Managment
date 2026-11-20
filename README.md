# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Profile provisioning

The `/api/auth/profile` route verifies the Firebase ID token, then reads or restores the corresponding `users/{uid}` profile. The recovery list in that route is an explicit allowlist for existing accounts; adding entries grants the listed role to that UID. New accounts must receive their profiles through the application's trusted approval flow.

Set `FIREBASE_ADMIN_PROJECT_ID` to the same Firebase project as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. On Firebase App Hosting, the server uses the runtime service account through Application Default Credentials. For local development, either configure Application Default Credentials with `gcloud auth application-default login` or provide the following values through a local, untracked environment file:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `FIREBASE_ADMIN_USE_APPLICATION_DEFAULT` is no longer needed; Application Default Credentials are used automatically when a private key is not supplied.

Never commit service-account credentials. Classroom assignment is optional during authentication and remains stored on the user profile or classroom record.

## Assigning staff roles

An active SuperAdmin can use **Admin → Staff Accounts** to assign `Admin` or `Teacher` to an existing Firebase Authentication account. Copy the account's Firebase Auth UID into the form. Create the sign-in account in Firebase Authentication first; this screen creates or updates its Firestore profile. SuperAdmin roles are not assignable from this screen and must be maintained through the approved recovery process.

The Firestore rules require an active `users/{uid}` profile, prevent client-side role changes, and check a Teacher's classroom assignment before allowing result writes. The current application has a single-school data layout; the rules do not yet provide tenant-level school isolation, and teacher data reads are not fully scoped to classroom membership.

## Netlify PDF/ZIP export

The export route uses Puppeteer's locally installed browser on localhost and `@sparticuz/chromium` with `puppeteer-core` on Netlify. Netlify builds must keep `PUPPETEER_SKIP_DOWNLOAD=true`; Chromium is packaged as its own serverless binary. The Next.js trace for `/api/export-class-zip` includes the Chromium assets.

`netlify.toml` leaves function memory at Netlify's plan default. Synchronous Netlify functions have a hard 60-second execution cap. Large exports that exceed it need an asynchronous/background export workflow.

Run `npm run verify:pdf-export` to check local browser launch, PDF validity, and ZIP contents. This does not test Firebase-backed class data or a deployed Netlify function.
