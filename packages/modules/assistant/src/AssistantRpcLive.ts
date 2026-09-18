import { Layer } from "effect";
import { Approve } from "./Approve.js";
import { AssistantRpcs } from "./AssistantRpc.js";
import { listConversations, listMessages, startConversation } from "./Conversations.js";
import { SendMessage } from "./SendMessage.js";

const ListConversations = AssistantRpcs.toLayerHandler(
  "ListConversations",
  () => listConversations,
);

const StartConversation = AssistantRpcs.toLayerHandler(
  "StartConversation",
  () => startConversation,
);

const GetMessages = AssistantRpcs.toLayerHandler(
  "GetMessages",
  (payload) => listMessages(payload.conversationId),
);

/** The assistant group: a merge of its handlers, and nothing else. */
export const AssistantRpcLive = Layer.mergeAll(
  ListConversations,
  StartConversation,
  GetMessages,
  SendMessage,
  Approve,
);
