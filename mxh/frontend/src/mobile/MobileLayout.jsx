import MobileHeader from './components/MobileHeader';
import MobileTabBar from './components/MobileTabBar';

export default function MobileLayout({ children }) {
  return (
    <div className="m-layout">
      <MobileHeader />
      <main className="m-content">{children}</main>
      <MobileTabBar />
    </div>
  );
}
