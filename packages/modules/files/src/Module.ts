import { Layer } from "effect";
import { FilesRpcLive } from "./FilesRpcLive.js";
import { ObjectStore } from "./ObjectStore.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * `ObjectStore` is provideMerged rather than provided, so anything outside the
 * module — a public API handler, a worker collecting abandoned uploads — reaches
 * the same store rather than building a second one.
 */
export const FilesModule = FilesRpcLive.pipe(Layer.provideMerge(ObjectStore.layer));

export { FilesHttp } from "./FilesHttp.js";
