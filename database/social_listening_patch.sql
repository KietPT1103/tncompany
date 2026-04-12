CREATE TABLE IF NOT EXISTS social_listening_comments (
  id VARCHAR(64) PRIMARY KEY,
  platform VARCHAR(32) NOT NULL DEFAULT 'tiktok',
  comment_id VARCHAR(128) NOT NULL,
  video_id VARCHAR(128) NOT NULL,
  author_name VARCHAR(255) NULL,
  author_id VARCHAR(128) NULL,
  comment_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  parent_comment_id VARCHAR(128) NULL,
  platform_created_at DATETIME NULL,
  collected_at DATETIME NOT NULL,
  comment_date DATE NOT NULL,
  report_month CHAR(7) NOT NULL,
  like_count INT NOT NULL DEFAULT 0,
  raw_metadata LONGTEXT NULL,
  brand_group VARCHAR(50) NOT NULL DEFAULT 'unknown',
  brand_confidence DECIMAL(8,4) NOT NULL DEFAULT 0,
  brand_scores_json LONGTEXT NULL,
  matched_keywords_json LONGTEXT NULL,
  sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral',
  sentiment_score INT NOT NULL DEFAULT 0,
  topic_tags_json LONGTEXT NULL,
  processing_version VARCHAR(32) NOT NULL DEFAULT 'rule-v1',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_social_platform_comment (platform, comment_id),
  KEY idx_social_comment_date (comment_date),
  KEY idx_social_report_month (report_month),
  KEY idx_social_brand_date (brand_group, comment_date),
  KEY idx_social_sentiment_date (sentiment, comment_date),
  KEY idx_social_video (video_id)
);

CREATE TABLE IF NOT EXISTS social_listening_comment_topics (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  comment_row_id VARCHAR(64) NOT NULL,
  topic_tag VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_social_comment_topic (comment_row_id, topic_tag),
  KEY idx_social_topic_tag (topic_tag),
  CONSTRAINT fk_social_comment_topic_comment
    FOREIGN KEY (comment_row_id) REFERENCES social_listening_comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS social_listening_reports (
  id VARCHAR(64) PRIMARY KEY,
  platform VARCHAR(32) NOT NULL DEFAULT 'tiktok',
  report_month CHAR(7) NOT NULL,
  title VARCHAR(255) NOT NULL,
  total_comments INT NOT NULL DEFAULT 0,
  generated_at DATETIME NOT NULL,
  report_json LONGTEXT NOT NULL,
  summary_markdown LONGTEXT NULL,
  summary_html LONGTEXT NULL,
  detail_csv LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_social_report_month_platform (platform, report_month),
  KEY idx_social_report_generated (generated_at)
);
