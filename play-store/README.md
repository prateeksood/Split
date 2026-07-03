# Play Store Release Assets

Checklist for publishing Split to Google Play Store.

## Required assets

| Asset | Size | Path | Status |
|-------|------|------|--------|
| App icon | 512×512 PNG | `apps/mobile/assets/icon.png` | ✅ Included |
| Feature graphic | 1024×500 PNG | `play-store/feature-graphic.png` | ⬜ Add before submit |
| Phone screenshots | 2+ (16:9 or 9:16) | `play-store/screenshots/` | ⬜ Add before submit |
| Privacy policy URL | HTTPS | Host `apps/mobile/assets/privacy-policy.html` | ✅ In-app at `/privacy-policy` |

## Screenshot suggestions

Capture from the running app (dark theme):

1. **Home** — balance hero + AI input bar + recent activity
2. **AI confirmation** — bottom sheet after NL parse
3. **Groups** — group list with balances
4. **Reports** — donut chart + category breakdown

### Generate screenshots

```powershell
# Run app on Android emulator or device
npm run dev:mobile
# Press 'a' for Android, navigate to each screen, use device screenshot (Power + Vol Down)
```

Save files as `play-store/screenshots/01-home.png`, etc.

## Feature graphic

Create a 1024×500 banner in Figma/Canva with:

- Split logo / app icon
- Tagline: "Split expenses with AI"
- Dark violet (#7C6FFF) accent on #0F0F14 background

Save as `play-store/feature-graphic.png`.

## Play Console fields

- **App name:** Split
- **Package:** `com.kunkshi.split`
- **Category:** Finance
- **Privacy policy URL:** Your hosted URL or Expo web deploy + `/privacy-policy`
- **Target API:** 34+ (configured in `app.json`)

## Build & submit

```powershell
cd apps/mobile
eas build --platform android --profile production
eas submit --platform android
```

## Permissions declared

CAMERA, READ_CONTACTS, USE_BIOMETRIC, RECORD_AUDIO (voice), READ_MEDIA_IMAGES (receipts)
