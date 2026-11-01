import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { DemoBadge } from "@/components/shared/demo-badge";
import { requirePageUser } from "@/lib/api/auth-guard";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your account · SolarX" };

export default async function AccountPage() {
  const { profile, email, vendor } = await requirePageUser("/account");

  return (
    <AppShell profile={profile}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Your account</h1>
          {profile.is_demo ? <DemoBadge /> : null}
        </div>

        <dl className="grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="break-all font-medium">{email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Account type</dt>
            <dd className="font-medium">{profile.role === "household" ? "Household" : "Vendor"}</dd>
          </div>
          {vendor ? (
            <div>
              <dt className="text-sm text-muted-foreground">Verification</dt>
              <dd className="font-medium">{vendor.verification_status === "demo" ? "Demo" : "Unverified"}</dd>
            </div>
          ) : null}
        </dl>

        <ProfileForm
          role={profile.role}
          initial={{
            name: profile.name,
            phone: profile.phone ?? "",
            company_name: vendor?.company_name ?? "",
            service_area: vendor?.service_area ?? "",
            service_radius_km: vendor ? String(vendor.service_radius_km) : "",
          }}
        />
      </div>
    </AppShell>
  );
}
