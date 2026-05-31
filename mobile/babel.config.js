module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            // Mirror tsconfig.json `paths`. Keep this in sync — the TS
            // compiler reads tsconfig, but Metro/Babel only honours
            // these.
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@store': './src/store',
            '@utils': './src/utils',
            '@hooks': './src/hooks',
            '@types': './src/types',
          },
        },
      ],
      // Reanimated must be listed last.
      'react-native-reanimated/plugin',
    ],
  };
};
