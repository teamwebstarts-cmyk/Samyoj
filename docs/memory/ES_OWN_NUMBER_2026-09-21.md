# Embedded Signup — own number and Finish 400

**Date:** 2026-09-21. App **Samyoj** `1766674304665017`, config `1304098751592068`, flow `es_v4`. App was still **Development**, not Live.

## Do not re-debug this as a missing portfolio screen

`+91 93036 18219` was already **Registered** on the developer-app WABA `3233664960155958` (phone number id `1236145152921778`) from the Meta app’s **Step 2. Production setup**.

Meta will not list that WABA inside Embedded Signup. The popup stays on “You don't have any existing phone numbers,” and typing the same number returns **#2655122**. A normal customer uses their own portfolio and one number. They never register that number in the developer console.

Remove it only in WhatsApp Manager: [home](https://business.facebook.com/wa/manage/home/) → Account tools → Phone numbers → trash. API cannot delete it. After that, Connect must use a portfolio that does **not** own this app. Official rule: [Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/) — developer-app WABAs cannot be onboarded through the flow.

## Finish toast “Request failed with status code 400”

2026-09-21 17:32 UTC, `POST /api/whatsapp/connect/callback`. Meta rejected the code:

`Error validating verification code. Please make sure your redirect_uri is identical to the one you used in the OAuth dialog request`

Exchange used `https://reimagined-fortnight-4j5p7x95xqqgc6p5-3000.app.github.dev/settings/whatsapp/callback/popup`. The Facebook SDK line about overriding the access token is not this error. The red toast is only the HTTP 400 wrapper.
