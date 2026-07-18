import assert from "node:assert/strict";
import test from "node:test";
import { clearSeoArticleBlockImage } from "./articleBlocks.ts";

test("removing a block image keeps its written content intact", () => {
  const block = {
    id: "part-1",
    heading: "Không gian trải nghiệm",
    html: "<p>Nội dung phần vẫn được giữ nguyên.</p>",
    imageUrl: "/uploads/seo/part-1.webp",
    imageAlt: "Không gian tại Ông Quan Farm",
  };

  assert.deepEqual(clearSeoArticleBlockImage(block), {
    ...block,
    imageUrl: "",
    imageAlt: "",
  });
});
