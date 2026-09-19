import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { contactsSerial } from "@vantion/core/atoms/Contact";

/**
 * Every read that belongs in the document, as a server function per route.
 *
 * The rule this file exists to hold: **a GET is rendered on the server.** A
 * dashboard whose data is fetched after hydration shows a spinner for work the
 * server could already have done, and a spinner standing in for a list is the
 * thing a person waits on twice — once for the page, once for its contents.
 *
 * What stays on the client is what a person asks for: creating, editing,
 * deleting, and the refetch that follows one. Those are atoms and stay atoms.
 *
 * The cookie is forwarded explicitly because there is no ambient one here, the
 * same way `server/session.ts` does it. Each of these is one internal request
 * to a service this app cannot render a page without anyway.
 */

const cookie = () => getRequestHeader("cookie");

export const listContacts = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(
    contactsSerial,
    await serverRpc(cookie(), (client) => client("ListContacts", undefined)),
  )
);
