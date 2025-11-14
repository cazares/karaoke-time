# Ensure Node LTS (RN doesn’t support Node 24/25 yet)
nvm install --lts
nvm use --lts

# Clean everything
pkill -f "react-native|metro|launchPackager" 2>/dev/null || true
watchman watch-del-all 2>/dev/null || true
rm -rf node_modules ios/Pods ios/Podfile.lock yarn.lock \
       ~/Library/Developer/Xcode/DerivedData/*

# Reinstall JS deps (Yarn only for this repo)
yarn install

# Install pods
cd ios && pod install --repo-update && cd ..

# Verify RNFS is present in Podfile.lock
grep -i RNFS ios/Podfile.lock || grep -i react-native-fs ios/Podfile.lock

# Build to a Simulator (avoid device)
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
yarn ios --simulator "iPhone 17 Pro"
