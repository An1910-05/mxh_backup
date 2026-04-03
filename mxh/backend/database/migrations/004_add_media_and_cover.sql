USE mxh_social;

ALTER TABLE posts
    ADD COLUMN media_url VARCHAR(500) NULL AFTER content,
    ADD COLUMN media_type ENUM('image', 'video') NULL AFTER media_url;

ALTER TABLE profiles
    ADD COLUMN cover_photo VARCHAR(255) NULL AFTER avatar;
