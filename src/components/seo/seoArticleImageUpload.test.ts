import assert from "node:assert/strict";
import test from "node:test";
import {
  getSeoArticleImageValidationError,
  SEO_ARTICLE_DIRECT_UPLOAD_MAX_BYTES,
  shouldOptimizeSeoArticleImage,
} from "./seoArticleImageUpload.ts";

test("accepts a supported SEO image below the direct upload limit", () => {
  const file = {
    size: SEO_ARTICLE_DIRECT_UPLOAD_MAX_BYTES,
    type: "image/jpeg",
  };

  assert.equal(getSeoArticleImageValidationError(file), null);
  assert.equal(shouldOptimizeSeoArticleImage(file), false);
});

test("optimizes a large JPEG before building the multipart request", () => {
  const file = {
    size: SEO_ARTICLE_DIRECT_UPLOAD_MAX_BYTES + 1,
    type: "image/jpeg",
  };

  assert.equal(getSeoArticleImageValidationError(file), null);
  assert.equal(shouldOptimizeSeoArticleImage(file), true);
});

test("rejects an oversized GIF because client optimization would remove animation", () => {
  const file = {
    size: SEO_ARTICLE_DIRECT_UPLOAD_MAX_BYTES + 1,
    type: "image/gif",
  };

  assert.match(
    getSeoArticleImageValidationError(file) || "",
    /GIF.*quá lớn/i,
  );
});

test("rejects image formats that the PHP endpoint does not support", () => {
  const file = {
    size: 1024,
    type: "image/svg+xml",
  };

  assert.match(
    getSeoArticleImageValidationError(file) || "",
    /JPG, PNG, WEBP hoặc GIF/i,
  );
});
