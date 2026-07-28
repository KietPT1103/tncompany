import assert from "node:assert/strict";
import test from "node:test";
import { getSeoArticleDisplayBlocks } from "./articleDisplayBlocks.ts";

test("keeps all five editor blocks in their original order", () => {
  const blocks = Array.from({ length: 5 }, (_, index) => ({
    id: `part-${index + 1}`,
    heading: `Phần ${index + 1}`,
    html: `<p>Nội dung ${index + 1}</p>`,
    imageUrl: index % 2 === 0 ? `/uploads/part-${index + 1}.jpg` : "",
    imageAlt: `Ảnh phần ${index + 1}`,
  }));

  const result = getSeoArticleDisplayBlocks(
    blocks,
    "<p>Nội dung fallback không được dùng</p>",
    "Mô tả fallback",
  );

  assert.equal(result.length, 5);
  assert.deepEqual(
    result.map((block) => block.heading),
    ["Phần 1", "Phần 2", "Phần 3", "Phần 4", "Phần 5"],
  );
  assert.equal(result[4].imageUrl, "/uploads/part-5.jpg");
});

test("uses legacy contentHtml only when structured blocks are unavailable", () => {
  const result = getSeoArticleDisplayBlocks(
    [],
    "<h2>Bài viết cũ</h2><p>Nội dung vẫn phải hiển thị.</p>",
    "",
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "legacy-content");
  assert.match(result[0].html, /Nội dung vẫn phải hiển thị/);
});

test("does not render empty editor blocks", () => {
  const result = getSeoArticleDisplayBlocks(
    [
      { id: "empty", heading: "", html: "", imageUrl: "", imageAlt: "" },
      {
        id: "content",
        heading: "Phần có nội dung",
        html: "<p>Chi tiết</p>",
        imageUrl: "",
        imageAlt: "",
      },
    ],
    "",
    "",
  );

  assert.deepEqual(result.map((block) => block.id), ["content"]);
});

test("sanitizes unsafe rich text before preview and public rendering", () => {
  const result = getSeoArticleDisplayBlocks(
    [
      {
        id: "unsafe",
        heading: "Nội dung an toàn",
        html: '<p onclick="alert(1)">Vẫn hiển thị</p><script>alert(2)</script><a href="javascript:alert(3)">Liên kết</a>',
        imageUrl: "",
        imageAlt: "",
      },
    ],
    "",
    "",
  );

  assert.match(result[0].html, /Vẫn hiển thị/);
  assert.doesNotMatch(result[0].html, /<script|onclick|javascript:/i);
});
