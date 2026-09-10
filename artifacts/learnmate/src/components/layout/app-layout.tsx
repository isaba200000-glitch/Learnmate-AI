import { ReactNode } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import BottomTabBar from "./bottom-tab-bar";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div
      className="flex h-[100dvh] w-full overflow-hidden bg-background relative touch-manipulation"
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="app-bg-blob-tl" aria-hidden="true" />
      <div className="app-bg-blob-br" aria-hidden="true" />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative z-10 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth overscroll-contain pb-20 lg:pb-0">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
        <BottomTabBar />
      </div>
    </div>
  );
}
