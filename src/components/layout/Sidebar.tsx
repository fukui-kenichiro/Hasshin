"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "確認待ちの記事" },
  { href: "/uploads", label: "PDFの取り込み" },
  { href: "/archive", label: "公開した記事" },
  { href: "/line", label: "LINE文案作成" },
  { href: "/glossary", label: "党内用語辞典" },
] as const;

export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen w-60 shrink-0 flex-col border-r border-hs-stone-300 bg-white">
      <div className="flex items-center gap-2.5 border-b border-hs-stone-300 px-5 py-6">
        <LogoMark />
        <div className="flex flex-col leading-tight">
          <span className="text-[17px] font-bold text-hs-text">ハッシン</span>
          <span className="text-[11px] text-hs-text-secondary">北多摩東部地区委員会 宣伝部</span>
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "rounded-md px-3 py-2.5 text-sm " +
                (active
                  ? "bg-hs-kitatama-bg font-bold text-hs-kitatama-text"
                  : "font-normal text-hs-stone-600 hover:bg-hs-stone-50")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-hs-stone-300 px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hs-stone-100 text-[13px] font-bold text-hs-stone-600">
          {userName[0]}
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-bold text-hs-text">{userName}</span>
          <div className="flex gap-2.5">
            <Link href="/settings" className="text-[12px] text-hs-text-secondary hover:text-hs-link">
              設定
            </Link>
            <button
              onClick={handleLogout}
              className="text-left text-[12px] text-hs-text-secondary hover:text-hs-link"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="4" fill="var(--color-hs-primary)" />
      <path d="M9 9 A 8 8 0 0 0 9 19" stroke="var(--color-hs-primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M19 9 A 8 8 0 0 1 19 19" stroke="var(--color-hs-primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M5.5 5.5 A 13 13 0 0 0 5.5 22.5" stroke="var(--color-hs-stone-400)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M22.5 5.5 A 13 13 0 0 1 22.5 22.5" stroke="var(--color-hs-stone-400)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
