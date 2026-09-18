import { personaById } from "@/fixtures/personas.js";
import { useSearch } from "@tanstack/react-router";

/** The persona the query string names, for whichever screen is rendering. */
export const usePersona = () => personaById(useSearch({ from: "__root__" }).persona);
