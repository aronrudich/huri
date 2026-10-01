# Polish Alex’s 1,000-claim celebration

Alex currently has **992 valid claims**. The one-time guard has not fired, and there are **zero milestone messages**, so the surprise remains intact.

## Update the wording everywhere

Use this exact text in both the Huri message and phone notification:

> WOW! Alex has officially hit 1000 claims! He sure knows how to Huri the f*ck up! Thank you Alex!

Update both the dormant database trigger and the push-notification handler so recipients always see matching copy.

## Make the Huri message feel like a real milestone

- Keep it clearly from **Huri** with a prominent gold trophy.
- Upgrade the message into a polished celebration panel with stronger gold depth, a subtle inner glow, decorative sparkles/confetti, and a bold **1,000 CLAIMS** treatment.
- Keep the full message highly readable in light and dark mode.
- Add a brief, tasteful entrance celebration while respecting reduced-motion settings.
- Keep the inbox preview concise with the trophy prefix and corrected wording.

## Preserve the surprise and one-time behavior

- Do not insert any message, send any push, claim any request, or manually invoke the trigger.
- Keep canceled claims excluded and keep the atomic one-time guard unchanged.
- Keep recipients limited to active, approved Valets, Service Managers, Admins, and Alex at his company.

## Verification

- Confirm the guard remains unfired and no milestone messages exist after the update.
- Confirm the trigger’s stored wording and push wording match exactly.
- Preview the celebration locally with isolated mock data only, without touching live messages.
- Check the finished appearance on phone and desktop widths, including dark mode and reduced motion.
- Confirm the app builds cleanly.
