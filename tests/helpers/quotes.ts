// Helpers for quote integration tests: publish a request with the service role.
import { randomUUID } from "node:crypto";
import { adminClient } from "./supabase";

export async function createRequestWithStatus(userId: string, status: "draft" | "open" | "quoted" | "accepted" | "closed" = "open") {
  const id = randomUUID();
  const { error } = await adminClient()
    .from("household_requests")
    .insert({
      id,
      user_id: userId,
      latitude: 17.41,
      longitude: 78.44,
      address_text: "Plot 12, Road 3",
      locality: "Test Locality",
      monthly_units: 250,
      budget: 150000,
      roof_photo_path: `${userId}/${id}/a.jpg`,
      status,
    });
  if (error) throw new Error(`createRequestWithStatus failed: ${error.message}`);
  return id;
}

export async function requestStatus(id: string): Promise<string | undefined> {
  const { data } = await adminClient().from("household_requests").select("status").eq("id", id).maybeSingle();
  return data?.status;
}
