import { Site } from "@/Site.js";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The page as markup, for the build to paste into `index.html`.
 *
 * Static markup rather than `renderToString`: React 19 hydrates a plain tree
 * happily here, and the hydration markers would otherwise be a meaningful
 * fraction of what a visitor downloads.
 */
export const render = (): string => renderToStaticMarkup(<Site />);
