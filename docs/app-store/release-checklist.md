# App Store Deployment Checklist

This checklist is for the first iPad App Store release of qwertZnake.

## Already Done In This Repo

- Added a native SwiftUI iPad app for qwertZnake.
- Added local result storage, local practice levels, and local settings persistence for the iPad app.
- Added external hardware keyboard handling for the iPad app.
- Verified web tests with `npm test`.
- Verified the iPad simulator build and launch for scheme `qwertZnake`.
- Added `Assets.xcassets/AppIcon.appiconset`.
- Added a baseline `PrivacyInfo.xcprivacy` declaring no tracking, no collected data, and no required-reason API access.
- Prepared German and English App Store metadata in `docs/app-store/metadata.md`.
- Prepared privacy policy and support page copy.
- Deployed `https://qwertznake.de/privacy` and `https://qwertznake.de/support`.
- Prepared the paid upfront monetization plan in `docs/app-store/monetization.md`.

## Your App Store Connect Tasks

1. Join or confirm the Apple Developer Program: https://developer.apple.com/programs/
2. Open App Store Connect: https://appstoreconnect.apple.com/apps
3. Create a new app record: https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
4. Use bundle ID `com.wqwertz.qwertznake`.
5. Set the app name to `qwertZnake`.
6. Use SKU `qwertznake-ios-1`.
7. Set primary language to German.
8. Set primary category to Education and secondary category to Games.
9. Complete the age rating questionnaire, targeting 4+.
10. Add the privacy policy URL: https://qwertznake.de/privacy
11. Add support URL: https://qwertznake.de/support
12. Complete App Privacy details: https://developer.apple.com/app-store/app-privacy-details/
13. Answer privacy as no tracking and no data collected. The iPad app stores gameplay locally and does not send player data to qwertznake.de.
14. Sign the Paid Apps Agreement in App Store Connect Business.
15. Enter banking information and complete tax forms.
16. Set Pricing and Availability before review. Recommended launch setup: Germany as base country or region, EUR 2.99 price point, Apple-generated comparable prices elsewhere.
17. Add the metadata from `docs/app-store/metadata.md`.
18. Upload one to ten iPad screenshots. For iPad-only apps, Apple requires iPad screenshots: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications
19. Use App Store Connect's screenshot uploader: https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots
20. In Xcode, set your Apple development team for target `qwertZnake`.
21. Archive the app in Xcode with Product > Archive.
22. Upload the archive to App Store Connect: https://help.apple.com/xcode/mac/current/en.lproj/dev442d7f2ca.html
23. Wait for build processing, then choose the uploaded build in the version page: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
24. Add App Review contact details and the review notes from `docs/app-store/metadata.md`.
25. Submit the app for review: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app
26. Use manual release after approval for the first version, so you can check the product page before going live.

## Pre-Submission QA

- Test on an iPad simulator in both portrait and landscape.
- Test with the on-screen keyboard.
- Test with an external hardware keyboard if available.
- Verify Space starts and pauses the game.
- Verify a full game can end without a crash.
- Check local score/name behavior.
- Replace the generated app icon with a polished final icon if desired.
- Confirm `DEVELOPMENT_TEAM` is set before archive; it is intentionally empty in the repo.

## Store Asset Plan

Minimum screenshot set:
- 13-inch iPad landscape screenshot of qwertZnake gameplay.
- 13-inch iPad landscape screenshot of the finger-colored keyboard.
- 13-inch iPad landscape screenshot of the key-change/finger prompt.
- 13-inch iPad landscape screenshot of the local results list.
- 13-inch iPad landscape screenshot of grid-size or level selection.

Apple allows one to ten screenshots in PNG, JPG, or JPEG. A short app preview video is optional.
