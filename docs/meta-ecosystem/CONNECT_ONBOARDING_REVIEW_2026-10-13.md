# Connect onboarding review — 13 Oct 2026

No code changes in this pass. This is the fix brief.

Live app in use: **Samyoj** `1766674304665017`, Live, Business Verification passed. Server flow is `es_v4`. `META_ES_CONFIG_ID` is set. `META_ES_COEX_CONFIG_ID` is not set, so coexistence reuses the standard config id and adds `featureType`.

## 1. WhatsApp Finish bug

Reported: Meta popup Finish ke baad page aksar connected state par nahi aata. Doosri baar, popup ke andar number choose ho chuka hota hai, phir bhi screen ke beech mein “Select a number” aata hai. Us par click ke baad kabhi home khulta hai, kabhi picker band hota hai aur purana page wapas aa jaata hai. Tab manual refresh karna padta hai.

Yeh do alag paths hain. Dono current code mein hain.

### Path A — ek number, page update nahi hota

WhatsApp Connect `FB.login` chalata hai. Meta ka popup hamara `window.open` nahi hai. Finish par `useWhatsAppConnectOAuth.runEmbeddedSignup` `POST /api/whatsapp/connect/callback` karta hai.

Agar server `requiresSelection: false` bhejta hai, client sirf `refreshNumbers({ silent: true })` karta hai. `window.location.reload` nahi hai. Toast aa sakta hai, lekin jo screen pehle se “not connected” paint kar chuki hai, woh tab tak purani rehti hai jab tak koi naya fetch na ho. `useMetaChannelStatus` Facebook/Instagram ke liye mount par ek baar fetch karta hai. WhatsApp number context silent refresh par update hona chahiye, lekin Dashboard/Settings ke kuch panels apna alag load rakhte hain.

`launchEmbeddedSignup` code aane ke baad session `postMessage` ke liye sirf **3 seconds** wait karta hai (`POSTMESSAGE_AFTER_CODE_MS`). `phone_number_id` us window mein na aaye to server ko hint nahi milta.

### Path B — doosri baar number select, page ke upar

Server `requiresSelection: true` tab bhejta hai jab token par **do ya zyada alag numbers** hon. Woh sirf `waba_id` se narrow karta hai (`narrowPhonesForWabaHint`). Popup wala `phone_number_id` server use nahi karta.

Client auto-select tabhi karta hai jab list mein ek phone ho, ya sab phones ke digits same hon. Do alag numbers hon to woh `phoneNumberId` ko ignore karke **main window** ko yahan bhej deta hai:

`window.location.assign('/settings/whatsapp/callback')`

`WhatsappCallbackPage` poori screen ke beech ek card dikhata hai: “Select a number”. Yeh Meta popup nahi hai. User jo number popup mein choose kar chuka hai, woh yahan dubara poochha jaata hai.

Us card par Connect ke baad:

- `completeOAuthPopupFlow` true return kare to `navigate('/')` **nahi** chalta. Page “this window should close” par ruk jaati hai.
- `isOAuthPopupContext()` true ho sakta hai agar purana `samyoj_wa_oauth_popup_marker` localStorage mein pada ho, kyunki `/settings/whatsapp/callback` ko popup path maana gaya hai (`isWhatsAppPopupCallbackPath`). Main tab par `window.close()` fail hota hai. User back karta hai, connected state nahi dikhti, manual refresh chahiye.
- Function false return kare to `navigate('/')` hota hai. Isliye kabhi refresh hota hai, kabhi nahi.

### Fix rule

Popup ke `phone_number_id` ko pehle use karo. Mil jaaye to usi number ko save karo. Doosra picker mat dikhao. Save ke baad user jis page par tha, wahi reload ho aur connected state dikhe. Selection tabhi dikhao jab Meta ne `phone_number_id` bheja hi na ho aur list mein sach mein do alag numbers hon. Woh selection bhi Meta popup jaisa chhota window ho, main page replace na ho.

## 2. Channel connect aaj kya karta hai

Maanga hua behavior: WhatsApp jaisa popup Facebook, Instagram, aur Email par bhi. Main page replace na ho.

| Channel | Aaj | Popup? |
|---|---|---|
| WhatsApp Cloud API | `FB.login` + `config_id`. Meta khud popup kholta hai. | Haan, Meta ka |
| WhatsApp coexistence | Same, extras mein `featureType: whatsapp_business_app_onboarding` | Haan, Meta ka |
| Facebook Page | `window.location.assign` se Facebook OAuth. Poora tab chala jaata hai. Callback `/settings/facebook/callback`. Kai Pages hon to wahi page “Choose which Page” dikhati hai, phir ~1.2s baad return path. | Nahi |
| Instagram | `POST /api/instagram/connect`. Koi Facebook dialog nahi. Pehle se connected Page ka token use karke linked professional account dhundhta hai. Page na ho to error, phir Facebook wala **full-page** redirect. | Nahi |
| Email | `gmailApi.connect()` ka URL `window.location.assign`. Google ka full-page redirect. Copy khud kehti hai “You will be redirected to Google”. | Nahi |

Facebook scopes jo code maangta hai: `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`, `pages_messaging`, `leads_retrieval`, `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `instagram_content_publish`, `ads_read`.

Live app par Page/Instagram/Ads permissions abhi **pending review** hain, approved nahi. `instagram_content_publish` reject ho chuka hai aur is submission mein hai bhi nahi. Live mode mein yeh extra scope real user ka Facebook dialog fail kar sakta hai. WhatsApp ke do permissions is problem se alag hain aur approved hain.

Instagram ka alag popup tabhi ban sakta hai jab Page connect ho. Instagram Cloud API professional account Page se linked hota hai. Bina Page ke sirf Instagram login se messaging/comments nahi aate.

## 3. Cloud API — implemented vs missing

Real user jiske paas apna Business Manager, WABA, aur Cloud API registered number hai.

Implemented:

- Connect button Embedded Signup v4 kholta hai. App ID/Secret UI mein nahi hai.
- Code exchange, WABA list, number save, token encrypt.
- WABA ko app webhooks se subscribe. Fields mein `messages` aur coexistence fields dono hain.
- `is_on_biz_app` Graph se padha jaata hai.
- Soft disconnect. Same org reconnect purana workspace rakhta hai.
- Campaign/template send us saved number se.

Missing or not proven:

- Graph `POST /{phone-number-id}/register` kahin call nahi hota. `skipRegister` pass hota hai aur `saveWhatsappConnection` usko padhta nahi. Embedded Signup khud registration karta hai to already-registered number ke liye yeh theek hai. Popup `FINISH_ONLY_WABA` de aur number pending rahe, to Samyoj usko register nahi karega.
- Payment method connect ko block nahi karta. Bina card ke connect ho jaata hai. Template send Meta reject karta hai jab tak customer WhatsApp Manager mein apna card na lagaye.
- Inbound webhook abhi ngrok par hai. Send chal sakta hai. Replies customer host par prove nahi hue.
- Section 1 wala Finish/refresh/reselect bug.

Real user steps:

1. Owner/admin Samyoj mein WhatsApp Connect dabaye. Cloud API wala mode.
2. Meta popup mein apna Facebook, Business, WABA, aur registered number choose kare. Finish.
3. Samyoj us number ko save kare aur wahi page connected dikhaye. Doosra picker nahi.
4. WhatsApp Manager mein payment method ho.
5. Approved template se broadcast. Session ke andar plain reply.

Test (apna dusra business, developer-app WABA nahi):

1. Jo number Samyoj developer app ke WhatsApp product par registered hai, usko is popup mein mat chuno. Meta us WABA ko ES mein dikhata nahi. Type karne par `#2655122`.
2. Doosre Business Manager ka Cloud API number lo jo is app ki WABA par na ho.
3. HTTPS origin par Connect → Cloud API → Finish.
4. Expect: ek hi select, page khud connected dikhe, Settings mein wahi number, template send usi number se phone par pahunche.
5. Do numbers wale account par bhi popup wala number hi save ho, screen par dobara list na aaye.

## 4. Coexistence — implemented vs missing

Yeh UI demo nahi hai. Launch, save, aur webhook ingest code mein hain. Live customer se complete hota hua prove nahi hua. Do Meta-required calls missing hain.

Implemented:

- Mode modal. Launch extras: `featureType: whatsapp_business_app_onboarding`, `sessionInfoVersion: 3`.
- Finish event `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` accept hota hai.
- Connect ke baad `is_on_biz_app` + `platform_type` fetch. True ho to status `active`.
- App webhook fields live hain: `history`, `smb_message_echoes`, `smb_app_state_sync`, `account_update`.
- Ingest: history → inbox `history_sync`. Echoes → outbound `biz_app`. Contact sync. `ACCOUNT_OFFBOARDED` / `ACCOUNT_RECONNECTED`.
- Send throttle for coexistence numbers.
- UI: badge, 13-day keep-alive note, offboarded copy.

Missing:

- `POST /{phone-number-id}/smb_app_data` with `sync_type: smb_app_state_sync` nahi hai.
- Uske baad `sync_type: history` nahi hai.
- Meta: onboard ke **24 hours** ke andar yeh dono calls. Warna customer ko offboard karke flow dubara karna padta hai. Har sync ek baar. `request_id` store nahi hota.
- Webhook handlers tab kaam aate hain jab Meta events bheje. Bina in POSTs ke contacts/history sync start nahi hoti.
- `META_ES_COEX_CONFIG_ID` empty hai. Meta ka documented launch `featureType` extras se hota hai, alag config zaroori nahi, lekin popup mein “connect existing WhatsApp Business Account” screen aati hai ya nahi, yeh is session mein click karke prove nahi hua.
- Section 1 wala reselect/refresh bug coexistence par bhi lagega jab WABA par ek se zyada number hon.

Real user (Business app number):

1. Number WhatsApp Business app par ho, kam se kam 7 din se, app version 2.24.17+.
2. Number pehle se is developer app ki WABA par Cloud API se bana hua na ho. Aisa number coexistence mein nahi ja sakta.
3. Connect → coexistence. Popup QR / existing account screen. Finish event `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`.
4. Samyoj number save kare, register API na chalaye, turant dono `smb_app_data` calls kare.
5. App khula rahe jab tak history webhooks aa rahe hon.
6. Phone app se bheja hua message Inbox mein echo ho. API se bheja hua message phone app mein dikhe.
7. Har ~13 din app kholni hai, warna Meta coexistence tod sakta hai.

Test:

1. Ek spare number jo sirf WhatsApp Business app par ho, Cloud API developer WABA par na ho.
2. HTTPS par coexistence Connect. Popup par existing-account screen confirm karo. Agar normal Cloud API WABA picker aaye, feature on nahi hua.
3. Finish ke baad DB: `isOnBizApp true`, `coexistenceStatus active`.
4. Graph par dono sync calls ka `request_id`. Phir `smb_app_state_sync` aur `history` webhooks. 24h ke andar.
5. Phone se ek naya message. Samyoj Inbox mein outbound echo. API se ek template. Phone app mein wahi chat.
6. Developer-app wala apna registered number is test mein mat use karna.

## 5. Fix prompt (next session)

WhatsApp Finish: agar Embedded Signup `phone_number_id` de, to `connect/callback` usi number ko save kare aur `requiresSelection` na bheje. Do alag numbers aur koi id na ho, tab hi select dikhao, aur woh main-tab navigation na ho. Save ke baad current page reload ho aur connected number dikhe. Purana popup marker main tab ko popup na samjhe. `skipRegister` ko ya to hatao ya coexistence par register call sach mein skip karo. Standard path par ES registration ke baad pending number ko `POST /register` se complete karo agar Graph status pending ho.

Coexistence: successful coexistence save ke turant baad `POST /{phone-number-id}/smb_app_data` do baar chalao, pehle `smb_app_state_sync`, phir `history`. `request_id` number row par rakho. 24h miss ho to UI bolo offboard karke dubara connect karo. Popup screen verify karo ki featureType wala existing-account step aa raha hai.

Facebook aur Instagram: WhatsApp jaisa popup. Main page `location.assign` se Facebook par na jaaye. Kai Pages hon to select popup ke andar ho, phir opener refresh. `instagram_content_publish` scope hatao jab tak review mein approved na ho. Instagram Page-linked account hi connect kare. Page na ho to pehle Facebook popup, uske baad IG link. Email ka Google redirect bhi popup ho, main app tab na chhode. App Review approve hone se pehle real customer par Facebook/Instagram success mat likhna.
