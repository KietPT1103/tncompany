import { apiRequest } from "../lib/api";

const TARGET_STORE_BY_VENUE = {
  cafe: "cafe",
  hotpot: "hotpot",
  farm: "farm",
};

const RELATED_LABELS = ["Điểm nhấn", "Trải nghiệm", "Góc nhìn"];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripHtml(html) {
  const source = String(html || "");
  if (!source) {
    return "";
  }

  if (typeof document === "undefined") {
    return source.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = source;
  return normalizeText(container.textContent || container.innerText || "");
}

function parseHtmlContent(html) {
  const source = String(html || "");
  if (!source) {
    return { paragraphs: [], quote: "", images: [] };
  }

  if (typeof document === "undefined") {
    const fallbackText = stripHtml(source);
    return {
      paragraphs: fallbackText ? [fallbackText] : [],
      quote: "",
      images: [],
    };
  }

  const container = document.createElement("div");
  container.innerHTML = source;

  const paragraphs = Array.from(container.querySelectorAll("p, li"))
    .map((node) => normalizeText(node.textContent || ""))
    .filter(Boolean);

  if (!paragraphs.length) {
    const fallbackText = normalizeText(container.textContent || "");
    if (fallbackText) {
      paragraphs.push(fallbackText);
    }
  }

  const quote = normalizeText(container.querySelector("blockquote")?.textContent || "");
  const images = Array.from(container.querySelectorAll("img[src]"))
    .map((node) => ({
      url: normalizeText(node.getAttribute("src") || ""),
      alt: normalizeText(node.getAttribute("alt") || ""),
    }))
    .filter((item) => item.url);

  return { paragraphs, quote, images };
}

function pushUniqueText(list, value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return;
  }

  const exists = list.some((item) => item.toLowerCase() === normalized.toLowerCase());
  if (!exists) {
    list.push(normalized);
  }
}

function pushUniqueImage(list, image) {
  const url = normalizeText(image?.url);
  if (!url) {
    return;
  }

  const exists = list.some((item) => item.url === url);
  if (!exists) {
    list.push({
      url,
      alt: normalizeText(image?.alt),
    });
  }
}

function truncateText(value, limit = 140) {
  const normalized = normalizeText(value);
  if (!normalized || normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}

function splitSentences(value) {
  return (normalizeText(value).match(/[^.!?]+[.!?]?/g) || [])
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function buildDisplayDate(value, fallbackValue) {
  const source = normalizeText(value || fallbackValue);
  if (!source) {
    return "";
  }

  const normalized = source.includes("T") ? source : source.replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return fallbackValue || source;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");

  return `${day} Thg ${month}, ${parsed.getFullYear()}`;
}

function buildReadTime(article, fallbackValue) {
  const text = normalizeText(
    [
      article.metaDescription,
      article.excerpt,
      article.contentHtml,
      ...(Array.isArray(article.contentJson) ? article.contentJson.map((block) => block.html) : []),
    ]
      .map(stripHtml)
      .join(" ")
  );

  const wordCount = text ? text.split(" ").filter(Boolean).length : 0;
  if (!wordCount) {
    return fallbackValue;
  }

  return `${Math.max(1, Math.ceil(wordCount / 220))} phút đọc`;
}

function buildRelatedTitle(sourceText, articleTitle, activeVenue, index) {
  const firstSentence = splitSentences(sourceText)[0] || normalizeText(sourceText);
  if (firstSentence) {
    return truncateText(firstSentence, 78);
  }

  return `Khám phá thêm tại ${activeVenue.name || articleTitle || RELATED_LABELS[index]}`;
}

function findNextUnusedImage(imagePool, usedUrls) {
  return imagePool.find((item) => item.url && !usedUrls.has(item.url)) || null;
}

function buildQuote(article, sections, fallbackContent) {
  const explicitQuote = sections.find((section) => section.quote)?.quote;
  if (explicitQuote) {
    return explicitQuote;
  }

  const candidates = [
    article.metaDescription,
    article.excerpt,
    ...sections.flatMap((section) => section.paragraphs),
  ];

  for (const candidate of candidates) {
    const bestSentence =
      splitSentences(candidate).find((sentence) => sentence.length >= 55 && sentence.length <= 220) ||
      normalizeText(candidate);

    if (bestSentence) {
      return bestSentence;
    }
  }

  return fallbackContent.quote;
}

function buildRelatedItems({ sections, article, imagePool, usedUrls, fallbackContent, activeVenue }) {
  const items = [];

  sections.forEach((section) => {
    if (items.length >= 3) {
      return;
    }

    const sourceText =
      section.summary ||
      section.paragraphs[0] ||
      article.metaDescription ||
      article.excerpt ||
      fallbackContent.closing;

    const title = normalizeText(section.heading) || buildRelatedTitle(sourceText, article.title, activeVenue, items.length);
    if (!title) {
      return;
    }

    const image = section.image?.url && !usedUrls.has(section.image.url)
      ? section.image
      : findNextUnusedImage(imagePool, usedUrls);

    if (image?.url) {
      usedUrls.add(image.url);
    }

    items.push({
      label: RELATED_LABELS[items.length] || activeVenue.shortLabel,
      title,
      description: truncateText(sourceText, 116) || fallbackContent.relatedItems?.[items.length]?.description || "",
      image: image?.url || "",
      imageAlt: image?.alt || title,
    });
  });

  while (items.length < 3) {
    const seedText =
      sections[items.length]?.paragraphs?.[0] ||
      article.metaDescription ||
      article.excerpt ||
      fallbackContent.relatedItems?.[items.length]?.description ||
      fallbackContent.closing;

    const image = findNextUnusedImage(imagePool, usedUrls);
    if (image?.url) {
      usedUrls.add(image.url);
    }

    items.push({
      label: RELATED_LABELS[items.length] || activeVenue.shortLabel,
      title:
        fallbackContent.relatedItems?.[items.length]?.title ||
        buildRelatedTitle(seedText, article.title, activeVenue, items.length),
      description: truncateText(seedText, 116),
      image: image?.url || "",
      imageAlt: image?.alt || article.title,
    });
  }

  return items;
}

function buildArticleSections(article) {
  const blocks = Array.isArray(article.contentJson) ? article.contentJson : [];

  return blocks.map((block) => {
    const parsed = parseHtmlContent(block.html);
    const images = [];

    if (block.imageUrl) {
      pushUniqueImage(images, {
        url: block.imageUrl,
        alt: block.imageAlt || block.heading || article.title,
      });
    }

    parsed.images.forEach((image) => {
      pushUniqueImage(images, {
        url: image.url,
        alt: image.alt || block.imageAlt || block.heading || article.title,
      });
    });

    return {
      heading: normalizeText(block.heading),
      paragraphs: parsed.paragraphs,
      quote: parsed.quote,
      image: images[0] || null,
      images,
      summary: normalizeText(parsed.paragraphs.join(" ") || stripHtml(block.html)),
    };
  });
}

export async function getLatestVenueEditorialArticle(venueId) {
  const targetStore = TARGET_STORE_BY_VENUE[venueId];
  if (!targetStore) {
    return null;
  }

  const { item } = await apiRequest(
    `/venue-editorial.php?targetStore=${encodeURIComponent(targetStore)}`,
    { method: "GET" },
    false
  );

  return item || null;
}

export function mapSeoArticleToVenueContent(article, fallbackContent, activeVenue) {
  const sections = buildArticleSections(article);
  const imagePool = [];
  const allParagraphs = [];

  if (article.coverImageUrl) {
    pushUniqueImage(imagePool, {
      url: article.coverImageUrl,
      alt: article.title,
    });
  }

  sections.forEach((section) => {
    section.images.forEach((image) => pushUniqueImage(imagePool, image));
    section.paragraphs.forEach((paragraph) => pushUniqueText(allParagraphs, paragraph));
  });

  pushUniqueText(allParagraphs, article.metaDescription);
  pushUniqueText(allParagraphs, article.excerpt);

  const readableParagraphs = allParagraphs.filter((paragraph) => paragraph.length >= 40);
  const leadParagraphs = readableParagraphs.slice(0, 2);
  const quote = buildQuote(article, sections, fallbackContent);

  const heroImage = imagePool[0]?.url || "";
  const usedImageUrls = new Set(heroImage ? [heroImage] : []);
  const secondaryImage = findNextUnusedImage(imagePool, usedImageUrls);
  if (secondaryImage?.url) {
    usedImageUrls.add(secondaryImage.url);
  }

  return {
    ...fallbackContent,
    category: fallbackContent.category || activeVenue.shortLabel,
    title: normalizeText(article.title) || fallbackContent.title,
    author: fallbackContent.author || "Đội ngũ Ông Quan",
    displayDate: buildDisplayDate(article.publishedAt, fallbackContent.displayDate),
    readTime: buildReadTime(article, fallbackContent.readTime),
    heroImage,
    heroAlt: imagePool[0]?.alt || article.title || fallbackContent.heroAlt,
    paragraphs: leadParagraphs.length ? leadParagraphs : fallbackContent.paragraphs,
    quote,
    closing:
      readableParagraphs.slice(2).find((paragraph) => paragraph.length >= 55) ||
      truncateText(article.metaDescription || article.excerpt, 220) ||
      fallbackContent.closing,
    secondaryImage: secondaryImage?.url || "",
    secondaryImageAlt: secondaryImage?.alt || article.title || fallbackContent.secondaryImageAlt,
    sideCard: fallbackContent.sideCard,
    relatedItems: buildRelatedItems({
      sections,
      article,
      imagePool,
      usedUrls: usedImageUrls,
      fallbackContent,
      activeVenue,
    }),
    articlePublicPath: article.publicPath || "",
  };
}
