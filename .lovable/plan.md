# One-time 1,000 claims celebration for Alex (Jesus Leos)

Alex is at 992 claims right now. When his 1,000th claim happens, Huri sends one celebration message, and it never fires again for him or anyone else.

## What people will see
- A message from **Huri** in Messages, with a gold trophy look so it stands out from normal messages.
- Text: "WOW! Alex has officially hit 1000 claims! He sure knows to Huri the f*ck up! Thank you Alex!"
- A phone notification with the same text.
- Who gets it: every active, approved Valet, Service Manager, and Admin at JCD. Alex gets it too.

## How it stays one-time
- It's tied to Alex's account only and turns itself off once it sends.
- If two claims land at the same moment, it still sends only once.

## Technical details
- Migration: a single-row `milestone_fired` guard table that only the service role can access. Add an AFTER UPDATE trigger on `pickup_requests`. When `claimed_by` becomes Alex's id (`2bce037a-…`), the trigger counts his claims. When the count hits 1000 or more, it inserts the guard row with ON CONFLICT DO NOTHING, and the trigger only continues if that insert went through. It then inserts one `messages` row per recipient. Each row uses `sender_id = NULL` (Huri), thread_id `huri-milestone-alex-1000`, and a body prefixed with a `[[celebrate]]` marker.
- Messages UI (`inbox.tsx`, `thread.$threadId.tsx`): a null sender shows as "Huri" with the logo. Bodies starting with `[[celebrate]]` show as a gold/amber card with a trophy, and the marker is hidden.
- Push: realtime/push path sends a notification for the new rows. I'll follow whatever the current message-push flow is and add it there if it's missing.
- Test using a transaction that gets rolled back, then confirm the trigger is still armed.
