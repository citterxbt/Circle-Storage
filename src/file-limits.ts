/**
 * Vercel Functions limit both request and response bodies to 4.5 MB. Files travel through this
 * API as Base64 in JSON, so 3 MiB of encrypted bytes leaves room for Base64 expansion and the
 * surrounding JSON response.
 */
export const MAX_SERVERLESS_CIPHERTEXT_BYTES = 3 * 1024 * 1024;

/** AES-GCM appends this many bytes to each plaintext file before it is uploaded. */
export const AES_GCM_TAG_BYTES = 16;

/** Maximum file a user may choose before browser-side AES-GCM encryption. */
export const MAX_UPLOAD_PLAINTEXT_BYTES = MAX_SERVERLESS_CIPHERTEXT_BYTES - AES_GCM_TAG_BYTES;

export const MAX_UPLOAD_LABEL = "3 MB";
