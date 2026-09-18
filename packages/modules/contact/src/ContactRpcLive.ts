import { Layer } from "effect";
import { CreateContact } from "./CreateContact.js";
import { DeleteContact } from "./DeleteContact.js";
import { GetOverview } from "./GetOverview.js";
import { ListContacts } from "./ListContacts.js";

/** The RPC transport over the shared store. */
export const ContactRpcLive = Layer.mergeAll(
  ListContacts,
  CreateContact,
  DeleteContact,
  GetOverview,
);
