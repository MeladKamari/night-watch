# راهنمای سریع استفاده (فارسی)

این SDK **مستقل و خودمیزبان** است و وابستگی اجرایی به سرویس ابری شخص ثالث ندارد.
SDK را روی دامنه ISP یا سرور داخلی خود «اول‌طرف» میزبانی کنید.

## بدون CDN خودمیزبان

فایل `fp.min.js` را روی دامنه خودتان یا **شبکه داخلی** میزبانی کنید:

```html
<script src="/vendor/night-watch/fp.min.js"></script>
<script>
  NightWatch.load({ monitoring: false }).then(function (agent) {
    return agent.get()
  }).then(function (result) {
    console.log(result.visitorId)
  })
</script>
```

یا با ESM در باندلر محلی / ورک‌اسپیس:

```ts
import { load } from '@night-watch/browser-sdk'

const agent = await load({ monitoring: false })
const { visitorId, components } = await agent.get()
```

## حریم و محدودیت‌ها

- خروجی `get()` را بدون رضایت کاربر یا سیاست دادهٔ شما ذخیره نکنید.
- محیط playground: فقط برای توسعهٔ محلی روی لوپ‌بک است.
- `monitoring` در این SDK همیشه خاموش است و به اندپوینت تلمتری
  شخص ثالث وصل نمی‌شود.

## راست‌چین و محیط ایران

- `dir="rtl"` و فونت فارسی **تأثیری** روی `visitorId` به‌تنهایی ندارد.
- لوکیل `fa-IR` در برخی مرورگرها روی سیگنال‌های `languages` / `timezone`
  اثر می‌گذارد؛ این به‌معنی «تشخیص کشور» قطعی نیست.

## دقت و محدودیت

به `docs/ACCURACY_AND_LIMITATIONS.md` مراجعه کنید. هیچ‌گاه ادعای شناسایی
قطعی کاربر فقط با اثرانگشت مرورگر نکنید.
