/**
 * CSS-animated Facebook-style emoji reactions
 * Based on react-facebook-emoji (asfand-dev/react-facebook-emoji)
 * CSS extracted from the published bundle and adapted for React 18.
 */

const SIZE_SCALE = {
  xxs: 0.15, xs: 0.2, sm: 0.3, md: 0.5, lg: 0.7, xl: 1, xxl: 1.5, xxxl: 3,
};
const SIZE_MARGIN = {
  xxs: -51, xs: -47, sm: -42, md: -30, lg: -18, xl: 0, xxl: 30, xxxl: 120,
};

export default function FacebookEmoji({ type = 'like', size = 'md' }) {
  const scale = SIZE_SCALE[size] ?? 0.5;
  const margin = SIZE_MARGIN[size] ?? -30;
  const style = scale !== 1
    ? { transform: `scale(${scale})`, margin: `${margin}px` }
    : {};

  const cls = `zama-emoji emoji--${type}`;

  switch (type) {
    case 'like':
      return (
        <div className={cls} style={style}>
          <div className="emoji__hand">
            <div className="emoji__thumb" />
          </div>
        </div>
      );
    case 'love':
      return (
        <div className={cls} style={style}>
          <div className="emoji__heart" />
        </div>
      );
    case 'haha':
      return (
        <div className={cls} style={style}>
          <div className="emoji__face">
            <div className="emoji__eyes" />
            <div className="emoji__mouth">
              <div className="emoji__tongue" />
            </div>
          </div>
        </div>
      );
    case 'yay':
      return (
        <div className={cls} style={style}>
          <div className="emoji__face">
            <div className="emoji__eyebrows" />
            <div className="emoji__mouth" />
          </div>
        </div>
      );
    case 'wow':
      return (
        <div className={cls} style={style}>
          <div className="emoji__face">
            <div className="emoji__eyebrows" />
            <div className="emoji__eyes" />
            <div className="emoji__mouth" />
          </div>
        </div>
      );
    case 'sad':
      return (
        <div className={cls} style={style}>
          <div className="emoji__face">
            <div className="emoji__eyebrows" />
            <div className="emoji__eyes" />
            <div className="emoji__mouth" />
          </div>
        </div>
      );
    case 'angry':
      return (
        <div className={cls} style={style}>
          <div className="emoji__face">
            <div className="emoji__eyebrows" />
            <div className="emoji__eyes" />
            <div className="emoji__mouth" />
          </div>
        </div>
      );
    default:
      return null;
  }
}
