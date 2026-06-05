import { API_ORIGIN } from '../config';

function getMediaUrl(mediaUrl) {
  if (!mediaUrl) return null;
  if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl;
  return `${API_ORIGIN}${mediaUrl}`;
}

function getRatioStyle(comment) {
  const width = Number(comment?.media_width);
  const height = Number(comment?.media_height);
  if (!width || !height || width <= 0 || height <= 0) return null;
  return { aspectRatio: `${width} / ${height}` };
}

export default function CommentMediaAttachment({ comment, onOpen }) {
  if (!comment?.media_url || !comment?.media_type || !onOpen) return null;

  const mediaUrl = getMediaUrl(comment.media_url);
  const isVideo = comment.media_type === 'video';
  const ratioStyle = getRatioStyle(comment);

  if (!mediaUrl) return null;

  return (
    <button
      type="button"
      className={`comment-media-button${isVideo ? ' comment-media-button--video' : ''}`}
      onClick={onOpen}
      aria-label={isVideo ? 'Xem video bình luận' : 'Xem ảnh bình luận'}
    >
      {isVideo ? (
        <span className="comment-media-video" style={ratioStyle || undefined}>
          <video
            src={mediaUrl}
            className="comment-media-video-preview"
            muted
            playsInline
            preload="metadata"
          />
          <span className="comment-media-video-scrim" aria-hidden="true" />
          <span className="comment-media-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      ) : (
        <img
          src={mediaUrl}
          alt=""
          className="comment-media-thumb"
          loading="lazy"
          draggable={false}
        />
      )}

      <span className="comment-media-open-chip">
        {isVideo ? 'Video' : 'Ảnh'}
      </span>
    </button>
  );
}
