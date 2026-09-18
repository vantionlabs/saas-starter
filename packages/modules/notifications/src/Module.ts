import { Layer } from "effect";
import { Mailer } from "./Mailer.js";

/**
 * Everything this module implements, as one layer to register.
 *
 * It is only the mailer today. The shape is the point: a host composes
 * `NotificationsModule`, and adding SMS or a webhook sender later changes this
 * file rather than every application that registers it.
 */
export const NotificationsModule: Layer.Layer<Mailer> = Mailer.layer;
