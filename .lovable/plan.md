# Get the new changes onto the live site

The preview and the published site are two separate builds. Preview updates instantly as I edit; the published site only changes when a publish deploy succeeds. So the symptom you're seeing — new features in preview, old app live — means the last publish either didn't finish, was blocked, or shipped before the newest edits landed.

## Steps

1. Check the security scan state, since a publish is blocked outright when there are unresolved critical findings. If anything is blocking, report it to you before doing anything else.
2. Trigger a fresh publish of the current project state (everything now in preview).
3. Wait for the deploy to finish, then fetch the live URL (https://huri.lovable.app) once and confirm the served build contains the new code rather than the old bundle.
4. If the live URL still serves the old build after the deploy completes, report exactly what the deploy returned instead of silently retrying.

## Note

If the live site instead shows a login/permission screen, that's publish visibility (private vs public), not a stale build — I'll check that setting and tell you before changing it.
