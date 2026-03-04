"use client";

import { useParams } from "next/navigation";
import { PollAdminWizard } from "@/features/poll-admin/components/poll-admin-wizard";

export default function AdminPollPage() {
  const { id } = useParams<{ id: string }>();

  return <PollAdminWizard pollId={id} />;
}
