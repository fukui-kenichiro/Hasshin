import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listSites } from "@/lib/data/store";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";
import { SiteConnectionsForm } from "@/components/settings/SiteConnectionsForm";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // WordPressのAPIキーはブラウザへ送らない（設定済みかどうかのみ渡す）。
  const sites = (await listSites()).map((site) => ({
    id: site.id,
    slug: site.slug,
    name: site.name,
    baseUrl: site.baseUrl,
    hasWpApiKey: !!site.wpApiKey,
  }));

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-hs-stone-300 bg-white px-8 py-5.5">
        <div className="text-[22px] font-bold text-hs-text">設定</div>
        <div className="mt-1 text-[13px] text-hs-text-secondary">
          ログイン情報と、WordPress連携（各サイトへの接続）を設定できます。
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-[15px] font-bold text-hs-text">アカウント設定</h2>
            <AccountSettingsForm user={user} />
          </section>
          <section>
            <h2 className="mb-1 text-[15px] font-bold text-hs-text">サイト接続設定（WordPress連携）</h2>
            <p className="mb-3 text-[12px] text-hs-text-secondary">
              各サイトのWordPressに「ハッシン連携」プラグインを導入し、その設定画面（設定 &gt;
              ハッシン連携）に表示される「受信先URL」と「APIキー」を、対応するサイトに入力してください。
              承認した記事は、ここで接続したサイトへ自動的に下書きとして送信されます。
            </p>
            <SiteConnectionsForm sites={sites} />
          </section>
        </div>
      </div>
    </div>
  );
}
