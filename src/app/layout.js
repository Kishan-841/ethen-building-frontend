import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "ISP Coverage",
  description: "Building feasibility and coverage management",
};

export const viewport = {
  themeColor: "#121b27", // tuned navy — oklch(19% 0.028 215)
};

// Runs before paint: applies the saved theme and sidebar width so the first
// frame is already correct (no light flash, no layout jump).
const bootScript = `(function(){try{
  var t = localStorage.getItem('theme');
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  var u = JSON.parse(localStorage.getItem('ui-prefs') || '{}');
  if (u.state && u.state.sidebarCollapsed) {
    document.documentElement.style.setProperty('--sidebar-w', '80px');
  }
} catch (e) {}})()`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        {children}
      </body>
    </html>
  );
}
