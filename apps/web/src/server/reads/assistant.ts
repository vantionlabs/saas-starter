import { dehydrate } from "@/server/hydration.js";
import { serverRpc } from "@/server/rpc.js";
import { createServerFn } from "@tanstack/react-start";
import { conversationsSerial } from "@vantion/core/atoms/Assistant";

/**
 * The conversation list only. A thread arrives by stream and belongs to
 * whichever conversation is open, so there is no single value for a loader.
 */
export const listConversations = createServerFn({ method: "GET" }).handler(async () =>
  dehydrate(
    conversationsSerial,
    await serverRpc((client) => client("ListConversations", undefined)),
  )
);
