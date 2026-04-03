USE mxh_social;

ALTER TABLE posts
    ADD COLUMN media_width INT NULL AFTER media_type,
    ADD COLUMN media_height INT NULL AFTER media_width;
