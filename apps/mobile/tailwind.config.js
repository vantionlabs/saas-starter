// NativeWind v4 is a Tailwind *3* integration, and this repository is on
// Tailwind 4 everywhere else. That is why `tailwindcss` is pinned here rather
// than taken from the catalog: two major versions, one of them scoped to this
// app, with the seam written down instead of discovered.
//
// The theme is generated from `@vantion/tokens`, converted to hex, so the phone
// and the browser cannot drift. NativeWind v5 will take the Tailwind 4 pipeline
// directly; it is a release candidate, and one release candidate in a starter
// (Effect) is enough.
const { nativeColors, nativeRadius } = require("./src/theme.ts");

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: nativeColors,
      borderRadius: {
        DEFAULT: nativeRadius,
        lg: nativeRadius + 2,
      },
    },
  },
  plugins: [],
};
