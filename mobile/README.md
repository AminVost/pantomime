# پانتومین – نسخه آفلاین اندروید

پروژه اندروید با Capacitor و React ساخته شده است. طراحی، فونت، تم‌ها و جریان بازی از کد اصلی وب استخراج می‌شود. MySQL و درخواست‌های API در برنامه اندروید غیرفعال هستند؛ کلمات و دسته‌ها همراه اپ نصب می‌شوند.

امکانات: ۲ تا ۸ تیم، ۱ تا ۲۰ دور، نوبت‌های ۳۰ تا ۱۲۰ ثانیه یا زمان دلخواه، دسته‌های قابل انتخاب، حالت چندکلمه‌ای، ریسک ۳۰ امتیازی، تعویض کلمه، جریمه، امتیاز، برنده، صدا، لرزش، تم روشن/تیره و ادامه بازی ذخیره‌شده.

## نصب و بیلد

پیش‌نیاز: Node.js 22، Java JDK 21، Android Studio و SDK سازگار.

از ریشه مخزن GitHub:

    cd mobile
    npm install
    npm test
    npm run android:init
    npm run android:open

پروژه بومی در mobile/android ایجاد می‌شود. پس از هر تغییر در سورس اصلی یا کاتالوگ:

    npm run android:sync

ویندوز، از پوشه mobile/android:

    .\gradlew.bat assembleDebug

فایل تست: android/app/build/outputs/apk/debug/app-debug.apk

برای انتشار، از همان پوشه:

    .\gradlew.bat assembleRelease bundleRelease

در Linux/macOS، دستورهای npm run android:debug و npm run android:release نیز در دسترس‌اند.

## پروژه مستقل (ZIP اکشن)

فایل pantomime-android-project.zip در GitHub Actions شامل کپی مستقل رابط React، کاتالوگ آفلاین و پوشه Android ساخته‌شده است. بعد از استخراج، npm install و npm run android:sync را اجرا کنید؛ به مخزن وب نیاز ندارد.

## امضای نسخه Release

برای انتشار در بازار و مایکت باید APK یا AAB امضاشده داشته باشید. keystore مخصوص خودتان بسازید، آن را خارج از Git نگه دارید و به‌صورت متغیر محیطی وارد کنید:

    keytool -genkeypair -v -keystore pantomime-release.jks -alias pantomime -keyalg RSA -keysize 3072 -validity 10000

متغیرهای لازم: PANTOMIME_KEYSTORE_PATH (مسیر مطلق فایل)، PANTOMIME_KEYSTORE_PASSWORD، PANTOMIME_KEY_ALIAS، PANTOMIME_KEY_PASSWORD.

اگر کلید وجود نداشته باشد، خروجی release برای انتشار امضا نشده است. از همان کلید برای به‌روزرسانی‌های آینده استفاده کنید.

در GitHub Actions می‌توانید برای امضای خودکار این چهار Secret را ثبت کنید: PANTOMIME_KEYSTORE_BASE64، PANTOMIME_KEYSTORE_PASSWORD، PANTOMIME_KEY_ALIAS، PANTOMIME_KEY_PASSWORD.

شناسه برنامه: ir.aminvost.pantomime. نام نمایشی: پانتومین.

برای انتشار AAB در کافه‌بازار، مستندات Bundle Signer و نیاز احتمالی به فایل تأیید امضا را در پنل توسعه‌دهندگان بررسی کنید؛ شرایط بسته و امضای مایکت هم باید بررسی شود.

## کیفیت و محدودیت‌ها

تست‌های Node ساختار کاتالوگ و قفل شدن حالت آفلاین را بررسی می‌کنند. گردش واقعی صفحه‌ها، رفتار تایمر پس از background، صدا و لرزش، وضعیت بدون اینترنت، نصب روی چند نسخه اندروید و تأیید پذیرش مارکت‌ها باید با APK روی گوشی واقعی بررسی شوند.

داده‌های بازی در فضای خصوصی WebView نگهداری می‌شوند. با پاک کردن داده یا حذف برنامه، پیشرفت محلی از دست می‌رود. هیچ همگام‌سازی حساب یا MySQL انجام نمی‌شود.
