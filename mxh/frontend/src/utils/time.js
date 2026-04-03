const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function timeAgo(dateStr) {
  if (!dateStr) return '';

  const utcDate = dateStr.endsWith('Z') ? new Date(dateStr) : new Date(dateStr + 'Z');
  const now = new Date();
  const diffMs = now - utcDate;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;

  return formatVNDate(utcDate);
}

export function timeAgoShort(dateStr) {
  if (!dateStr) return '';

  const utcDate = dateStr.endsWith('Z') ? new Date(dateStr) : new Date(dateStr + 'Z');
  const now = new Date();
  const diffMs = now - utcDate;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'vừa xong';
  if (diffMin < 60) return `${diffMin}ph`;
  if (diffHr < 24) return `${diffHr}h`;

  return formatVNDateShort(utcDate);
}

/** Ví dụ: "Tham gia tháng 11 năm 2020" — dùng header hồ sơ kiểu X */
export function formatJoinMonthYear(isoDateStr) {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr.endsWith('Z') ? isoDateStr : `${isoDateStr}Z`);
  const part = d.toLocaleDateString('vi-VN', {
    timeZone: VN_TIMEZONE,
    month: 'long',
    year: 'numeric',
  });
  return `Tham gia ${part}`;
}

export function formatVNDate(date) {
  return date.toLocaleString('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatVNDateShort(date) {
  return date.toLocaleDateString('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  });
}
