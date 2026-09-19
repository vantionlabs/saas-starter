module.exports = (api) => {
  api.cache(true);

  return {
    // `jsxImportSource: nativewind` is what turns a `className` on a React
    // Native element into styles; without it every class is silently ignored
    // and the app renders unstyled with no warning.
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
