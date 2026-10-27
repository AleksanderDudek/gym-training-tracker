/**
 * The image model that recognises a dish on a meal photo, on the phone: the image half of Google's
 * SigLIP 2 base/16 at 224 px (Apache-2.0), 4-bit weights with fp16 for the rest, as exported for
 * ONNX Runtime by onnx-community. Chosen by measurement (`docs/research/zdjecie-posilku-modele.md`):
 * among models a phone tab can hold (≈ 0.6 GB while it reads), it is the most accurate one whose
 * licence allows shipping it in an app — MobileCLIP-B scored a little higher, but Apple licenses
 * its weights for research only.
 *
 * The file is not in git: `vite/photoModel.ts` downloads this exact revision once, checks its
 * SHA-256 and serves it at `models/<dir>/vision.onnx` (the version is in the path, so the name stays
 * fixed). The text half never ships — `npm run food:dish-embeddings` turns the dish phrases into
 * vectors at build time.
 */
export const PHOTO_MODEL = {
  repo: 'onnx-community/siglip2-base-patch16-224-ONNX',
  revision: 'ba1f3b0843f24bc5417d38e19c37b287d719b2f4',
  file: 'onnx/vision_model_q4f16.onnx',
  bytes: 54_630_849,
  sha256: 'a0740d409b91ba59c273efa530b238efcf603fd968c7940bf313f071a5de27ed',
  /** Where the app serves it, relative to the page. */
  dir: 'models/siglip2-b16-q4f16-ba1f3b0',
  /** SigLIP squashes the photo to a square without cropping, then maps 0–255 to −1…1. */
  size: 224,
  /** The model's learned logit scale; softmax over dishes at this temperature reads as a probability. */
  logitScale: 112.67,
} as const;

/** What a phrase is wrapped in before it is embedded; the best of the templates measured for SigLIP 2. */
export const promptOf = (phrase: string) => `a photo of ${phrase}.`;
