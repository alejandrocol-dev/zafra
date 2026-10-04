"use client";

import { AdminView } from "@/components/views/admin-view";
import { CertifierView } from "@/components/views/certifier-view";
import { InvestorView } from "@/components/views/investor-view";
import { OverviewView } from "@/components/views/overview-view";
import { ProducerView } from "@/components/views/producer-view";
import { useScrollTopOnChange, useView } from "@/lib/nav";

export default function Home() {
  const [view] = useView();
  useScrollTopOnChange(view);

  return (
    <div aria-live="polite">
      {view === "overview" && <OverviewView />}
      {view === "borrow" && <ProducerView />}
      {view === "earn" && <InvestorView />}
      {view === "certifier" && <CertifierView />}
      {view === "admin" && <AdminView />}
    </div>
  );
}
