import { Brand } from "@/brand.js";
import { renderToStaticMarkup } from "react-dom/server";

/** The page as markup, for the build to paste into `index.html`. */
export const render = (): string => renderToStaticMarkup(<Brand />);
