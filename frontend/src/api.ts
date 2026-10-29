import createClient from "openapi-fetch";
import type { paths } from "spec/api";

/** Typed client for `/api/*`; paths and bodies come from `spec/openapi.yaml`. */
export const api = createClient<paths>();
