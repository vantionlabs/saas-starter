// NativeWind compiles `global.css` through Metro, and the root layout imports
// it for its side effect. TypeScript has no notion of that, so the module is
// declared rather than the import being suppressed at each site.
declare module "*.css" {}
