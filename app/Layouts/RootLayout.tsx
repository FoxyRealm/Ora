import AutoTablePagination from "../Components/AutoTablePagination";
import OverlayScrollLock from "../Components/OverlayScrollLock";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}<AutoTablePagination /><OverlayScrollLock /></body></html>;
}
