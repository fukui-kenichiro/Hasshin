import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-hs-stone-300 bg-white px-8 py-5.5">
        <div className="text-[22px] font-bold text-hs-text">アカウント設定</div>
        <div className="mt-1 text-[13px] text-hs-text-secondary">
          ログイン用のメールアドレス・パスワード・表示名を変更できます。
        </div>
      </div>
      <div className="flex-1 overflow-auto px-8 py-7">
        <AccountSettingsForm user={user} />
      </div>
    </div>
  );
}
