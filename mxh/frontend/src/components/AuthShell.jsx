import { Link } from 'react-router-dom';

export default function AuthShell({ mode = 'login', headline, subcopy, children, footnote }) {
  return (
    <div className={`auth-page auth-page--${mode} fade-in`}>
      <div className="auth-shell">
        <section className="auth-brand-pane" aria-label="Giới thiệu iPock">
          <Link to="/" className="auth-wordmark">iPock</Link>
          <h1 className="auth-slogan">{headline}</h1>
          <p className="auth-subcopy">{subcopy}</p>
        </section>

        <section className="auth-card-pane">
          {children}
          {footnote ? <p className="auth-footnote">{footnote}</p> : null}
        </section>
      </div>
    </div>
  );
}
