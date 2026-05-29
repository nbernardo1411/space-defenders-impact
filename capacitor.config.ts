import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zukito.spaceimpactdefender',
  appName: 'Space Impact Defender',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
